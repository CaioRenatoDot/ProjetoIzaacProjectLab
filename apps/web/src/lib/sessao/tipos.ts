/** `UsuarioSessao` de `docs/api/openapi.yaml`, devolvido por `/auth/login` e `/auth/me`. */
export interface UsuarioSessao {
  id: string;
  nome: string;
  perfilId: string;
  perfilNome: string;
  unidadeId: string;
  unidadeNome: string;
  permissoes: readonly string[];
}

export interface RespostaLogin {
  accessToken: string;
  expiraEm: number;
  usuario: UsuarioSessao;
}

export interface RespostaRefresh {
  accessToken: string;
  expiraEm: number;
}

export interface DadosLogin {
  identificacao: string;
  senha: string;
  manterConectado: boolean;
}
