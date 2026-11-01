import {
  type EnquadramentoLegal,
  type Prioridade,
  type TipoAtendimento,
  type VinculoPaciente,
} from '@filas/contracts';

/** Tipos conforme `docs/api/openapi.yaml` (tags "Triagem" e "Senhas"). */

/** Resultado da busca de paciente: só o necessário para escolher (nome abreviado, P-03). */
export interface PacienteBusca {
  id: string;
  iniciais: string;
  documento: string;
  vinculo: VinculoPaciente;
  /** Reincidência de ausências (RN-13): avisa, mas não impede a triagem. */
  restricaoAtiva: boolean;
  restricaoAte: string | null;
}

export interface EspecialidadeTriagem {
  id: string;
  nome: string;
  /** Só especialidades ativas com fila configurada aparecem na ficha (T-06). */
  ativa: boolean;
  filasVinculadas: number;
}

export interface TriagemRegistrada {
  id: string;
  pacienteIniciais: string;
  especialidadeId: string;
  especialidade: string;
  tipoAtendimento: TipoAtendimento;
  prioridade: Prioridade;
  enquadramentoLegal: EnquadramentoLegal | null;
}

export interface SenhaEmitida {
  id: string;
  numero: string;
  especialidade: string;
  pacienteIniciais: string;
  prioridade: Prioridade;
  tipoAtendimento: TipoAtendimento;
  posicaoEstimada: number;
  versao: number;
  avisos: { codigo: string; mensagem: string }[];
}

export interface Reclassificacao {
  id: string;
  dePrioridade: Prioridade;
  paraPrioridade: Prioridade;
  justificativa: string;
  usuarioNome: string;
  ocorridoEm: string;
}

export type CodigoErroTriagem =
  | 'SEM_FILA_CONFIGURADA'
  | 'VERSAO_DESATUALIZADA'
  | 'TRANSICAO_INVALIDA'
  | 'JUSTIFICATIVA_OBRIGATORIA'
  | 'VALIDACAO';

export class ErroTriagem extends Error {
  constructor(
    readonly codigo: CodigoErroTriagem,
    mensagem: string,
  ) {
    super(mensagem);
  }
}

export interface TriagemApi {
  /** Busca por nome ou documento (`GET /pacientes?busca=`). */
  buscarPacientes(termo: string): Promise<PacienteBusca[]>;
  /** Especialidades (`GET /especialidades?ativa=true`). */
  listarEspecialidades(): Promise<EspecialidadeTriagem[]>;
  /** `POST /triagens`. */
  registrarTriagem(entrada: TriagemEntradaApi): Promise<TriagemRegistrada>;
  /** `POST /senhas`. Pode lançar `SEM_FILA_CONFIGURADA`. */
  emitirSenha(entrada: {
    triagemId: string;
    tipoAtendimento: TipoAtendimento;
  }): Promise<SenhaEmitida>;
  /** `GET /senhas/{id}/reclassificacoes`. Vazio é lista vazia, não erro. */
  historicoReclassificacoes(senhaId: string): Promise<Reclassificacao[]>;
  /** `GET /senhas/{id}`: recarrega a senha após `VERSAO_DESATUALIZADA`. */
  consultarSenha(
    senhaId: string,
  ): Promise<{ prioridade: Prioridade; versao: number; posicao: number }>;
  /** `PATCH /senhas/{id}/prioridade`. */
  reclassificar(entrada: {
    senhaId: string;
    prioridade: Prioridade;
    justificativa: string;
    versao: number;
  }): Promise<{ prioridade: Prioridade; novaPosicao: number; versao: number }>;
  /** Parâmetros da unidade que a tela precisa (hoje só o mínimo da justificativa). */
  parametros(): Promise<{ justificativaMinCaracteres: number }>;
}

/** Corpo de `POST /triagens` (`TriagemEntrada`). */
export interface TriagemEntradaApi {
  pacienteId: string;
  especialidadeDestinoId: string;
  tipoAtendimento: TipoAtendimento;
  prioridade: Prioridade;
  motivo: string;
  enquadramentoLegal?: EnquadramentoLegal;
  justificativaClinica?: string;
  observacoes?: string;
}
