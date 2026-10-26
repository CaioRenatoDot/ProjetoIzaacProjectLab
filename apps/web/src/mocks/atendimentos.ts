import {
  type AtendimentoDetalhe,
  type AtendimentoResumo,
  type Desfecho,
  type PausaAtendimento,
  type StatusSenha,
} from '@filas/contracts';
import { http, HttpResponse } from 'msw';

import { API_URL } from '@/lib/api/config';

import { alocacaoDaSimulacao } from './alocacao';
import { type SenhaSimulada, senhasDaSimulacao } from './filas';
import { usuarioMockDaRequisicao } from './handlers';

/**
 * Simulação do atendimento (UC-11 a UC-13), até a API da #23 ser usada pelo front. Age sobre as
 * senhas de `mocks/filas.ts`, então o painel de fila acompanha a mudança de status. Dados
 * fictícios (RNF-07).
 *
 * - F016 (Fisioterapia, exige validação) e N107 (Nutrição, não exige) em atendimento.
 * - N108 pausado; N109 pendente de validação (RN-11).
 * - N105 já alocada, pronta para iniciar; F018 alocada a uma sala que entrou em manutenção
 *   (409 RECURSO_INDISPONIVEL ao iniciar). Senha alocada pela tela de alocação também inicia.
 */

interface Recursos {
  estudante: string;
  supervisor: string | null;
  sala: string;
}

interface AtendimentoSimulado extends Recursos {
  id: string;
  senhaId: string;
  pacienteNome: string;
  iniciadoEm: string;
  encerradoEm: string | null;
  desfecho: Desfecho | null;
  observacoes: string | null;
  exigeValidacao: boolean;
  parecerSupervisor: string | null;
  validadoPor: string | null;
  validadoEm: string | null;
  pausas: PausaAtendimento[];
}

/** RN-11: copiado da especialidade no início. */
const EXIGE_VALIDACAO: Record<string, boolean> = { Fisioterapia: true, Nutrição: false };

const ALOCACOES_PREVIAS: Record<string, Recursos & { salaIndisponivel?: boolean }> = {
  'senha-n105': { estudante: 'Heitor Prado', supervisor: null, sala: 'Sala 02' },
  'senha-f018': {
    estudante: 'Bruno Lima',
    supervisor: 'Prof. Elisa Nunes',
    sala: 'Sala 05',
    salaIndisponivel: true,
  },
};

const NOMES_FICTICIOS: Record<string, string> = {
  'senha-f016': 'Paciente Fictício P. R. A.',
  'senha-n105': 'Paciente Fictício S. U. V.',
  'senha-n107': 'Paciente Fictício Z. A. B.',
  'senha-n108': 'Paciente Fictício C. E. F.',
  'senha-n109': 'Paciente Fictício H. J. K.',
};

let atendimentos = new Map<string, AtendimentoSimulado>();
let sequencia = 0;

function semente(
  senhaId: string,
  recursos: Recursos,
  iniciadoHaMinutos: number,
  extra: Partial<AtendimentoSimulado> = {},
): AtendimentoSimulado {
  sequencia += 1;
  return {
    id: `atendimento-simulado-${sequencia}`,
    senhaId,
    pacienteNome: NOMES_FICTICIOS[senhaId] ?? 'Paciente Fictício',
    iniciadoEm: new Date(Date.now() - iniciadoHaMinutos * 60_000).toISOString(),
    encerradoEm: null,
    desfecho: null,
    observacoes: null,
    exigeValidacao: false,
    parecerSupervisor: null,
    validadoPor: null,
    validadoEm: null,
    pausas: [],
    ...recursos,
    ...extra,
  };
}

export function reiniciarMockAtendimentos() {
  sequencia = 0;
  const agora = Date.now();
  atendimentos = new Map(
    [
      semente(
        'senha-f016',
        { estudante: 'Carla Souza', supervisor: 'Prof. Elisa Nunes', sala: 'Sala 01' },
        12,
        { exigeValidacao: true },
      ),
      semente('senha-n107', { estudante: 'Júlia Campos', supervisor: null, sala: 'Sala 06' }, 20),
      semente('senha-n108', { estudante: 'Lucas Andrade', supervisor: null, sala: 'Sala 08' }, 30, {
        pausas: [
          {
            motivo: 'Aguardando resultado de exame',
            pausadoEm: new Date(agora - 8 * 60_000).toISOString(),
            retomadoEm: null,
          },
        ],
      }),
      semente(
        'senha-n109',
        { estudante: 'Marcos Vieira', supervisor: 'Prof. Marina Lopes', sala: 'Sala 04' },
        45,
        {
          exigeValidacao: true,
          desfecho: 'ALTA',
          observacoes: 'Orientação alimentar concluída; paciente sem queixas.',
          encerradoEm: new Date(agora - 5 * 60_000).toISOString(),
        },
      ),
    ].map((a) => [a.senhaId, a]),
  );
}

