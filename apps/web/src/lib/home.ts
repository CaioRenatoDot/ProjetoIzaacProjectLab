import { type Permissao } from '@filas/ui';

export interface AcaoPrimaria {
  rotulo: string;
  rota: string;
  permissao: Permissao;
}

export interface BlocoHome {
  id: string;
  titulo: string;
  /** Texto do estado vazio enquanto não há dados (ou a API do bloco ainda não existe). */
  vazio: string;
  permissao: Permissao;
  acao?: AcaoPrimaria;
}

export interface IndicadorHome {
  rotulo: string;
  unidade: string;
  /** Tela de destino, já filtrada. */
  rota: string;
  permissao: Permissao;
}

/**
 * Blocos da home (W-02 / T-02), cada um ligado à permissão que o exige.
 * Este é o único lugar dessa decisão: nada aqui depende do nome do perfil.
 */
export const BLOCOS: readonly BlocoHome[] = [
  {
    id: 'recepcao',
    titulo: 'Fila resumida',
    vazio: 'Nenhuma senha aguardando agora.',
    permissao: 'fila:consultar',
    acao: { rotulo: 'Chamar próxima', rota: '/chamada', permissao: 'fila:chamar' },
  },
  {
    id: 'triagem',
    titulo: 'Triagens do dia',
    vazio: 'Nenhuma triagem registrada hoje.',
    permissao: 'triagem:criar',
    acao: { rotulo: 'Nova triagem', rota: '/triagem', permissao: 'triagem:criar' },
  },
  {
    id: 'estudante',
    titulo: 'Atendimento atual',
    vazio: 'Você não tem atendimento em andamento.',
    permissao: 'atendimento:criar',
    acao: { rotulo: 'Iniciar atendimento', rota: '/atendimento', permissao: 'atendimento:criar' },
  },
  {
    id: 'supervisao',
    titulo: 'Pendentes de validação',
    vazio: 'Nenhum atendimento aguardando sua validação.',
    permissao: 'atendimento:validar',
  },
  {
    id: 'gestao',
    titulo: 'Filas e alertas de SLA',
    vazio: 'Nenhum alerta de SLA ativo.',
    permissao: 'indicadores:consultar',
  },
  {
    id: 'administracao',
    titulo: 'Atalhos de cadastro',
    vazio: 'Use o módulo Cadastros para manter as entidades base.',
    permissao: 'cadastros:criar',
  },
];

/** Cartões de indicador (no máximo 4), cada um levando à tela já filtrada. */
export const INDICADORES: readonly IndicadorHome[] = [
  {
    rotulo: 'Aguardando na fila',
    unidade: 'senhas',
    rota: '/fila?status=aguardando',
    permissao: 'fila:consultar',
  },
  {
    rotulo: 'Triagens hoje',
    unidade: 'triagens',
    rota: '/triagem?periodo=hoje',
    permissao: 'triagem:consultar',
  },
  {
    rotulo: 'Em atendimento',
    unidade: 'atendimentos',
    rota: '/atendimento?status=em_atendimento',
    permissao: 'atendimento:consultar',
  },
  {
    rotulo: 'Alertas de SLA',
    unidade: 'alertas',
    rota: '/indicadores?aba=alertas',
    permissao: 'alertas:consultar',
  },
];

export const MAXIMO_INDICADORES = 4;

export function montarHome(permissoes: readonly string[]) {
  const tem = (p: Permissao) => permissoes.includes(p);
  const blocos = BLOCOS.filter((b) => tem(b.permissao)).map((b) => ({
    ...b,
    acao: b.acao && tem(b.acao.permissao) ? b.acao : undefined,
  }));
  return {
    blocos,
    indicadores: INDICADORES.filter((i) => tem(i.permissao)).slice(0, MAXIMO_INDICADORES),
  };
}

/** Rótulo completo para leitor de tela: nome, valor e unidade. */
export function rotuloIndicador(indicador: IndicadorHome, valor: number | null) {
  return valor === null
    ? `${indicador.rotulo}: sem dados no momento`
    : `${indicador.rotulo}: ${valor} ${indicador.unidade}`;
}
