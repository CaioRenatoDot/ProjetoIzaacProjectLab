import { http, HttpResponse } from 'msw';

import { API_URL } from '@/lib/api/config';
import {
  type EventoAuditoria,
  type EventoAuditoriaDetalhe,
  type OperacaoAuditoria,
  type UsuarioResumo,
} from '@/lib/auditoria/tipos';

/**
 * Simulação de `GET /auditoria`, `/auditoria/{id}`, `/auditoria/exportacao` (#29) e de
 * `GET /usuarios` (#12), usado no filtro por usuário. Dados fictícios (RNF-07).
 */

const uuid = (prefixo: number, n: number) =>
  `${(n * 2654435761).toString(16).slice(-8).padStart(8, '0')}-0000-4000-8${prefixo}00-${n.toString(16).padStart(12, '0')}`;

export const USUARIOS_AUDITORIA: readonly UsuarioResumo[] = [
  {
    id: 'usuario-admin',
    nome: 'Usuário de desenvolvimento',
    perfilNome: 'Administração',
    ativo: true,
  },
  {
    id: 'usuario-recepcao',
    nome: 'Recepção de desenvolvimento',
    perfilNome: 'Recepção',
    ativo: true,
  },
  { id: 'usuario-triagem', nome: 'Triagem de desenvolvimento', perfilNome: 'Triagem', ativo: true },
  {
    id: 'usuario-estudante',
    nome: 'Estudante de desenvolvimento',
    perfilNome: 'Estudante',
    ativo: true,
  },
  {
    id: 'usuario-supervisor',
    nome: 'Supervisão de desenvolvimento',
    perfilNome: 'Supervisão',
    ativo: true,
  },
  { id: 'usuario-gestao', nome: 'Gestão de desenvolvimento', perfilNome: 'Gestão', ativo: false },
];

interface Modelo {
  usuarioId: string;
  operacao: OperacaoAuditoria;
  modulo: string;
  entidade: string;
  descricao: string;
  comRegistro: boolean;
  justificativa?: string;
}

/** Um evento de cada tipo que a tela precisa mostrar, repetidos ao longo dos últimos dias. */
const MODELOS: readonly Modelo[] = [
  {
    usuarioId: 'usuario-triagem',
    operacao: 'CONSULTAR_SENSIVEL',
    modulo: 'triagem',
    entidade: 'triagem',
    descricao: 'Consultou a ficha de triagem',
    comRegistro: true,
  },
  {
    usuarioId: 'usuario-triagem',
    operacao: 'EDITAR',
    modulo: 'senha',
    entidade: 'senha',
    descricao: 'Reclassificou prioridade - justificativa registrada',
    comRegistro: true,
    justificativa:
      'Paciente relatou piora da dor durante a espera; prioridade elevada para urgente.',
  },
  {
    usuarioId: 'usuario-supervisor',
    operacao: 'EDITAR',
    modulo: 'atendimento',
    entidade: 'atendimento',
    descricao: 'Validou encerramento',
    comRegistro: true,
  },
  {
    usuarioId: 'usuario-estudante',
    operacao: 'CONSULTAR_SENSIVEL',
    modulo: 'atendimento',
    entidade: 'atendimento',
    descricao: 'Consultou os dados clínicos do atendimento',
    comRegistro: true,
  },
  {
    usuarioId: 'usuario-recepcao',
    operacao: 'CRIAR',
    modulo: 'cadastros',
    entidade: 'paciente',
    descricao: 'Cadastrou paciente',
    comRegistro: true,
  },
  {
    usuarioId: 'usuario-recepcao',
    operacao: 'LOGIN',
    modulo: 'auth',
    entidade: 'sessao',
    descricao: 'Entrou no sistema',
    comRegistro: false,
  },
  {
    usuarioId: 'usuario-admin',
    operacao: 'EDITAR',
    modulo: 'perfis',
    entidade: 'perfil',
    descricao: 'Alterou as permissões do perfil',
    comRegistro: true,
  },
  {
    usuarioId: 'usuario-admin',
    operacao: 'EXCLUIR',
    modulo: 'cadastros',
    entidade: 'sala',
    descricao: 'Excluiu sala',
    comRegistro: true,
  },
  {
    usuarioId: 'usuario-gestao',
    operacao: 'EXPORTAR',
    modulo: 'indicadores',
    entidade: 'indicadores',
    descricao: 'Exportou os indicadores do período',
    comRegistro: false,
  },
  {
    usuarioId: 'usuario-recepcao',
    operacao: 'LOGOUT',
    modulo: 'auth',
    entidade: 'sessao',
    descricao: 'Saiu do sistema',
    comRegistro: false,
  },
];

const QUANTIDADE = 45;
/** Eventos a cada 45 minutos, a partir desta data para trás. */
const MAIS_RECENTE = Date.parse('2026-10-21T17:30:00-03:00');
const INTERVALO_MS = 45 * 60_000;

type EventoInterno = EventoAuditoriaDetalhe & { usuarioId: string };

function usuario(id: string) {
  return USUARIOS_AUDITORIA.find((u) => u.id === id) ?? USUARIOS_AUDITORIA[0]!;
}

