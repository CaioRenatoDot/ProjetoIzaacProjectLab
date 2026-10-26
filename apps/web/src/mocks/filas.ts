import { type Prioridade, type StatusSenha, type TipoAtendimento } from '@filas/contracts';
import { http, HttpResponse } from 'msw';

import { API_URL } from '@/lib/api/config';
import { type Chamada, type Fila, type SenhaResumo } from '@/lib/fila/tipos';
import { type Reclassificacao } from '@/lib/triagem/tipos';

import { usuarioMockDaRequisicao } from './handlers';

/**
 * Simulação única das filas e senhas, até a API da Etapa 6 (#17 a #19). Atende o painel de fila
 * (#41) e a tela de Ausências (#47), que agem sobre o mesmo estado. Dados fictícios (RNF-07).
 *
 * - Fisioterapia: os seis cenários da #47 (F013 a F018), sem alteração.
 * - Fonoaudiologia: bloqueada por falta de supervisor (RN-10).
 * - Nutrição: prioridades (RN-03, RN-04), SLA excedido e os demais status do quadro.
 * - Psicologia: fila vazia.
 */

export interface SenhaSimulada extends SenhaResumo {
  sequenciaChamada: number;
  reclassificacoes: Reclassificacao[];
}

/** Parâmetros da unidade simulados (a API real lê `parametro_unidade`). */
const PARAMETROS = { justificativaMinCaracteres: 20, toleranciaMinutos: 5, slaMinutos: 25 };

const PESO_PRIORIDADE: Record<Prioridade, number> = { URGENTE: 0, PREFERENCIAL: 1, NORMAL: 2 };

let filas: Fila[] = [];
let senhas: SenhaSimulada[] = [];
let sequencia = 0;
const respostasIdempotentes = new Map<string, Record<string, unknown>>();
const antesDoQuadro = new Set<() => void>();

/** Estado compartilhado: a simulação de ausências registra sobre as mesmas senhas. */
export function senhasDaSimulacao() {
  return senhas;
}

/**
 * Senha sem os campos internos da simulação. O histórico de reclassificações traz a
 * justificativa, dado sensível que nunca sai em resposta de lista ou de ação (ADR-003).
 */
export function semCamposInternos<T extends Partial<SenhaSimulada>>(senha: T) {
  const { sequenciaChamada: _sequencia, reclassificacoes: _reclassificacoes, ...publica } = senha;
  return publica;
}

/** Filas da simulação: o encaminhamento interno (#46) gera senha na fila de destino. */
export function filasDaSimulacao() {
  return filas;
}

const LETRA_DA_FILA: Record<string, string> = {
  Fisioterapia: 'F',
  Fonoaudiologia: 'O',
  Nutrição: 'N',
  Psicologia: 'P',
};

/** Nova senha AGUARDANDO na fila, como a emissão faria (encaminhamento interno, RF-08). */
export function incluirSenhaSimulada(
  f: Fila,
  dados: { pacienteIniciais: string; prioridade: Prioridade },
): SenhaResumo {
  const letra = LETRA_DA_FILA[f.especialidade] ?? 'X';
  const ultimo = Math.max(
    0,
    ...senhas.filter((x) => x.filaId === f.id).map((x) => Number(x.numero.slice(1)) || 0),
  );
  const agora = Date.now();
  const nova = senha(f, agora, {
    id: `senha-encaminhada-${senhas.length + 1}`,
    numero: `${letra}${String(ultimo + 1).padStart(3, '0')}`,
    pacienteIniciais: dados.pacienteIniciais,
    status: 'AGUARDANDO',
    chegouHaMinutos: 0,
    prioridade: dados.prioridade,
  });
  senhas.push(nova);
  return resumo(nova, f, agora);
}

/** Roda antes de cada leitura do quadro (ex.: expiração automática da tolerância, #47). */
export function aoConsultarQuadro(acao: () => void) {
  antesDoQuadro.add(acao);
}

function fila(
  id: string,
  especialidadeId: string,
  especialidade: string,
  bloqueio: Fila['bloqueio'] = { ativo: false, motivo: null, desde: null },
): Fila {
  return {
    id,
    nome: `Fila de ${especialidade}`,
    especialidadeId,
    especialidade,
    ativa: true,
    slaMinutos: PARAMETROS.slaMinutos,
    toleranciaMinutos: PARAMETROS.toleranciaMinutos,
    bloqueio,
  };
}

