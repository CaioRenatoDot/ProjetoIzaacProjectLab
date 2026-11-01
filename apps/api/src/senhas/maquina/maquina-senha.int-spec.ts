import { type PrismaClient, type StatusSenha } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { EventosDominio, EventosDominioModule } from '../../common/eventos/eventos-dominio';
import { type ErroDominio } from '../../common/errors/erro-dominio';
import { criarAppIntegracao, UNIDADE_PADRAO } from '../../common/testing/app-integracao';
import { type AppDeTeste } from '../../common/testing/criar-app-de-teste';
import { PrismaService } from '../../prisma/prisma.service';
import { SenhasModule } from '../senhas.module';
import { MaquinaSenha, type PedidoTransicao } from './maquina-senha.service';

type Contexto = AppDeTeste & { prisma: PrismaClient };

let contexto: Contexto;
let maquina: MaquinaSenha;
let filaId: string;
let triagemId: string;
let pacienteId: string;
let seq = 0;
const unico = (base: string) => `${base} ${Date.now()}-${++seq}`;

const novaSenha = async (status: StatusSenha = 'AGUARDANDO') =>
  contexto.prisma.senha.create({
    data: {
      numero: `M${String(++seq % 1000).padStart(3, '0')}`,
      filaId,
      triagemId,
      pacienteId,
      prioridade: 'NORMAL',
      tipoAtendimento: 'PRIMEIRA_CONSULTA',
      status,
    },
  });

const transicionar = (pedido: Omit<PedidoTransicao, 'unidadeId'>) =>
  contexto.app
    .get(PrismaService)
    .$transaction((tx) => maquina.transicionar(tx, { ...pedido, unidadeId: UNIDADE_PADRAO }));

const erroDe = async (promessa: Promise<unknown>) =>
  (await promessa.catch((e: unknown) => e)) as ErroDominio;