reiniciarMockAtendimentos();

/** Do início ao encerramento (ou agora), descontadas as pausas (RF-10). */
function duracaoMinutos(a: AtendimentoSimulado, agora: number) {
  const fim = a.encerradoEm ? Date.parse(a.encerradoEm) : agora;
  const pausado = a.pausas.reduce(
    (total, p) =>
      total + ((p.retomadoEm ? Date.parse(p.retomadoEm) : fim) - Date.parse(p.pausadoEm)),
    0,
  );
  return Math.max(0, Math.floor((fim - Date.parse(a.iniciadoEm) - pausado) / 60_000));
}

function resumo(a: AtendimentoSimulado, senha: SenhaSimulada): AtendimentoResumo {
  return {
    id: a.id,
    senhaId: senha.id,
    numero: senha.numero,
    pacienteIniciais: senha.pacienteIniciais,
    especialidade: senha.especialidade,
    estudante: a.estudante,
    supervisor: a.supervisor,
    sala: a.sala,
    status: senha.status,
    iniciadoEm: a.iniciadoEm,
    duracaoMinutos: duracaoMinutos(a, Date.now()),
    encerradoEm: a.encerradoEm,
    desfecho: a.desfecho,
    exigeValidacao: a.exigeValidacao,
    versao: senha.versao,
  };
}

function detalhe(a: AtendimentoSimulado, senha: SenhaSimulada): AtendimentoDetalhe {
  return {
    ...resumo(a, senha),
    pacienteNome: a.pacienteNome,
    triagem: {
      id: `triagem-${senha.id}`,
      pacienteIniciais: senha.pacienteIniciais,
      especialidadeId: senha.filaId,
      especialidade: senha.especialidade,
      tipoAtendimento: senha.tipoAtendimento,
      prioridade: senha.prioridade,
      concluidaEm: senha.chegadaEm,
      senhaEmitida: true,
      pacienteId: `paciente-${senha.id}`,
      pacienteNome: a.pacienteNome,
      motivo: 'Dor lombar há duas semanas, piora ao ficar sentado (motivo fictício).',
      enquadramentoLegal: null,
      justificativaClinica: null,
      observacoes: 'Sem alergias relatadas.',
      profissionalId: 'usuario-admin',
    },
    observacoes: a.observacoes,
    parecerSupervisor: a.parecerSupervisor,
    validadoPor: a.validadoPor,
    validadoEm: a.validadoEm,
    pausas: a.pausas,
  };
}

function problema(
  status: number,
  codigo: string,
  detail: string,
  extras: Record<string, unknown> = {},
) {
  return HttpResponse.json(
    { status, codigo, title: 'Não foi possível concluir', detail, ...extras },
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  );
}

const semPermissao = () =>
  problema(403, 'SEM_PERMISSAO', 'Seu perfil não tem acesso a este conteúdo.');

function autorizar(request: Request, cookies: Record<string, string>, permissao: string) {
  const usuario = usuarioMockDaRequisicao(request, cookies);
  if (!usuario) return problema(401, 'NAO_AUTENTICADO', 'Sua sessão expirou. Entre novamente.');
  if (!usuario.permissoes.includes(permissao)) return semPermissao();
  return null;
}

const versaoDesatualizada = () =>
  problema(
    409,
    'VERSAO_DESATUALIZADA',
    'O atendimento foi alterado por outra pessoa. Os dados foram recarregados.',
  );

const transicaoInvalida = (detail: string) => problema(409, 'TRANSICAO_INVALIDA', detail);

/** Atendimento e senha da simulação, para o encaminhamento (#46). */
export function atendimentoDaSimulacao(id: unknown) {
  return porId(id);
}

