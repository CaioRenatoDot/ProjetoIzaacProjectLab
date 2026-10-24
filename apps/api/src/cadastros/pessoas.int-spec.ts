import {
  type Estudante,
  type Paciente,
  type PacienteDetalhe,
  type Problema,
  type RespostaPaginada,
  type Supervisor,
} from '@filas/contracts';
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
let especialidadeId: string;
let habilitacaoId: string;
let procedimentoId: string;
let seq = 0;
const unico = (base: string) => `${base} ${Date.now()}-${++seq}`;
const documentoUnico = () => `${Date.now()}${++seq}`.slice(-11);
const corpo = <T>(resposta: request.Response) => resposta.body as T;
const api = () => request(contexto.servidor);
const comToken = (req: request.Test) => req.set('Authorization', `Bearer ${admin.token}`);

const novoPaciente = (dados: Record<string, unknown> = {}) =>
  comToken(api().post('/api/v1/pacientes')).send({
    nomeCompleto: unico('Maria Aparecida da Silva'),
    documento: documentoUnico(),
    dataNascimento: '1950-03-10',
    vinculo: 'EXTERNO',
    ...dados,
  });

const novoEstudante = (dados: Record<string, unknown> = {}) =>
  comToken(api().post('/api/v1/estudantes')).send({
    nome: unico('Estudante Ficticio'),
    especialidadeId,
    nivelFormacao: '7º período',
    habilitacoesIds: [habilitacaoId],
    procedimentosIds: [procedimentoId],
    disponibilidade: [{ diaSemana: 1, turno: 'MANHA' }],
    ...dados,
  });

