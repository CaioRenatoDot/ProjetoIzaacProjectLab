import { type EventosFila, type NomeEventoFila, type SenhaResumo } from '@filas/contracts';
import { type PrismaClient } from '@prisma/client';
import { decode } from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { type AddressInfo } from 'node:net';
import { io, type Socket } from 'socket.io-client';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { type ConteudoToken, TokenAcessoService } from '../auth/token-acesso.service';
import { EventosDominio, EventosDominioModule } from '../common/eventos/eventos-dominio';
import { IdempotenciaModule } from '../common/idempotencia/idempotencia.service';
import { Relogio } from '../common/relogio';
import {
  criarAppIntegracao,
  entrarComPermissoes,
  type SessaoDeTeste,
  UNIDADE_PADRAO,
} from '../common/testing/app-integracao';
import { type AppDeTeste } from '../common/testing/criar-app-de-teste';
import { BloqueioRepository } from '../filas/bloqueio.repository';
import { BloqueioService } from '../filas/bloqueio.service';
import { FilasRepository } from '../filas/filas.repository';
import { SenhasService } from '../senhas/senhas.service';
import { TempoRealModule } from './tempo-real.module';

let contexto: AppDeTeste & { prisma: PrismaClient };
let atendente: SessaoDeTeste;
let url: string;
const sockets: Socket[] = [];
const AGORA = new Date('2026-10-27T10:00:00-03:00');
const TURNO = { diaSemana: 'TERCA', turno: 'MANHA' } as const;
const api = () => request(contexto.servidor);
const autenticado = (r: request.Test) => r.auth(atendente.token, { type: 'bearer' });

function cliente(
  canal: string,
  token?: string,
  query: Record<string, string> = {},
  origin?: string,
) {
  const s = io(url + canal, {
    autoConnect: false,
    forceNew: true,
    reconnection: false,
    transports: ['websocket'],
    auth: { token },
    query,
    ...(origin ? { extraHeaders: { Origin: origin } } : {}),
  });
  sockets.push(s);
  return s;
}
function evento<T = unknown>(s: Socket, nome: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const receber = (valor: T) => {
      clearTimeout(timer);
      resolve(valor);
    };
    const timer = setTimeout(() => {
      s.off(nome, receber);
      reject(new Error(`Não recebeu ${nome}`));
    }, 4000);
    s.once(nome, receber);
  });
}
async function conectar(s: Socket) {
  const conectado = evento(s, 'connect');
  s.connect();
  await conectado;
}

async function cenario(exigeSupervisao = false) {
  const marca = randomUUID();
  const especialidade = await contexto.prisma.especialidade.create({
    data: {
      nome: `Especialidade ${marca}`,
      unidadeId: UNIDADE_PADRAO,
      exigeSupervisaoDocente: exigeSupervisao,
      filas: { create: { nome: 'Fila fictícia', unidadeId: UNIDADE_PADRAO, letraSenha: 'Z' } },
    },
    include: { filas: true },
  });
  const fila = especialidade.filas[0]!;
  const paciente = await contexto.prisma.paciente.create({
    data: {
      nomeCompleto: 'Paciente Fictício Sigiloso',
      documento: marca,
      dataNascimento: new Date('1990-01-01'),
      vinculo: 'EXTERNO',
      unidadeId: UNIDADE_PADRAO,
    },
  });
  const triagem = await contexto.prisma.triagem.create({
    data: {
      pacienteId: paciente.id,
      profissionalId: atendente.usuarioId,
      especialidadeDestinoId: especialidade.id,
      prioridade: 'NORMAL',
      tipoAtendimento: 'PRIMEIRA_CONSULTA',
      motivo: 'Conteúdo clínico sigiloso',
    },
  });
  const senha = await contexto.prisma.senha.create({
    data: {
      numero: 'Z001',
      filaId: fila.id,
      pacienteId: paciente.id,
      triagemId: triagem.id,
      prioridade: 'NORMAL',
      tipoAtendimento: 'PRIMEIRA_CONSULTA',
    },
  });
  return { fila, especialidade, senha };
}

