import { type Prioridade } from '@filas/contracts';

import {
  ErroTriagem,
  type EspecialidadeTriagem,
  type PacienteBusca,
  type Reclassificacao,
  type SenhaEmitida,
  type TriagemApi,
  type TriagemRegistrada,
} from './tipos';

const PACIENTES: PacienteBusca[] = [
  {
    id: 'pac-1',
    iniciais: 'M. A. S.',
    documento: '12345678900',
    vinculo: 'EXTERNO',
    restricaoAtiva: false,
    restricaoAte: null,
  },
  {
    id: 'pac-2',
    iniciais: 'J. P. O.',
    documento: '98765432100',
    vinculo: 'ALUNO',
    restricaoAtiva: true,
    restricaoAte: '2026-11-30',
  },
  {
    id: 'pac-3',
    iniciais: 'A. C. L.',
    documento: '11122233344',
    vinculo: 'SERVIDOR',
    restricaoAtiva: false,
    restricaoAte: null,
  },
];

/** Nomes completos só existem aqui para a busca por nome; nunca saem do mock (P-03). */
const NOMES: Record<string, string> = {
  'pac-1': 'Maria Aparecida Souza',
  'pac-2': 'João Pedro Oliveira',
  'pac-3': 'Ana Clara Lima',
};

const ESPECIALIDADES: EspecialidadeTriagem[] = [
  { id: 'esp-fisio', nome: 'Fisioterapia', ativa: true, filasVinculadas: 1 },
  { id: 'esp-psico', nome: 'Psicologia', ativa: true, filasVinculadas: 1 },
  { id: 'esp-nutri', nome: 'Nutrição', ativa: true, filasVinculadas: 1 },
  { id: 'esp-fono', nome: 'Fonoaudiologia', ativa: true, filasVinculadas: 0 },
];

/** Especialidade com bloqueio por ausência de supervisor: emite, mas a chamada fica suspensa (RN-10). */
const ESPECIALIDADE_BLOQUEADA = 'esp-psico';

export interface OpcoesTriagemEmMemoria {
  /** Especialidades cuja fila deixa de existir entre a triagem e a emissão (409 SEM_FILA_CONFIGURADA). */
  especialidadesSemFilaNaEmissao?: string[];
  justificativaMinCaracteres?: number;
}

interface SenhaGuardada {
  prioridade: Prioridade;
  versao: number;
  posicao: number;
  historico: Reclassificacao[];
}

const semAcento = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('pt-BR');

/**
 * Implementação em memória até as APIs de triagem (#15), senha (#16) e pacientes (#38) existirem.
 * Segue as regras do contrato. Ao integrar, trocar por um cliente HTTP que implemente `TriagemApi`.
 */
