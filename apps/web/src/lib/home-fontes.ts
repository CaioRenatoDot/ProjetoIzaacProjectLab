import { type AtendimentoResumo, type TriagemResumo } from '@filas/contracts';
import { type Permissao } from '@filas/ui';

import { descreverGravidade } from '@/lib/alertas/apresentacao';
import { type Alerta } from '@/lib/alertas/tipos';
import { type ClienteHttp } from '@/lib/api/cliente-http';
import { type Pagina } from '@/lib/cadastros/tipos';
import { criarFilaApi } from '@/lib/fila/api';
import { type QuadroFila } from '@/lib/fila/tipos';

export type FonteHome = 'filas' | 'triagens' | 'atendimentos' | 'pendentes' | 'alertas';

/** Permissão de leitura de cada fonte: sem ela, a home nem faz a consulta. */
export const PERMISSAO_FONTE: Readonly<Record<FonteHome, Permissao>> = {
  filas: 'fila:consultar',
  triagens: 'triagem:consultar',
  atendimentos: 'atendimento:consultar',
  pendentes: 'atendimento:consultar',
  alertas: 'alertas:consultar',
};

export const FONTES = Object.keys(PERMISSAO_FONTE) as FonteHome[];

export interface ItemHome {
  id: string;
  titulo: string;
  detalhe: string;
  rota: string;
}

export interface DadosFonte {
  /** Valor do cartão de indicador. */
  total: number;
  /** Primeiros itens do bloco, em projeção de resumo (ADR-003). */
  itens: ItemHome[];
  /** Itens que ficaram de fora do bloco. */
  restantes: number;
}

export const MAXIMO_ITENS = 5;

/** Dia de quem consulta, no formato de `de` e `ate` de `GET /triagens`. */
export function diaLocal(agora: Date) {
  return [
    agora.getFullYear(),
    String(agora.getMonth() + 1).padStart(2, '0'),
    String(agora.getDate()).padStart(2, '0'),
  ].join('-');
}

function deUmaPagina<T>(pagina: Pagina<T>, paraItem: (registro: T) => ItemHome): DadosFonte {
  return {
    total: pagina.meta.total,
    itens: pagina.dados.map(paraItem),
    restantes: Math.max(0, pagina.meta.total - pagina.dados.length),
  };
}

const itemDeAtendimento = (a: AtendimentoResumo): ItemHome => ({
  id: a.id,
  titulo: `Senha ${a.numero} · ${a.especialidade}`,
  detalhe: `${a.estudante} · ${a.sala}`,
  rota: `/atendimento?senha=${encodeURIComponent(a.senhaId)}`,
});

export function criarFontesHome(
  cliente: ClienteHttp,
): Readonly<Record<FonteHome, () => Promise<DadosFonte>>> {
  const atendimentos = (status: string) =>
    cliente.requisitar<Pagina<AtendimentoResumo>>(
      `/atendimentos?status=${status}&pagina=1&tamanho=${MAXIMO_ITENS}`,
    );

  return {
    /** `GET /filas` não traz contagem: ela vem das métricas do quadro de cada fila. */
    filas: async () => {
      const { dados: filas } = await criarFilaApi(cliente).listarFilas();
      const quadros = await Promise.all(
        filas.map((fila) =>
          cliente.requisitar<QuadroFila>(
            `/filas/${encodeURIComponent(fila.id)}/senhas?pagina=1&tamanho=1`,
          ),
        ),
      );
      const porEspera = [...quadros].sort((a, b) => b.metricas.aguardando - a.metricas.aguardando);
      return {
        total: quadros.reduce((soma, q) => soma + q.metricas.aguardando, 0),
        itens: porEspera.slice(0, MAXIMO_ITENS).map(({ fila, metricas }) => ({
          id: fila.id,
          titulo: fila.especialidade,
          detalhe: `${metricas.aguardando} aguardando${fila.bloqueio.ativo ? ' · chamadas suspensas' : ''}`,
          rota: '/fila',
        })),
        restantes: Math.max(0, quadros.length - MAXIMO_ITENS),
      };
    },

    triagens: async () => {
      const hoje = diaLocal(new Date());
      const pagina = await cliente.requisitar<Pagina<TriagemResumo>>(
        `/triagens?de=${hoje}&ate=${hoje}&pagina=1&tamanho=${MAXIMO_ITENS}`,
      );
      return deUmaPagina(pagina, (t) => ({
        id: t.id,
        titulo: `${t.pacienteIniciais} · ${t.especialidade}`,
        detalhe: t.senhaEmitida ? 'Senha emitida' : 'Senha ainda não emitida',
        rota: '/triagem',
      }));
    },

    atendimentos: async () => deUmaPagina(await atendimentos('EM_ATENDIMENTO'), itemDeAtendimento),

    pendentes: async () => deUmaPagina(await atendimentos('PENDENTE_VALIDACAO'), itemDeAtendimento),

    alertas: async () => {
      const pagina = await cliente.requisitar<Pagina<Alerta>>(
        `/alertas?status=ATIVO&status=RECONHECIDO&pagina=1&tamanho=${MAXIMO_ITENS}`,
      );
      return deUmaPagina(pagina, (a) => ({
        id: a.id,
        titulo: a.especialidade,
        detalhe: descreverGravidade(a),
        rota: '/indicadores/alertas',
      }));
    },
  };
}