describe('RN-10 e tempo real da #19', () => {
  beforeAll(async () => {
    contexto = await criarAppIntegracao({
      imports: [EventosDominioModule, IdempotenciaModule, TempoRealModule],
    });
    vi.spyOn(contexto.app.get(Relogio), 'agora').mockReturnValue(AGORA);
    atendente = await entrarComPermissoes(contexto, [
      'fila:consultar',
      'fila:chamar',
      'alertas:consultar',
    ]);
    await contexto.app.listen(0, '127.0.0.1');
    url = `http://127.0.0.1:${(contexto.servidor.address() as AddressInfo).port}`;
  });
  afterAll(async () => {
    for (const s of sockets) s.disconnect();
    await contexto.app.close();
    await contexto.prisma.$disconnect();
  });
  afterEach(() => {
    vi.spyOn(contexto.app.get(Relogio), 'agora').mockReturnValue(AGORA);
  });

  it('RN-10 sem supervisor: 409 FILA_BLOQUEADA, campos do bloqueio e evento; regularização desbloqueia na consulta', async () => {
    const c = await cenario(true);
    const s = cliente('/filas', atendente.token, { especialidadeId: c.especialidade.id });
    await conectar(s);
    const bloqueada = evento(s, 'fila.bloqueada');
    const chamada = await autenticado(api().post(`/api/v1/filas/${c.fila.id}/chamadas`))
      .send({})
      .expect(409);
    expect((chamada.body as { codigo: string }).codigo).toBe('FILA_BLOQUEADA');
    expect(await bloqueada).toMatchObject({ filaId: c.fila.id, desde: AGORA.toISOString() });
    const consulta = await autenticado(api().get(`/api/v1/filas/${c.fila.id}`)).expect(200);
    expect((consulta.body as { bloqueio: object }).bloqueio).toEqual({
      ativo: true,
      motivo: 'Sem supervisor habilitado disponível na especialidade.',
      desde: AGORA.toISOString(),
    });
    await contexto.prisma.supervisor.create({
      data: {
        nome: 'Supervisor fictício',
        especialidades: { create: { especialidadeId: c.especialidade.id } },
        disponibilidades: { create: TURNO },
      },
    });
    const desbloqueada = evento(s, 'fila.desbloqueada');
    const regularizada = await autenticado(api().get(`/api/v1/filas/${c.fila.id}`)).expect(200);
    expect((regularizada.body as { bloqueio: object }).bloqueio).toEqual({
      ativo: false,
      motivo: null,
      desde: null,
    });
    expect(await desbloqueada).toMatchObject({ filaId: c.fila.id, em: AGORA.toISOString() });
  });

  it('RN-07, RN-08 e RN-10 reavalia ocupação/liberação, inativação e virada de turno sem bloquear outra especialidade', async () => {
    const c = await cenario(true);
    const outra = await cenario();
    const supervisor = await contexto.prisma.supervisor.create({
      data: {
        nome: 'Supervisor com uma vaga',
        limiteEstudantesSimultaneos: 1,
        especialidades: {
          create: [
            { especialidadeId: c.especialidade.id },
            { especialidadeId: outra.especialidade.id },
          ],
        },
        disponibilidades: { create: TURNO },
      },
    });
    const estudante = await contexto.prisma.estudante.create({
      data: {
        nome: 'Estudante fictício',
        especialidadeId: outra.especialidade.id,
        nivelFormacao: '7',
      },
    });
    const sala = await contexto.prisma.sala.create({
      data: { identificacao: `Sala ${c.fila.id}`, unidadeId: UNIDADE_PADRAO },
    });
    const alocacao = await contexto.prisma.alocacao.create({
      data: {
        senhaId: outra.senha.id,
        estudanteId: estudante.id,
        salaId: sala.id,
        supervisorId: supervisor.id,
        confirmadaPor: atendente.usuarioId,
      },
    });
    const bloqueio = contexto.app.get(BloqueioService);
    await bloqueio.atualizar(c.fila.id, UNIDADE_PADRAO);
    expect(
      (await contexto.prisma.fila.findUniqueOrThrow({ where: { id: c.fila.id } })).bloqueada,
    ).toBe(true);
    expect(
      (await contexto.prisma.fila.findUniqueOrThrow({ where: { id: outra.fila.id } })).bloqueada,
    ).toBe(false);
    await contexto.prisma.alocacao.update({
      where: { id: alocacao.id },
      data: { liberadaEm: new Date() },
    });
    await bloqueio.atualizar(c.fila.id, UNIDADE_PADRAO);
    expect(
      (await contexto.prisma.fila.findUniqueOrThrow({ where: { id: c.fila.id } })).bloqueada,
    ).toBe(false);
    await contexto.prisma.supervisor.update({
      where: { id: supervisor.id },
      data: { ativo: false },
    });
    await bloqueio.atualizar(c.fila.id, UNIDADE_PADRAO);
    expect(
      (await contexto.prisma.fila.findUniqueOrThrow({ where: { id: c.fila.id } })).bloqueada,
    ).toBe(true);
    await contexto.prisma.supervisor.update({
      where: { id: supervisor.id },
      data: { ativo: true },
    });
    await bloqueio.atualizar(c.fila.id, UNIDADE_PADRAO);
    const relogio = vi
      .spyOn(contexto.app.get(Relogio), 'agora')
      .mockReturnValue(new Date('2026-10-27T15:00:00-03:00'));
    const monitoradas = vi
      .spyOn(contexto.app.get(BloqueioRepository), 'monitoradas')
      .mockResolvedValue([{ id: c.fila.id, unidadeId: UNIDADE_PADRAO }]);
    try {
      await bloqueio.executar();
      expect(
        (await contexto.prisma.fila.findUniqueOrThrow({ where: { id: c.fila.id } })).bloqueada,
      ).toBe(true);
    } finally {
      relogio.mockReturnValue(AGORA);
      monitoradas.mockRestore();
    }
  });

  it('RNF-02 chamada e rechamada chegam ao painel sem paciente ou prioridade; reconexão recupera quatro anteriores', async () => {
    // Chamadas são gravadas pelo relógio do PostgreSQL; o histórico deve consultar esse dia.
    vi.spyOn(contexto.app.get(Relogio), 'agora').mockImplementation(() => new Date());
    const c = await cenario();
    const s = cliente('/painel', undefined, { unidadeId: UNIDADE_PADRAO });
    const inicial = evento(s, 'painel.estado');
    s.connect();
    await inicial;
    const primeira = evento<Record<string, unknown>>(s, 'chamada.exibir');
    const resposta = await autenticado(api().post(`/api/v1/filas/${c.fila.id}/chamadas`))
      .send({ localExibicao: 'Sala 03' })
      .expect(201);
    let chamadaId = (resposta.body as { chamada: { id: string } }).chamada.id;
    expect(Object.keys(await primeira).sort()).toEqual([
      'em',
      'especialidade',
      'local',
      'numero',
      'sequencia',
    ]);
    for (let sequencia = 2; sequencia <= 6; sequencia++) {
      const recebeu = evento(s, 'chamada.exibir');
      const nova = await autenticado(api().post(`/api/v1/chamadas/${chamadaId}/rechamada`)).expect(
        201,
      );
      chamadaId = (nova.body as { id: string }).id;
      expect(await recebeu).toMatchObject({ numero: c.senha.numero, sequencia });
    }
    s.disconnect();
    const estado = evento<{ atual: object; anteriores: object[] }>(s, 'painel.estado');
    s.connect();
    const painel = await estado;
    expect(painel.atual).toEqual({
      numero: c.senha.numero,
      especialidade: c.especialidade.nome,
      local: 'Sala 03',
    });
    expect(painel.anteriores).toHaveLength(4);
    for (const carga of [painel.atual, ...painel.anteriores])
      expect(Object.keys(carga).sort()).toEqual(['especialidade', 'local', 'numero']);
  });

  it('RNF-01 recusa token ausente/inválido, permissão ausente, unidade alheia e origem CORS não autorizada nos três namespaces', async () => {
    const c = await cenario();
    const semPermissao = await entrarComPermissoes(contexto, []);
    const unidade = await contexto.prisma.unidade.create({ data: { nome: 'Unidade isolada' } });
    const especialidade = await contexto.prisma.especialidade.create({
      data: { nome: `Especialidade ${unidade.id}`, unidadeId: unidade.id },
    });
    for (const s of [
      cliente('/filas', undefined, { especialidadeId: c.especialidade.id }),
      cliente('/filas', 'token-invalido', { especialidadeId: c.especialidade.id }),
      cliente('/filas', semPermissao.token, { especialidadeId: c.especialidade.id }),
      cliente('/filas', atendente.token, { especialidadeId: especialidade.id }),
      cliente('/alertas'),
      cliente('/alertas', semPermissao.token),
      cliente('/alertas', atendente.token, { unidadeId: unidade.id }),
      cliente('/painel', undefined, { unidadeId: randomUUID() }),
      cliente(
        '/painel',
        undefined,
        { unidadeId: UNIDADE_PADRAO },
        'https://origem-nao-autorizada.invalid',
      ),
    ]) {
      const recusada = evento(s, 'connect_error');
      s.connect();
      expect(await recusada).toBeInstanceOf(Error);
    }
    await conectar(cliente('/alertas', atendente.token));
    const publico = cliente('/painel', undefined, { unidadeId: unidade.id });
    const estado = evento(publico, 'painel.estado');
    publico.connect();
    expect(await estado).toEqual({ atual: null, anteriores: [] });
  });

  it('RNF-01 desconecta quando o access token expira e recusa a reconexão com o token vencido', async () => {
    const c = await cenario();
    const original = decode(atendente.token) as ConteudoToken;
    const { sub, sid, nome, perfilId, perfilNome, unidadeId, permissoes } = original;
    const token = contexto.app
      .get(TokenAcessoService)
      .assinar({ sub, sid, nome, perfilId, perfilNome, unidadeId, permissoes }, 2);
    const s = cliente('/filas', token, { especialidadeId: c.especialidade.id });
    await conectar(s);
    expect(await evento(s, 'disconnect')).toBe('io server disconnect');
    const recusada = evento(s, 'connect_error');
    s.connect();
    expect(await recusada).toBeInstanceOf(Error);
  });

  it('RN-10 falha da chamada faz rollback da senha e não publica chamada nem mudança de status', async () => {
    const c = await cenario();
    const eventos = contexto.app.get(EventosDominio);
    const publicada = vi.fn();
    const cancelar = [
      eventos.assinar('senha.chamada', publicada),
      eventos.assinar('senha.status_alterado', publicada),
    ];
    const falha = vi
      .spyOn(contexto.app.get(FilasRepository), 'criarChamada')
      .mockRejectedValueOnce(new Error('Falha simulada'));
    try {
      await autenticado(api().post(`/api/v1/filas/${c.fila.id}/chamadas`))
        .send({})
        .expect(500);
      expect(
        (await contexto.prisma.senha.findUniqueOrThrow({ where: { id: c.senha.id } })).status,
      ).toBe('AGUARDANDO');
      expect(await contexto.prisma.chamada.count({ where: { senhaId: c.senha.id } })).toBe(0);
      expect(publicada).not.toHaveBeenCalled();
    } finally {
      falha.mockRestore();
      cancelar.forEach((cancelar) => cancelar());
    }
  });

  it('repassa todos os eventos contratados somente à sala da especialidade e envia métricas', async () => {
    const c = await cenario();
    const outra = await cenario();
    const s = cliente('/filas', atendente.token, { especialidadeId: c.especialidade.id });
    await conectar(s);
    const outro = cliente('/filas', atendente.token, { especialidadeId: outra.especialidade.id });
    await conectar(outro);
    const indevido = vi.fn();
    outro.onAny(indevido);
    const senha: SenhaResumo = await contexto.app
      .get(SenhasService)
      .consultar(c.senha.id, UNIDADE_PADRAO);
    const cargas: { [N in NomeEventoFila]: [N, EventosFila[N]] }[NomeEventoFila][] = [
      ['senha.criada', senha],
      [
        'senha.chamada',
        {
          senha,
          chamada: {
            id: randomUUID(),
            senhaId: senha.id,
            numero: senha.numero,
            local: 'Sala 03',
            sequencia: 1,
            chamadoEm: AGORA.toISOString(),
            chamadoPor: 'Atendente',
          },
        },
      ],
      [
        'senha.status_alterado',
        {
          senhaId: senha.id,
          filaId: c.fila.id,
          statusAnterior: 'AGUARDANDO',
          status: 'CHAMADA',
          versao: 2,
        },
      ],
      ['senha.reclassificada', { senhaId: senha.id, prioridade: 'PREFERENCIAL', novaPosicao: 1 }],
      [
        'fila.bloqueada',
        {
          filaId: c.fila.id,
          especialidade: c.especialidade.nome,
          motivo: 'Sem supervisor',
          desde: AGORA.toISOString(),
        },
      ],
      [
        'fila.desbloqueada',
        { filaId: c.fila.id, especialidade: c.especialidade.nome, em: AGORA.toISOString() },
      ],
      [
        'fila.metricas',
        { filaId: c.fila.id, aguardando: 1, emAtendimento: 0, tempoMedioEsperaMinutos: null },
      ],
    ];
    for (const [nome, carga] of cargas) {
      const recebido = evento(s, nome);
      contexto.app.get(EventosDominio).emitir(nome, carga);
      expect(await recebido).toEqual(carga);
    }
    expect(indevido).not.toHaveBeenCalled();
  });
});
