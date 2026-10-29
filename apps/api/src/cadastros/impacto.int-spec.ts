import { type ImpactoEmUso, type Problema } from '@filas/contracts';
import { type PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  criarAppIntegracao,
  entrarComPermissoes,
  type SessaoDeTeste,
  UNIDADE_PADRAO,
} from '../common/testing/app-integracao';
import { type AppDeTeste } from '../common/testing/criar-app-de-teste';
import { CadastrosModule } from './cadastros.module';

type Contexto = AppDeTeste & { prisma: PrismaClient };

let contexto: Contexto;
let admin: SessaoDeTeste;
let pacienteId: string;
let seq = 0;
const unico = (base: string) => `${base} ${Date.now()}-${++seq}`;
const corpo = <T>(resposta: request.Response) => resposta.body as T;
const api = (metodo: 'put' | 'patch', caminho: string) => {
  const cliente = request(contexto.servidor);
  const req =
    metodo === 'put' ? cliente.put(`/api/v1/${caminho}`) : cliente.patch(`/api/v1/${caminho}`);
  return req.set('Authorization', `Bearer ${admin.token}`);
};

async function cenario() {
  const recurso = await contexto.prisma.recurso.create({ data: { nome: unico('Maca') } });
  const especialidade = await contexto.prisma.especialidade.create({
    data: {
      nome: unico('Impacto'),
      unidadeId: UNIDADE_PADRAO,
      exigeSupervisaoDocente: true,
      filas: { create: { unidadeId: UNIDADE_PADRAO, nome: 'X', letraSenha: 'X' } },
    },
    include: { filas: true },
  });
  const habilitacao = await contexto.prisma.habilitacao.create({ data: { nome: unico('Hab') } });
  const procedimento = await contexto.prisma.procedimento.create({ data: { nome: unico('Proc') } });
  const estudante = await contexto.prisma.estudante.create({
    data: {
      nome: unico('Estudante'),
      especialidadeId: especialidade.id,
      nivelFormacao: '7º período',
      habilitacoes: { create: { habilitacaoId: habilitacao.id } },
      procedimentos: { create: { procedimentoId: procedimento.id } },
      disponibilidades: { create: { diaSemana: 'SEGUNDA', turno: 'MANHA' } },
    },
  });
  const supervisor = await contexto.prisma.supervisor.create({
    data: {
      nome: unico('Prof.'),
      limiteEstudantesSimultaneos: 3,
      especialidades: { create: { especialidadeId: especialidade.id } },
    },
  });
  const sala = await contexto.prisma.sala.create({
    data: {
      identificacao: unico('Sala'),
      unidadeId: UNIDADE_PADRAO,
      recursos: { create: { recursoId: recurso.id } },
    },
  });
  return { recurso, especialidade, habilitacao, procedimento, estudante, supervisor, sala };
}

async function alocar(c: Awaited<ReturnType<typeof cenario>>) {
  const triagem = await contexto.prisma.triagem.create({
    data: {
      pacienteId,
      profissionalId: admin.usuarioId,
      especialidadeDestinoId: c.especialidade.id,
      tipoAtendimento: 'PRIMEIRA_CONSULTA',
      prioridade: 'NORMAL',
      motivo: 'Motivo ficticio',
    },
  });
  const senha = await contexto.prisma.senha.create({
    data: {
      numero: `X${String(++seq % 1000).padStart(3, '0')}`,
      filaId: c.especialidade.filas[0]!.id,
      triagemId: triagem.id,
      pacienteId,
      prioridade: 'NORMAL',
      tipoAtendimento: 'PRIMEIRA_CONSULTA',
      status: 'CHAMADA',
    },
  });
  await contexto.prisma.alocacao.create({
    data: {
      senhaId: senha.id,
      estudanteId: c.estudante.id,
      supervisorId: c.supervisor.id,
      salaId: c.sala.id,
      confirmadaPor: admin.usuarioId,
    },
  });
  return senha.numero;
}

const entradaEstudante = (
  c: Awaited<ReturnType<typeof cenario>>,
  dados: Record<string, unknown> = {},
) => ({
  nome: c.estudante.nome,
  especialidadeId: c.especialidade.id,
  nivelFormacao: '7º período',
  habilitacoesIds: [c.habilitacao.id],
  procedimentosIds: [c.procedimento.id],
  disponibilidade: [{ diaSemana: 1, turno: 'MANHA' }],
  ...dados,
});

const impacto = (resposta: request.Response) =>
  corpo<Problema & { impacto: ImpactoEmUso }>(resposta);

