# Pendências de integração front ↔ back

Partes do front construídas antes da API ou da sessão que elas consomem. Cada item diz **o que é
provisório, onde está e qual issue destrava**. Quem fechar a issue que destrava um item faz a troca
indicada e remove o item deste arquivo no mesmo PR.

> Para assistentes de IA: consulte este arquivo antes de mexer em telas do `apps/web`. Não trate
> um item daqui como pronto, e não remova o provisório sem a issue que o destrava estar mergeada.

> **Para quem for fazer o back-end:** antes de implementar uma API listada abaixo, leia a seção
> dela. Cada uma diz **o que o front já consome**, em que formato, e **onde o contrato
> (`docs/api/openapi.yaml`) está incompleto ou diverge do que a tela precisa**. Lacunas do contrato
> não se resolvem no código: viram PR de contrato próprio (AGENTS.md §6) ou issue `tipo: decisão`.
> Ao entregar a API, avise o dono da tela para trocar o mock (a coluna "Troca a fazer" diz como).

**Legenda:** ⏳ aguardando a issue que destrava · 🔧 pode ser trocado agora

## Índice por issue do back-end

| Issue (back-end)                                | O que destrava no front                            | Seção                                                   |
| ----------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------- |
| #10 (3.1, login, refresh e bloqueio)            | Login e sessão reais (hoje sobre a simulação MSW)  | [Sessão e acesso](#sessão-e-acesso)                     |
| #11 (3.2, guard e catálogo de permissões)       | Permissões usadas em menu, home e telas            | [Sessão e acesso](#sessão-e-acesso)                     |
| #12 (3.6, API de perfis)                        | Tela de perfis (W-05)                              | [Perfis](#perfis-w-05-36)                               |
| #13 e #14 (4.1, API dos cadastros base)         | Lista e formulário de cadastros (W-03, W-04)       | [Cadastros](#cadastros-w-03-e-w-04-37-e-38)             |
| #15 (5.1, API de triagem)                       | Ficha de triagem (W-06)                            | [Triagem e senha](#triagem-e-senha-w-06-e-w-07-39-e-40) |
| #16 (5.2, emissão e reclassificação de senha)   | Emissão da senha e modal de reclassificação (W-07) | [Triagem e senha](#triagem-e-senha-w-06-e-w-07-39-e-40) |
| #29 (9.4, consulta e exportação da trilha)      | Trilha de auditoria (W-18)                         | [Auditoria](#trilha-de-auditoria-w-18-50)               |
| #28 (9.3, alertas de SLA e escalonamento)       | Alertas de SLA (W-18)                              | [Alertas](#alertas-de-sla-w-18-49)                      |
| #17 a #19 (6.1 a 6.3, fila, chamada e bloqueio) | Painel de fila (W-08)                              | [Painel de fila](#painel-de-fila-w-08-41)               |
| #21 (7.1, API de alocação)                      | Alocação de recursos (W-11)                        | [Alocação](#alocação-de-recursos-w-11-43)               |

## Sessão e acesso

| Status | Provisório                                                                                                                                                                                          | Onde                                                     | Destrava                                                                              | Troca a fazer                                                                                                                              |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 🔧     | Login, refresh, logout e `/auth/me` sobre a simulação MSW, ligada por padrão no `pnpm dev` (`NEXT_PUBLIC_API_MOCK=false` desliga). Usuários simulados em `src/mocks/usuarios.ts`, senha `senha-dev` | `apps/web/src/mocks/`                                    | #10 (API, parte 3.1) entregue                                                         | Rodar com `NEXT_PUBLIC_API_MOCK=false` contra a API e conferir os códigos de erro (lacunas abaixo); depois apagar os handlers de `/auth/*` |
| ⏳     | Testes Playwright entram pela sessão simulada (cookie `filas-mock-refresh`) e trocam permissões pelo cookie `filas-dev-permissoes`                                                                  | `apps/web/e2e/apoio.ts`, `apps/web/src/mocks/cookies.ts` | #10 e seed (parte 2.4)                                                                | Entrar por login real com usuários de seed de cada perfil; apagar os dois cookies                                                          |
| ⏳     | Rota `/acesso` redireciona direto para `/acesso/perfis`                                                                                                                                             | `apps/web/src/app/(autenticado)/acesso/page.tsx`         | quando o módulo Acesso tiver outra tela                                               | Trocar o redirect por uma página do módulo                                                                                                 |
| 🔧     | Guard e catálogo de permissões                                                                                                                                                                      | —                                                        | #11 (API, parte 3.2) entregue; catálogo em `@filas/contracts` (`CATALOGO_PERMISSOES`) | Conferir que as permissões usadas em `lib/modulos.ts`, `lib/home.ts` e na tela de perfis existem no catálogo real                          |

### Lacunas do contrato de `/auth/*` (decisão antes de integrar com a #10)

