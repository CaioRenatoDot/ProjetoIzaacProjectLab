import { http, HttpResponse } from 'msw';

import { API_URL } from '@/lib/api/config';
import {
  type Alocacao,
  type CandidatoAlocacao,
  type MotivoInaptidao,
  type RecursoFaltante,
} from '@/lib/alocacao/tipos';

import { semCamposInternos, senhasDaSimulacao } from './filas';
import { usuarioMockDaRequisicao } from './handlers';

/**
 * Simulação da alocação (UC-10), até a API da #21. A aptidão de cada recurso e o motivo vêm
 * prontos, como da API: a tela não deduz regra (RN-05 a RN-09). Dados fictícios (RNF-07).
 *
 * - Fisioterapia exige supervisor; tem inaptos de cada tipo. "Ana Ribeiro" fica indisponível na
 *   hora de confirmar (409 RECURSO_INDISPONIVEL), para o caso de corrida da T-10.
 * - Nutrição não exige supervisor (RN-07); a senha N106 não tem sala compatível.
 */

const apto = (id: string, nome: string, descricao: string): CandidatoAlocacao => ({
  id,
  nome,
  descricao,
  apto: true,
  motivoInaptidao: null,
  motivoTexto: null,
});

const inapto = (
  id: string,
  nome: string,
  descricao: string,
  motivoInaptidao: MotivoInaptidao,
  motivoTexto: string,
): CandidatoAlocacao => ({ id, nome, descricao, apto: false, motivoInaptidao, motivoTexto });

const ESTUDANTE_VOLATIL = 'est-fisio-ana';

interface Cenario {
  exigeSupervisao: boolean;
  estudantes: CandidatoAlocacao[];
  supervisores: CandidatoAlocacao[];
  salas: CandidatoAlocacao[];
}

const FISIOTERAPIA: Cenario = {
  exigeSupervisao: true,
  estudantes: [
    apto('est-fisio-bruno', 'Bruno Lima', 'Fisioterapia · 8º período · Reabilitação'),
    apto(ESTUDANTE_VOLATIL, 'Ana Ribeiro', 'Fisioterapia · 9º período · Avaliação'),
    inapto(
      'est-fisio-carla',
      'Carla Souza',
      'Fisioterapia · 7º período',
      'ATENDIMENTO_ATIVO',
      'Já possui atendimento ativo',
    ),
    inapto(
      'est-fisio-diego',
      'Diego Melo',
      'Fisioterapia · 6º período',
      'FORA_DO_TURNO',
      'Fora do turno: disponível só à tarde',
    ),
  ],
  supervisores: [
    apto('sup-elisa', 'Prof. Elisa Nunes', 'Fisioterapia · 2 de 3 estudantes'),
    inapto(
      'sup-fabio',
      'Prof. Fábio Reis',
      'Fisioterapia · 3 de 3 estudantes',
      'LIMITE_SUPERVISAO_ATINGIDO',
      'Limite de supervisão atingido (3 de 3)',
    ),
    inapto(
      'sup-gabriela',
      'Prof. Gabriela Teles',
      'Psicologia · 0 de 3 estudantes',
      'ESPECIALIDADE_INCOMPATIVEL',
      'Não habilitada em Fisioterapia',
    ),
  ],
  salas: [
    apto('sala-03', 'Sala 03', 'Térreo · maca e espelho terapêutico'),
    apto('sala-07', 'Sala 07', '1º andar · maca'),
    inapto(
      'sala-05',
      'Sala 05',
      '1º andar · computador',
      'RECURSO_INDISPONIVEL_NA_SALA',
      'Sem maca, exigida pela especialidade',
    ),
  ],
};

const NUTRICAO: Cenario = {
  exigeSupervisao: false,
  estudantes: [
    apto('est-nutri-heitor', 'Heitor Prado', 'Nutrição · 8º período · Orientação'),
    inapto(
      'est-nutri-isabela',
      'Isabela Rocha',
      'Nutrição · 6º período',
      'FORA_DO_TURNO',
      'Fora do turno: disponível só pela manhã',
    ),
  ],
  supervisores: [],
  salas: [apto('sala-02', 'Sala 02', 'Térreo · balança antropométrica')],
};

const SEM_SALA_COMPATIVEL = new Set(['senha-n106']);
const SALAS_INCOMPATIVEIS = [
  inapto('sala-02', 'Sala 02', 'Térreo', 'ATENDIMENTO_ATIVO', 'Ocupada por outro atendimento'),
  inapto(
    'sala-04',
    'Sala 04',
    '1º andar',
    'RECURSO_INDISPONIVEL_NA_SALA',
    'Sem balança antropométrica, exigida pela especialidade',
  ),
];

