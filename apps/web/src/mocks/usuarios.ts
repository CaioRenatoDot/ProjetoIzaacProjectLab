import { type UsuarioSessao } from '@/lib/sessao/tipos';

/** Senha de todos os usuários simulados. Nenhum dado real (RNF-07). */
export const SENHA_MOCK = 'senha-dev';

/** Catálogo de permissões de `docs/04-contrato-api.md` §3: o administrador tem todas. */
const CATALOGO: Record<string, readonly string[]> = {
  cadastros: ['consultar', 'criar', 'editar', 'excluir'],
  perfis: ['consultar', 'criar', 'editar', 'excluir'],
  triagem: ['consultar', 'criar', 'editar', 'consultar_sensivel'],
  senha: ['consultar', 'criar', 'reclassificar'],
  fila: ['consultar', 'criar', 'editar', 'excluir', 'chamar'],
  alocacao: ['consultar', 'criar', 'editar'],
  atendimento: ['consultar', 'criar', 'editar', 'validar', 'consultar_sensivel'],
  encaminhamento: ['consultar', 'criar'],
  ausencia: ['consultar', 'criar'],
  indicadores: ['consultar', 'exportar'],
  alertas: ['consultar', 'reconhecer', 'escalonar'],
  auditoria: ['consultar', 'exportar'],
};

const TODAS_AS_PERMISSOES = Object.entries(CATALOGO).flatMap(([modulo, operacoes]) =>
  operacoes.map((operacao) => `${modulo}:${operacao}`),
);

const UNIDADE = { unidadeId: 'unidade-mock', unidadeNome: 'Clínica-Escola' };

interface UsuarioMock {
  identificacoes: readonly string[];
  /** `null` simula conta sem perfil vinculado (403 no login). */
  sessao: UsuarioSessao | null;
}

export const USUARIOS_MOCK: readonly UsuarioMock[] = [
  {
    identificacoes: ['admin@clinica.edu.br', '2021000001'],
    sessao: {
      id: 'usuario-admin',
      nome: 'Usuário de desenvolvimento',
      perfilId: 'administrador',
      perfilNome: 'Administração',
      permissoes: TODAS_AS_PERMISSOES,
      ...UNIDADE,
    },
  },
  {
    identificacoes: ['recepcao@clinica.edu.br', '2021000002'],
    sessao: {
      id: 'usuario-recepcao',
      nome: 'Recepção de desenvolvimento',
      perfilId: 'recepcao',
      perfilNome: 'Recepção',
      permissoes: [
        'cadastros:consultar',
        'cadastros:criar',
        'fila:consultar',
        'fila:chamar',
        'senha:consultar',
      ],
      ...UNIDADE,
    },
  },
  { identificacoes: ['semperfil@clinica.edu.br', '2021000003'], sessao: null },
];

export function buscarUsuarioMock(identificacao: string) {
  const chave = identificacao.trim().toLocaleLowerCase('pt-BR');
  return USUARIOS_MOCK.find((u) => u.identificacoes.includes(chave));
}

export function usuarioMockPorId(id: string) {
  return USUARIOS_MOCK.find((u) => u.sessao?.id === id)?.sessao ?? null;
}