| #   | Lacuna                                                                                                                                                                       | O que o front faz hoje                                                                                                                       | Pedido ao back-end                                                                                                                                                                                         |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Tempo restante do bloqueio** só existe no texto de `detail` (exemplo `bloqueado` do `openapi.yaml`)                                                                        | Exibe o `detail` de `BLOQUEIO_TEMPORARIO` como veio                                                                                          | **Resolvida no contrato (#10):** o 401 `BLOQUEIO_TEMPORARIO` traz `minutosRestantes`. Ao integrar, usar o campo em vez de depender do `detail`                                                             |
| 2   | **Conta sem perfil (403 no login)** não tem `codigo` definido                                                                                                                | Decide pelo status 403 e usa texto próprio; a simulação devolve `SEM_PERFIL`                                                                 | **Resolvida no contrato (#10):** não existe conta sem perfil (`usuario.perfil_id` é obrigatório); o 403 saiu do login e conta inativa recebe o mesmo 401 neutro. Ao integrar, apagar `MENSAGEM_SEM_PERFIL` |
| 3   | **Credencial inválida**: o front mostra um texto fixo para todo 401 que não seja `BLOQUEIO_TEMPORARIO`, para que nenhuma variação do servidor revele qual campo errou (T-01) | Texto em `apps/web/src/lib/sessao/login.ts`                                                                                                  | Nenhuma mudança; só aviso                                                                                                                                                                                  |
| 4   | **Cookie de refresh entre portas**: o front (3000) chama a API (3333) com `credentials: 'include'`                                                                           | A simulação guarda o refresh num cookie comum                                                                                                | CORS com `credentials: true` para `apps/web` e `apps/publico` entregue na #31 (`CORS_ORIGENS`). Falta só a produção: com `SameSite=Strict`, web e API têm de ficar no mesmo site                           |
| 5   | **"Manter conectado"**: o contrato tem `manterConectado`, mas não diz o efeito (cookie persistente ou de sessão)                                                             | Envia o valor; em terminal compartilhado o campo fica desabilitado por `NEXT_PUBLIC_TERMINAL_COMPARTILHADO=true` (**proposta**, a confirmar) | **Resolvida no contrato (#10):** `false` = cookie de sessão; `true` = cookie persistente até o fim das 8 h. "Terminal compartilhado" segue como configuração do front (proposta)                           |

## Cadastros (W-03 e W-04, #37 e #38)

A lista e o formulário genéricos (`apps/web/src/components/cadastros/`) já consomem a API pelo
cliente HTTP; hoje quem responde é a simulação MSW (`apps/web/src/mocks/cadastros.ts`). Para
integrar: rodar com `NEXT_PUBLIC_API_MOCK=false` contra a API e apagar os handlers de cadastros.

| Status | Provisório                                                                                                                                            | Onde                                        | Destrava                                                     | Troca a fazer                                                                           |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| 🔧     | Listar, consultar, criar, editar, excluir e inativar os cinco cadastros, e os cadastros de apoio, sobre MSW com dados fictícios                       | `apps/web/src/mocks/cadastros.ts`           | #13 e #14 entregues                                          | Conferir lista e formulário contra a API real; apagar os handlers                       |
| 🔧     | Schemas Zod do formulário são cópia local das entradas do `openapi.yaml` (decisão de 22/10/2026: os oficiais ainda não existem em `@filas/contracts`) | `apps/web/src/lib/cadastros/formularios.ts` | Schemas em `@filas/contracts` (`cadastros.ts`, `pessoas.ts`) | Importar os schemas de `@filas/contracts` e apagar a cópia local, mantendo as mensagens |

### Lacunas do contrato dos cadastros (decisão antes de integrar com #13 e #14)

| #   | Lacuna                                                                                                                                                                                                                                                   | O que o front faz hoje                                                                                                                                          | Pedido ao back-end                                                                                                                                                                     |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Inativar** não existe no contrato: `PacienteEntrada` e as demais entradas não têm `ativo`, e não há endpoint próprio. A T-03 manda oferecer "inativar" quando a exclusão é recusada por vínculo, e a parte 4.1 prevê "inativação no lugar de exclusão" | Chama `PATCH /<entidade>/{id}` com `{ "ativo": false }` (`ativa` em especialidade). **Proposta**, só a simulação responde                                       | **Resolvida no contrato (#13):** `PATCH /<entidade>/{id}` com `{ ativo }` (`{ ativa }` em especialidade), como a simulação já faz                                                      |
| 2   | **Vínculo ativo não vem na listagem**: a T-03 diz que "Excluir" só é oferecido sem vínculo, mas os schemas não trazem esse dado                                                                                                                          | Oferece "Excluir" a quem tem `cadastros:excluir` e trata o `409 VINCULO_ATIVO` explicando o vínculo e oferecendo inativar                                       | **Decidido (#13):** sem campo na lista; a tela segue oferecendo "Excluir" e trata o `409 VINCULO_ATIVO`, cujo `detail` diz o vínculo e sugere inativar                                 |
| 3   | **Filtros da T-03 sem parâmetro no contrato**: nível de formação (estudantes), disponibilidade (supervisores) e recurso (salas, `recursoId` existe)                                                                                                      | A tela só oferece os filtros que o contrato aceita                                                                                                              | **Resolvida no contrato (#14):** `nivelFormacao` em estudantes e `disponivel` em supervisores (ocupação depende da alocação, #7)                                                       |
| 4   | **Cadastros de apoio sem endpoint**: não há como listar habilitações, procedimentos e recursos, que alimentam as seleções múltiplas do formulário (Documento de Requisitos §5, Tabelas 2 a 5) e o filtro de recurso da lista                             | Usa `GET /habilitacoes`, `GET /procedimentos` e `GET /recursos` (resposta paginada de `ItemReferencia`). **Proposta**, só a simulação responde                  | **Resolvida no contrato (#13):** `GET /habilitacoes`, `/procedimentos` e `/recursos`, paginados, com `ItemReferencia`                                                                  |
| 5   | **Ordenação**: `docs/04` §5 prevê `ordenar` e `direcao`, mas o `openapi.yaml` não lista esses parâmetros nos `GET` de cadastros                                                                                                                          | Envia `ordenar=nome` (`identificacao` em salas) e `direcao`                                                                                                     | **Resolvida no contrato (#13):** `ordenar` (campos por endpoint) e `direcao` nas cinco listagens; campo fora da lista dá 422                                                           |
| 6   | **Mensagem do `409 VINCULO_ATIVO`**: a tela exibe o `detail` como explicação do vínculo                                                                                                                                                                  | A simulação devolve o texto com causa e próximo passo                                                                                                           | **Resolvida no contrato (#13):** `docs/04` §4 exige que o `detail` diga o vínculo e sugira inativar                                                                                    |
| 7   | **Aviso de impacto na edição**: o `PUT /estudantes/{id}` diz que devolve `avisos[]` "antes de aplicar", mas não há como confirmar depois do aviso; supervisor, sala e especialidade não têm o aviso                                                      | O formulário avisa antes de enviar quando um campo de impacto mudou e o registro está em uso (`ocupado`, `ocupacaoAtual > 0`, `ocupada`, `filasVinculadas > 0`) | Definir o fluxo (por exemplo `?confirmar=true` ou `409` com o impacto) e estendê-lo às quatro entidades                                                                                |
| 8   | **Obrigatoriedade do estudante**: o W-04 marca habilitações, procedimentos e disponibilidade como obrigatórios; `EstudanteEntrada` exige só `nome`, `especialidadeId` e `nivelFormacao`                                                                  | Segue o wireframe (mais restrito que o servidor)                                                                                                                | **Resolvida no contrato (#14):** `EstudanteEntrada` exige habilitações, procedimentos e disponibilidade, como o W-04                                                                   |
| 9   | **Situação da sala**: o contrato tem `situacao` como texto livre; a Tabela 4 (ID04) define Disponível, Em manutenção e Indisponível                                                                                                                      | O formulário oferece só os três valores                                                                                                                         | **Resolvida no contrato (#13):** `SituacaoSala` enum (`DISPONIVEL`, `EM_MANUTENCAO`, `INDISPONIVEL`)                                                                                   |
| 10  | **Critério de duplicidade**: o contrato define o do paciente (documento, ou nome e nascimento, `docs/03` §3.2), mas não o de estudante e especialidade, que também verificam (T-04)                                                                      | A simulação compara o nome                                                                                                                                      | **Provisório (#14):** estudante por nome + especialidade e especialidade por nome, sem diferenciar maiúsculas, com `recursoExistenteId`. Critério do estudante pendente na decisão #81 |

## Perfis (W-05, #36)

| Status | Provisório                                                                            | Onde                                                           | Destrava     | Troca a fazer                                                                                                                                               |
| ------ | ------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🔧     | API de perfis em memória (dados somem ao recarregar)                                  | `apps/web/src/lib/perfis/api-em-memoria.ts`                    | #12 entregue | Criar um cliente HTTP que implemente `PerfisApi` (`lib/perfis/tipos.ts`) e usá-lo em `app/(autenticado)/acesso/perfis/page.tsx`; apagar a versão em memória |
| ⏳     | Aviso "muda as permissões de N usuários" usa `usuariosVinculados` do perfil carregado | `apps/web/src/components/perfis/tela-perfis.tsx`               | #12          | Usar `usuariosAfetados` do `PUT /perfis/{id}` (definido no contrato da #12) ou `usuariosVinculados` antes de salvar                                         |
| ⏳     | Aviso de perfil sem consulta é calculado no front                                     | `apps/web/src/lib/perfis/regras.ts` (`semPermissaoDeConsulta`) | #12          | Preferir `avisos[]` da API, código `PERFIL_SEM_CONSULTA` (contrato da #12), e manter o cálculo só como pré-validação                                        |

## Home por perfil (W-02, #35)

| Status | Provisório                                                | Onde                                      | Destrava                                                                         | Troca a fazer                                                                           |
| ------ | --------------------------------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| ⏳     | Todos os blocos mostram o estado vazio                    | `apps/web/src/app/(autenticado)/page.tsx` | APIs de fila (Etapa 6), triagem (Etapa 5), atendimento (Etapa 7) e alertas (#49) | Buscar os dados de cada bloco e implementar os estados de carregamento e erro por bloco |
| ⏳     | Cartões de indicador mostram "—" e "sem dados no momento" | `apps/web/src/app/(autenticado)/page.tsx` | mesmas APIs acima                                                                | Passar o valor real para `rotuloIndicador` (`lib/home.ts`)                              |

## Tempo real

| Status | Provisório                                                                                                                                                                                                                                                                                   | Onde                                                                  | Destrava                          | Troca a fazer                                                                                                                                    |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| ⏳     | Conexão sempre "conectada" (`<ConexaoProvider conectado>`)                                                                                                                                                                                                                                   | `apps/web/src/components/shell.tsx`                                   | Etapa 6 (Socket.IO)               | Ligar ao estado real do socket; o banner e o `podeEscrever` já reagem (`docs/04` §7)                                                             |
| ⏳     | Painel de fila com cliente Socket.IO de `/filas` (`socket.io-client` 4.8.4): conecta com o token no `auth` do handshake, invalida o quadro a cada evento do `docs/04` §7 e liga o banner e o congelamento de escrita ao estado da conexão. Na simulação (MSW) não conecta e fica "conectado" | `apps/web/src/components/fila/use-tempo-real-fila.ts`                 | Etapa 6 (servidor Socket.IO, #24) | Com o servidor no ar, rodar com `NEXT_PUBLIC_API_MOCK=false` e conferir conexão, sala e eventos (lacuna 2 do painel de fila)                     |
| ⏳     | Alertas sem o canal `/alertas`: a tela revalida por HTTP a cada 30 s e detecta alerta novo e normalizado comparando leituras                                                                                                                                                                 | `apps/web/src/components/alertas/tela-alertas.tsx` (`REVALIDACAO_MS`) | Etapa 6 (Socket.IO) e #28         | Com `socket.io-client` (issue própria, AGENTS §3), em `sla.excedido` e `sla.normalizado` invalidar `['alertas']`; o anúncio já sai da comparação |

## Rotas ainda inexistentes

Os links do menu (`apps/web/src/lib/modulos.ts`) e das ações da home apontam para rotas que
outras issues criam: `/triagem`, `/chamada`, `/atendimento`,
`/encaminhamento`, `/ausencias`, `/indicadores`. Até lá, respondem 404.

No painel de fila (W-08, #41), "Abrir atendimento" leva a `/atendimento?senha=<id>` (Etapa 7).
"Alocar recursos" abre `/fila/senhas/<id>/alocacao` (#43); `/alocacao`, do menu, redireciona para
a alocação quando recebe `?senha=<id>` e, sem senha, para a fila.

## Divergências do plano do front (`docs/.ref/SPECS/frontend/`)

Pontos do [plano de implementação](.ref/SPECS/frontend/plano-implementacao.md) e da [spec](.ref/SPECS/frontend/spec.md) ainda não atendidos nas etapas O0 e O1.

| Status | O plano pede                                                                            | Situação atual                                                                                                                   | Destrava                                                                     | Troca a fazer                                                                                               |
| ------ | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| ⏳     | TanStack Query para estado de servidor                                                  | Configurado em `components/providers.tsx` e usado no login (#33); a tela de perfis ainda busca com `useState`/`useEffect`        | #12 (primeira API real consumida)                                            | Usar `useQuery`/`useMutation` com o `cliente` de `useSessao()` ao trocar a API em memória pelo cliente HTTP |
| ⏳     | React Hook Form + Zod reaproveitando `packages/contracts`; simulação gerada dos schemas | Login usa React Hook Form + Zod com schema local (`lib/sessao/login.ts`); formulário de perfil manual; simulações escritas à mão | PR de contrato com o schema de perfil em `packages/contracts` (AGENTS.md §6) | Validar o formulário com o schema do contrato e gerar a simulação a partir dele                             |
| ⏳     | Barra superior com seletor de contexto de perfil                                        | Só mostra o perfil ativo                                                                                                         | Decisão: `UsuarioSessao` (`openapi.yaml`) tem um único perfil                | Abrir issue `tipo: decisão` se um usuário puder ter mais de um perfil                                       |

## Triagem e senha (W-06 e W-07, #39 e #40)

Telas em `apps/web` (`/triagem`), construídas sobre a interface `TriagemApi`
(`apps/web/src/lib/triagem/tipos.ts`), que hoje tem uma implementação em memória
(`apps/web/src/lib/triagem/api-em-memoria.ts`). Para integrar: criar um cliente HTTP que implemente
`TriagemApi`, usá-lo em `apps/web/src/app/(autenticado)/triagem/page.tsx` e apagar a versão em
memória. O front **não altera** `openapi.yaml`; tudo o que está em "Lacuna do contrato" precisa de
decisão do tech lead e do back-end dono do módulo.

### O que o front consome de cada API

| Status | Endpoint                            | O que a tela envia e lê                                                                                                                                                  | Destrava |
| ------ | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| ⏳     | `GET /pacientes?busca=`             | Lê `id`, `nomeCompleto` (só para a busca, nunca exibido), `documento`, `vinculo`, `restricaoAtiva`, `restricaoAte`. Exibe iniciais e documento mascarado                 | #38      |
| ⏳     | `GET /especialidades?ativa=true`    | Lê `id`, `nome`, `ativa`, `filasVinculadas`. A ficha só oferece as que têm `ativa` e `filasVinculadas > 0`                                                               | #38      |
| ⏳     | `POST /triagens`                    | Envia `TriagemEntrada` completo. Lê `id`, `pacienteIniciais`, `especialidade`, `tipoAtendimento`, `prioridade`, `enquadramentoLegal`                                     | #15      |
| ⏳     | `POST /senhas`                      | Envia `{ triagemId, tipoAtendimento }`. Lê `id`, `numero`, `especialidade`, `pacienteIniciais`, `prioridade`, `tipoAtendimento`, `posicaoEstimada`, `versao`, `avisos[]` | #16      |
| ⏳     | `GET /senhas/{id}`                  | Só `prioridade`, `versao`, `posicao`, para recarregar após `VERSAO_DESATUALIZADA`                                                                                        | #16      |
| ⏳     | `GET /senhas/{id}/reclassificacoes` | Lê a lista; vazia deve vir como `[]`, não 404                                                                                                                            | #16      |
| ⏳     | `PATCH /senhas/{id}/prioridade`     | Envia `{ prioridade, justificativa, versao }`. Lê `senha.prioridade`, `senha.versao`, `novaPosicao`                                                                      | #16      |

### Lacunas do contrato (decisão necessária antes de integrar)

| #   | Lacuna                                                                                                                                                                                               | O que o front faz hoje                                                            | Pedido ao back-end                                                                                                                                                               |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Mínimo da justificativa da unidade** (`justificativaMinCaracteres`) não tem endpoint. O `PATCH /senhas/{id}/prioridade` o valida no servidor, mas o modal precisa do número para orientar a pessoa | `TriagemApi.parametros()` devolve 20 (valor provisório do `openapi.yaml`)         | Expor o parâmetro, por exemplo em `GET /auth/me` ou em um `GET /parametros`. AGENTS.md §5.8 proíbe constante no código                                                           |
| 2   | **`TriagemDetalhe` não traz `especialidadeId`**; a tela de emissão usa o id para saber a especialidade e a fila                                                                                      | O mock devolve `especialidadeId`                                                  | Incluir `especialidadeId` na resposta de `POST /triagens` (ou o front passa a depender só do nome)                                                                               |
| 3   | **`POST /senhas` e `SEM_FILA_CONFIGURADA`:** a tela exibe a mensagem do servidor como causa e próximo passo ("peça à administração para configurar a fila")                                          | O mock devolve o texto completo                                                   | Garantir que `detail` do 409 traga a causa **e** o próximo passo (T-07), ou combinar que o texto fica no front a partir de `codigo`                                              |
| 4   | **Código do aviso de fila bloqueada (RN-10)** em `SenhaEmitida.avisos[]` não está definido                                                                                                           | A tela mostra qualquer `avisos[].mensagem` num banner, sem olhar o `codigo`       | Definir o `codigo` (o mock usa `FILA_BLOQUEADA`) e garantir `mensagem` legível                                                                                                   |
| 5   | **Resposta do `PATCH /senhas/{id}/prioridade`** devolve `{ senha, novaPosicao }`, mas o front lê `prioridade`/`versao` no nível de cima                                                              | O mock devolve `{ prioridade, novaPosicao, versao }`                              | Ao integrar, o cliente HTTP mapeia `senha.prioridade` e `senha.versao`; nenhuma mudança de contrato, só aviso                                                                    |
| 6   | **Aviso de reincidência (RN-13):** a spec do módulo diz que vem como aviso na busca do paciente, mas `Paciente` só tem `restricaoAtiva` e `restricaoAte`, sem texto de política                      | A tela monta o banner com `restricaoAte` e a frase "A triagem continua permitida" | **Decidido (#14):** a busca usa `restricaoAtiva`/`restricaoAte` (como a tela já faz); o aviso `PACIENTE_COM_RESTRICAO` vem em `avisos[]` de `GET /pacientes/{id}`                |
| 7   | **Busca de paciente devolve `nomeCompleto`**; a issue #39 pede resultado resumido (nome abreviado, P-03)                                                                                             | A tela só exibe `iniciais` e documento mascarado                                  | **Decidido (#14):** a lista de pacientes devolve o nome completo por desenho (o cadastro é o objeto da tela, `openapi.yaml`); a tela de triagem continua exibindo só as iniciais |
| 8   | **Especialidades "ativas com fila"**: o contrato só filtra por `ativa`                                                                                                                               | A tela filtra `filasVinculadas > 0` no cliente                                    | Aceitar um filtro `comFila=true` ou garantir `filasVinculadas` confiável                                                                                                         |
| 9   | **Erro 422 de validação** devolve `campos[]`; a ficha valida localmente com o mesmo critério                                                                                                         | A tela só usa a validação local                                                   | Manter `campos[].campo` igual aos nomes de `TriagemEntrada`, para o front mapear o erro do servidor ao campo                                                                     |

### Pendências só do front (sem depender de API)

| Status | Provisório                                                          | Onde                                              | Troca a fazer                                                                                                                                                      |
| ------ | ------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ⏳     | Schema Zod da ficha é uma cópia local, com RN-02 e RN-03            | `apps/web/src/lib/triagem/schema.ts`              | Quando a #15 criar o schema oficial em `packages/contracts`, importar de lá e apagar a cópia (e `prioridadeEfetiva`, se o servidor passar a devolver a prioridade) |
| ⏳     | "Imprimir senha" só chama `window.print()`, sem layout de impressão | `apps/web/src/components/triagem/etapa-senha.tsx` | Criar estilo de impressão com a senha em destaque (e decidir se há impressora térmica)                                                                             |
| ⏳     | Posição estimada na fila é fixa no mock                             | `apps/web/src/lib/triagem/api-em-memoria.ts`      | Usar `posicaoEstimada` real da API                                                                                                                                 |
| ⏳     | Testes Playwright rodam contra os dados em memória                  | `apps/web/e2e/triagem.e2e.ts`                     | Com API real, rodar contra o banco de teste com seed (paciente com restrição, especialidade sem fila, especialidade bloqueada)                                     |

## Painel de fila (W-08, #41)

O painel (`apps/web/src/components/fila/`) consome a API pelo cliente HTTP; hoje quem responde é a
simulação única das filas (`apps/web/src/mocks/filas.ts`), que também atende a tela de Ausências.
Especialidades de teste: Fisioterapia (cenários da #47), Fonoaudiologia (bloqueada, RN-10),
Nutrição (RN-03, RN-04, SLA e todos os status) e Psicologia (vazia).

| Status | Provisório                                                                                                                                   | Onde                                            | Destrava                                    | Troca a fazer                                           |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------- | ------------------------------------------------------- |
| ⏳     | `GET /filas`, quadro, chamada com `Idempotency-Key`, rechamada, reclassificação e `GET /senhas/{id}` sobre MSW, com dados fictícios          | `apps/web/src/mocks/filas.ts`                   | #17 a #19 (API) e #16 (reclassificação)     | Conferir o painel contra a API real; apagar os handlers |
| ⏳     | O modal de reclassificação lê o mínimo da justificativa de `GET /parametros` (proposta, lacuna 1 da triagem)                                 | `apps/web/src/lib/fila/reclassificacao-http.ts` | decisão do back sobre parâmetros da unidade | Trocar pelo endpoint definido                           |
| ⏳     | Visão consolidada multiespecialidade e seletor de turno (T-09) não implementados: o contrato só tem o quadro por fila e não filtra por turno | `apps/web/src/components/fila/tela-fila.tsx`    | contrato (lacunas 4 e 5)                    | Implementar quando o contrato tiver os parâmetros       |

### Lacunas do contrato da fila (decisão antes de integrar com #17 a #19)

| #   | Lacuna                                                                                                                 | O que o front faz hoje                                                                                                    | Pedido ao back-end                                                                       |
| --- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 1   | **`SenhaResumo` não traz a chamada vigente**: "Rechamar" usa `POST /chamadas/{id}/rechamada`, que pede o id da chamada | Lê `chamadaId` na senha (a simulação devolve) e só mostra "Rechamar" quando ele existe                                    | Incluir `chamadaId` em `SenhaResumo` ou aceitar a rechamada por `/senhas/{id}/rechamada` |
| 2   | **Sala `especialidade:{id}` do `/filas`**: o `docs/04` §7 não diz como o cliente entra na sala                         | Envia `especialidadeId` na query do handshake (**proposta**)                                                              | Definir o mecanismo (query do handshake ou evento de inscrição)                          |
| 3   | **Confirmação de urgente (RN-03)**: `furouFilaPorUrgencia` só chega depois da chamada feita                            | Antes de chamar, verifica no quadro se a primeira aguardando é urgente e chegou depois de outra senha, e pede confirmação | Confirmar que a checagem no front basta ou expor a próxima senha antes da chamada        |
| 4   | **Seletor de turno (T-09)**: `GET /filas/{id}/senhas` não filtra por turno                                             | Não oferece o seletor                                                                                                     | Acrescentar o parâmetro                                                                  |
| 5   | **Visão consolidada (T-09, RNF-08)**: o quadro é por fila; não há quadro de várias especialidades                      | Mostra uma especialidade por vez e os bloqueios de todas na faixa de avisos                                               | Definir se a visão consolidada é um endpoint próprio                                     |
| 6   | **"Aguardando recurso" no quadro**: a T-09 tem cinco colunas e nenhuma para `AGUARDANDO_RECURSO`                       | A senha aparece na coluna "Chamada", com a etiqueta do próprio status                                                     | Confirmar com a especificação de UI                                                      |

## Alocação de recursos (W-11, #43)

A tela (`apps/web/src/components/alocacao/`) consome a API pelo cliente HTTP e não deduz regra:
quem está apto e o motivo de quem não está vêm prontos de `GET /senhas/{id}/alocacao/sugestoes`.
Hoje quem responde é a simulação `apps/web/src/mocks/alocacao.ts`, sobre as senhas de
`mocks/filas.ts`: Fisioterapia exige supervisor e tem inaptos de cada tipo; "Ana Ribeiro" fica
indisponível na confirmação (409 `RECURSO_INDISPONIVEL`); Nutrição não exige supervisor; N106 não
tem sala compatível.

| Status | Provisório                                                                                                              | Onde                             | Destrava                           | Troca a fazer                                         |
| ------ | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------- | ---------------------------------- | ----------------------------------------------------- |
| ⏳     | Sugestões, confirmação com `Idempotency-Key` e "Manter aguardando recurso" sobre MSW, com dados fictícios               | `apps/web/src/mocks/alocacao.ts` | #21 (API, parte 7.1)               | Conferir a tela contra a API real; apagar os handlers |
| ⏳     | "Trocar recurso" de uma alocação já confirmada (`PUT /senhas/{id}/alocacao`, "Reavaliar alocação" da T-09) não tem tela | —                                | parte 7.4 (#44) ou decisão do time | Definir onde a reavaliação acontece                   |

### Lacunas do contrato da alocação (decisão antes de integrar com a #21)

| #   | Lacuna                                                                                                                                            | O que o front faz hoje                                                          | Pedido ao back-end                                                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 1   | **Status depois da alocação**: o contrato não diz se a senha muda de status ao confirmar (nem se `AGUARDANDO_RECURSO` volta a `CHAMADA`)          | A simulação deixa a senha em `CHAMADA`, com `versao` nova                       | Definir a transição (P-01)                                                |
| 2   | **Sala ocupada**: `motivoInaptidao` não tem valor para sala ocupada por outro atendimento                                                         | A simulação usa `ATENDIMENTO_ATIVO` com o texto "Ocupada por outro atendimento" | Acrescentar o valor ou confirmar o uso de `ATENDIMENTO_ATIVO`             |
| 3   | **Cabeçalho da tela**: número, especialidade e horário da chamada vêm de `GET /senhas/{id}`, que exige `senha:consultar` além de `alocacao:criar` | Usa `GET /senhas/{id}` (sem `incluirTriagem`, então sem dado sensível)          | Incluir esses dados em `SugestoesAlocacao` ou confirmar a dupla permissão |
| 4   | **`SUPERVISOR_INDISPONIVEL`**: a tela mostra o `detail` e avisa que a senha ficou aguardando recurso e que a gestão foi notificada                | Não simulado                                                                    | Garantir que `detail` diga a causa e o próximo passo                      |

## Ausência e desistência (W-15 e W-16, #47)

O front pode ser usado em `/ausencias` com a API simulada do projeto (MSW). A parte 8.3
permanece em andamento até integrar as dependências reais e concluir a revisão.

### Como testar agora

Execute `corepack pnpm --filter web dev`, entre com `admin@clinica.edu.br` e
`senha-dev` e abra `http://localhost:3000/ausencias`. A simulação é ativada pela
configuração já existente (`NEXT_PUBLIC_API_MOCK`); não exige banco nem API NestJS.
O aviso de demonstração aparece somente quando os dados são simulados.

- F013: ausência manual com confirmação antecipada e observação opcional.
- F014: ausência que devolve restrição temporária e sua descrição (RN-13).
- F015: desistência enquanto aguardando, origem paciente/equipe e motivo opcional.
- F016: desistência em atendimento, com liberação de recursos.
- F017: expira em 30 segundos; o polling da simulação entrega ausência automática sem modal.
- F018: ausência que devolve exigência de confirmação prévia (RN-13).
- Use **Reiniciar demonstração** para repor os cenários fictícios.

Os tempos e as restrições em `mocks/ausencias.ts` são fixtures de demonstração.
Não representam os parâmetros da unidade nem executam regras no servidor real.

### Integração restante

- **#24/#25:** os mesmos componentes já fazem requisições HTTP aos endpoints existentes:
  `POST /senhas/{id}/ausencia` e `POST /senhas/{id}/desistencia`, com versão e corpos do
  OpenAPI. Com `NEXT_PUBLIC_API_MOCK=false`, não há fallback para sucesso simulado.
- A consulta usa `GET /filas?ativa=true&pagina=1&tamanho=100` e
  `GET /filas/{id}/senhas?pagina=...&tamanho=20`, em projeção resumida e sem dados clínicos.
  Exige `ausencia:consultar` e `fila:consultar`; escrita usa `ausencia:criar`.
  Desistência usa `ausencia:criar` (decidido no contrato da #11, `docs/04` §3).
  O seletor carrega até 100 filas; se a unidade ultrapassar isso, paginar também esse catálogo.
- **#41 (feito):** o painel de fila usa `AcoesAusenciaDesistencia` no painel lateral de
  "Detalhes", e a simulação das senhas passou para `mocks/filas.ts`, compartilhada pelas duas
  telas (os cenários F013 a F018 continuam iguais, na fila de Fisioterapia).
  As capturas e o checklist estão em [entregas/GH-47-validacao.md](entregas/GH-47-validacao.md).
- **RN-12, evento real:** ligar a fonte de registros automáticos do back à prop
  `assinarAusenciasAutomaticas` de `TelaAusencias` ou a `NotificacaoAusencia` do painel.
  O adaptador local em MSW é provisório. Não inferir ausência no componente pelo relógio:
  a política pode devolver a senha à fila. Transporte e payload real seguem dependentes de #24/#41.
- **RN-13:** exibir `restricaoAplicada.tipo`, `descricao` e `ate`, inclusive no evento
  automático. Sem limites ou prazos de política fixos no código de produção.
- **Divergência do OpenAPI:** a descrição da desistência também menciona CHAMADA e
  AGUARDANDO_RECURSO. A UI e o mock seguem UC-17, docs/03 §5 e #47: só AGUARDANDO e
  EM_ATENDIMENTO. O contrato não foi alterado.

### Verificações

`corepack pnpm --filter web test`, `lint`, `typecheck` e `build`.
Teste no navegador: `corepack pnpm --filter web exec playwright test ausencias.e2e.ts --workers=1`.
A suíte cobre os dois fluxos por HTTP, RN-12/RN-13, permissões, contraste com axe, foco,
retorno ao gatilho e dimensões do modal a 390 px. As capturas ficam em
`apps/web/test-results/ausencia-desktop.png` e `ausencia-celular.png` para anexar ao PR.

Ainda faltam integração real, CI e revisão antes de concluir a issue.

## Trilha de auditoria (W-18, #50)

A tela (`apps/web/src/components/auditoria/`, rota `/auditoria`) já consome a API pelo cliente
HTTP; hoje quem responde é a simulação MSW (`apps/web/src/mocks/auditoria.ts`). Para integrar:
rodar com `NEXT_PUBLIC_API_MOCK=false` contra a API e apagar os handlers de auditoria.

| Status | Provisório                                                                                     | Onde                              | Destrava             | Troca a fazer                                                                             |
| ------ | ---------------------------------------------------------------------------------------------- | --------------------------------- | -------------------- | ----------------------------------------------------------------------------------------- |
| ⏳     | `GET /auditoria`, `/auditoria/{id}` e `/auditoria/exportacao` sobre MSW, com eventos fictícios | `apps/web/src/mocks/auditoria.ts` | #29 (API, parte 9.4) | Conferir filtros, detalhe e exportação contra a API real; apagar os handlers de auditoria |
| 🔧     | `GET /usuarios` (filtro por usuário) sobre MSW                                                 | `apps/web/src/mocks/auditoria.ts` | #12 entregue         | Conferir contra a API real e mover o handler para junto da simulação de perfis, se houver |

### Lacunas do contrato da auditoria (decisão antes de integrar com a #29)

| #   | Lacuna                                                                                                                                                                                                     | O que o front faz hoje                                                                                                                     | Pedido ao back-end                                                                                         |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| 1   | **Exportação sem todos os filtros**: `GET /auditoria/exportacao` só aceita `de`, `ate` e `usuarioId`, mas a T-18 pede "exportar resultado filtrado" e a tela também filtra por operação, módulo e registro | Envia os mesmos filtros da tela (`operacao`, `modulo` e `entidadeId` incluídos)                                                            | Aceitar os seis filtros de `GET /auditoria` na exportação                                                  |
| 2   | **Valores de `modulo` não enumerados**: o parâmetro e o campo são texto livre                                                                                                                              | Oferece os módulos do catálogo de permissões (`docs/04` §3) e `auth` para entrada e saída (proposta); valor desconhecido aparece como veio | Enumerar `modulo` no contrato (ou expor a lista), incluindo o módulo de `LOGIN`/`LOGOUT`                   |
| 3   | **Registro afetado só por UUID**: `entidadeId` é `uuid`, mas o W-18 mostra o registro pelo identificador de negócio (ex.: senha F014)                                                                      | Valida UUID no campo e oferece "Filtrar por este registro" no detalhe do evento; a tabela mostra `entidade` e o início do UUID             | Avaliar um campo legível no evento (ex.: `registroRotulo`) e um filtro por ele                             |
| 4   | **Permissão do filtro por usuário**: `GET /usuarios` é da tag de perfis; quem tem só `auditoria:consultar` pode receber 403                                                                                | Se a lista falhar, o filtro fica só com "Todos" e um aviso; os demais filtros seguem                                                       | Liberar a listagem de usuários (só `id` e `nome`) para `auditoria:consultar`, ou incluir a lista no módulo |
| 5   | **Ordenação**: a T-18 pede "ordenação anunciada", e o contrato fixa a ordem cronológica decrescente                                                                                                        | Anuncia a ordem fixa (`aria-sort` e região `aria-live`), sem alternar                                                                      | Nenhuma, se a ordem fixa bastar; senão, incluir `ordenar`/`direcao`                                        |
| 6   | **Perfil no evento**: o contrato traz `perfilNoMomento` já na listagem, e a T-18 o põe só no detalhe                                                                                                       | Mostra o perfil abaixo do nome do usuário, como no W-18                                                                                    | Nenhuma                                                                                                    |

## Alertas de SLA (W-18, #49)

A tela (`apps/web/src/components/alertas/`, rota `/indicadores/alertas`) já consome a API pelo
cliente HTTP; hoje quem responde é a simulação MSW (`apps/web/src/mocks/alertas.ts`). Para
integrar: rodar com `NEXT_PUBLIC_API_MOCK=false` contra a API e apagar os handlers de alertas.

| Status | Provisório                                                                            | Onde                                                                 | Destrava                               | Troca a fazer                                                                                                                                                                                                                                  |
| ------ | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ⏳     | `GET /alertas`, `/reconhecimento` e `/escalonamento` sobre MSW, com alertas fictícios | `apps/web/src/mocks/alertas.ts`                                      | #28 (API, parte 9.3)                   | Conferir contra a API real; apagar os handlers                                                                                                                                                                                                 |
| ⏳     | Rota `/indicadores/alertas`, alcançada pelo cartão da home; não há item de menu       | `apps/web/src/app/(autenticado)/indicadores/alertas/`, `lib/home.ts` | Decisão (`tipo: decisão`) e #48 (W-17) | O W-18 junta alertas e auditoria, mas o supervisor tem `alertas:consultar` sem `auditoria:consultar`. Confirmar onde fica o acesso (aba em Indicadores, item próprio no menu ou junto da Auditoria) e, se for aba, a W-17 ligar para esta rota |

### Lacunas do contrato dos alertas (decisão antes de integrar com a #28)

| #   | Lacuna                                                                                                                                          | O que o front faz hoje                                                                                                                      | Pedido ao back-end                                                                |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 1   | **Medidas acionadas não vêm no alerta**: `Alerta` não lista os escalonamentos; a T-17 e a issue pedem que o alerta mostre quem acionou e quando | Lê `escalonamentos[]` do alerta (**proposta**, só a simulação devolve) e mostra o `Escalonamento` devolvido pelo `POST` no aviso de sucesso | Incluir `escalonamentos[]` em `Alerta` (ou um `GET /alertas/{id}/escalonamentos`) |
| 2   | **Sem nível de gravidade**: a T-17 pede gravidade em texto; o contrato só diz que a lista vem "ordenada por gravidade"                          | Mantém a ordem da API e descreve em texto quanto a espera passou do limite; não classifica no front (seria regra de negócio)                | Avaliar um campo `gravidade` com rótulo, ou confirmar que a descrição basta       |
| 3   | **"Entra no topo" × ordem por gravidade**: a issue diz que o alerta novo entra no topo; a T-17 ordena por gravidade                             | Segue a ordem da API; a simulação desempata pelo mais recente                                                                               | Definir o desempate na API (mais recente primeiro, sugerido)                      |
| 4   | **Histórico "do período" sem filtro de data**: `GET /alertas` não aceita `de`/`ate`                                                             | O histórico lista os normalizados, paginado, na ordem da API                                                                                | Acrescentar `de` e `ate` (ou definir o período padrão do histórico)               |
| 5   | **Respostas de erro** de `/reconhecimento` e `/escalonamento`: só o 403 está no contrato (reconhecer alerta já normalizado, `acao` inválida)    | Trata 403 com mensagem própria; outros erros com mensagem genérica                                                                          | Definir 409 para alerta normalizado e 422 para `acao` inválida                    |
| 6   | **Bloqueio sem limite**: alerta `FILA_BLOQUEADA` vem com `tempoEsperaMinutos` e `limiteMinutos` nulos                                           | Mostra a causa (RN-10) no lugar dos tempos                                                                                                  | Nenhuma, se for o comportamento esperado                                          |
