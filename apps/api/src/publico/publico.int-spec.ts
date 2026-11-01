import { ConsultaSenhaPublica, EstadoPainelPublico, Problema } from '@filas/contracts';
import { type Prisma, type PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { Relogio } from '../common/relogio';
import { criarAppIntegracao, entrarComPermissoes } from '../common/testing/app-integracao';
import { type AppDeTeste } from '../common/testing/criar-app-de-teste';
import { PublicoModule } from './publico.module';

let contexto: AppDeTeste & { prisma: PrismaClient };
let usuarioId: string;
let agora = new Date('2026-10-28T02:30:00Z');
const api = () => request(contexto.servidor);
const numeroUnico = () => `F${randomUUID().replaceAll('-', '')}`;

async function cenario() {
  const unidade = await contexto.prisma.unidade.create({ data: { nome: numeroUnico() } });
  const especialidade = await contexto.prisma.especialidade.create({
    data: {
      nome: `Especialidade fictícia ${numeroUnico()}`,
      unidadeId: unidade.id,
      filas: { create: { nome: 'Fila fictícia', unidadeId: unidade.id, letraSenha: 'F' } },
    },
    include: { filas: true },
  });
  const paciente = await contexto.prisma.paciente.create({
    data: {
      nomeCompleto: 'Paciente Sigiloso Fictício',
      documento: numeroUnico(),
      dataNascimento: new Date('1990-01-01'),
      vinculo: 'EXTERNO',
      unidadeId: unidade.id,
    },
  });
  async function emitir(dados: Partial<Prisma.SenhaUncheckedCreateInput> = {}) {
    const triagem = await contexto.prisma.triagem.create({
      data: {
        pacienteId: paciente.id,
        profissionalId: usuarioId,
        especialidadeDestinoId: especialidade.id,
        prioridade: 'NORMAL',
        tipoAtendimento: 'PRIMEIRA_CONSULTA',
        motivo: 'Dado clínico proibido',
        observacoes: 'Observação proibida',
      },
    });
    return contexto.prisma.senha.create({
      data: {
        filaId: especialidade.filas[0]!.id,
        triagemId: triagem.id,
        pacienteId: paciente.id,
        numero: numeroUnico(),
        prioridade: 'NORMAL',
        tipoAtendimento: 'PRIMEIRA_CONSULTA',
        chegadaEm: new Date(agora.getTime() - 120_000),
        ...dados,
      },
    });
  }
  return { unidade, especialidade, emitir };
}

async function chamar(senhaId: string, chamadoEm = agora, sequencia = 1) {
  return contexto.prisma.chamada.create({
    data: {
      senhaId,
      usuarioId,
      localExibicao: `Sala ${sequencia}`,
      chamadoEm,
      sequencia,
    },
  });
}

describe('HTTP público da #20 (PostgreSQL, sem token)', () => {
  beforeAll(async () => {
    contexto = await criarAppIntegracao({ imports: [PublicoModule] });
    usuarioId = (await entrarComPermissoes(contexto, [])).usuarioId;
  });
  beforeEach(() => {
    agora = new Date(agora.getTime() + 61_000);
    vi.spyOn(contexto.app.get(Relogio), 'agora').mockImplementation(() => agora);
  });
  afterAll(async () => {
    await contexto.app.close();
    await contexto.prisma.$disconnect();
  });

  it('RN-04 e RNF-02: posição segue prioridade, chegada e agendamento, sem dados de paciente', async () => {
    const c = await cenario();
    const alvo = await c.emitir();
    await c.emitir({ prioridade: 'URGENTE' });
    await c.emitir({ chegadaEm: new Date(alvo.chegadaEm.getTime() - 1) });
    await c.emitir({ temAgendamentoPrevio: true, chegadaEm: alvo.chegadaEm });
    await c.emitir({ chegadaEm: new Date(alvo.chegadaEm.getTime() + 1) });
    const r = await api().get(`/api/v1/publico/senhas/${alvo.numero}`).expect(200);
    expect(r.body).toEqual({
      numero: alvo.numero,
      especialidade: c.especialidade.nome,
      status: 'AGUARDANDO',
      posicao: 4,
      tempoEstimadoMinutos: null,
      local: null,
    });
    expect(r.headers['cache-control']).toBe('no-store');
  });

  it('UC-08: senha de ontem, inexistente e duplicada devolvem o mesmo 404 neutro', async () => {
    const c = await cenario();
    const velha = await c.emitir({ chegadaEm: new Date(agora.getTime() - 86_400_000) });
    const duplicada = await c.emitir();
    await (await cenario()).emitir({ numero: duplicada.numero });
    const respostas = [];
    for (const numero of [velha.numero, numeroUnico(), duplicada.numero]) {
      const r = await api().get(`/api/v1/publico/senhas/${numero}`).expect(404);
      expect(r.headers['content-type']).toContain('application/problem+json');
      const { instance: _instance, ...problema } = r.body as Record<string, unknown>;
      respostas.push(problema);
    }
    expect(respostas[0]).toEqual(respostas[1]);
    expect(respostas[1]).toEqual(respostas[2]);
    expect(respostas[0]).toMatchObject({
      codigo: 'SENHA_NAO_ENCONTRADA',
      detail: 'Não localizamos essa senha para o dia de hoje. Procure a recepção.',
    });
  });

  it('UC-08: usa o dia civil de São Paulo, incluindo emissão na data UTC anterior', async () => {
    const c = await cenario();
    const senha = await c.emitir({ chegadaEm: new Date('2026-10-27T23:30:00Z') });
    await api().get(`/api/v1/publico/senhas/${senha.numero}`).expect(200);
  });

  it('UC-08: dez primeiras chamadas permitem média; rechamadas, outro dia e outra fila não contam', async () => {
    const c = await cenario();
    const alvo = await c.emitir();
    for (let i = 0; i < 9; i++) {
      const s = await c.emitir({ chegadaEm: new Date(agora.getTime() - 1_200_000) });
      await chamar(s.id, new Date(agora.getTime() - 600_000));
      await chamar(s.id, agora, 2);
    }
    const ontem = await c.emitir({ chegadaEm: new Date(agora.getTime() - 86_400_000) });
    await chamar(ontem.id, new Date(agora.getTime() - 85_800_000));
    const outra = await (await cenario()).emitir();
    await chamar(outra.id);
    const url = `/api/v1/publico/senhas/${alvo.numero}`;
    expect(
      ConsultaSenhaPublica.parse((await api().get(url).expect(200)).body).tempoEstimadoMinutos,
    ).toBeNull();
    const decima = await c.emitir({ chegadaEm: new Date(agora.getTime() - 1_200_000) });
    await chamar(decima.id, new Date(agora.getTime() - 600_000));
    expect(
      ConsultaSenhaPublica.parse((await api().get(url).expect(200)).body).tempoEstimadoMinutos,
    ).toBe(10);
  });

  it('UC-09 e RNF-02: painel vazio e cinco chamadas públicas isoladas por unidade e dia', async () => {
    const c = await cenario();
    const url = `/api/v1/publico/painel/${c.unidade.id}`;
    expect((await api().get(url).expect(200)).body).toEqual({
      atual: null,
      anteriores: [],
      servidorEm: agora.toISOString(),
    });
    const s = await c.emitir({ status: 'CHAMADA' });
    for (let i = 1; i <= 6; i++) await chamar(s.id, new Date(agora.getTime() - (6 - i) * 1000), i);
    const outra = await (await cenario()).emitir();
    await chamar(outra.id);
    await chamar(s.id, new Date(agora.getTime() - 86_400_000), 7);
    const r = await api().get(url).expect(200);
    const estado = EstadoPainelPublico.parse(r.body);
    expect(estado.atual).toEqual({
      numero: s.numero,
      especialidade: c.especialidade.nome,
      local: 'Sala 6',
    });
    expect(estado.anteriores).toEqual(
      [5, 4, 3, 2].map((i) => ({
        numero: s.numero,
        especialidade: c.especialidade.nome,
        local: `Sala ${i}`,
      })),
    );
    expect((await api().get(`/api/v1/publico/senhas/${s.numero}`).expect(200)).body).toMatchObject({
      status: 'CHAMADA',
      posicao: null,
      tempoEstimadoMinutos: null,
      local: 'Sala 6',
    });
    await api().get(`/api/v1/publico/painel/${randomUUID()}`).expect(404);
    await api().get('/api/v1/publico/painel/invalida').expect(404);
  });

  it('RNF-02: 31ª requisição retorna 429 entre rotas; X-Forwarded-For não contorna o limite', async () => {
    const c = await cenario();
    for (let i = 0; i < 30; i++)
      await api().get(`/api/v1/publico/painel/${c.unidade.id}`).expect(200);
    const r = await api()
      .get(`/api/v1/publico/senhas/${numeroUnico()}`)
      .set('X-Forwarded-For', '203.0.113.99')
      .expect(429);
    expect(r.headers['retry-after']).toBe('60');
    expect(r.headers['cache-control']).toBe('no-store');
    expect(r.headers['content-type']).toContain('application/problem+json');
    expect(Problema.parse(r.body).codigo).toBe('LIMITE_REQUISICOES');
    agora = new Date(agora.getTime() + 60_000);
    await api().get(`/api/v1/publico/painel/${c.unidade.id}`).expect(200);
  });
});
