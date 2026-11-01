import { type ModuloCatalogo, type Perfil as PerfilApi } from '@filas/contracts';

import { type ClienteHttp, ErroApi } from '@/lib/api/cliente-http';

import { type CodigoErroPerfil, ErroPerfil, type Perfil, type PerfisApi } from './tipos';

const CODIGOS: readonly CodigoErroPerfil[] = [
  'DUPLICIDADE',
  'VINCULO_ATIVO',
  'PERFIL_SISTEMA',
  'VALIDACAO',
];

/** Converte os erros que a tela explica à pessoa com a mensagem do servidor. */
async function comErroPerfil<T>(promessa: Promise<T>): Promise<T> {
  try {
    return await promessa;
  } catch (erro) {
    if (erro instanceof ErroApi && (CODIGOS as string[]).includes(erro.codigo)) {
      throw new ErroPerfil(erro.codigo as CodigoErroPerfil, erro.detail);
    }
    throw erro;
  }
}

function paraTela({
  id,
  nome,
  descricao,
  sistema,
  permissoes,
  usuariosVinculados,
}: PerfilApi): Perfil {
  return { id, nome, descricao, sistema, permissoes, usuariosVinculados };
}

/**
 * W-05 pela API (#12). O aviso de usuários afetados usa `usuariosVinculados` de cada perfil, que é
 * o número antes de salvar; o de perfil sem consulta segue calculado na tela (`regras.ts`).
 */
export function criarPerfisHttp(cliente: ClienteHttp): PerfisApi {
  return {
    catalogo: () => cliente.requisitar<ModuloCatalogo[]>('/permissoes'),

    async listar() {
      const pagina = await cliente.requisitar<{ dados: PerfilApi[] }>('/perfis?tamanho=100');
      return pagina.dados.map(paraTela);
    },

    async salvar(id, entrada) {
      const perfil = await comErroPerfil(
        cliente.requisitar<PerfilApi>(id ? `/perfis/${encodeURIComponent(id)}` : '/perfis', {
          metodo: id ? 'PUT' : 'POST',
          corpo: entrada,
        }),
      );
      return paraTela(perfil);
    },

    excluir: (id) =>
      comErroPerfil(
        cliente.requisitar<void>(`/perfis/${encodeURIComponent(id)}`, { metodo: 'DELETE' }),
      ),
  };
}