describe('cadastros de paciente, estudante e supervisor (#14)', () => {
  beforeAll(async () => {
    contexto = await criarAppIntegracao({ imports: [CadastrosModule] });
    admin = await entrarComPermissoes(contexto, [
      'cadastros:consultar',
      'cadastros:criar',
      'cadastros:editar',
      'cadastros:excluir',
    ]);
    especialidadeId = (
      await contexto.prisma.especialidade.create({
        data: { nome: unico('Odontologia'), unidadeId: UNIDADE_PADRAO },
      })
    ).id;
    habilitacaoId = (await contexto.prisma.habilitacao.create({ data: { nome: unico('Raio X') } }))
      .id;
    procedimentoId = (
      await contexto.prisma.procedimento.create({ data: { nome: unico('Profilaxia') } })
    ).id;
  });

  afterAll(async () => {
    await contexto.app.close();
    await contexto.prisma.$disconnect();
  });

  describe('pacientes (Tabela 1)', () => {
    it('cadastra com documento só em dígitos e iniciais calculadas no servidor', async () => {
      const resposta = await novoPaciente({
        nomeCompleto: 'Maria Aparecida da Silva',
        documento: `${documentoUnico().slice(0, 3)}.${documentoUnico().slice(-3)}-99`,
      }).expect(201);

      const paciente = corpo<Paciente>(resposta);
      expect(paciente.iniciais).toBe('M. A. S.');
      expect(paciente.documento).toMatch(/^\d+$/);
      expect(paciente.dataNascimento).toBe('1950-03-10');
    });

    it('UC-01 recusa documento repetido e nome + nascimento repetidos', async () => {
      const original = corpo<Paciente>(await novoPaciente());

      const porDocumento = await novoPaciente({ documento: original.documento }).expect(409);
      expect(
        corpo<Problema & { recursoExistenteId: string }>(porDocumento).recursoExistenteId,
      ).toBe(original.id);

      const porNome = await novoPaciente({
        nomeCompleto: `  ${original.nomeCompleto.toUpperCase()}  `,
      }).expect(409);
      expect(corpo<Problema & { recursoExistenteId: string }>(porNome).recursoExistenteId).toBe(
        original.id,
      );
    });

    it('recusa nascimento no futuro', async () => {
      await novoPaciente({ dataNascimento: '2999-01-01' }).expect(422);
    });

    it('RN-13 o detalhe avisa a restrição vigente, sem bloquear', async () => {
      const paciente = corpo<Paciente>(await novoPaciente());
      await contexto.prisma.paciente.update({
        where: { id: paciente.id },
        data: { restricaoAtiva: true, restricaoAte: new Date('2999-12-31') },
      });

      const detalhe = corpo<PacienteDetalhe>(
        await comToken(api().get(`/api/v1/pacientes/${paciente.id}`)).expect(200),
      );

      expect(detalhe.restricaoAtiva).toBe(true);
      expect(detalhe.avisos[0]?.codigo).toBe('PACIENTE_COM_RESTRICAO');
    });

    it('RN-13 restrição vencida não aparece', async () => {
      const paciente = corpo<Paciente>(await novoPaciente());
      await contexto.prisma.paciente.update({
        where: { id: paciente.id },
        data: { restricaoAtiva: true, restricaoAte: new Date('2000-01-01') },
      });

      const detalhe = corpo<PacienteDetalhe>(
        await comToken(api().get(`/api/v1/pacientes/${paciente.id}`)),
      );

      expect(detalhe).toMatchObject({ restricaoAtiva: false, restricaoAte: null, avisos: [] });
    });

    it('busca por nome ou documento e filtra por vínculo', async () => {
      const paciente = corpo<Paciente>(await novoPaciente({ vinculo: 'ALUNO' }));

      const porDocumento = corpo<RespostaPaginada<Paciente>>(
        await comToken(api().get(`/api/v1/pacientes?busca=${paciente.documento}`)).expect(200),
      );
      expect(porDocumento.dados.map((p) => p.id)).toContain(paciente.id);

      const porVinculo = corpo<RespostaPaginada<Paciente>>(
        await comToken(api().get('/api/v1/pacientes?vinculo=ALUNO&tamanho=100')),
      );
      expect(porVinculo.dados.every((p) => p.vinculo === 'ALUNO')).toBe(true);
    });

    it('inativa e exclui', async () => {
      const paciente = corpo<Paciente>(await novoPaciente());

      const inativo = await comToken(api().patch(`/api/v1/pacientes/${paciente.id}`))
        .send({ ativo: false })
        .expect(200);
      expect(corpo<Paciente>(inativo).ativo).toBe(false);

      await comToken(api().delete(`/api/v1/pacientes/${paciente.id}`)).expect(204);
    });
  });

  describe('estudantes (Tabela 2, RN-06)', () => {
    it('cadastra com habilitações, procedimentos e disponibilidade em 0 a 6', async () => {
      const resposta = await novoEstudante({
        disponibilidade: [
          { diaSemana: 0, turno: 'NOITE' },
          { diaSemana: 6, turno: 'TARDE' },
        ],
      }).expect(201);

      const estudante = corpo<Estudante>(resposta);
      expect(estudante.habilitacoes.map((h) => h.id)).toEqual([habilitacaoId]);
      expect(estudante.disponibilidade).toEqual(
        expect.arrayContaining([
          { diaSemana: 0, turno: 'NOITE' },
          { diaSemana: 6, turno: 'TARDE' },
        ]),
      );
      expect(estudante.ocupado).toBe(false);
    });

    it('exige habilitação, procedimento e disponibilidade (W-04)', async () => {
      await novoEstudante({ habilitacoesIds: [] }).expect(422);
      await novoEstudante({ disponibilidade: [] }).expect(422);
    });

    it('recusa especialidade e habilitação inexistentes', async () => {
      await novoEstudante({ especialidadeId: '0190a000-0000-7000-8000-0000000000ff' }).expect(422);
      await novoEstudante({ habilitacoesIds: ['0190a000-0000-7000-8000-0000000000ff'] }).expect(
        422,
      );
    });

    it('duplicidade provisória: mesmo nome na mesma especialidade (#81)', async () => {
      const original = corpo<Estudante>(await novoEstudante());

      const resposta = await novoEstudante({ nome: original.nome.toLowerCase() }).expect(409);

      expect(corpo<Problema & { recursoExistenteId: string }>(resposta).recursoExistenteId).toBe(
        original.id,
      );
    });

    it('edita trocando a disponibilidade e filtra por turno e nível', async () => {
      const estudante = corpo<Estudante>(await novoEstudante({ nivelFormacao: 'Residência' }));

      await comToken(api().put(`/api/v1/estudantes/${estudante.id}`))
        .send({
          nome: estudante.nome,
          especialidadeId,
          nivelFormacao: 'Residência',
          habilitacoesIds: [habilitacaoId],
          procedimentosIds: [procedimentoId],
          disponibilidade: [{ diaSemana: 3, turno: 'NOITE' }],
        })
        .expect(200);

      const filtrados = corpo<RespostaPaginada<Estudante>>(
        await comToken(api().get('/api/v1/estudantes?turno=NOITE&nivelFormacao=residência')).expect(
          200,
        ),
      );
      expect(filtrados.dados.map((e) => e.id)).toContain(estudante.id);
    });
  });

  describe('supervisores (Tabela 3, RN-07, RN-08)', () => {
    it('cadastra com especialidades e limite, sem verificar duplicidade', async () => {
      const dados = {
        nome: 'Prof. Supervisor Ficticio',
        especialidadesIds: [especialidadeId],
        disponibilidade: [{ diaSemana: 2, turno: 'MANHA' }],
        limiteEstudantesSimultaneos: 3,
      };

      const primeiro = await comToken(api().post('/api/v1/supervisores')).send(dados).expect(201);
      await comToken(api().post('/api/v1/supervisores')).send(dados).expect(201);

      expect(corpo<Supervisor>(primeiro)).toMatchObject({
        limiteEstudantesSimultaneos: 3,
        ocupacaoAtual: 0,
      });
    });

    it('RN-08 recusa limite zero e especialidade de outra unidade', async () => {
      await comToken(api().post('/api/v1/supervisores'))
        .send({ nome: 'X', especialidadesIds: [especialidadeId], limiteEstudantesSimultaneos: 0 })
        .expect(422);

      const outraUnidade = await contexto.prisma.unidade.create({ data: { nome: unico('Outra') } });
      const deFora = await contexto.prisma.especialidade.create({
        data: { nome: unico('Fora'), unidadeId: outraUnidade.id },
      });
      await comToken(api().post('/api/v1/supervisores'))
        .send({ nome: 'X', especialidadesIds: [deFora.id], limiteEstudantesSimultaneos: 2 })
        .expect(422);
    });

    it('filtra por especialidade e inativa', async () => {
      const supervisor = corpo<Supervisor>(
        await comToken(api().post('/api/v1/supervisores')).send({
          nome: unico('Prof.'),
          especialidadesIds: [especialidadeId],
          limiteEstudantesSimultaneos: 2,
        }),
      );

      const lista = corpo<RespostaPaginada<Supervisor>>(
        await comToken(api().get(`/api/v1/supervisores?especialidadeId=${especialidadeId}`)).expect(
          200,
        ),
      );
      expect(lista.dados.map((s) => s.id)).toContain(supervisor.id);

      const inativo = await comToken(api().patch(`/api/v1/supervisores/${supervisor.id}`))
        .send({ ativo: false })
        .expect(200);
      expect(corpo<Supervisor>(inativo).ativo).toBe(false);
    });
  });
});
