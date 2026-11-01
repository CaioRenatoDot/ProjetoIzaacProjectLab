import { ErroPerfil, type ModuloCatalogo, type Perfil, type PerfisApi } from './tipos';

const operacoes = (modulo: string, lista: string[]) =>
  lista.map((operacao) => ({ operacao, permissao: `${modulo}:${operacao}` }));

/** Catálogo de `docs/04-contrato-api.md` §3. */
const CATALOGO: ModuloCatalogo[] = [
  {
    modulo: 'cadastros',
    rotulo: 'Cadastros',
    sensivel: false,
    operacoes: operacoes('cadastros', ['consultar', 'criar', 'editar', 'excluir']),
  },
  {
    modulo: 'perfis',
    rotulo: 'Perfis',
    sensivel: false,
    operacoes: operacoes('perfis', ['consultar', 'criar', 'editar', 'excluir']),
  },
  {
    modulo: 'triagem',
    rotulo: 'Triagem',
    sensivel: true,
    operacoes: operacoes('triagem', ['consultar', 'criar', 'editar', 'consultar_sensivel']),
  },
  {
    modulo: 'senha',
    rotulo: 'Senha',
    sensivel: false,
    operacoes: operacoes('senha', ['consultar', 'criar', 'reclassificar']),
  },
  {
    modulo: 'fila',
    rotulo: 'Fila',
    sensivel: false,
    operacoes: operacoes('fila', ['consultar', 'criar', 'editar', 'excluir', 'chamar']),
  },
  {
    modulo: 'alocacao',
    rotulo: 'Alocação',
    sensivel: false,
    operacoes: operacoes('alocacao', ['consultar', 'criar', 'editar']),
  },
  {
    modulo: 'atendimento',
    rotulo: 'Atendimento',
    sensivel: true,
    operacoes: operacoes('atendimento', [
      'consultar',
      'criar',
      'editar',
      'validar',
      'consultar_sensivel',
    ]),
  },
  {
    modulo: 'encaminhamento',
    rotulo: 'Encaminhamento',
    sensivel: false,
    operacoes: operacoes('encaminhamento', ['consultar', 'criar']),
  },
  {
    modulo: 'ausencia',
    rotulo: 'Ausências',
    sensivel: false,
    operacoes: operacoes('ausencia', ['consultar', 'criar']),
  },
  {
    modulo: 'indicadores',
    rotulo: 'Indicadores',
    sensivel: false,
    operacoes: operacoes('indicadores', ['consultar', 'exportar']),
  },
  {
    modulo: 'alertas',
    rotulo: 'Alertas',
    sensivel: false,
    operacoes: operacoes('alertas', ['consultar', 'reconhecer', 'escalonar']),
  },
  {
    modulo: 'auditoria',
    rotulo: 'Auditoria',
    sensivel: true,
    operacoes: operacoes('auditoria', ['consultar', 'exportar']),
  },
];

const PERFIS_INICIAIS: Perfil[] = [
  {
    id: 'administrador',
    nome: 'Administrador',
    descricao: 'Perfil do sistema, com acesso total.',
    sistema: true,
    permissoes: CATALOGO.flatMap((m) => m.operacoes.map((o) => o.permissao)),
    usuariosVinculados: 1,
  },
  {
    id: 'recepcao',
    nome: 'Recepção',
    descricao: 'Cadastro de pacientes e chamada da fila.',
    sistema: false,
    permissoes: [
      'cadastros:consultar',
      'cadastros:criar',
      'fila:consultar',
      'fila:chamar',
      'senha:consultar',
    ],
    usuariosVinculados: 3,
  },
  {
    id: 'triagem',
    nome: 'Triagem',
    descricao: 'Triagem e emissão de senha.',
    sistema: false,
    permissoes: ['triagem:consultar', 'triagem:criar', 'senha:criar', 'fila:consultar'],
    usuariosVinculados: 0,
  },
];

/**
 * Implementação em memória até a API de perfis (#12) existir. Segue as regras do contrato
 * (nome único, perfil do sistema imutável, exclusão bloqueada com usuário vinculado).
 * Ao integrar, trocar por um cliente HTTP que implemente `PerfisApi`.
 */
export function criarPerfisApiEmMemoria(): PerfisApi {
  let perfis = structuredClone(PERFIS_INICIAIS);
  let sequencia = 0;

  const nomeEmUso = (nome: string, id: string | null) =>
    perfis.some(
      (p) => p.id !== id && p.nome.toLocaleLowerCase('pt-BR') === nome.toLocaleLowerCase('pt-BR'),
    );

  return {
    catalogo: () => Promise.resolve(structuredClone(CATALOGO)),
    listar: () => Promise.resolve(structuredClone(perfis)),
    salvar(id, entrada) {
      const nome = entrada.nome.trim();
      if (nomeEmUso(nome, id)) {
        return Promise.reject(
          new ErroPerfil('DUPLICIDADE', 'Já existe um perfil com este nome. Escolha outro.'),
        );
      }
      if (id === null) {
        sequencia += 1;
        const novo: Perfil = {
          ...entrada,
          nome,
          id: `novo-${sequencia}`,
          sistema: false,
          usuariosVinculados: 0,
        };
        perfis = [...perfis, novo];
        return Promise.resolve(structuredClone(novo));
      }
      const atual = perfis.find((p) => p.id === id);
      if (!atual || atual.sistema) {
        return Promise.reject(
          new ErroPerfil('VALIDACAO', 'Perfil do sistema não pode ser alterado.'),
        );
      }
      const atualizado = { ...atual, ...entrada, nome };
      perfis = perfis.map((p) => (p.id === id ? atualizado : p));
      return Promise.resolve(structuredClone(atualizado));
    },
    excluir(id) {
      const atual = perfis.find((p) => p.id === id);
      if (atual?.sistema) {
        return Promise.reject(
          new ErroPerfil('VALIDACAO', 'Perfil do sistema não pode ser excluído.'),
        );
      }
      if (atual && atual.usuariosVinculados > 0) {
        return Promise.reject(
          new ErroPerfil(
            'VINCULO_ATIVO',
            `Este perfil não pode ser excluído porque ${atual.usuariosVinculados} usuário(s) estão vinculados a ele. Mude o perfil desses usuários antes de excluir.`,
          ),
        );
      }
      perfis = perfis.filter((p) => p.id !== id);
      return Promise.resolve();
    },
  };
}