describe('confirmação de mudança em cadastro em uso (#79, T-04)', () => {
  beforeAll(async () => {
    contexto = await criarAppIntegracao({ imports: [CadastrosModule] });
    admin = await entrarComPermissoes(contexto, ['cadastros:consultar', 'cadastros:editar']);
    pacienteId = (
      await contexto.prisma.paciente.create({
        data: {
          nomeCompleto: unico('Paciente Impacto'),
          documento: `${Date.now()}${++seq}`.slice(-11),
          dataNascimento: new Date('1977-01-01'),
          vinculo: 'EXTERNO',
          unidadeId: UNIDADE_PADRAO,
        },
      })
    ).id;
  });

  afterAll(async () => {
    await contexto.app.close();
    await contexto.prisma.$disconnect();
  });

  it('RN-05 estudante alocado: mudar a disponibilidade pede confirmação e nada é gravado antes', async () => {
    const c = await cenario();
    const numero = await alocar(c);
    const entrada = entradaEstudante(c, { disponibilidade: [{ diaSemana: 2, turno: 'TARDE' }] });

    const recusa = await api('put', `estudantes/${c.estudante.id}`).send(entrada).expect(409);

    expect(impacto(recusa)).toMatchObject({
      codigo: 'IMPACTO_EM_USO',
      impacto: { campos: ['disponibilidade'] },
    });
    expect(impacto(recusa).impacto.emUso).toContain(numero);
    expect(
      await contexto.prisma.estudanteDisponibilidade.findMany({
        where: { estudanteId: c.estudante.id },
      }),
    ).toEqual([expect.objectContaining({ diaSemana: 'SEGUNDA', turno: 'MANHA' })]);

    await api('put', `estudantes/${c.estudante.id}?confirmar=true`).send(entrada).expect(200);
  });

  it('campo que não afeta alocação, ou registro sem uso, grava direto', async () => {
    const emUso = await cenario();
    await alocar(emUso);
    const livre = await cenario();

    await api('put', `estudantes/${emUso.estudante.id}`)
      .send(entradaEstudante(emUso, { nome: unico('Novo nome') }))
      .expect(200);
    await api('put', `estudantes/${livre.estudante.id}`)
      .send(entradaEstudante(livre, { nivelFormacao: '8º período' }))
      .expect(200);
  });

  it('RN-09 sala ocupada: trocar recursos ou inativar pede confirmação; características não', async () => {
    const c = await cenario();
    await alocar(c);
    const outro = await contexto.prisma.recurso.create({ data: { nome: unico('Biombo') } });
    const base = { identificacao: c.sala.identificacao, situacao: 'DISPONIVEL' };

    const recursos = await api('put', `salas/${c.sala.id}`)
      .send({ ...base, recursosIds: [outro.id] })
      .expect(409);
    await api('put', `salas/${c.sala.id}`)
      .send({ ...base, recursosIds: [c.recurso.id], caracteristicas: 'Janela ampla' })
      .expect(200);
    const inativar = await api('patch', `salas/${c.sala.id}`).send({ ativo: false }).expect(409);
    await api('patch', `salas/${c.sala.id}?confirmar=true`).send({ ativo: false }).expect(200);

    expect(impacto(recursos).impacto.campos).toEqual(['recursos']);
    expect(impacto(inativar).impacto.campos).toEqual(['ativo']);
  });

  it('RN-08 supervisor alocado: mudar o limite pede confirmação', async () => {
    const c = await cenario();
    await alocar(c);

    const resposta = await api('put', `supervisores/${c.supervisor.id}`)
      .send({
        nome: c.supervisor.nome,
        especialidadesIds: [c.especialidade.id],
        limiteEstudantesSimultaneos: 1,
      })
      .expect(409);

    expect(impacto(resposta).impacto.campos).toEqual(['limiteEstudantesSimultaneos']);
  });

  it('RN-07 especialidade com senha em curso: exigir supervisão pede confirmação; a validação não', async () => {
    const c = await cenario();
    await alocar(c);
    const base = {
      nome: c.especialidade.nome,
      exigeSupervisaoDocente: true,
      exigeValidacaoEncerramento: false,
      recursosExigidosIds: [],
    };

    const supervisao = await api('put', `especialidades/${c.especialidade.id}`)
      .send({ ...base, exigeSupervisaoDocente: false })
      .expect(409);
    await api('put', `especialidades/${c.especialidade.id}`)
      .send({ ...base, exigeValidacaoEncerramento: true })
      .expect(200);

    expect(impacto(supervisao).impacto.campos).toEqual(['exigeSupervisaoDocente']);
  });
});
