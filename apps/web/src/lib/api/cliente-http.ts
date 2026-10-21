/** Erro de campo de uma resposta 422 (`docs/04-contrato-api.md` §4). */
export interface ErroDeCampo {
  campo: string;
  mensagem: string;
}

/** Erro da API (RFC 7807 + `codigo`). Falha de rede vem com `status` 0 e `codigo` `REDE`. */
export class ErroApi extends Error {
  constructor(
    readonly status: number,
    readonly codigo: string,
    readonly detail: string,
    readonly campos: readonly ErroDeCampo[] = [],
  ) {
    super(detail);
    this.name = 'ErroApi';
  }
}

export interface OpcoesRequisicao {
  metodo?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  corpo?: unknown;
  /** Não tenta renovar o token num 401 (login, refresh e logout). */
  semRenovar?: boolean;
}

export interface ClienteHttp {
  requisitar<T>(caminho: string, opcoes?: OpcoesRequisicao): Promise<T>;
}

export interface ConfigClienteHttp {
  baseUrl: string;
  obterToken: () => string | null;
  /** Renova o access token pelo cookie de refresh. Devolve `false` se não conseguiu. */
  renovarToken: () => Promise<boolean>;
  /** Chamado quando um 401 persiste depois da tentativa de renovação. */
  aoPerderSessao: () => void;
}

/**
 * Cliente HTTP do `apps/web`. Num 401, renova o token uma vez e repete a requisição; vários 401
 * ao mesmo tempo compartilham o mesmo refresh.
 */
export function criarClienteHttp(config: ConfigClienteHttp): ClienteHttp {
  let renovacao: Promise<boolean> | null = null;

  function renovarUmaVez() {
    renovacao ??= config.renovarToken().finally(() => {
      renovacao = null;
    });
    return renovacao;
  }

  async function enviar(caminho: string, opcoes: OpcoesRequisicao) {
    const token = config.obterToken();
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (opcoes.corpo !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;
    try {
      return await fetch(`${config.baseUrl}${caminho}`, {
        method: opcoes.metodo ?? 'GET',
        headers,
        credentials: 'include',
        body: opcoes.corpo === undefined ? undefined : JSON.stringify(opcoes.corpo),
      });
    } catch {
      throw new ErroApi(
        0,
        'REDE',
        'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.',
      );
    }
  }

  return {
    async requisitar<T>(caminho: string, opcoes: OpcoesRequisicao = {}) {
      let resposta = await enviar(caminho, opcoes);
      if (resposta.status === 401 && !opcoes.semRenovar) {
        if (await renovarUmaVez()) resposta = await enviar(caminho, opcoes);
        if (resposta.status === 401) config.aoPerderSessao();
      }
      if (!resposta.ok) throw await converterErro(resposta);
      if (resposta.status === 204) return undefined as T;
      return (await resposta.json()) as T;
    },
  };
}

async function converterErro(resposta: Response) {
  const corpo = (await resposta.json().catch(() => ({}))) as {
    codigo?: string;
    detail?: string;
    title?: string;
    campos?: ErroDeCampo[];
  };
  return new ErroApi(
    resposta.status,
    corpo.codigo ?? 'DESCONHECIDO',
    corpo.detail ?? corpo.title ?? 'Não foi possível concluir a operação. Tente novamente.',
    corpo.campos ?? [],
  );
}
