import { Alerta, AlertaNormalizado, Escalonamento, type RespostaPaginada } from '@filas/contracts';
import { type PrismaClient, type StatusAlerta, type TipoAlerta } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { type AddressInfo } from 'node:net';
import { io, type Socket } from 'socket.io-client';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuditoriaService } from '../common/auditoria/auditoria.service';
import { EventosDominio } from '../common/eventos/eventos-dominio';
import { IdempotenciaModule } from '../common/idempotencia/idempotencia.service';
import { Relogio } from '../common/relogio';
import {
  criarAppIntegracao,
  entrarComPermissoes,
  type SessaoDeTeste,
  UNIDADE_PADRAO,
} from '../common/testing/app-integracao';
import { type AppDeTeste } from '../common/testing/criar-app-de-teste';
import { BloqueioService } from '../filas/bloqueio.service';
import { TempoRealModule } from '../tempo-real/tempo-real.module';
import { AlertasModule } from './alertas.module';
import { AlertasRepository } from './alertas.repository';
import { AlertasService } from './alertas.service';

let contexto: AppDeTeste & { prisma: PrismaClient };
let autor: SessaoDeTeste;
let url: string;
const agora = new Date('2026-10-28T13:00:00Z');
const sockets: Socket[] = [];
const api = () => request(contexto.servidor);
const como = (r: request.Test, sessao = autor) => r.auth(sessao.token, { type: 'bearer' });
const lista = (r: request.Response) => r.body as RespostaPaginada<Alerta>;
const service = () => contexto.app.get(AlertasService);

function evento<T>(s: Socket, nome: string, aceitar: (d: T) => boolean = () => true): Promise<T> {
  return new Promise((resolve, reject) => {
    const receber = (d: T) => {
      if (aceitar(d)) {
        clearTimeout(timer);
        s.off(nome, receber);
        resolve(d);
      }
    };
    const timer = setTimeout(() => {
      s.off(nome, receber);
      reject(new Error(`Não recebeu ${nome}`));
    }, 4000);
    s.on(nome, receber);
  });
}
async function cliente(sessao = autor) {
  const s = io(`${url}/alertas`, {
    auth: { token: sessao.token },
    autoConnect: false,
    forceNew: true,
    reconnection: false,
    transports: ['websocket'],
  });
  sockets.push(s);
  const conectado = evento(s, 'connect');
  s.connect();
  await conectado;
  return s;
}
async function cenario(
  esperas: number[] = [32],
  opcoes: { sla?: number | null; supervisao?: boolean; ativa?: boolean } = {},
) {
  const especialidade = await contexto.prisma.especialidade.create({
    data: {
      nome: `Alerta fictício ${randomUUID()}`,
      unidadeId: UNIDADE_PADRAO,
      exigeSupervisaoDocente: opcoes.supervisao ?? false,
      filas: {
        create: {
          nome: 'Fila fictícia',
          letraSenha: 'L',
          unidadeId: UNIDADE_PADRAO,
          slaMinutos: opcoes.sla === undefined ? 25 : opcoes.sla,
          ativa: opcoes.ativa ?? true,
        },
      },
    },
    include: { filas: true },
  });
  const fila = especialidade.filas[0]!;
  const paciente = await contexto.prisma.paciente.create({
    data: {
      nomeCompleto: 'Paciente Fictício Sigiloso',
      documento: randomUUID(),
      dataNascimento: new Date('1990-01-01'),
      vinculo: 'EXTERNO',
      unidadeId: UNIDADE_PADRAO,
    },
  });
  const senhas = [];
  for (const [i, espera] of esperas.entries()) {
    const triagem = await contexto.prisma.triagem.create({
      data: {
        pacienteId: paciente.id,
        profissionalId: autor.usuarioId,
        especialidadeDestinoId: especialidade.id,
        prioridade: 'NORMAL',
        tipoAtendimento: 'PRIMEIRA_CONSULTA',
        motivo: 'Motivo clínico sigiloso',
        observacoes: 'Observação sigilosa',
      },
    });
    senhas.push(
      await contexto.prisma.senha.create({
        data: {
          numero: `L${i + 1}`,
          filaId: fila.id,
          pacienteId: paciente.id,
          triagemId: triagem.id,
          prioridade: 'NORMAL',
          tipoAtendimento: 'PRIMEIRA_CONSULTA',
          chegadaEm: new Date(agora.getTime() - espera * 60_000),
        },
      }),
    );
  }
  return { fila, especialidade, senhas };
}
async function aberto(filaId: string, tipo: TipoAlerta = 'SLA_EXCEDIDO') {
  return contexto.prisma.alerta.findFirstOrThrow({
    where: { filaId, tipo, status: { in: ['ATIVO', 'RECONHECIDO'] } },
  });
}
async function consultar(filaId: string) {
  return lista(await como(api().get(`/api/v1/alertas?filaId=${filaId}`)).expect(200));
}

