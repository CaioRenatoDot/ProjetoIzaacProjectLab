/** Tipos de perfis e permissões conforme `docs/api/openapi.yaml` (tag "Perfis e permissões"). */

export interface OperacaoCatalogo {
  operacao: string;
  permissao: string;
}

export interface ModuloCatalogo {
  modulo: string;
  rotulo: string;
  /** Módulo com dado de saúde ou auditoria: marcação visual em T-05. */
  sensivel: boolean;
  operacoes: OperacaoCatalogo[];
}

export interface Perfil {
  id: string;
  nome: string;
  descricao: string;
  /** Perfil do sistema não é editável nem excluível (T-05). */
  sistema: boolean;
  permissoes: string[];
  usuariosVinculados: number;
}

export interface PerfilEntrada {
  nome: string;
  descricao: string;
  permissoes: string[];
}

export type CodigoErroPerfil = 'DUPLICIDADE' | 'VINCULO_ATIVO' | 'PERFIL_SISTEMA' | 'VALIDACAO';

export class ErroPerfil extends Error {
  constructor(
    readonly codigo: CodigoErroPerfil,
    mensagem: string,
  ) {
    super(mensagem);
  }
}

export interface PerfisApi {
  catalogo(): Promise<ModuloCatalogo[]>;
  listar(): Promise<Perfil[]>;
  /** Sem `id` cria; com `id` atualiza. */
  salvar(id: string | null, entrada: PerfilEntrada): Promise<Perfil>;
  excluir(id: string): Promise<void>;
}
