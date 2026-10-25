import { type Problema, type ProblemaValidacao, type RegistroAusencia } from '@filas/contracts';
import { type PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { EventosDominio, EventosDominioModule } from '../common/eventos/eventos-dominio';
import { Relogio, RelogioModule } from '../common/relogio';
import {
  criarAppIntegracao,
  entrarComPermissoes,
  type SessaoDeTeste,
  UNIDADE_PADRAO,
} from '../common/testing/app-integracao';
import { type AppDeTeste } from '../common/testing/criar-app-de-teste';
import { AusenciasModule } from './ausencias.module';
import { AusenciasService } from './ausencias.service';

type Contexto = AppDeTeste & { prisma: PrismaClient };

let contexto: Contexto;
let recepcao: SessaoDeTeste;
let especialidadeId: string;
let filaId: string;
/** Bem à frente do relógio real: toda tolerância gravada nos testes já venceu. */
const agora = new Date(Date.now() + 2 * 86_400_000);
let seq = 0;
const unico = (base: string) => `${base} ${Date.now()}-${++seq}`;
const corpo = <T>(resposta: request.Response) => resposta.body as T;

const novoPaciente = async () =>
  (
    await contexto.prisma.paciente.create({
      data: {
        nomeCompleto: unico('Paulo Reis'),
        documento: `${Date.now()}${++seq}`.slice(-11),
        dataNascimento: new Date('1988-01-01'),
        vinculo: 'EXTERNO',
        unidadeId: UNIDADE_PADRAO,
      },
    })
  ).id;

async function senhaChamada(pacienteId: string, toleranciaAte: Date, chegadaEm?: Date) {
  const triagem = await contexto.prisma.triagem.create({
    data: {
      pacienteId,
      profissionalId: recepcao.usuarioId,
      especialidadeDestinoId: especialidadeId,
      tipoAtendimento: 'PRIMEIRA_CONSULTA',
      prioridade: 'NORMAL',
      motivo: 'Motivo ficticio',
    },
  });
  return contexto.prisma.senha.create({
    data: {
      numero: `U${String(++seq % 1000).padStart(3, '0')}`,
      filaId,
      triagemId: triagem.id,
      pacienteId,
      prioridade: 'NORMAL',
      tipoAtendimento: 'PRIMEIRA_CONSULTA',
      status: 'CHAMADA',
      chamadaEm: new Date(toleranciaAte.getTime() - 5 * 60_000),
      toleranciaAte,
      ...(chegadaEm ? { chegadaEm } : {}),
    },
  });
}

const ausentar = (senhaId: string, dados: Record<string, unknown> = {}) =>
  request(contexto.servidor)
    .post(`/api/v1/senhas/${senhaId}/ausencia`)
    .set('Authorization', `Bearer ${recepcao.token}`)
    .send({ versao: 1, ...dados });

/** Roda a rotina até não sobrar senha vencida (o banco de teste acumula senhas de outras suítes). */
async function rodarRotina() {
  const servico = contexto.app.get(AusenciasService);
  while ((await servico.processarToleranciasVencidas()) > 0);
}

describe('tolerância, ausência e reincidência (#24)', () => {
  beforeAll(async () => {
    contexto = await criarAppIntegracao({
      imports: [EventosDominioModule, RelogioModule, AusenciasModule],
    });
    vi.spyOn(contexto.app.get(Relogio), 'agora').mockImplementation(() => agora);
    recepcao = await entrarComPermissoes(contexto, ['ausencia:criar']);
    const especialidade = await contexto.prisma.especialidade.create({
      data: {
        nome: unico('Ausencias'),
        unidadeId: UNIDADE_PADRAO,
        filas: { create: { unidadeId: UNIDADE_PADRAO, nome: 'U', letraSenha: 'U' } },
      },
      include: { filas: true },
    });
    especialidadeId = especialidade.id;
    filaId = especialidade.filas[0]!.id;
  });

  afterAll(async () => {
    await contexto.app.close();
    await contexto.prisma.$disconnect();
  });

  describe('ausência manual (UC-16)', () => {
    it('antes do fim da tolerância exige confirmação; confirmada, registra e libera recursos', async () => {
      const senha = await senhaChamada(await novoPaciente(), new Date(agora.getTime() + 60_000));
      await contexto.prisma.alocacao.create({
        data: {
          senhaId: senha.id,
          estudanteId: (
            await contexto.prisma.estudante.create({
              data: { nome: unico('Estudante'), especialidadeId, nivelFormacao: '5º' },
            })
          ).id,
          salaId: (
            await contexto.prisma.sala.create({
              data: { identificacao: unico('Sala'), unidadeId: UNIDADE_PADRAO },
            })
          ).id,
          confirmadaPor: recepcao.usuarioId,
        },
      });

      const semConfirmar = await ausentar(senha.id).expect(422);
      const registro = corpo<RegistroAusencia>(
        await ausentar(senha.id, {
          confirmadoAntesDaTolerancia: true,
          observacao: 'Nao respondeu',
        }).expect(200),
      );

      expect(corpo<ProblemaValidacao>(semConfirmar).campos[0]?.campo).toBe(
        'confirmadoAntesDaTolerancia',
      );
      expect(registro).toMatchObject({
        senha: { status: 'AUSENTE' },
        automatica: false,
        recursosLiberados: true,
        restricaoAplicada: null,
      });
      expect(
        await contexto.prisma.ausencia.findFirst({ where: { senhaId: senha.id } }),
      ).toMatchObject({
        automatica: false,
        observacao: 'Nao respondeu',
        registradoPor: recepcao.usuarioId,
      });
    });

    it('senha fora de CHAMADA recebe TRANSICAO_INVALIDA', async () => {
      const senha = await senhaChamada(await novoPaciente(), new Date(agora.getTime() - 60_000));
      await contexto.prisma.senha.update({
        where: { id: senha.id },
        data: { status: 'AGUARDANDO' },
      });

      expect(corpo<Problema>(await ausentar(senha.id).expect(409)).codigo).toBe(
        'TRANSICAO_INVALIDA',
      );
    });
  });

  describe('rotina de tolerância (RN-12)', () => {
    it('RN-12 primeira expiração devolve à fila com a chegada original; a segunda vira ausência automática', async () => {
      const chegada = new Date('2026-10-20T09:00:00Z');
      const senha = await senhaChamada(
        await novoPaciente(),
        new Date(agora.getTime() - 60_000),
        chegada,
      );
      const ouvinte = vi.fn();
      const cancelar = contexto.app.get(EventosDominio).assinar('ausencia.registrada', ouvinte);

      await rodarRotina();
      const devolvida = await contexto.prisma.senha.findUniqueOrThrow({ where: { id: senha.id } });
      expect(devolvida).toMatchObject({
        status: 'AGUARDANDO',
        retornosTolerancia: 1,
        chegadaEm: chegada,
        chamadaEm: null,
        toleranciaAte: null,
      });
      expect(await contexto.prisma.ausencia.count({ where: { senhaId: senha.id } })).toBe(0);

      // Chamada de novo, e a tolerância vence outra vez.
      await contexto.prisma.senha.update({
        where: { id: senha.id },
        data: { status: 'CHAMADA', toleranciaAte: new Date(agora.getTime() - 60_000) },
      });
      await rodarRotina();
      cancelar();

      expect(
        await contexto.prisma.senha.findUniqueOrThrow({ where: { id: senha.id } }),
      ).toMatchObject({
        status: 'AUSENTE',
      });
      expect(
        await contexto.prisma.ausencia.findFirst({ where: { senhaId: senha.id } }),
      ).toMatchObject({
        automatica: true,
        registradoPor: null,
      });
      expect(ouvinte).toHaveBeenCalledWith(
        expect.objectContaining({
          automatica: true,
          senha: expect.objectContaining({ id: senha.id }) as unknown,
        }),
      );
    });

    it('RN-12 tolerância ainda no prazo não é tocada', async () => {
      const senha = await senhaChamada(
        await novoPaciente(),
        new Date(agora.getTime() + 10 * 60_000),
      );

      await rodarRotina();

      expect(
        (await contexto.prisma.senha.findUniqueOrThrow({ where: { id: senha.id } })).status,
      ).toBe('CHAMADA');
    });
  });

  it('RN-13 a terceira ausência na janela aplica restrição temporária até hoje + janela', async () => {
    const pacienteId = await novoPaciente();
    const registros: RegistroAusencia[] = [];
    for (let i = 0; i < 3; i += 1) {
      const senha = await senhaChamada(pacienteId, new Date(agora.getTime() - 60_000));
      registros.push(corpo<RegistroAusencia>(await ausentar(senha.id).expect(200)));
    }

    expect(registros.slice(0, 2).map((r) => r.restricaoAplicada)).toEqual([null, null]);
    const restricao = registros[2]!.restricaoAplicada!;
    expect(restricao.tipo).toBe('RESTRICAO_TEMPORARIA');
    const esperado = new Date(agora.getTime() + 90 * 86_400_000);
    expect(Math.abs(Date.parse(restricao.ate!) - esperado.getTime())).toBeLessThan(2 * 86_400_000);
    expect(
      await contexto.prisma.paciente.findUniqueOrThrow({ where: { id: pacienteId } }),
    ).toMatchObject({
      restricaoAtiva: true,
    });
  });

  it('versão desatualizada recebe VERSAO_DESATUALIZADA', async () => {
    const senha = await senhaChamada(await novoPaciente(), new Date(agora.getTime() - 60_000));

    expect(corpo<Problema>(await ausentar(senha.id, { versao: 9 }).expect(409)).codigo).toBe(
      'VERSAO_DESATUALIZADA',
    );
  });
});