const indisponiveis = new Set<string>();
const alocacoes = new Map<string, Alocacao>();
/** Resultado por `Idempotency-Key`, guardado antes de qualquer `await` (pedidos simultâneos). */
const respostasIdempotentes = new Map<string, Promise<Resultado>>();
let sequencia = 0;

export function reiniciarMockAlocacao() {
  indisponiveis.clear();
  alocacoes.clear();
  respostasIdempotentes.clear();
  sequencia = 0;
}

/** Alocação vigente confirmada nesta simulação, para o início do atendimento (#44). */
export function alocacaoDaSimulacao(senhaId: string) {
  return alocacoes.get(senhaId) ?? null;
}

function cenarioDa(especialidade: string) {
  return especialidade === 'Nutrição' ? NUTRICAO : FISIOTERAPIA;
}

/** Aplica o estado atual: quem foi alocado ou ficou indisponível passa a inapto. */
function atual(candidato: CandidatoAlocacao): CandidatoAlocacao {
  if (!candidato.apto || !indisponiveis.has(candidato.id)) return candidato;
  return {
    ...candidato,
    apto: false,
    motivoInaptidao: 'ATENDIMENTO_ATIVO',
    motivoTexto: 'Já possui atendimento ativo',
  };
}

function bloco(candidatos: CandidatoAlocacao[], regras: string[]) {
  const lista = candidatos.map(atual);
  const sugestao = lista.find((c) => c.apto) ?? null;
  return {
    sugestao,
    alternativas: lista.filter((c) => c.id !== sugestao?.id),
    regrasVerificadas: regras,
  };
}

function sugestoesPara(senhaId: string, especialidade: string) {
  const cenario = cenarioDa(especialidade);
  const salas = SEM_SALA_COMPATIVEL.has(senhaId) ? SALAS_INCOMPATIVEIS : cenario.salas;
  return {
    senhaId,
    estudante: bloco(cenario.estudantes, ['RN-05', 'RN-06']),
    supervisor: {
      ...bloco(cenario.supervisores, ['RN-07', 'RN-08']),
      aplicavel: cenario.exigeSupervisao,
    },
    sala: bloco(salas, ['RN-09']),
  };
}

interface Resultado {
  status: number;
  corpo: Record<string, unknown>;
}

const falha = (
  status: number,
  codigo: string,
  detail: string,
  title = 'Não foi possível concluir',
): Resultado => ({
  status,
  corpo: { title, status, codigo, detail },
});

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

const ALOCAVEL = ['CHAMADA', 'AGUARDANDO_RECURSO'];

function senhaAlocavel(id: unknown) {
  const senha = senhasDaSimulacao().find((s) => s.id === id);
  if (!senha)
    return { erro: problema(403, 'SEM_PERMISSAO', 'Seu perfil não tem acesso a este conteúdo.') };
  if (!ALOCAVEL.includes(senha.status)) {
    return {
      erro: problema(
        409,
        'TRANSICAO_INVALIDA',
        `A senha ${senha.numero} não está chamada nem aguardando recurso. Volte à fila para conferir a situação.`,
      ),
    };
  }
  return { senha };
}

