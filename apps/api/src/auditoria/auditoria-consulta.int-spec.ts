import {
  type EventoAuditoria,
  type EventoAuditoriaDetalhe,
  type ItemReferencia,
  type RespostaPaginada,
} from '@filas/contracts';
import { type PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  criarAppIntegracao,
  entrarComPermissoes,
  type SessaoDeTeste,
} from '../common/testing/app-integracao';
import { type AppDeTeste } from '../common/testing/criar-app-de-teste';
import { AuditoriaConsultaModule } from './auditoria-consulta.module';

type Contexto = AppDeTeste & { prisma: PrismaClient };

let contexto: Contexto;
let auditor: SessaoDeTeste;
let leitor: SessaoDeTeste;
const corpo = <T>(resposta: request.Response) => resposta.body as T;
const api = () => request(contexto.servidor);
const comToken = (req: request.Test, sessao = auditor) =>
  req.set('Authorization', `Bearer ${sessao.token}`);
const PERIODO = `de=${encodeURIComponent('2020-01-01T00:00:00-03:00')}&ate=${encodeURIComponent(
  '2099-01-01T00:00:00-03:00',
)}`;
const periodoRecente = () => {
  const ate = new Date(Date.now() + 60_000).toISOString();
  const de = new Date(Date.now() - 86_400_000).toISOString();
  return `de=${encodeURIComponent(de)}&ate=${encodeURIComponent(ate)}`;
};

describe('consulta e exportação da trilha de auditoria (#29)', () => {
  beforeAll(async () => {
    contexto = await criarAppIntegracao({ imports: [AuditoriaConsultaModule] });
    auditor = await entrarComPermissoes(contexto, ['auditoria:consultar', 'auditoria:exportar']);
    leitor = await entrarComPermissoes(contexto, ['auditoria:consultar']);
  });

  afterAll(async () => {
    await contexto.app.close();
    await contexto.prisma.$disconnect();
  });

  it('UC-20 lista a trilha em ordem cronológica decrescente e filtra por operação', async () => {
    const resposta = await comToken(
      api().get(`/api/v1/auditoria?usuarioId=${auditor.usuarioId}&operacao=LOGIN`),
    ).expect(200);

    const { dados } = corpo<RespostaPaginada<EventoAuditoria>>(resposta);
    expect(dados.length).toBeGreaterThan(0);
    expect(dados.every((e) => e.operacao === 'LOGIN' && e.modulo === 'auth')).toBe(true);
    expect(dados[0]?.descricao).toBe('Entrou no sistema');
    const datas = dados.map((e) => e.ocorridoEm);
    expect([...datas].sort().reverse()).toEqual(datas);
  });

  it('recusa módulo fora da lista e período invertido', async () => {
    await comToken(api().get('/api/v1/auditoria?modulo=financeiro')).expect(422);
    await comToken(
      api().get(
        `/api/v1/auditoria?de=${encodeURIComponent('2026-10-20T00:00:00Z')}&ate=${encodeURIComponent('2026-10-01T00:00:00Z')}`,
      ),
    ).expect(422);
  });

  it('o detalhe traz perfil, origem e request id, e a consulta não gera registro', async () => {
    const [evento] = corpo<RespostaPaginada<EventoAuditoria>>(
      await comToken(api().get(`/api/v1/auditoria?usuarioId=${auditor.usuarioId}`)),
    ).dados;
    const antes = await contexto.prisma.auditLog.count({ where: { usuarioId: auditor.usuarioId } });

    const detalhe = corpo<EventoAuditoriaDetalhe>(
      await comToken(api().get(`/api/v1/auditoria/${evento!.id}`)).expect(200),
    );

    expect(detalhe.perfilNoMomento).toMatch(/^Perfil de teste/);
    expect(detalhe.origemIp).not.toBe('');
    expect(await contexto.prisma.auditLog.count({ where: { usuarioId: auditor.usuarioId } })).toBe(
      antes,
    );
  });

  it('usuários do filtro saem com só auditoria:consultar', async () => {
    const { nome } = await contexto.prisma.usuario.findUniqueOrThrow({
      where: { id: leitor.usuarioId },
    });
    const resposta = await comToken(
      api().get(`/api/v1/auditoria/usuarios?busca=${encodeURIComponent(nome)}`),
      leitor,
    ).expect(200);

    const { dados } = corpo<RespostaPaginada<ItemReferencia>>(resposta);
    expect(dados.some((u) => u.id === leitor.usuarioId)).toBe(true);
    expect(Object.keys(dados[0]!).sort()).toEqual(['id', 'nome']);
  });

  describe('exportação', () => {
    it('exige o período', async () => {
      await comToken(api().get('/api/v1/auditoria/exportacao')).expect(422);
    });

    it('exige auditoria:exportar, antes de validar o período', async () => {
      await comToken(api().get(`/api/v1/auditoria/exportacao?${PERIODO}`), leitor).expect(403);
      await comToken(api().get(`/api/v1/auditoria/exportacao?${periodoRecente()}`), leitor).expect(
        403,
      );
    });

    it('gera CSV com cabeçalho e grava EXPORTAR com os filtros', async () => {
      const resposta = await comToken(
        api().get(`/api/v1/auditoria/exportacao?${periodoRecente()}&operacao=LOGIN`),
      ).expect(200);

      expect(resposta.headers['content-type']).toContain('text/csv');
      const linhas = resposta.text.split('\n');
      expect(linhas[0]).toBe(
        'ocorridoEm;usuario;perfilNoMomento;operacao;modulo;entidade;entidadeId;sensivel;justificativa;requestId',
      );
      expect(linhas.slice(1).every((l) => l.split(';')[3] === 'LOGIN')).toBe(true);
      const exportacao = await contexto.prisma.auditLog.findFirst({
        where: { usuarioId: auditor.usuarioId, operacao: 'EXPORTAR' },
        orderBy: { ocorridoEm: 'desc' },
      });
      expect(exportacao?.justificativa).toMatch(/operacao=LOGIN/);
    });

    it('neutraliza conteúdo que viraria fórmula na planilha', async () => {
      await contexto.prisma.auditLog.create({
        data: {
          usuarioId: auditor.usuarioId,
          operacao: 'EDITAR',
          modulo: 'cadastros',
          entidade: '=HYPERLINK("http://malicioso.invalid")',
        },
      });

      const resposta = await comToken(
        api().get(
          `/api/v1/auditoria/exportacao?${periodoRecente()}&usuarioId=${auditor.usuarioId}`,
        ),
      ).expect(200);

      expect(resposta.text).toContain(`"'=HYPERLINK(""http://malicioso.invalid"")"`);
    });
  });
});
