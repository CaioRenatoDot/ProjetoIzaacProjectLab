import { http, HttpResponse } from 'msw';

import { API_URL } from '@/lib/api/config';
import {
  type AcaoEscalonamento,
  type Alerta,
  type Escalonamento,
  type StatusAlerta,
} from '@/lib/alertas/tipos';

/**
 * Simulação de `GET /alertas`, `/reconhecimento` e `/escalonamento` (#28). Dados fictícios.
 * `dispararAlertaMock` e `normalizarAlertaMock` fazem o papel da varredura de SLA nos testes.
 */

const AUTOR_MOCK = 'Usuário de desenvolvimento';
const MINUTO = 60_000;

const ESPECIALIDADES = ['Fisioterapia', 'Fonoaudiologia', 'Nutrição', 'Psicologia', 'Odontologia'];

function base(id: string, parcial: Partial<Alerta>): Alerta {
  return {
    id,
    tipo: 'SLA_EXCEDIDO',
    status: 'ATIVO',
    filaId: 'fila-1',
    especialidade: 'Fisioterapia',
    tempoEsperaMinutos: null,
    limiteMinutos: null,
    senhasAfetadas: 0,
    disparadoEm: new Date().toISOString(),
    reconhecidoPor: null,
    reconhecidoEm: null,
    normalizadoEm: null,
    escalonamentos: [],
    ...parcial,
  };
}

function criarAlertas(): Alerta[] {
  const agora = Date.now();
  const emAberto = [
    base('alerta-1', {
      filaId: 'fila-1',
      especialidade: 'Fisioterapia',
      tempoEsperaMinutos: 32,
      limiteMinutos: 25,
      senhasAfetadas: 6,
      disparadoEm: new Date(agora - 12 * MINUTO).toISOString(),
    }),
    base('alerta-2', {
      tipo: 'FILA_BLOQUEADA',
      filaId: 'fila-2',
      especialidade: 'Fonoaudiologia',
      senhasAfetadas: 4,
      disparadoEm: new Date(agora - 20 * MINUTO).toISOString(),
    }),
    base('alerta-3', {
      status: 'RECONHECIDO',
      filaId: 'fila-4',
      especialidade: 'Psicologia',
      tempoEsperaMinutos: 41,
      limiteMinutos: 30,
      senhasAfetadas: 3,
      disparadoEm: new Date(agora - 45 * MINUTO).toISOString(),
      reconhecidoPor: 'Gestão de desenvolvimento',
      reconhecidoEm: new Date(agora - 30 * MINUTO).toISOString(),
    }),
  ];
  const historico = Array.from({ length: 24 }, (_, i) => {
    const disparo = agora - (i + 2) * 3 * 60 * MINUTO;
    return base(`alerta-historico-${i + 1}`, {
      tipo: i % 6 === 2 ? 'FILA_BLOQUEADA' : 'SLA_EXCEDIDO',
      status: 'NORMALIZADO',
      filaId: `fila-${(i % 5) + 1}`,
      especialidade: ESPECIALIDADES[i % ESPECIALIDADES.length]!,
      tempoEsperaMinutos: i % 6 === 2 ? null : 28 + (i % 9),
      limiteMinutos: i % 6 === 2 ? null : 25,
      senhasAfetadas: 2 + (i % 5),
      disparadoEm: new Date(disparo).toISOString(),
      normalizadoEm: new Date(disparo + (15 + i) * MINUTO).toISOString(),
    });
  });
  return [...emAberto, ...historico];
}

let alertas = criarAlertas();
let sequencia = 0;

export function reiniciarMockAlertas() {
  alertas = criarAlertas();
  sequencia = 0;
}

/** Simula a varredura de SLA gerando um alerta novo (evento `sla.excedido`). */
export function dispararAlertaMock(parcial: Partial<Alerta> = {}) {
  sequencia += 1;
  const novo = base(`alerta-novo-${sequencia}`, {
    filaId: 'fila-3',
    especialidade: 'Nutrição',
    tempoEsperaMinutos: 27,
    limiteMinutos: 20,
    senhasAfetadas: 2,
    ...parcial,
  });
  alertas = [novo, ...alertas];
  return novo;
}

