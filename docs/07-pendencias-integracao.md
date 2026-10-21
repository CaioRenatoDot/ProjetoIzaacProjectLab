# Pendências de integração front ↔ back

Partes do front construídas antes da API ou da sessão que elas consomem. Cada item diz **o que é
provisório, onde está e qual issue destrava**. Quem fechar a issue que destrava um item faz a troca
indicada e remove o item deste arquivo no mesmo PR.

> Para assistentes de IA: consulte este arquivo antes de mexer em telas do `apps/web`. Não trate
> um item daqui como pronto, e não remova o provisório sem a issue que o destrava estar mergeada.

**Legenda:** ⏳ aguardando a issue que destrava · 🔧 pode ser trocado agora

## Sessão e acesso

| Status | Provisório                                                                                                   | Onde                                                                  | Destrava                                | Troca a fazer                                                                                                         |
| ------ | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| ⏳     | Sessão fixa com todas as permissões (`obterSessaoProvisoria`)                                                | `apps/web/src/lib/sessao.ts`                                          | #33 (login e sessão no front)           | Ler a sessão real (`UsuarioSessao`, `docs/04` §2) no layout `(autenticado)` e na home; apagar `obterSessaoProvisoria` |
| ⏳     | Cookie `filas-dev-permissoes` troca as permissões da sessão fora de produção (usado pelos testes Playwright) | `apps/web/src/lib/sessao.ts` (`obterSessao`), `apps/web/e2e/apoio.ts` | #33                                     | Fazer os testes entrarem por login real com usuários de seed de cada perfil; apagar o cookie                          |
| ⏳     | "Sair" só redireciona para `/login`                                                                          | `apps/web/src/components/shell.tsx` (`sair`)                          | #33                                     | Encerrar a sessão no servidor antes de redirecionar                                                                   |
| ⏳     | Rota `/acesso` redireciona direto para `/acesso/perfis`                                                      | `apps/web/src/app/(autenticado)/acesso/page.tsx`                      | quando o módulo Acesso tiver outra tela | Trocar o redirect por uma página do módulo                                                                            |
| ⏳     | Guard e catálogo de permissões                                                                               | —                                                                     | #11 (API, parte 3.2)                    | Conferir que as permissões usadas em `lib/modulos.ts`, `lib/home.ts` e na tela de perfis existem no catálogo real     |

## Perfis (W-05, #36)

| Status | Provisório                                                                            | Onde                                                           | Destrava                                   | Troca a fazer                                                                                                                                               |
| ------ | ------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ⏳     | API de perfis em memória (dados somem ao recarregar)                                  | `apps/web/src/lib/perfis/api-em-memoria.ts`                    | #12 (API de perfis, permissões e usuários) | Criar um cliente HTTP que implemente `PerfisApi` (`lib/perfis/tipos.ts`) e usá-lo em `app/(autenticado)/acesso/perfis/page.tsx`; apagar a versão em memória |
| ⏳     | Aviso "muda as permissões de N usuários" usa `usuariosVinculados` do perfil carregado | `apps/web/src/components/perfis/tela-perfis.tsx`               | #12                                        | Avaliar usar `usuariosAfetados` devolvido pelo `PUT /perfis/{id}`                                                                                           |
| ⏳     | Aviso de perfil sem consulta é calculado no front                                     | `apps/web/src/lib/perfis/regras.ts` (`semPermissaoDeConsulta`) | #12                                        | Preferir `avisos[]` da resposta da API (contrato) e manter o cálculo só como pré-validação                                                                  |

## Home por perfil (W-02, #35)

| Status | Provisório                                                | Onde                                      | Destrava                                                                         | Troca a fazer                                                                           |
| ------ | --------------------------------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| ⏳     | Todos os blocos mostram o estado vazio                    | `apps/web/src/app/(autenticado)/page.tsx` | APIs de fila (Etapa 6), triagem (Etapa 5), atendimento (Etapa 7) e alertas (#49) | Buscar os dados de cada bloco e implementar os estados de carregamento e erro por bloco |
| ⏳     | Cartões de indicador mostram "—" e "sem dados no momento" | `apps/web/src/app/(autenticado)/page.tsx` | mesmas APIs acima                                                                | Passar o valor real para `rotuloIndicador` (`lib/home.ts`)                              |

## Tempo real

| Status | Provisório                                                 | Onde                                | Destrava            | Troca a fazer                                                                        |
| ------ | ---------------------------------------------------------- | ----------------------------------- | ------------------- | ------------------------------------------------------------------------------------ |
| ⏳     | Conexão sempre "conectada" (`<ConexaoProvider conectado>`) | `apps/web/src/components/shell.tsx` | Etapa 6 (Socket.IO) | Ligar ao estado real do socket; o banner e o `podeEscrever` já reagem (`docs/04` §7) |

## Rotas ainda inexistentes

Os links do menu (`apps/web/src/lib/modulos.ts`) e das ações da home apontam para rotas que
outras issues criam: `/cadastros`, `/triagem`, `/fila`, `/chamada`, `/alocacao`, `/atendimento`,
`/encaminhamento`, `/ausencias`, `/indicadores`, `/auditoria`. Até lá, respondem 404.

## Divergências do plano do front (`docs/.ref/SPECS/frontend/`)

Pontos do [plano de implementação](.ref/SPECS/frontend/plano-implementacao.md) e da [spec](.ref/SPECS/frontend/spec.md) ainda não atendidos nas etapas O0 e O1.

| Status | O plano pede                                                                            | Situação atual                                       | Destrava                                                                     | Troca a fazer                                                                    |
| ------ | --------------------------------------------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| ⏳     | TanStack Query para estado de servidor                                                  | Tela de perfis busca com `useState`/`useEffect`      | #12 (primeira API real consumida)                                            | Adotar TanStack Query no `apps/web` ao trocar a API em memória pelo cliente HTTP |
| ⏳     | React Hook Form + Zod reaproveitando `packages/contracts`; simulação gerada dos schemas | Formulário de perfil manual; simulação escrita à mão | PR de contrato com o schema de perfil em `packages/contracts` (AGENTS.md §6) | Validar o formulário com o schema do contrato e gerar a simulação a partir dele  |
| ⏳     | Barra superior com seletor de contexto de perfil                                        | Só mostra o perfil ativo                             | Decisão: `UsuarioSessao` (`openapi.yaml`) tem um único perfil                | Abrir issue `tipo: decisão` se um usuário puder ter mais de um perfil            |
| ⏳     | Playwright cobrindo login e expiração de sessão (O0)                                    | Não coberto                                          | #33                                                                          | Acrescentar os testes em `apps/web/e2e/`                                         |