describe('alertas #28 (HTTP, PostgreSQL e Socket.IO reais)', () => {
  beforeAll(async () => {
    contexto = await criarAppIntegracao({
      imports: [IdempotenciaModule, AlertasModule, TempoRealModule],
    });
    autor = await entrarComPermissoes(contexto, [
      'alertas:consultar',
      'alertas:reconhecer',
      'alertas:escalonar',
      'fila:chamar',
    ]);
    await contexto.app.listen(0, '127.0.0.1');
    url = `http://127.0.0.1:${(contexto.servidor.address() as AddressInfo).port}`;
  });
  beforeEach(() => vi.spyOn(contexto.app.get(Relogio), 'agora').mockReturnValue(agora));
  afterEach(() => {
    vi.restoreAllMocks();
    for (const s of sockets.splice(0)) s.disconnect();
  });
  afterAll(async () => {
    await contexto.app.close();
    await contexto.prisma.$disconnect();
  });

  it('UC-19 RF-11 rotina cria SLA_EXCEDIDO e entrega evento só na unidade, após commit real', async () => {
    const c = await cenario([32, 26, 25, 2]);
    const s = await cliente();
    const outro = await entrarComPermissoes(contexto, ['alertas:consultar']);
    const unidade = await contexto.prisma.unidade.create({ data: { nome: randomUUID() } });
    await contexto.prisma.usuario.update({
      where: { id: outro.usuarioId },
      data: { unidadeId: unidade.id },
    });
    const alheio = await cliente(outro);
    const indevido = vi.fn();
    alheio.onAny(indevido);
    const recebido = evento<Alerta>(s, 'sla.excedido', (a) => a.filaId === c.fila.id);
    let commitConcluido = false;
    let publicadoDepois = false;
    let persistido: Promise<number> | undefined;
    const repo = contexto.app.get(AlertasRepository);
    const transacionar = repo.transacao.bind(repo);
    vi.spyOn(repo, 'transacao').mockImplementation(async (trabalho) => {
      commitConcluido = false;
      const r = await transacionar(trabalho);
      commitConcluido = true;
      return r;
    });
    const cancelar = contexto.app.get(EventosDominio).assinar('sla.excedido', ({ dados }) => {
      if (dados.filaId === c.fila.id) {
        publicadoDepois = commitConcluido;
        persistido = contexto.prisma.alerta.count({ where: { id: dados.id } }).then((n) => n);
      }
    });
    try {
      await service().executar();
      const alerta = Alerta.parse(await recebido);
      expect(alerta).toMatchObject({
        tipo: 'SLA_EXCEDIDO',
        status: 'ATIVO',
        tempoEsperaMinutos: 32,
        limiteMinutos: 25,
        senhasAfetadas: 2,
        escalonamentos: [],
      });
      expect(await persistido).toBe(1);
      expect(publicadoDepois).toBe(true);
      expect(indevido).not.toHaveBeenCalled();
      expect(JSON.stringify(alerta)).not.toMatch(/sigiloso|paciente|motivo|observacoes|unidadeId/);
      expect((await consultar(c.fila.id)).dados).toEqual([alerta]);
    } finally {
      cancelar();
    }
  });

  it('UC-19 normaliza RECONHECIDO ao voltar ao limite, preserva retrato e publica sla.normalizado', async () => {
    const c = await cenario([32, 25]);
    await service().avaliarSla(c.fila.id);
    const a = await aberto(c.fila.id);
    await como(api().post(`/api/v1/alertas/${a.id}/reconhecimento`)).expect(200);
    await como(api().post(`/api/v1/filas/${c.fila.id}/chamadas`))
      .send({})
      .expect(201);
    const s = await cliente();
    const recebido = evento<AlertaNormalizado>(s, 'sla.normalizado', (d) => d.alertaId === a.id);
    await service().avaliarSla(c.fila.id);
    expect(AlertaNormalizado.parse(await recebido)).toEqual({
      alertaId: a.id,
      normalizadoEm: agora.toISOString(),
    });
    const normalizado = (await consultar(c.fila.id)).dados[0]!;
    expect(normalizado).toMatchObject({
      status: 'NORMALIZADO',
      tempoEsperaMinutos: 32,
      senhasAfetadas: 1,
      normalizadoEm: agora.toISOString(),
    });
    for (const acao of ['reconhecimento', 'escalonamento']) {
      const r = await como(api().post(`/api/v1/alertas/${a.id}/${acao}`))
        .send({ acao: 'VAGA_EXTRA' })
        .expect(409);
      expect((r.body as { codigo: string }).codigo).toBe('TRANSICAO_INVALIDA');
    }
  });

  it('UC-19 escalonamentos são consultáveis com autor/horário do servidor e auditoria única', async () => {
    const c = await cenario();
    await service().avaliarSla(c.fila.id);
    const a = await aberto(c.fila.id);
    const requestId = randomUUID();
    const r = await como(api().post(`/api/v1/alertas/${a.id}/escalonamento`))
      .set('X-Request-Id', requestId)
      .set('User-Agent', 'teste-GH28')
      .send({ acao: 'REFORCO_ATENDENTE', observacao: '  Ajuste operacional  ' })
      .expect(201);
    const medida = Escalonamento.parse(r.body);
    const usuario = await contexto.prisma.usuario.findUniqueOrThrow({
      where: { id: autor.usuarioId },
    });
    expect(medida).toMatchObject({
      alertaId: a.id,
      acao: 'REFORCO_ATENDENTE',
      acionadoPor: usuario.nome,
      acionadoEm: agora.toISOString(),
      observacao: 'Ajuste operacional',
    });
    expect((await consultar(c.fila.id)).dados[0]!.escalonamentos).toEqual([medida]);
    const audit = await contexto.prisma.auditLog.findMany({
      where: { entidade: 'escalonamento', entidadeId: medida.id },
    });
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      usuarioId: autor.usuarioId,
      perfilNomeNoMomento: (
        await contexto.prisma.perfil.findUniqueOrThrow({ where: { id: autor.perfilId } })
      ).nome,
      requestId,
      userAgent: 'teste-GH28',
      modulo: 'alertas',
      operacao: 'CRIAR',
    });
    const segunda = await como(api().post(`/api/v1/alertas/${a.id}/escalonamento`))
      .send({ acao: 'VAGA_EXTRA', observacao: '  ' })
      .expect(201);
    expect(Escalonamento.parse(segunda.body).observacao).toBeNull();
    expect((await aberto(c.fila.id)).status).toBe('ATIVO');
  });

  it('RN-10 bloqueio da #19 gera origem distinta e desbloqueio normaliza sem repetir regra de supervisor', async () => {
    const c = await cenario([], { supervisao: true });
    const s = await cliente();
    const recebido = evento<Alerta>(s, 'sla.excedido', (a) => a.filaId === c.fila.id);
    await contexto.app.get(BloqueioService).atualizar(c.fila.id, UNIDADE_PADRAO);
    const a = Alerta.parse(await recebido);
    expect(a).toMatchObject({
      tipo: 'FILA_BLOQUEADA',
      tempoEsperaMinutos: null,
      limiteMinutos: null,
      senhasAfetadas: 0,
    });
    await contexto.prisma.supervisor.create({
      data: {
        nome: 'Supervisor fictício',
        especialidades: { create: { especialidadeId: c.especialidade.id } },
        disponibilidades: { create: { diaSemana: 'QUARTA', turno: 'MANHA' } },
      },
    });
    const normalizado = evento<AlertaNormalizado>(s, 'sla.normalizado', (d) => d.alertaId === a.id);
    await contexto.app.get(BloqueioService).atualizar(c.fila.id, UNIDADE_PADRAO);
    expect(await normalizado).toMatchObject({ alertaId: a.id });
    expect((await consultar(c.fila.id)).dados[0]!.status).toBe('NORMALIZADO');
  });

  it('RF-11 limite exato não dispara; milissegundo acima dispara; fila inativa não é monitorada', async () => {
    const c = await cenario([25]);
    await service().avaliarSla(c.fila.id);
    expect((await consultar(c.fila.id)).meta.total).toBe(0);
    await contexto.prisma.senha.update({
      where: { id: c.senhas[0]!.id },
      data: { chegadaEm: new Date(agora.getTime() - 25 * 60_000 - 1) },
    });
    await service().avaliarSla(c.fila.id);
    expect(await aberto(c.fila.id)).toMatchObject({ tempoEsperaMinutos: 26, senhasAfetadas: 1 });
    const inativa = await cenario([40], { ativa: false });
    await service().avaliarSla(inativa.fila.id);
    expect((await consultar(inativa.fila.id)).meta.total).toBe(0);
  });

  it('RF-11 precedência de SLA: fila, especialidade, unidade; ignora senhas que já saíram da espera', async () => {
    const c = await cenario([15], { sla: null });
    await service().avaliarSla(c.fila.id);
    expect((await consultar(c.fila.id)).meta.total).toBe(0);
    await contexto.prisma.parametroUnidade.create({
      data: {
        unidadeId: UNIDADE_PADRAO,
        especialidadeId: c.especialidade.id,
        chave: 'SLA_MINUTOS',
        valor: 10,
      },
    });
    await service().avaliarSla(c.fila.id);
    expect((await aberto(c.fila.id)).limiteMinutos).toBe(10);
    const daFila = await cenario([15], { sla: 20 });
    await contexto.prisma.parametroUnidade.create({
      data: {
        unidadeId: UNIDADE_PADRAO,
        especialidadeId: daFila.especialidade.id,
        chave: 'SLA_MINUTOS',
        valor: 5,
      },
    });
    await service().avaliarSla(daFila.fila.id);
    expect((await consultar(daFila.fila.id)).meta.total).toBe(0);
    await contexto.prisma.fila.update({ where: { id: daFila.fila.id }, data: { slaMinutos: 12 } });
    await service().avaliarSla(daFila.fila.id);
    expect((await aberto(daFila.fila.id)).limiteMinutos).toBe(12);
    await como(api().post(`/api/v1/filas/${daFila.fila.id}/chamadas`))
      .send({})
      .expect(201);
    await service().avaliarSla(daFila.fila.id);
    expect((await consultar(daFila.fila.id)).dados[0]!.status).toBe('NORMALIZADO');
  });

  it('RF-11 varreduras simultâneas geram um aberto; índice recusa duplicação direta e permite nova ocorrência', async () => {
    const c = await cenario();
    const emitir = vi.spyOn(contexto.app.get(EventosDominio), 'emitir');
    await Promise.all(Array.from({ length: 5 }, () => service().avaliarSla(c.fila.id)));
    expect((await consultar(c.fila.id)).meta.total).toBe(1);
    expect(emitir.mock.calls.filter(([nome]) => nome === 'sla.excedido')).toHaveLength(1);
    const a = await aberto(c.fila.id);
    await expect(
      contexto.prisma.alerta.create({
        data: {
          tipo: 'SLA_EXCEDIDO',
          filaId: c.fila.id,
          unidadeId: UNIDADE_PADRAO,
          status: 'RECONHECIDO',
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
    await como(api().post(`/api/v1/filas/${c.fila.id}/chamadas`))
      .send({})
      .expect(201);
    await Promise.all([service().avaliarSla(c.fila.id), service().avaliarSla(c.fila.id)]);
    expect(emitir.mock.calls.filter(([nome]) => nome === 'sla.normalizado')).toHaveLength(1);
    await contexto.prisma.senha.update({
      where: { id: c.senhas[0]!.id },
      data: { status: 'AGUARDANDO' },
    });
    await service().avaliarSla(c.fila.id);
    expect((await consultar(c.fila.id)).meta.total).toBe(2);
    expect((await aberto(c.fila.id)).id).not.toBe(a.id);
  });

  it('T-17 reconhecimento concorrente preserva primeiro autor/horário e uma única auditoria', async () => {
    const c = await cenario();
    await service().avaliarSla(c.fila.id);
    const a = await aberto(c.fila.id);
    const r = await Promise.all(
      Array.from({ length: 3 }, () =>
        como(api().post(`/api/v1/alertas/${a.id}/reconhecimento`)).expect(200),
      ),
    );
    const primeiro = Alerta.parse(r[0]!.body);
    expect(primeiro.status).toBe('RECONHECIDO');
    expect(r.map((resposta) => Alerta.parse(resposta.body))).toEqual([
      primeiro,
      primeiro,
      primeiro,
    ]);
    const outro = await entrarComPermissoes(contexto, ['alertas:reconhecer']);
    const repetido = await como(api().post(`/api/v1/alertas/${a.id}/reconhecimento`), outro).expect(
      200,
    );
    expect(Alerta.parse(repetido.body)).toEqual(primeiro);
    expect(
      await contexto.prisma.auditLog.count({ where: { entidadeId: a.id, operacao: 'EDITAR' } }),
    ).toBe(1);
  });

  it('UC-19 filtros, ordenação por gravidade/estado, histórico e paginação respeitam o contrato', async () => {
    const criados: { id: string }[] = [];
    const configuracoes: {
      tipo: TipoAlerta;
      status: StatusAlerta;
      excesso: number;
      dia: number;
    }[] = [
      { tipo: 'SLA_EXCEDIDO', status: 'NORMALIZADO', excesso: 40, dia: 1 },
      { tipo: 'SLA_EXCEDIDO', status: 'ATIVO', excesso: 5, dia: 1 },
      { tipo: 'FILA_BLOQUEADA', status: 'RECONHECIDO', excesso: 0, dia: 2 },
      { tipo: 'SLA_EXCEDIDO', status: 'ATIVO', excesso: 20, dia: 1 },
      { tipo: 'FILA_BLOQUEADA', status: 'ATIVO', excesso: 0, dia: 1 },
      { tipo: 'SLA_EXCEDIDO', status: 'NORMALIZADO', excesso: 1, dia: 2 },
    ];
    for (const cfg of configuracoes) {
      const c = await cenario([]);
      criados.push(
        await contexto.prisma.alerta.create({
          data: {
            filaId: c.fila.id,
            unidadeId: UNIDADE_PADRAO,
            tipo: cfg.tipo,
            status: cfg.status,
            tempoEsperaMinutos: cfg.tipo === 'SLA_EXCEDIDO' ? 25 + cfg.excesso : null,
            limiteMinutos: cfg.tipo === 'SLA_EXCEDIDO' ? 25 : null,
            senhasAfetadas: 1,
            disparadoEm: new Date(`2099-01-0${cfg.dia}T12:00:00Z`),
            normalizadoEm:
              cfg.status === 'NORMALIZADO' ? new Date(`2099-01-0${cfg.dia}T13:00:00Z`) : null,
          },
        }),
      );
    }
    const query = 'de=2099-01-01T00:00:00Z&ate=2099-01-03T00:00:00Z';
    const todos = lista(await como(api().get(`/api/v1/alertas?${query}`)).expect(200));
    expect(todos.dados.map((a) => a.id)).toEqual([4, 3, 1, 2, 5, 0].map((i) => criados[i]!.id));
    const pagina = lista(
      await como(api().get(`/api/v1/alertas?${query}&pagina=2&tamanho=2`)).expect(200),
    );
    expect(pagina.dados.map((a) => a.id)).toEqual([criados[1]!.id, criados[2]!.id]);
    expect(pagina.meta).toMatchObject({ pagina: 2, tamanho: 2, total: 6, totalPaginas: 3 });
    const abertos = lista(
      await como(api().get(`/api/v1/alertas?${query}&status=ATIVO&status=RECONHECIDO`)).expect(200),
    );
    expect(abertos.meta.total).toBe(4);
    for (const q of [
      'tamanho=101',
      'status=OUTRO',
      'filaId=invalida',
      'de=2099-01-03T00:00:00Z&ate=2099-01-01T00:00:00Z',
    ])
      await como(api().get(`/api/v1/alertas?${q}`)).expect(422);
  });

  it('RNF-05 falha de auditoria desfaz disparo, normalização e ações sem eventos indevidos', async () => {
    const c = await cenario();
    const auditoria = contexto.app.get(AuditoriaService);
    const emitir = vi.spyOn(contexto.app.get(EventosDominio), 'emitir');
    const falhar = () =>
      vi
        .spyOn(auditoria, 'registrar')
        .mockRejectedValueOnce(new Error('Falha fictícia de auditoria'));
    falhar();
    await expect(service().avaliarSla(c.fila.id)).rejects.toThrow('Falha fictícia');
    expect((await consultar(c.fila.id)).meta.total).toBe(0);
    expect(emitir).not.toHaveBeenCalled();
    await service().avaliarSla(c.fila.id);
    const a = await aberto(c.fila.id);
    emitir.mockClear();
    falhar();
    await como(api().post(`/api/v1/alertas/${a.id}/reconhecimento`)).expect(500);
    expect((await aberto(c.fila.id)).status).toBe('ATIVO');
    falhar();
    await como(api().post(`/api/v1/alertas/${a.id}/escalonamento`))
      .send({ acao: 'VAGA_EXTRA' })
      .expect(500);
    expect(await contexto.prisma.escalonamento.count({ where: { alertaId: a.id } })).toBe(0);
    await contexto.prisma.senha.update({
      where: { id: c.senhas[0]!.id },
      data: { chegadaEm: agora },
    });
    falhar();
    await expect(service().avaliarSla(c.fila.id)).rejects.toThrow('Falha fictícia');
    expect((await aberto(c.fila.id)).status).toBe('ATIVO');
    expect(emitir).not.toHaveBeenCalled();
  });

  it('RNF-01 permissões independentes, 403 neutro, unidade isolada e autoria não forjável', async () => {
    const c = await cenario();
    await service().avaliarSla(c.fila.id);
    const a = await aberto(c.fila.id);
    await api().get('/api/v1/alertas').expect(401);
    const semPermissao = await entrarComPermissoes(contexto, []);
    await como(api().get('/api/v1/alertas'), semPermissao).expect(403);
    const consulta = await entrarComPermissoes(contexto, ['alertas:consultar']);
    for (const id of [a.id, randomUUID()])
      for (const operacao of ['reconhecimento', 'escalonamento'])
        await como(api().post(`/api/v1/alertas/${id}/${operacao}`), consulta)
          .send({ acao: 'VAGA_EXTRA' })
          .expect(403);
    const unidade = await contexto.prisma.unidade.create({ data: { nome: randomUUID() } });
    const outro = await entrarComPermissoes(contexto, [
      'alertas:consultar',
      'alertas:reconhecer',
      'alertas:escalonar',
    ]);
    await contexto.prisma.usuario.update({
      where: { id: outro.usuarioId },
      data: { unidadeId: unidade.id },
    });
    expect(
      lista(await como(api().get(`/api/v1/alertas?filaId=${c.fila.id}`), outro).expect(200)).meta
        .total,
    ).toBe(0);
    for (const id of [a.id, randomUUID()])
      for (const operacao of ['reconhecimento', 'escalonamento'])
        await como(api().post(`/api/v1/alertas/${id}/${operacao}`), outro)
          .send({ acao: 'VAGA_EXTRA' })
          .expect(404);
    for (const entrada of [
      { acao: 'OUTRA' },
      { acao: 'VAGA_EXTRA', acionadoPor: 'forjado' },
      { acao: 'VAGA_EXTRA', acionadoEm: agora.toISOString() },
    ])
      await como(api().post(`/api/v1/alertas/${a.id}/escalonamento`))
        .send(entrada)
        .expect(422);
    const soEscalona = await entrarComPermissoes(contexto, ['alertas:escalonar']);
    await como(api().post(`/api/v1/alertas/${a.id}/escalonamento`), soEscalona)
      .send({ acao: 'VAGA_EXTRA' })
      .expect(201);
  });

  it('RN-10 recuperação na inicialização reconcilia o bloqueio persistido sem depender de novo evento', async () => {
    const c = await cenario([], { supervisao: true });
    await contexto.prisma.fila.update({
      where: { id: c.fila.id },
      data: { bloqueada: true, bloqueadaDesde: agora },
    });
    await service().onApplicationBootstrap();
    expect((await aberto(c.fila.id, 'FILA_BLOQUEADA')).tipo).toBe('FILA_BLOQUEADA');
    await contexto.prisma.fila.update({ where: { id: c.fila.id }, data: { bloqueada: false } });
    await service().onApplicationBootstrap();
    expect((await consultar(c.fila.id)).dados[0]!.status).toBe('NORMALIZADO');
  });
});