/** Simula a espera voltando ao limite (evento `sla.normalizado`). */
export function normalizarAlertaMock(id: string) {
  alertas = alertas.map((a) =>
    a.id === id ? { ...a, status: 'NORMALIZADO', normalizadoEm: new Date().toISOString() } : a,
  );
}

const problema = (status: number, codigo: string, title: string, detail: string) =>
  HttpResponse.json(
    { title, status, codigo, detail },
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  );

/** 403 neutro também para alerta inexistente (`docs/04` §3). */
const semPermissao = () =>
  problema(403, 'SEM_PERMISSAO', 'Sem permissão', 'Seu perfil não tem acesso a este conteúdo.');

/** Ordem simulada: bloqueio primeiro, depois maior excesso sobre o limite, depois o mais recente. */
function gravidade(a: Alerta) {
  if (a.tipo === 'FILA_BLOQUEADA') return 1_000_000;
  return (a.tempoEsperaMinutos ?? 0) - (a.limiteMinutos ?? 0);
}

const ACOES: readonly AcaoEscalonamento[] = ['REFORCO_ATENDENTE', 'VAGA_EXTRA'];

export const handlersAlertas = [
  http.get(`${API_URL}/alertas`, ({ request }) => {
    const q = new URL(request.url).searchParams;
    const status = q.getAll('status') as StatusAlerta[];
    const filaId = q.get('filaId');
    const lista = alertas
      .filter(
        (a) =>
          (status.length === 0 || status.includes(a.status)) && (!filaId || a.filaId === filaId),
      )
      .sort((a, b) =>
        a.status === 'NORMALIZADO' && b.status === 'NORMALIZADO'
          ? (b.normalizadoEm ?? '').localeCompare(a.normalizadoEm ?? '')
          : gravidade(b) - gravidade(a) || b.disparadoEm.localeCompare(a.disparadoEm),
      );
    const pagina = Math.max(1, Number(q.get('pagina') ?? 1));
    const tamanho = Math.min(100, Math.max(1, Number(q.get('tamanho') ?? 20)));
    return HttpResponse.json({
      dados: lista.slice((pagina - 1) * tamanho, pagina * tamanho),
      meta: {
        pagina,
        tamanho,
        total: lista.length,
        totalPaginas: Math.max(1, Math.ceil(lista.length / tamanho)),
      },
    });
  }),

  http.post(`${API_URL}/alertas/:id/reconhecimento`, ({ params }) => {
    const alerta = alertas.find((a) => a.id === params.id);
    if (!alerta) return semPermissao();
    if (alerta.status === 'ATIVO') {
      Object.assign(alerta, {
        status: 'RECONHECIDO',
        reconhecidoPor: AUTOR_MOCK,
        reconhecidoEm: new Date().toISOString(),
      });
    }
    return HttpResponse.json(alerta);
  }),

  http.post(`${API_URL}/alertas/:id/escalonamento`, async ({ params, request }) => {
    const alerta = alertas.find((a) => a.id === params.id);
    if (!alerta) return semPermissao();
    const { acao, observacao } = (await request.json()) as {
      acao?: AcaoEscalonamento;
      observacao?: string;
    };
    if (!acao || !ACOES.includes(acao)) {
      return HttpResponse.json(
        {
          title: 'Dados inválidos',
          status: 422,
          codigo: 'VALIDACAO',
          detail: 'Escolha a medida de escalonamento.',
          campos: [{ campo: 'acao', mensagem: 'Escolha a medida de escalonamento.' }],
        },
        { status: 422, headers: { 'Content-Type': 'application/problem+json' } },
      );
    }
    sequencia += 1;
    const escalonamento: Escalonamento = {
      id: `escalonamento-${sequencia}`,
      alertaId: alerta.id,
      acao,
      observacao: observacao?.trim() || null,
      acionadoPor: AUTOR_MOCK,
      acionadoEm: new Date().toISOString(),
    };
    alerta.escalonamentos = [...(alerta.escalonamentos ?? []), escalonamento];
    return HttpResponse.json(escalonamento, { status: 201 });
  }),
];