interface SementeSenha {
  id: string;
  numero: string;
  pacienteIniciais: string;
  status: StatusSenha;
  chegouHaMinutos: number;
  prioridade?: Prioridade;
  tipoAtendimento?: TipoAtendimento;
  chamadaEm?: string | null;
  toleranciaAte?: string | null;
  temAgendamentoPrevio?: boolean;
}

function senha(filaBase: Fila, agora: number, s: SementeSenha): SenhaSimulada {
  const chamada = s.status === 'CHAMADA' || s.status === 'AGUARDANDO_RECURSO';
  return {
    id: s.id,
    numero: s.numero,
    filaId: filaBase.id,
    especialidade: filaBase.especialidade,
    pacienteIniciais: s.pacienteIniciais,
    prioridade: s.prioridade ?? 'NORMAL',
    tipoAtendimento: s.tipoAtendimento ?? 'PRIMEIRA_CONSULTA',
    status: s.status,
    posicao: null,
    chegadaEm: new Date(agora - s.chegouHaMinutos * 60_000).toISOString(),
    chamadaEm: s.chamadaEm ?? (chamada ? new Date(agora - 2 * 60_000).toISOString() : null),
    toleranciaAte: s.toleranciaAte ?? null,
    tempoEsperaMinutos: 0,
    slaExcedido: false,
    temAgendamentoPrevio: s.temAgendamentoPrevio ?? false,
    versao: 1,
    chamadaId: chamada ? `chamada-${s.id}` : null,
    sequenciaChamada: chamada ? 1 : 0,
    reclassificacoes: [],
  };
}

export function reiniciarMockFilas() {
  const agora = Date.now();
  const fisioterapia = fila('fila-ausencias-dev', 'especialidade-1', 'Fisioterapia');
  const fonoaudiologia = fila('fila-fonoaudiologia', 'especialidade-2', 'Fonoaudiologia', {
    ativo: true,
    motivo: 'Sem supervisor habilitado disponível',
    desde: new Date(agora - 18 * 60_000).toISOString(),
  });
  const nutricao = fila('fila-nutricao', 'especialidade-3', 'Nutrição');
  const psicologia = fila('fila-psicologia', 'especialidade-4', 'Psicologia');
  filas = [fisioterapia, fonoaudiologia, nutricao, psicologia];

  // Cenários da #47: chamadas com tolerância em curso; F017 expira em 30 s.
  const chamadaEm = new Date(agora).toISOString();
  const tolerancia = new Date(agora + 300_000).toISOString();
  const doFisio = (s: Omit<SementeSenha, 'chamadaEm' | 'toleranciaAte'> & Partial<SementeSenha>) =>
    senha(fisioterapia, agora, {
      chamadaEm: s.status === 'AGUARDANDO' ? null : chamadaEm,
      toleranciaAte: s.status === 'CHAMADA' ? tolerancia : null,
      ...s,
    });

  senhas = [
    doFisio({
      id: 'senha-f013',
      numero: 'F013',
      pacienteIniciais: 'A. B. T.',
      status: 'CHAMADA',
      chegouHaMinutos: 60,
    }),
    doFisio({
      id: 'senha-f014',
      numero: 'F014',
      pacienteIniciais: 'M. A. S.',
      status: 'CHAMADA',
      chegouHaMinutos: 55,
    }),
    doFisio({
      id: 'senha-f015',
      numero: 'F015',
      pacienteIniciais: 'J. C. L.',
      status: 'AGUARDANDO',
      chegouHaMinutos: 50,
    }),
    doFisio({
      id: 'senha-f016',
      numero: 'F016',
      pacienteIniciais: 'P. R. A.',
      status: 'EM_ATENDIMENTO',
      chegouHaMinutos: 45,
    }),
    doFisio({
      id: 'senha-f017',
      numero: 'F017',
      pacienteIniciais: 'L. F. R.',
      status: 'CHAMADA',
      chegouHaMinutos: 40,
      toleranciaAte: new Date(agora + 30_000).toISOString(),
    }),
    doFisio({
      id: 'senha-f018',
      numero: 'F018',
      pacienteIniciais: 'C. D. S.',
      status: 'CHAMADA',
      chegouHaMinutos: 35,
    }),

    senha(fonoaudiologia, agora, {
      id: 'senha-o201',
      numero: 'O201',
      pacienteIniciais: 'R. T. M.',
      status: 'AGUARDANDO',
      chegouHaMinutos: 22,
    }),
    senha(fonoaudiologia, agora, {
      id: 'senha-o202',
      numero: 'O202',
      pacienteIniciais: 'E. S. P.',
      status: 'AGUARDANDO',
      chegouHaMinutos: 9,
      prioridade: 'PREFERENCIAL',
    }),

    senha(nutricao, agora, {
      id: 'senha-n101',
      numero: 'N101',
      pacienteIniciais: 'G. H. B.',
      status: 'AGUARDANDO',
      chegouHaMinutos: 15,
      tipoAtendimento: 'RETORNO',
    }),
    senha(nutricao, agora, {
      id: 'senha-n102',
      numero: 'N102',
      pacienteIniciais: 'I. M. C.',
      status: 'AGUARDANDO',
      chegouHaMinutos: 10,
      prioridade: 'PREFERENCIAL',
    }),
    senha(nutricao, agora, {
      id: 'senha-n103',
      numero: 'N103',
      pacienteIniciais: 'K. L. D.',
      status: 'AGUARDANDO',
      chegouHaMinutos: 4,
      prioridade: 'URGENTE',
      tipoAtendimento: 'ENCAIXE',
    }),
    senha(nutricao, agora, {
      id: 'senha-n104',
      numero: 'N104',
      pacienteIniciais: 'O. P. Q.',
      status: 'AGUARDANDO',
      chegouHaMinutos: 38,
      temAgendamentoPrevio: true,
    }),
    senha(nutricao, agora, {
      id: 'senha-n105',
      numero: 'N105',
      pacienteIniciais: 'S. U. V.',
      status: 'CHAMADA',
      chegouHaMinutos: 42,
      toleranciaAte: new Date(agora + 180_000).toISOString(),
    }),
    senha(nutricao, agora, {
      id: 'senha-n106',
      numero: 'N106',
      pacienteIniciais: 'W. X. Y.',
      status: 'AGUARDANDO_RECURSO',
      chegouHaMinutos: 48,
    }),
    senha(nutricao, agora, {
      id: 'senha-n107',
      numero: 'N107',
      pacienteIniciais: 'Z. A. B.',
      status: 'EM_ATENDIMENTO',
      chegouHaMinutos: 60,
      tipoAtendimento: 'RETORNO',
    }),
    senha(nutricao, agora, {
      id: 'senha-n108',
      numero: 'N108',
      pacienteIniciais: 'C. E. F.',
      status: 'PAUSADO',
      chegouHaMinutos: 70,
    }),
    senha(nutricao, agora, {
      id: 'senha-n109',
      numero: 'N109',
      pacienteIniciais: 'H. J. K.',
      status: 'PENDENTE_VALIDACAO',
      chegouHaMinutos: 80,
    }),
  ];
  sequencia = 0;
  respostasIdempotentes.clear();
}

