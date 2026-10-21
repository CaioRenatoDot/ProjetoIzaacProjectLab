import { BLOCOS, INDICADORES } from '@/lib/home';
import { MODULOS } from '@/lib/modulos';
import { type UsuarioSessao } from '@/lib/sessao/tipos';

/** Senha de todos os usuários simulados. Nenhum dado real (RNF-07). */
export const SENHA_MOCK = 'senha-dev';

const TODAS_AS_PERMISSOES = [
  ...new Set([
    ...MODULOS.map((m) => m.permissao),
    ...BLOCOS.flatMap((b) => [b.permissao, ...(b.acao ? [b.acao.permissao] : [])]),
    ...INDICADORES.map((i) => i.permissao),
    'perfis:criar',
    'perfis:editar',
    'perfis:excluir',
    'senha:reclassificar',
  ]),
];

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