async function confirmarAlocacao(
  request: Request,
  cookies: Record<string, string>,
  senhaId: unknown,
): Promise<Resultado> {
  const senha = senhasDaSimulacao().find((s) => s.id === senhaId);
  if (!senha) return falha(403, 'SEM_PERMISSAO', 'Seu perfil não tem acesso a este conteúdo.');
  if (!ALOCAVEL.includes(senha.status)) {
    return falha(
      409,
      'TRANSICAO_INVALIDA',
      `A senha ${senha.numero} não está chamada nem aguardando recurso. Volte à fila para conferir a situação.`,
    );
  }
  const corpo = (await request.json()) as {
    estudanteId?: string;
    supervisorId?: string | null;
    salaId?: string;
    versao?: number;
  };
  if (corpo.versao !== senha.versao)
    return falha(
      409,
      'VERSAO_DESATUALIZADA',
      'A senha foi alterada por outra pessoa. Recarregue a alocação.',
    );

  // Corrida da T-10: a estudante inicia outro atendimento entre a sugestão e a confirmação.
  if (corpo.estudanteId === ESTUDANTE_VOLATIL && !indisponiveis.has(ESTUDANTE_VOLATIL)) {
    indisponiveis.add(ESTUDANTE_VOLATIL);
    return falha(
      409,
      'RECURSO_INDISPONIVEL',
      'Ana Ribeiro acabou de iniciar outro atendimento. As alternativas foram atualizadas: escolha outro estudante.',
      'Recurso indisponível',
    );
  }

  const sugestoes = sugestoesPara(senha.id, senha.especialidade);
  const todos = (b: { sugestao: CandidatoAlocacao | null; alternativas: CandidatoAlocacao[] }) =>
    b.sugestao ? [b.sugestao, ...b.alternativas] : b.alternativas;
  const escolhido = (lista: CandidatoAlocacao[], id: string | null | undefined) =>
    lista.find((c) => c.id === id && c.apto);

  const estudante = escolhido(todos(sugestoes.estudante), corpo.estudanteId);
  const sala = escolhido(todos(sugestoes.sala), corpo.salaId);
  const supervisor = sugestoes.supervisor.aplicavel
    ? escolhido(todos(sugestoes.supervisor), corpo.supervisorId)
    : null;
  if (!estudante || !sala || (sugestoes.supervisor.aplicavel && !supervisor)) {
    return falha(
      409,
      'RECURSO_INDISPONIVEL',
      'Um dos recursos escolhidos não está mais disponível. As alternativas foram atualizadas.',
      'Recurso indisponível',
    );
  }

  sequencia += 1;
  const alocacao: Alocacao = {
    id: `alocacao-simulada-${sequencia}`,
    senhaId: senha.id,
    estudante: { id: estudante.id, nome: estudante.nome },
    supervisor: supervisor ? { id: supervisor.id, nome: supervisor.nome } : null,
    sala: { id: sala.id, nome: sala.nome },
    confirmadaEm: new Date().toISOString(),
    confirmadaPor: usuarioMockDaRequisicao(request, cookies)?.nome ?? '',
    liberadaEm: null,
  };
  indisponiveis.add(estudante.id);
  alocacoes.set(senha.id, alocacao);
  senha.status = 'CHAMADA';
  senha.versao += 1;
  return { status: 201, corpo: { ...alocacao } };
}

export const handlersAlocacao = [
  http.get(`${API_URL}/senhas/:id/alocacao/sugestoes`, ({ request, cookies, params }) => {
    const erro = autorizar(request, cookies, 'alocacao:consultar');
    if (erro) return erro;
    const resultado = senhaAlocavel(params.id);
    if (resultado.erro) return resultado.erro;
    return HttpResponse.json(sugestoesPara(resultado.senha.id, resultado.senha.especialidade));
  }),

  http.post(`${API_URL}/senhas/:id/alocacao`, async ({ request, cookies, params }) => {
    const erro = autorizar(request, cookies, 'alocacao:criar');
    if (erro) return erro;
    // Mesma chave em até 10 minutos devolve a resposta original (docs/04 §6).
    const chave = request.headers.get('Idempotency-Key');
    let promessa = chave ? respostasIdempotentes.get(chave) : undefined;
    if (!promessa) {
      promessa = confirmarAlocacao(request, cookies, params.id);
      if (chave) respostasIdempotentes.set(chave, promessa);
    }
    const { status, corpo } = await promessa;
    if (status !== 201 && chave) respostasIdempotentes.delete(chave);
    return HttpResponse.json(corpo, {
      status,
      headers: status === 201 ? undefined : { 'Content-Type': 'application/problem+json' },
    });
  }),

  http.post(`${API_URL}/senhas/:id/aguardando-recurso`, async ({ request, cookies, params }) => {
    const erro = autorizar(request, cookies, 'alocacao:criar');
    if (erro) return erro;
    const resultado = senhaAlocavel(params.id);
    if (resultado.erro) return resultado.erro;
    const { senha } = resultado;
    const corpo = (await request.json()) as { recursoFaltante?: RecursoFaltante; versao?: number };
    if (
      !corpo.recursoFaltante ||
      !['ESTUDANTE', 'SUPERVISOR', 'SALA'].includes(corpo.recursoFaltante)
    )
      return problema(422, 'VALIDACAO', 'Informe qual recurso está faltando.');
    if (corpo.versao !== senha.versao)
      return problema(
        409,
        'VERSAO_DESATUALIZADA',
        'A senha foi alterada por outra pessoa. Recarregue a alocação.',
      );
    senha.status = 'AGUARDANDO_RECURSO';
    senha.versao += 1;
    return HttpResponse.json(semCamposInternos(senha));
  }),
];