function montarEvento(
  modelo: Modelo,
  n: number,
  ocorridoEm: number,
  entidadeId: string | null,
): EventoInterno {
  const autor = usuario(modelo.usuarioId);
  return {
    id: uuid(1, n),
    usuarioId: autor.id,
    usuarioNome: autor.nome,
    perfilNoMomento: autor.perfilNome,
    operacao: modelo.operacao,
    modulo: modelo.modulo,
    entidade: modelo.entidade,
    entidadeId,
    descricao: modelo.descricao,
    sensivel: modelo.operacao === 'CONSULTAR_SENSIVEL',
    ocorridoEm: new Date(ocorridoEm).toISOString(),
    justificativa: modelo.justificativa ?? null,
    origemIp: `10.0.0.${(n % 40) + 10}`,
    userAgent: 'Mozilla/5.0 (simulação de desenvolvimento)',
    requestId: uuid(3, n),
  };
}

function criarEventos(): EventoInterno[] {
  return Array.from({ length: QUANTIDADE }, (_, i) => {
    const modelo = MODELOS[i % MODELOS.length]!;
    // Registros se repetem para o filtro "registro afetado" achar mais de um evento.
    const entidadeId = modelo.comRegistro ? uuid(2, (i % 7) + 1) : null;
    return montarEvento(modelo, i + 1, MAIS_RECENTE - i * INTERVALO_MS, entidadeId);
  });
}

let eventos = criarEventos();

export function reiniciarMockAuditoria() {
  eventos = criarEventos();
}

const problema = (status: number, codigo: string, title: string, detail: string) =>
  HttpResponse.json(
    { title, status, codigo, detail },
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  );

/** 403 neutro também para evento inexistente (`docs/04` §3). */
const semPermissao = () =>
  problema(403, 'SEM_PERMISSAO', 'Sem permissão', 'Seu perfil não tem acesso a este conteúdo.');

function filtrar(q: URLSearchParams) {
  const de = q.get('de');
  const ate = q.get('ate');
  return eventos
    .filter(
      (e) =>
        (!q.get('usuarioId') || e.usuarioId === q.get('usuarioId')) &&
        (!q.get('modulo') || e.modulo === q.get('modulo')) &&
        (!q.get('operacao') || e.operacao === q.get('operacao')) &&
        (!q.get('entidadeId') || e.entidadeId === q.get('entidadeId')) &&
        (!de || e.ocorridoEm >= de) &&
        (!ate || e.ocorridoEm <= ate),
    )
    .sort((a, b) => b.ocorridoEm.localeCompare(a.ocorridoEm));
}

function resumo({
  usuarioId: _usuarioId,
  justificativa: _justificativa,
  origemIp: _origemIp,
  userAgent: _userAgent,
  requestId: _requestId,
  ...evento
}: EventoInterno): EventoAuditoria {
  return evento;
}

function paginar<T>(lista: T[], q: URLSearchParams) {
  const pagina = Math.max(1, Number(q.get('pagina') ?? 1));
  const tamanho = Math.min(100, Math.max(1, Number(q.get('tamanho') ?? 20)));
  return {
    dados: lista.slice((pagina - 1) * tamanho, pagina * tamanho),
    meta: {
      pagina,
      tamanho,
      total: lista.length,
      totalPaginas: Math.max(1, Math.ceil(lista.length / tamanho)),
    },
  };
}

const celula = (valor: string | null) => `"${(valor ?? '').replaceAll('"', '""')}"`;

function csv(lista: EventoInterno[]) {
  const cabecalho = [
    'Data e hora',
    'Usuário',
    'Perfil',
    'Operação',
    'Módulo',
    'Registro',
    'Descrição',
  ];
  const linhas = lista.map((e) =>
    [
      e.ocorridoEm,
      e.usuarioNome,
      e.perfilNoMomento,
      e.operacao,
      e.modulo,
      e.entidadeId,
      e.descricao,
    ]
      .map(celula)
      .join(';'),
  );
  return [cabecalho.map(celula).join(';'), ...linhas].join('\n');
}

export const handlersAuditoria = [
  http.get(`${API_URL}/auditoria`, ({ request }) => {
    const q = new URL(request.url).searchParams;
    const pagina = paginar(filtrar(q), q);
    return HttpResponse.json({ ...pagina, dados: pagina.dados.map(resumo) });
  }),

  // Antes de `/auditoria/:id`, senão "exportacao" seria lido como id.
  http.get(`${API_URL}/auditoria/exportacao`, ({ request }) => {
    const resultado = filtrar(new URL(request.url).searchParams);
    // A própria exportação vira evento na trilha (T-18).
    const n = eventos.length + 1;
    eventos = [
      montarEvento(
        {
          usuarioId: 'usuario-admin',
          operacao: 'EXPORTAR',
          modulo: 'auditoria',
          entidade: 'audit_log',
          descricao: `Exportou a trilha de auditoria (${resultado.length} registros)`,
          comRegistro: false,
        },
        n,
        Math.max(Date.now(), MAIS_RECENTE + 60_000),
        null,
      ),
      ...eventos,
    ];
    return new HttpResponse(csv(resultado), {
      headers: { 'Content-Type': 'text/csv; charset=utf-8' },
    });
  }),

  http.get(`${API_URL}/auditoria/:id`, ({ params }) => {
    const evento = eventos.find((e) => e.id === params.id);
    if (!evento) return semPermissao();
    const { usuarioId: _usuarioId, ...detalhe } = evento;
    return HttpResponse.json(detalhe);
  }),

  http.get(`${API_URL}/usuarios`, ({ request }) => {
    const q = new URL(request.url).searchParams;
    return HttpResponse.json(paginar([...USUARIOS_AUDITORIA], q));
  }),
];