reiniciarMockFilas();

/** Ordem da RN-04: prioridade, depois chegada, depois agendamento prévio. */
function ordemRn04(a: SenhaResumo, b: SenhaResumo) {
  return (
    PESO_PRIORIDADE[a.prioridade] - PESO_PRIORIDADE[b.prioridade] ||
    Date.parse(a.chegadaEm) - Date.parse(b.chegadaEm) ||
    Number(b.temAgendamentoPrevio) - Number(a.temAgendamentoPrevio)
  );
}

function daFila(filaId: string) {
  return senhas.filter((s) => s.filaId === filaId).sort(ordemRn04);
}

/** Projeção `SenhaResumo`, com espera, SLA e posição calculados na hora da leitura. */
function resumo(s: SenhaSimulada, f: Fila, agora: number): SenhaResumo {
  const dados = semCamposInternos(s);
  const tempoEsperaMinutos = Math.max(0, Math.floor((agora - Date.parse(s.chegadaEm)) / 60_000));
  const aguardando = daFila(f.id).filter((x) => x.status === 'AGUARDANDO');
  const posicao = s.status === 'AGUARDANDO' ? aguardando.findIndex((x) => x.id === s.id) + 1 : null;
  return {
    ...dados,
    tempoEsperaMinutos,
    slaExcedido: s.status === 'AGUARDANDO' && tempoEsperaMinutos > f.slaMinutos,
    posicao,
  };
}

function problema(
  status: number,
  codigo: string,
  detail: string,
  title = 'Não foi possível concluir',
) {
  return HttpResponse.json(
    { status, codigo, title, detail },
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  );
}

function autorizar(request: Request, cookies: Record<string, string>, permissao: string) {
  const usuario = usuarioMockDaRequisicao(request, cookies);
  if (!usuario) return problema(401, 'NAO_AUTENTICADO', 'Sua sessão expirou. Entre novamente.');
  if (!usuario.permissoes.includes(permissao))
    return problema(403, 'SEM_PERMISSAO', 'Seu perfil não tem acesso a este conteúdo.');
  return null;
}