function porId(id: unknown) {
  for (const a of atendimentos.values()) {
    if (a.id !== id) continue;
    const senha = senhasDaSimulacao().find((s) => s.id === a.senhaId);
    if (senha) return { atendimento: a, senha };
  }
  return null;
}

function mudar(senha: SenhaSimulada, status: StatusSenha) {
  senha.status = status;
  senha.versao += 1;
}

async function corpo<T>(request: Request) {
  return (await request.json().catch(() => ({}))) as Partial<T>;
}

export const handlersAtendimentos = [
  http.get(`${API_URL}/atendimentos`, ({ request, cookies }) => {
    const erro = autorizar(request, cookies, 'atendimento:consultar');
    if (erro) return erro;
    const url = new URL(request.url);
    const status = (url.searchParams.get('status') ?? '').split(',').filter(Boolean);
    const senhaId = url.searchParams.get('senhaId');
    const pagina = Math.max(1, Number(url.searchParams.get('pagina')) || 1);
    const tamanho = Math.min(100, Math.max(1, Number(url.searchParams.get('tamanho')) || 20));
    const lista = [...atendimentos.values()]
      .map((a) => {
        const senha = senhasDaSimulacao().find((s) => s.id === a.senhaId);
        return senha ? resumo(a, senha) : null;
      })
      .filter((a): a is AtendimentoResumo => a !== null)
      .filter((a) => !status.length || status.includes(a.status))
      .filter((a) => !senhaId || a.senhaId === senhaId)
      .sort((a, b) => Date.parse(b.iniciadoEm ?? '') - Date.parse(a.iniciadoEm ?? ''));
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

  http.get(`${API_URL}/atendimentos/:id`, ({ request, cookies, params }) => {
    const erro = autorizar(request, cookies, 'atendimento:consultar_sensivel');
    if (erro) return erro;
    const achado = porId(params.id);
    if (!achado) return semPermissao();
    return HttpResponse.json(detalhe(achado.atendimento, achado.senha));
  }),

  http.post(`${API_URL}/senhas/:id/atendimento`, async ({ request, cookies, params }) => {
    const erro = autorizar(request, cookies, 'atendimento:criar');
    if (erro) return erro;
    const senha = senhasDaSimulacao().find((s) => s.id === params.id);
    if (!senha) return semPermissao();
    const { versao } = await corpo<{ versao: number }>(request);
    if (versao !== senha.versao) return versaoDesatualizada();
    if (!['CHAMADA', 'AGUARDANDO_RECURSO'].includes(senha.status) || atendimentos.has(senha.id)) {
      return transicaoInvalida(
        `A senha ${senha.numero} não está alocada para iniciar o atendimento.`,
      );
    }
    const alocada = alocacaoDaSimulacao(senha.id);
    const previa = ALOCACOES_PREVIAS[senha.id];
    const recursos: Recursos | null = alocada
      ? {
          estudante: alocada.estudante.nome,
          supervisor: alocada.supervisor?.nome ?? null,
          sala: alocada.sala.nome,
        }
      : (previa ?? null);
    if (!recursos) {
      return transicaoInvalida('Aloque estudante e sala antes de iniciar o atendimento.');
    }
    if (!alocada && previa?.salaIndisponivel) {
      return problema(
        409,
        'RECURSO_INDISPONIVEL',
        `A ${previa.sala} entrou em manutenção e não está mais disponível. Refaça a alocação.`,
      );
    }
    const novo = semente(senha.id, recursos, 0, {
      exigeValidacao: EXIGE_VALIDACAO[senha.especialidade] ?? false,
    });
    atendimentos.set(senha.id, novo);
    mudar(senha, 'EM_ATENDIMENTO');
    return HttpResponse.json(resumo(novo, senha), { status: 201 });
  }),

  http.post(`${API_URL}/atendimentos/:id/pausa`, async ({ request, cookies, params }) => {
    const erro = autorizar(request, cookies, 'atendimento:editar');
    if (erro) return erro;
    const achado = porId(params.id);
    if (!achado) return semPermissao();
    const { atendimento, senha } = achado;
    const { motivo, versao } = await corpo<{ motivo: string; versao: number }>(request);
    if (versao !== senha.versao) return versaoDesatualizada();
    if (senha.status !== 'EM_ATENDIMENTO')
      return transicaoInvalida('O atendimento não está em andamento.');
    atendimento.pausas.push({
      motivo: motivo?.trim() || null,
      pausadoEm: new Date().toISOString(),
      retomadoEm: null,
    });
    mudar(senha, 'PAUSADO');
    return HttpResponse.json(resumo(atendimento, senha));
  }),

  http.post(`${API_URL}/atendimentos/:id/retomada`, async ({ request, cookies, params }) => {
    const erro = autorizar(request, cookies, 'atendimento:editar');
    if (erro) return erro;
    const achado = porId(params.id);
    if (!achado) return semPermissao();
    const { atendimento, senha } = achado;
    const { versao } = await corpo<{ versao: number }>(request);
    if (versao !== senha.versao) return versaoDesatualizada();
    if (senha.status !== 'PAUSADO') return transicaoInvalida('O atendimento não está pausado.');
    const aberta = atendimento.pausas.find((p) => !p.retomadoEm);
    if (aberta) aberta.retomadoEm = new Date().toISOString();
    mudar(senha, 'EM_ATENDIMENTO');
    return HttpResponse.json(resumo(atendimento, senha));
  }),

  http.post(`${API_URL}/atendimentos/:id/encerramento`, async ({ request, cookies, params }) => {
    const erro = autorizar(request, cookies, 'atendimento:editar');
    if (erro) return erro;
    const achado = porId(params.id);
    if (!achado) return semPermissao();
    const { atendimento, senha } = achado;
    const entrada = await corpo<{ desfecho: Desfecho | null; observacoes: string; versao: number }>(
      request,
    );
    if (entrada.versao !== senha.versao) return versaoDesatualizada();
    const reenvio = senha.status === 'PENDENTE_VALIDACAO' && atendimento.parecerSupervisor;
    if (senha.status !== 'EM_ATENDIMENTO' && !reenvio) {
      return transicaoInvalida(
        senha.status === 'PAUSADO'
          ? 'Retome o atendimento antes de encerrar.'
          : 'O atendimento não pode ser encerrado agora.',
      );
    }
    if (!entrada.desfecho) {
      return problema(422, 'DESFECHO_OBRIGATORIO', 'Escolha o desfecho para encerrar.', {
        campos: [{ campo: 'desfecho', mensagem: 'Escolha o desfecho.' }],
      });
    }
    atendimento.desfecho = entrada.desfecho;
    atendimento.observacoes = entrada.observacoes?.trim() || null;
    atendimento.encerradoEm ??= new Date().toISOString();
    if (reenvio) {
      senha.versao += 1;
    } else {
      mudar(senha, atendimento.exigeValidacao ? 'PENDENTE_VALIDACAO' : 'ENCERRADO');
    }
    return HttpResponse.json({
      atendimento: resumo(atendimento, senha),
      exigeValidacao: atendimento.exigeValidacao,
      exigeEncaminhamento: entrada.desfecho.startsWith('ENCAMINHAMENTO'),
    });
  }),

  http.post(`${API_URL}/atendimentos/:id/validacao`, async ({ request, cookies, params }) => {
    const erro = autorizar(request, cookies, 'atendimento:validar');
    if (erro) return erro;
    const achado = porId(params.id);
    if (!achado) return semPermissao();
    const { atendimento, senha } = achado;
    const entrada = await corpo<{ aprovado: boolean; parecer: string; versao: number }>(request);
    if (entrada.versao !== senha.versao) return versaoDesatualizada();
    if (senha.status !== 'PENDENTE_VALIDACAO') {
      return transicaoInvalida('O atendimento não está aguardando validação.');
    }
    const parecer = entrada.parecer?.trim() || null;
    if (!entrada.aprovado && !parecer) {
      return problema(422, 'VALIDACAO', 'Informe o parecer da recusa.', {
        campos: [{ campo: 'parecer', mensagem: 'Informe o parecer da recusa.' }],
      });
    }
    atendimento.parecerSupervisor = parecer;
    if (entrada.aprovado) {
      atendimento.validadoPor = usuarioMockDaRequisicao(request, cookies)?.nome ?? null;
      atendimento.validadoEm = new Date().toISOString();
      mudar(senha, 'ENCERRADO');
    } else {
      // RN-11: a recusa mantém o status e registra o parecer.
      senha.versao += 1;
    }
    return HttpResponse.json(resumo(atendimento, senha));
  }),
];