export function criarTriagemApiEmMemoria(opcoes: OpcoesTriagemEmMemoria = {}): TriagemApi {
  const { especialidadesSemFilaNaEmissao = [], justificativaMinCaracteres = 20 } = opcoes;
  const triagens = new Map<string, TriagemRegistrada>();
  const senhas = new Map<string, SenhaGuardada>();
  let sequencia = 0;
  let proximaSenha = 13;

  return {
    buscarPacientes(termo) {
      const alvo = semAcento(termo.trim());
      if (!alvo) return Promise.resolve([]);
      const digitos = termo.replace(/\D/g, '');
      return Promise.resolve(
        PACIENTES.filter(
          (p) =>
            semAcento(NOMES[p.id] ?? '').includes(alvo) ||
            (digitos.length > 0 && p.documento.includes(digitos)),
        ),
      );
    },

    listarEspecialidades: () => Promise.resolve(structuredClone(ESPECIALIDADES)),

    registrarTriagem(entrada) {
      const paciente = PACIENTES.find((p) => p.id === entrada.pacienteId);
      const especialidade = ESPECIALIDADES.find((e) => e.id === entrada.especialidadeDestinoId);
      if (!paciente || !especialidade) {
        return Promise.reject(new ErroTriagem('VALIDACAO', 'Paciente ou especialidade inválidos.'));
      }
      // RN-03, repetida no servidor.
      if (entrada.prioridade === 'URGENTE' && !entrada.justificativaClinica?.trim()) {
        return Promise.reject(
          new ErroTriagem('VALIDACAO', 'Justificativa é obrigatória para prioridade Urgente.'),
        );
      }
      sequencia += 1;
      const triagem: TriagemRegistrada = {
        id: `tri-${sequencia}`,
        pacienteIniciais: paciente.iniciais,
        especialidadeId: especialidade.id,
        especialidade: especialidade.nome,
        tipoAtendimento: entrada.tipoAtendimento,
        // RN-02, repetida no servidor.
        prioridade:
          entrada.enquadramentoLegal && entrada.prioridade === 'NORMAL'
            ? 'PREFERENCIAL'
            : entrada.prioridade,
        enquadramentoLegal: entrada.enquadramentoLegal ?? null,
      };
      triagens.set(triagem.id, triagem);
      return Promise.resolve(structuredClone(triagem));
    },

    emitirSenha({ triagemId, tipoAtendimento }) {
      const triagem = triagens.get(triagemId);
      if (!triagem) {
        return Promise.reject(new ErroTriagem('VALIDACAO', 'Triagem não encontrada.'));
      }
      if (especialidadesSemFilaNaEmissao.includes(triagem.especialidadeId)) {
        return Promise.reject(
          new ErroTriagem(
            'SEM_FILA_CONFIGURADA',
            `A especialidade ${triagem.especialidade} não tem fila ativa. A senha não foi emitida. Peça à administração para configurar a fila e tente de novo.`,
          ),
        );
      }
      proximaSenha += 1;
      const posicaoEstimada = 3;
      const senha: SenhaEmitida = {
        id: `sen-${proximaSenha}`,
        numero: `${triagem.especialidade[0]?.toUpperCase() ?? 'S'}${String(proximaSenha).padStart(3, '0')}`,
        especialidade: triagem.especialidade,
        pacienteIniciais: triagem.pacienteIniciais,
        prioridade: triagem.prioridade,
        tipoAtendimento,
        posicaoEstimada,
        versao: 1,
        avisos:
          triagem.especialidadeId === ESPECIALIDADE_BLOQUEADA
            ? [
                {
                  codigo: 'FILA_BLOQUEADA',
                  mensagem:
                    'A chamada desta especialidade está suspensa por falta de supervisor habilitado. A senha foi emitida e será chamada quando o bloqueio terminar.',
                },
              ]
            : [],
      };
      senhas.set(senha.id, {
        prioridade: senha.prioridade,
        versao: 1,
        posicao: posicaoEstimada,
        historico: [],
      });
      return Promise.resolve(structuredClone(senha));
    },

    historicoReclassificacoes: (senhaId) =>
      Promise.resolve(structuredClone(senhas.get(senhaId)?.historico ?? [])),

    consultarSenha(senhaId) {
      const senha = senhas.get(senhaId);
      if (!senha) return Promise.reject(new ErroTriagem('VALIDACAO', 'Senha não encontrada.'));
      return Promise.resolve({
        prioridade: senha.prioridade,
        versao: senha.versao,
        posicao: senha.posicao,
      });
    },

    reclassificar({ senhaId, prioridade, justificativa, versao }) {
      const senha = senhas.get(senhaId);
      if (!senha) return Promise.reject(new ErroTriagem('VALIDACAO', 'Senha não encontrada.'));
      if (versao !== senha.versao) {
        return Promise.reject(
          new ErroTriagem(
            'VERSAO_DESATUALIZADA',
            'Esta senha foi alterada por outra pessoa. Os dados foram recarregados; confira e tente de novo.',
          ),
        );
      }
      if (justificativa.trim().length < justificativaMinCaracteres) {
        return Promise.reject(
          new ErroTriagem(
            'JUSTIFICATIVA_OBRIGATORIA',
            `A justificativa precisa ter ao menos ${justificativaMinCaracteres} caracteres.`,
          ),
        );
      }
      senha.historico.push({
        id: `rec-${senha.historico.length + 1}`,
        dePrioridade: senha.prioridade,
        paraPrioridade: prioridade,
        justificativa: justificativa.trim(),
        usuarioNome: 'Usuário de desenvolvimento',
        ocorridoEm: new Date().toISOString(),
      });
      senha.prioridade = prioridade;
      senha.versao += 1;
      senha.posicao = prioridade === 'URGENTE' ? 1 : prioridade === 'PREFERENCIAL' ? 2 : 4;
      return Promise.resolve({
        prioridade,
        novaPosicao: senha.posicao,
        versao: senha.versao,
      });
    },

    parametros: () => Promise.resolve({ justificativaMinCaracteres }),
  };
}
