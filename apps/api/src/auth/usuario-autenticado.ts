import { type UsuarioSessao } from '@filas/contracts';

import { type UsuarioComPerfil } from './auth.repository';

/** Usuário da requisição autenticada, com as permissões lidas do banco (docs/04 §3). */
export interface UsuarioAutenticado extends UsuarioSessao {
  sessaoId: string;
}

export function paraUsuarioSessao(usuario: UsuarioComPerfil): UsuarioSessao {
  return {
    id: usuario.id,
    nome: usuario.nome,
    perfilId: usuario.perfilId,
    perfilNome: usuario.perfil.nome,
    unidadeId: usuario.unidadeId,
    unidadeNome: usuario.unidade.nome,
    permissoes: usuario.perfil.permissoes.map(({ permissao }) => permissao),
  };
}