describe('máquina de estados da senha no banco (#17)', () => {
  beforeAll(async () => {
    contexto = await criarAppIntegracao({ imports: [EventosDominioModule, SenhasModule] });
    maquina = contexto.app.get(MaquinaSenha);
    const perfil = await contexto.prisma.perfil.create({ data: { nome: unico('Perfil 6.1') } });
    const usuario = await contexto.prisma.usuario.create({
      data: {
        nome: 'Usuario 6.1',
        identificacao: `${unico('maquina').replace(/\W/g, '')}@clinica.invalid`,
        senhaHash: 'hash-ficticio',
        perfilId: perfil.id,
        unidadeId: UNIDADE_PADRAO,
      },
    });
    pacienteId = (
      await contexto.prisma.paciente.create({
        data: {
          nomeCompleto: unico('Paciente Maquina'),
          documento: `${Date.now()}${++seq}`.slice(-11),
          dataNascimento: new Date('1985-01-01'),
          vinculo: 'EXTERNO',
          unidadeId: UNIDADE_PADRAO,
        },
      })
    ).id;
    const especialidade = await contexto.prisma.especialidade.create({
      data: {
        nome: unico('Maquina'),
        unidadeId: UNIDADE_PADRAO,
        filas: { create: { unidadeId: UNIDADE_PADRAO, nome: 'M', letraSenha: 'M' } },
      },
      include: { filas: true },
    });
    filaId = especialidade.filas[0]!.id;
    triagemId = (
      await contexto.prisma.triagem.create({
        data: {
          pacienteId,
          profissionalId: usuario.id,
          especialidadeDestinoId: especialidade.id,
          tipoAtendimento: 'PRIMEIRA_CONSULTA',
          prioridade: 'NORMAL',
          motivo: 'Motivo ficticio',
        },
      })
    ).id;
  });

  afterAll(async () => {
    await contexto.app.close();
    await contexto.prisma.$disconnect();
  });

  it('chamar grava horários, tolerância do parâmetro e incrementa a versão', async () => {
    const senha = await novaSenha();
    const agora = new Date('2026-10-25T13:00:00Z');

    const mudanca = await transicionar({ senhaId: senha.id, versao: 1, para: 'CHAMADA', agora });

    expect(mudanca).toEqual({
      senhaId: senha.id,
      filaId,
      statusAnterior: 'AGUARDANDO',
      status: 'CHAMADA',
      versao: 2,
    });
    expect(await contexto.prisma.senha.findUnique({ where: { id: senha.id } })).toMatchObject({
      status: 'CHAMADA',
      versao: 2,
      chamadaEm: agora,
      toleranciaAte: new Date('2026-10-25T13:05:00Z'),
    });
  });

  it('AGUARDANDO direto para EM_ATENDIMENTO recebe TRANSICAO_INVALIDA', async () => {
    const senha = await novaSenha();

    const erro = await erroDe(
      transicionar({ senhaId: senha.id, versao: 1, para: 'EM_ATENDIMENTO' }),
    );

    expect(erro).toMatchObject({ codigo: 'TRANSICAO_INVALIDA', status: 409 });
  });

  it('UC-17 desistência de senha CHAMADA recebe TRANSICAO_INVALIDA', async () => {
    const senha = await novaSenha('CHAMADA');

    expect(
      (await erroDe(transicionar({ senhaId: senha.id, versao: 1, para: 'DESISTENCIA' }))).codigo,
    ).toBe('TRANSICAO_INVALIDA');
  });

  it('duas atualizações com a mesma versão: a segunda recebe VERSAO_DESATUALIZADA', async () => {
    const senha = await novaSenha();

    const resultados = await Promise.allSettled([
      transicionar({ senhaId: senha.id, versao: 1, para: 'CHAMADA' }),
      transicionar({ senhaId: senha.id, versao: 1, para: 'DESISTENCIA' }),
    ]);

    const recusas = resultados.filter((r) => r.status === 'rejected');
    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(recusas).toHaveLength(1);
    expect((recusas[0] as PromiseRejectedResult).reason).toMatchObject({
      codigo: 'VERSAO_DESATUALIZADA',
      extras: { atual: { id: senha.id, versao: 2 } },
    });
  });

  it('a transação de quem chama desfaz a mudança se algo falhar depois', async () => {
    const senha = await novaSenha();

    await expect(
      contexto.app.get(PrismaService).$transaction(async (tx) => {
        await maquina.transicionar(tx, {
          senhaId: senha.id,
          unidadeId: UNIDADE_PADRAO,
          versao: 1,
          para: 'CHAMADA',
        });
        throw new Error('efeito colateral falhou');
      }),
    ).rejects.toThrow('efeito colateral falhou');

    expect(await contexto.prisma.senha.findUnique({ where: { id: senha.id } })).toMatchObject({
      status: 'AGUARDANDO',
      versao: 1,
    });
  });

  it('publicar entrega senha.status_alterado', async () => {
    const senha = await novaSenha();
    const ouvinte = vi.fn();
    const cancelar = contexto.app.get(EventosDominio).assinar('senha.status_alterado', ouvinte);

    maquina.publicar(await transicionar({ senhaId: senha.id, versao: 1, para: 'CHAMADA' }));
    cancelar();

    expect(ouvinte).toHaveBeenCalledWith(
      expect.objectContaining({ senhaId: senha.id, status: 'CHAMADA', versao: 2 }),
    );
  });

  it('senha de outra unidade não é encontrada', async () => {
    const senha = await novaSenha();

    const erro = await erroDe(
      contexto.app.get(PrismaService).$transaction((tx) =>
        maquina.transicionar(tx, {
          senhaId: senha.id,
          unidadeId: '0190a000-0000-7000-8000-0000000000ee',
          versao: 1,
          para: 'CHAMADA',
        }),
      ),
    );

    expect(erro.codigo).toBe('NAO_ENCONTRADO');
  });
});