const semPermissao = () =>
  problema(403, 'SEM_PERMISSAO', 'Seu perfil não tem acesso a este conteúdo.');

function chamadaDe(s: SenhaSimulada, f: Fila): Chamada {
  return {
    id: s.chamadaId ?? '',
    senhaId: s.id,
    numero: s.numero,
    local: f.especialidade,
    sequencia: s.sequenciaChamada,
    chamadoEm: s.chamadaEm ?? new Date().toISOString(),
    chamadoPor: 'Usuário de desenvolvimento',
  };
}

export const handlersFilas = [
  http.get(`${API_URL}/filas`, ({ request, cookies }) => {
    const erro = autorizar(request, cookies, 'fila:consultar');
    if (erro) return erro;
    const ativa = new URL(request.url).searchParams.get('ativa');
    const lista = ativa === 'true' ? filas.filter((x) => x.ativa) : filas;
    return HttpResponse.json({
      dados: lista,
      meta: { pagina: 1, tamanho: 100, total: lista.length, totalPaginas: 1 },
    });
  }),

  http.get(`${API_URL}/filas/:id/senhas`, ({ request, cookies, params }) => {
    const erro = autorizar(request, cookies, 'fila:consultar');
    if (erro) return erro;
    const f = filas.find((x) => x.id === params.id);
    if (!f) return problema(404, 'NAO_ENCONTRADO', 'Fila não encontrada. Atualize a lista.');
    for (const acao of antesDoQuadro) acao();

    const agora = Date.now();
    const url = new URL(request.url);
    const tipo = url.searchParams.get('tipoAtendimento');
    const pagina = Math.max(1, Number(url.searchParams.get('pagina')) || 1);
    const tamanho = Math.min(100, Math.max(1, Number(url.searchParams.get('tamanho')) || 20));
    const todas = daFila(f.id).map((s) => resumo(s, f, agora));
    const lista = tipo ? todas.filter((s) => s.tipoAtendimento === tipo) : todas;
    const aguardando = todas.filter((s) => s.status === 'AGUARDANDO');
    const contar = (status: StatusSenha) => todas.filter((s) => s.status === status).length;

    return HttpResponse.json({
      fila: f,
      metricas: {
        aguardando: aguardando.length,
        chamadas: contar('CHAMADA'),
        emAtendimento: contar('EM_ATENDIMENTO'),
        ausenciasHoje: contar('AUSENTE'),
        tempoMedioEsperaMinutos: aguardando.length
          ? Math.round(aguardando.reduce((t, s) => t + s.tempoEsperaMinutos, 0) / aguardando.length)
          : null,
      },
      dados: lista.slice((pagina - 1) * tamanho, pagina * tamanho),
      meta: {
        pagina,
        tamanho,
        total: lista.length,
        totalPaginas: Math.max(1, Math.ceil(lista.length / tamanho)),
      },
      sincronizadoEm: new Date().toISOString(),
    });
  }),

  http.post(`${API_URL}/filas/:id/chamadas`, ({ request, cookies, params }) => {
    const erro = autorizar(request, cookies, 'fila:chamar');
    if (erro) return erro;
    // Mesma chave em até 10 minutos devolve a resposta original (docs/04 §6).
    const chave = request.headers.get('Idempotency-Key');
    if (chave && respostasIdempotentes.has(chave)) {
      return HttpResponse.json(respostasIdempotentes.get(chave), { status: 201 });
    }
    const f = filas.find((x) => x.id === params.id);
    if (!f) return semPermissao();
    if (f.bloqueio.ativo) {
      return problema(
        409,
        'FILA_BLOQUEADA',
        `${f.especialidade} está sem supervisor habilitado disponível. As chamadas seguem suspensas até a regularização.`,
        'Fila bloqueada',
      );
    }
    const aguardando = daFila(f.id).filter((s) => s.status === 'AGUARDANDO');
    const proxima = aguardando[0];
    if (!proxima) {
      return problema(
        409,
        'FILA_VAZIA',
        'Não há senha aguardando nesta fila no momento.',
        'Nenhuma senha aguardando',
      );
    }
    const furouFilaPorUrgencia =
      proxima.prioridade === 'URGENTE' &&
      aguardando.some(
        (s) =>
          s.prioridade !== 'URGENTE' && Date.parse(s.chegadaEm) < Date.parse(proxima.chegadaEm),
      );
    const agora = Date.now();
    sequencia += 1;
    proxima.status = 'CHAMADA';
    proxima.chamadaEm = new Date(agora).toISOString();
    proxima.toleranciaAte = new Date(agora + f.toleranciaMinutos * 60_000).toISOString();
    proxima.chamadaId = `chamada-simulada-${sequencia}`;
    proxima.sequenciaChamada = 1;
    proxima.versao += 1;

    const corpo = {
      senha: resumo(proxima, f, agora),
      chamada: chamadaDe(proxima, f),
      furouFilaPorUrgencia,
      toleranciaAte: proxima.toleranciaAte,
    };
    if (chave) respostasIdempotentes.set(chave, corpo);
    return HttpResponse.json(corpo, { status: 201 });
  }),

  http.post(`${API_URL}/chamadas/:id/rechamada`, ({ request, cookies, params }) => {
    const erro = autorizar(request, cookies, 'fila:chamar');
    if (erro) return erro;
    const s = senhas.find((x) => x.chamadaId === params.id && x.status === 'CHAMADA');
    const f = s && filas.find((x) => x.id === s.filaId);
    if (!s || !f)
      return problema(409, 'TRANSICAO_INVALIDA', 'A senha não está mais chamada. Atualize a fila.');
    s.sequenciaChamada += 1;
    return HttpResponse.json(chamadaDe(s, f), { status: 201 });
  }),

  http.get(`${API_URL}/senhas/:id`, ({ request, cookies, params }) => {
    const erro = autorizar(request, cookies, 'senha:consultar');
    if (erro) return erro;
    const s = senhas.find((x) => x.id === params.id);
    const f = s && filas.find((x) => x.id === s.filaId);
    return s && f ? HttpResponse.json(resumo(s, f, Date.now())) : semPermissao();
  }),

  http.get(`${API_URL}/senhas/:id/reclassificacoes`, ({ request, cookies, params }) => {
    const erro = autorizar(request, cookies, 'senha:consultar');
    if (erro) return erro;
    const s = senhas.find((x) => x.id === params.id);
    return s ? HttpResponse.json(s.reclassificacoes) : semPermissao();
  }),

  http.patch(`${API_URL}/senhas/:id/prioridade`, async ({ request, cookies, params }) => {
    const erro = autorizar(request, cookies, 'senha:reclassificar');
    if (erro) return erro;
    const s = senhas.find((x) => x.id === params.id);
    const f = s && filas.find((x) => x.id === s.filaId);
    if (!s || !f) return semPermissao();
    const corpo = (await request.json()) as {
      prioridade?: Prioridade;
      justificativa?: string;
      versao?: number;
    };
    if (corpo.versao !== s.versao)
      return problema(
        409,
        'VERSAO_DESATUALIZADA',
        'A senha foi alterada por outra pessoa. Confira a prioridade atual.',
      );
    if (s.status !== 'AGUARDANDO' && s.status !== 'AGUARDANDO_RECURSO')
      return problema(
        409,
        'TRANSICAO_INVALIDA',
        'Só senha ainda não atendida pode ser reclassificada.',
      );
    const justificativa = (corpo.justificativa ?? '').trim();
    if (justificativa.length < PARAMETROS.justificativaMinCaracteres)
      return problema(
        422,
        'JUSTIFICATIVA_OBRIGATORIA',
        `Descreva o motivo da reclassificação com pelo menos ${PARAMETROS.justificativaMinCaracteres} caracteres.`,
      );
    if (!corpo.prioridade || corpo.prioridade === s.prioridade)
      return problema(422, 'VALIDACAO', 'Escolha uma prioridade diferente da atual.');

    const usuario = usuarioMockDaRequisicao(request, cookies);
    s.reclassificacoes.unshift({
      id: `reclassificacao-${s.reclassificacoes.length + 1}`,
      dePrioridade: s.prioridade,
      paraPrioridade: corpo.prioridade,
      justificativa,
      usuarioNome: usuario?.nome ?? '',
      ocorridoEm: new Date().toISOString(),
    });
    s.prioridade = corpo.prioridade;
    s.versao += 1;
    const atual = resumo(s, f, Date.now());
    return HttpResponse.json({ senha: atual, novaPosicao: atual.posicao ?? 0 });
  }),

  // Proposta: o contrato não expõe os parâmetros da unidade (lacuna 1 da triagem, docs/07).
  http.get(`${API_URL}/parametros`, () => HttpResponse.json(PARAMETROS)),
];
