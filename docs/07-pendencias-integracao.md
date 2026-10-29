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

| Issue (back-end)                                | O que destrava no front                           | Seção                                                     |
| ----------------------------------------------- | ------------------------------------------------- | --------------------------------------------------------- |
| #10 (3.1, login, refresh e bloqueio)            | Login e sessão reais (hoje sobre a simulação MSW) | [Sessão e acesso](#sessão-e-acesso)                       |
| #11 (3.2, guard e catálogo de permissões)       | Permissões usadas em menu, home e telas           | [Sessão e acesso](#sessão-e-acesso)                       |
| #13 e #14 (4.1, API dos cadastros base)         | Lista e formulário de cadastros (W-03, W-04)      | [Cadastros](#cadastros-w-03-e-w-04-37-e-38)               |
| #29 (9.4, consulta e exportação da trilha)      | Trilha de auditoria (W-18)                        | [Auditoria](#trilha-de-auditoria-w-18-50)                 |
| #28 (9.3, alertas de SLA e escalonamento)       | Alertas de SLA (W-18)                             | [Alertas](#alertas-de-sla-w-18-49)                        |
| #17 a #19 (6.1 a 6.3, fila, chamada e bloqueio) | Painel de fila (W-08)                             | [Painel de fila](#painel-de-fila-w-08-41)                 |
| #21 (7.1, API de alocação)                      | Alocação de recursos (W-11)                       | [Alocação](#alocação-de-recursos-w-11-43)                 |
| #23 (7.2, ciclo do atendimento)                 | Atendimento e encerramento (W-12, W-13)           | [Atendimento](#atendimento-e-encerramento-w-12-e-w-13-44) |
| #26 (9.1, API de encaminhamento)                | Encaminhamento interno e externo (W-14)           | [Encaminhamento](#encaminhamento-w-14-46)                 |

## Sessão e acesso

| Status | Provisório                                                                                                                                                                                          | Onde                                                     | Destrava                                                                                           | Troca a fazer                                                                                                                              |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 🔧     | Login, refresh, logout e `/auth/me` sobre a simulação MSW, ligada por padrão no `pnpm dev` (`NEXT_PUBLIC_API_MOCK=false` desliga). Usuários simulados em `src/mocks/usuarios.ts`, senha `senha-dev` | `apps/web/src/mocks/`                                    | #10 (API, parte 3.1) entregue                                                                      | Rodar com `NEXT_PUBLIC_API_MOCK=false` contra a API e conferir os códigos de erro (lacunas abaixo); depois apagar os handlers de `/auth/*` |
| 🔧     | Testes Playwright entram pela sessão simulada (cookie `filas-mock-refresh`) e trocam permissões pelo cookie `filas-dev-permissoes`                                                                  | `apps/web/e2e/apoio.ts`, `apps/web/src/mocks/cookies.ts` | #10 e seed da parte 2.4 entregues (usuários `<perfil>@clinica.invalid`, senha `senha-dev`, README) | Entrar por login real com usuários de seed de cada perfil; apagar os dois cookies                                                          |
| ⏳     | Rota `/acesso` redireciona direto para `/acesso/perfis`                                                                                                                                             | `apps/web/src/app/(autenticado)/acesso/page.tsx`         | quando o módulo Acesso tiver outra tela                                                            | Trocar o redirect por uma página do módulo                                                                                                 |
| 🔧     | Guard e catálogo de permissões                                                                                                                                                                      | —                                                        | #11 (API, parte 3.2) entregue; catálogo em `@filas/contracts` (`CATALOGO_PERMISSOES`)              | Conferir que as permissões usadas em `lib/modulos.ts`, `lib/home.ts` e na tela de perfis existem no catálogo real                          |

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

| #   | Lacuna                                                                                                                                                                                                                                                   | O que o front faz hoje                                                                                                                                          | Pedido ao back-end                                                                                                                                                                                                 |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **Inativar** não existe no contrato: `PacienteEntrada` e as demais entradas não têm `ativo`, e não há endpoint próprio. A T-03 manda oferecer "inativar" quando a exclusão é recusada por vínculo, e a parte 4.1 prevê "inativação no lugar de exclusão" | Chama `PATCH /<entidade>/{id}` com `{ "ativo": false }` (`ativa` em especialidade). **Proposta**, só a simulação responde                                       | **Resolvida no contrato (#13):** `PATCH /<entidade>/{id}` com `{ ativo }` (`{ ativa }` em especialidade), como a simulação já faz                                                                                  |
| 2   | **Vínculo ativo não vem na listagem**: a T-03 diz que "Excluir" só é oferecido sem vínculo, mas os schemas não trazem esse dado                                                                                                                          | Oferece "Excluir" a quem tem `cadastros:excluir` e trata o `409 VINCULO_ATIVO` explicando o vínculo e oferecendo inativar                                       | **Decidido (#13):** sem campo na lista; a tela segue oferecendo "Excluir" e trata o `409 VINCULO_ATIVO`, cujo `detail` diz o vínculo e sugere inativar                                                             |
| 3   | **Filtros da T-03 sem parâmetro no contrato**: nível de formação (estudantes), disponibilidade (supervisores) e recurso (salas, `recursoId` existe)                                                                                                      | A tela só oferece os filtros que o contrato aceita                                                                                                              | **Resolvida no contrato (#14):** `nivelFormacao` em estudantes e `disponivel` em supervisores (ocupação depende da alocação, #7)                                                                                   |
| 4   | **Cadastros de apoio sem endpoint**: não há como listar habilitações, procedimentos e recursos, que alimentam as seleções múltiplas do formulário (Documento de Requisitos §5, Tabelas 2 a 5) e o filtro de recurso da lista                             | Usa `GET /habilitacoes`, `GET /procedimentos` e `GET /recursos` (resposta paginada de `ItemReferencia`). **Proposta**, só a simulação responde                  | **Resolvida no contrato (#13):** `GET /habilitacoes`, `/procedimentos` e `/recursos`, paginados, com `ItemReferencia`                                                                                              |
| 5   | **Ordenação**: `docs/04` §5 prevê `ordenar` e `direcao`, mas o `openapi.yaml` não lista esses parâmetros nos `GET` de cadastros                                                                                                                          | Envia `ordenar=nome` (`identificacao` em salas) e `direcao`                                                                                                     | **Resolvida no contrato (#13):** `ordenar` (campos por endpoint) e `direcao` nas cinco listagens; campo fora da lista dá 422                                                                                       |
| 6   | **Mensagem do `409 VINCULO_ATIVO`**: a tela exibe o `detail` como explicação do vínculo                                                                                                                                                                  | A simulação devolve o texto com causa e próximo passo                                                                                                           | **Resolvida no contrato (#13):** `docs/04` §4 exige que o `detail` diga o vínculo e sugira inativar                                                                                                                |
| 7   | **Aviso de impacto na edição**: o `PUT /estudantes/{id}` diz que devolve `avisos[]` "antes de aplicar", mas não há como confirmar depois do aviso; supervisor, sala e especialidade não têm o aviso                                                      | O formulário avisa antes de enviar quando um campo de impacto mudou e o registro está em uso (`ocupado`, `ocupacaoAtual > 0`, `ocupada`, `filasVinculadas > 0`) | **Decidido (#79):** opção A só para os campos que afetam alocações em curso (T-04). `PUT` sem `?confirmar=true` responde `409 IMPACTO_EM_USO` com o impacto; a tela mostra e reenvia. Aguarda PR de contrato e API |
| 8   | **Obrigatoriedade do estudante**: o W-04 marca habilitações, procedimentos e disponibilidade como obrigatórios; `EstudanteEntrada` exige só `nome`, `especialidadeId` e `nivelFormacao`                                                                  | Segue o wireframe (mais restrito que o servidor)                                                                                                                | **Resolvida no contrato (#14):** `EstudanteEntrada` exige habilitações, procedimentos e disponibilidade, como o W-04                                                                                               |
| 9   | **Situação da sala**: o contrato tem `situacao` como texto livre; a Tabela 4 (ID04) define Disponível, Em manutenção e Indisponível                                                                                                                      | O formulário oferece só os três valores                                                                                                                         | **Resolvida no contrato (#13):** `SituacaoSala` enum (`DISPONIVEL`, `EM_MANUTENCAO`, `INDISPONIVEL`)                                                                                                               |
| 10  | **Critério de duplicidade**: o contrato define o do paciente (documento, ou nome e nascimento, `docs/03` §3.2), mas não o de estudante e especialidade, que também verificam (T-04)                                                                      | A simulação compara o nome                                                                                                                                      | **Decidido (#81):** estudante por nome + especialidade e especialidade por nome, sem diferenciar maiúsculas, com `recursoExistenteId`. Matrícula (opção B) só se a coordenação pedir                               |

## Perfis (W-05, #36)

Integrada à API real na #133 (`apps/web/src/lib/perfis/api-http.ts`): catálogo (`GET /permissoes`),
listar, criar, editar e excluir. O aviso "muda as permissões de N usuários" usa o
`usuariosVinculados` real de cada perfil, que é o número antes de salvar. O aviso de perfil sem
consulta segue calculado na tela, porque a confirmação acontece antes de enviar; a API devolve o
mesmo aviso (`PERFIL_SEM_CONSULTA`) depois de gravar. Os erros `DUPLICIDADE`, `VINCULO_ATIVO` e
`PERFIL_SISTEMA` aparecem com a mensagem do servidor. Na simulação (MSW), que não tem perfis, a
página segue com `api-em-memoria.ts`, com os dados de `e2e/perfis.e2e.ts`.

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
outras issues criam: nenhuma no momento. `/chamada` redireciona para o painel de fila, onde fica
"Chamar próxima". `/encaminhamento` sem `?atendimento=` explica que o registro parte do encerramento.

No painel de fila (W-08, #41), "Abrir atendimento" (em atendimento, pausado ou pendente) e
"Iniciar atendimento" (chamada ou aguardando recurso) levam a `/atendimento?senha=<id>` (#44).
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

Integradas à API real na #52 (`apps/web/src/lib/triagem/api-http.ts`): busca de paciente,
especialidades ativas com fila (`?comFila=true`), `POST /triagens`, `POST /senhas` e a
reclassificação pelo mesmo cliente do painel de fila. O fluxo de ponta a ponta com API e banco
reais (`apps/web/e2e-real/`) percorre a tela. Na simulação (MSW), que não tem triagem nem senha, a
página segue usando `api-em-memoria.ts`, com os dados de `e2e/triagem.e2e.ts`.

### Pendências só do front (sem depender de API)

| Status | Provisório                                                          | Onde                                              | Troca a fazer                                                                                                                   |
| ------ | ------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 🔧     | Schema Zod da ficha é uma cópia local, com RN-02 e RN-03            | `apps/web/src/lib/triagem/schema.ts`              | Importar `TriagemEntrada` e `prioridadeEfetiva` de `@filas/contracts` e apagar a cópia; o servidor devolve a prioridade efetiva |
| ⏳     | "Imprimir senha" só chama `window.print()`, sem layout de impressão | `apps/web/src/components/triagem/etapa-senha.tsx` | Criar estilo de impressão com a senha em destaque (e decidir se há impressora térmica)                                          |
| 🔧     | A simulação não tem handlers de triagem e senha                     | `apps/web/src/lib/triagem/api-em-memoria.ts`      | Criar os handlers MSW, apontar `e2e/triagem.e2e.ts` para eles e apagar a API em memória                                         |

## Painel de fila (W-08, #41)

O painel (`apps/web/src/components/fila/`) consome a API pelo cliente HTTP; hoje quem responde é a
simulação única das filas (`apps/web/src/mocks/filas.ts`), que também atende a tela de Ausências.
Especialidades de teste: Fisioterapia (cenários da #47), Fonoaudiologia (bloqueada, RN-10),
Nutrição (RN-03, RN-04, SLA e todos os status) e Psicologia (vazia).

| Status | Provisório                                                                                                                                   | Onde                                            | Destrava                                    | Troca a fazer                                           |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------- | ------------------------------------------------------- |
| 🔧     | `GET /filas`, quadro, chamada com `Idempotency-Key`, rechamada, reclassificação e `GET /senhas/{id}` sobre MSW, com dados fictícios          | `apps/web/src/mocks/filas.ts`                   | #17 a #19 (API) e #16 (reclassificação)     | Conferir o painel contra a API real; apagar os handlers |
| ⏳     | O modal de reclassificação lê o mínimo da justificativa de `GET /parametros` (proposta, lacuna 1 da triagem)                                 | `apps/web/src/lib/fila/reclassificacao-http.ts` | decisão do back sobre parâmetros da unidade | Trocar pelo endpoint definido                           |
| ⏳     | Visão consolidada multiespecialidade e seletor de turno (T-09) não implementados: o contrato só tem o quadro por fila e não filtra por turno | `apps/web/src/components/fila/tela-fila.tsx`    | contrato (lacunas 4 e 5)                    | Implementar quando o contrato tiver os parâmetros       |

### Lacunas do contrato da fila (decisão antes de integrar com #17 a #19)

| #   | Lacuna                                                                                                                 | O que o front faz hoje                                                                                                    | Pedido ao back-end                                                                                         |
| --- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 1   | **`SenhaResumo` não traz a chamada vigente**: "Rechamar" usa `POST /chamadas/{id}/rechamada`, que pede o id da chamada | Lê `chamadaId` na senha (a simulação devolve) e só mostra "Rechamar" quando ele existe                                    | **Decidido (#18):** `SenhaResumo.chamadaId`, nula fora de CHAMADA                                          |
| 2   | **Sala `especialidade:{id}` do `/filas`**: mecanismo formalizado no contrato da #19                                    | Envia `especialidadeId` na query do handshake                                                                             | Contrato da #19: query `especialidadeId`, JWT em `auth.token`, permissão e unidade verificadas no servidor |
| 3   | **Confirmação de urgente (RN-03)**: `furouFilaPorUrgencia` só chega depois da chamada feita                            | Antes de chamar, verifica no quadro se a primeira aguardando é urgente e chegou depois de outra senha, e pede confirmação | **Decidido (#18):** a checagem no front basta; a resposta da chamada confirma com `furouFilaPorUrgencia`   |
| 4   | **Seletor de turno (T-09)**: `GET /filas/{id}/senhas` não filtra por turno                                             | Não oferece o seletor                                                                                                     | Acrescentar o parâmetro                                                                                    |
| 5   | **Visão consolidada (T-09, RNF-08)**: o quadro é por fila; não há quadro de várias especialidades                      | Mostra uma especialidade por vez e os bloqueios de todas na faixa de avisos                                               | Definir se a visão consolidada é um endpoint próprio                                                       |
| 6   | **"Aguardando recurso" no quadro**: a T-09 tem cinco colunas e nenhuma para `AGUARDANDO_RECURSO`                       | A senha aparece na coluna "Chamada", com a etiqueta do próprio status                                                     | Confirmar com a especificação de UI                                                                        |

## Alocação de recursos (W-11, #43)

A tela (`apps/web/src/components/alocacao/`) consome a API pelo cliente HTTP e não deduz regra:
quem está apto e o motivo de quem não está vêm prontos de `GET /senhas/{id}/alocacao/sugestoes`.
O back-end da #22 está implementado e validado localmente, aguardando merge. O relatório
[GH-22-aceite](entregas/GH-22-aceite.md) registra a projeção, os limites e as evidências.
Hoje quem responde é a simulação `apps/web/src/mocks/alocacao.ts`, sobre as senhas de
`mocks/filas.ts`: Fisioterapia exige supervisor e tem inaptos de cada tipo; "Ana Ribeiro" fica
indisponível na confirmação (409 `RECURSO_INDISPONIVEL`); Nutrição não exige supervisor; N106 não
tem sala compatível.

| Status | Provisório                                                                                                                      | Onde                                                  | Destrava                            | Troca a fazer                                                                                        |
| ------ | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------- |
| ⏳     | Sugestões, confirmação com `Idempotency-Key` e "Manter aguardando recurso" sobre MSW, com dados fictícios                       | `apps/web/src/mocks/alocacao.ts`                      | #21 (API, parte 7.1)                | Conferir a tela contra a API real; apagar os handlers                                                |
| ⏳     | Sugestão do sistema destacada e pré-escolhida em cada bloco (#45): a tela usa `sugestao` como vem, sem reordenar nem recalcular | `apps/web/src/components/alocacao/bloco-alocacao.tsx` | #22 (API, parte 7.5)                | Conferir com a API real que `sugestao` vem apta e fora de `alternativas`; a tela já tolera repetição |
| ⏳     | "Trocar recurso" de uma alocação já confirmada (`PUT /senhas/{id}/alocacao`, "Reavaliar alocação" da T-09) não tem tela         | —                                                     | decisão do time (não entrou na #44) | Definir onde a reavaliação acontece; ver também a lacuna 4 do atendimento                            |

### Lacunas do contrato da alocação (decisão antes de integrar com a #21)

| #   | Lacuna                                                                                                                                            | O que o front faz hoje                                                 | Pedido ao back-end                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1   | **Status depois da alocação**: o contrato não diz se a senha muda de status ao confirmar (nem se `AGUARDANDO_RECURSO` volta a `CHAMADA`)          | A simulação deixa a senha em `CHAMADA`, com `versao` nova              | Definir a transição (P-01)                                                    |
| 2   | **Sala ocupada**: representar ocupação por outro atendimento                                                                                      | A simulação usa `ATENDIMENTO_ATIVO`                                    | A #22 usa o mesmo código existente e texto em português, sem mudar o contrato |
| 3   | **Cabeçalho da tela**: número, especialidade e horário da chamada vêm de `GET /senhas/{id}`, que exige `senha:consultar` além de `alocacao:criar` | Usa `GET /senhas/{id}` (sem `incluirTriagem`, então sem dado sensível) | Incluir esses dados em `SugestoesAlocacao` ou confirmar a dupla permissão     |
| 4   | **`SUPERVISOR_INDISPONIVEL`**: a tela mostra o `detail` e avisa que a senha ficou aguardando recurso e que a gestão foi notificada                | Não simulado                                                           | Garantir que `detail` diga a causa e o próximo passo                          |

## Atendimento e encerramento (W-12 e W-13, #44)

A tela (`apps/web/src/components/atendimento/`, rota `/atendimento?senha=<id>`) consome a API pelo
cliente HTTP (`lib/atendimento/api.ts`), com os tipos de `@filas/contracts`; sem `?senha=`, a rota
lista os atendimentos (`GET /atendimentos`, filtro `?status=` usado pelo cartão da home). Hoje
quem responde é a simulação `apps/web/src/mocks/atendimentos.ts`, sobre as senhas de
`mocks/filas.ts`: F016 (Fisioterapia, exige validação) e N107 (Nutrição, não exige) em
atendimento, N108 pausado, N109 pendente de validação, N105 alocada pronta para iniciar e F018
alocada a uma sala em manutenção (409 `RECURSO_INDISPONIVEL`).

| Status | Provisório                                                                                       | Onde                                          | Destrava                 | Troca a fazer                                                                                        |
| ------ | ------------------------------------------------------------------------------------------------ | --------------------------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------- |
| 🔧     | Início, pausa, retomada, encerramento, validação, lista e detalhe sobre MSW, com dados fictícios | `apps/web/src/mocks/atendimentos.ts`          | #23 entregue             | Rodar com `NEXT_PUBLIC_API_MOCK=false` contra a API e conferir as lacunas abaixo; apagar os handlers |
| ⏳     | Mudança feita por outra pessoa só aparece ao recarregar ou no 409 `VERSAO_DESATUALIZADA`         | `components/atendimento/tela-atendimento.tsx` | Etapa 6 (Socket.IO, #19) | Em `senha.status_alterado` da senha aberta, invalidar `[atendimento, senhaId]`                       |

### Lacunas do contrato do atendimento (decisão antes de integrar com a #23)

| #   | Lacuna                                                                                                                                                                                                    | O que o front faz hoje                                                                                                                            | Pedido ao back-end                                                                                 |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 1   | **Da senha ao atendimento**: o painel de fila só conhece a senha, `GET /atendimentos` não filtra por senha e `SenhaResumo`/`SenhaDetalhe` não trazem o id do atendimento (um por senha, `senha_id` único) | Lista `GET /atendimentos?status=<status da senha>&tamanho=100` e escolhe pelo `senhaId`; envia também `senhaId` (**proposta**, a API real ignora) | Aceitar `senhaId` em `GET /atendimentos` ou incluir `atendimentoId` na senha                       |
| 2   | **Perfil Estudante sem `senha:consultar`** (seed): a tela lê `GET /senhas/{id}` para o número, o status e a `versao` antes do início                                                                      | Usa `GET /senhas/{id}`; com 403, mostra o estado de sem permissão                                                                                 | Incluir `senha:consultar` no perfil Estudante ou expor esses campos por um endpoint do atendimento |
| 3   | **Recursos alocados antes do início**: só vêm em `SenhaDetalhe` (`incluirTriagem`, exige `triagem:consultar_sensivel`)                                                                                    | Mostra os recursos e a triagem só depois de iniciar (vêm em `AtendimentoResumo`/`AtendimentoDetalhe`)                                             | Expor a alocação vigente sem a triagem (por exemplo `GET /senhas/{id}/alocacao`)                   |
| 4   | **Recurso indisponível na retomada**: a T-13 pede nova alocação, mas `PUT /senhas/{id}/alocacao` só vale antes do início (`CHAMADA`, `AGUARDANDO_RECURSO`)                                                | Mostra o `detail` e orienta avisar a recepção, sem link para a alocação                                                                           | Definir a realocação de atendimento pausado                                                        |
| 5   | **Motivo de pausa obrigatório pelo protocolo**: o modelo ainda não tem onde configurar (o `openapi.yaml` registra a pendência)                                                                            | Campo opcional com a orientação; trata o 422 mostrando a mensagem abaixo do campo                                                                 | Nenhuma até existir o parâmetro                                                                    |
| 6   | **Senha alocada aguardando início** na home do estudante (W-02): `GET /atendimentos` só lista atendimentos já iniciados                                                                                   | O bloco "Atendimento atual" da home segue vazio; o início parte do painel de fila                                                                 | Definir a fonte (por exemplo `GET /senhas?estudanteId=&status=CHAMADA` com alocação)               |

## Encaminhamento (W-14, #46)

A tela (`apps/web/src/components/encaminhamento/`, rota `/encaminhamento?atendimento=<id>`) abre
quando o encerramento devolve `exigeEncaminhamento` (#44); a variante sai do desfecho registrado.
Consome a API pelo cliente HTTP (`lib/encaminhamento/api.ts`); hoje quem responde é a simulação
`apps/web/src/mocks/encaminhamentos.ts`: o interno gera senha AGUARDANDO na fila de destino de
`mocks/filas.ts`, Fonoaudiologia aceita com o aviso `FILA_BLOQUEADA` (RN-10) e Psicologia é
inativada no envio (409 `ESPECIALIDADE_INATIVA`).

Contrato da #26 mergeado no PR #125; implementação HTTP validada localmente, aguardando
revisão/CI/merge. Decisões e evidências em [GH-26-aceite](entregas/GH-26-aceite.md).

| Status | Provisório                                                               | Onde                                     | Destrava                                              | Troca a fazer                                   |
| ------ | ------------------------------------------------------------------------ | ---------------------------------------- | ----------------------------------------------------- | ----------------------------------------------- |
| ⏳     | `POST /atendimentos/{id}/encaminhamentos` sobre MSW, com dados fictícios | `apps/web/src/mocks/encaminhamentos.ts`  | #26 (API, parte 9.1)                                  | Conferir contra a API real; apagar os handlers  |
| ⏳     | Tipos de entrada e de `Encaminhamento` copiados do `openapi.yaml`        | `apps/web/src/lib/encaminhamento/api.ts` | Schemas em `@filas/contracts` (PR de contrato da #26) | Importar de `@filas/contracts` e apagar a cópia |

### Lacunas do contrato do encaminhamento (decisão antes de integrar com a #26)

| #   | Lacuna                                                                                                     | O que o front faz hoje                                                                                                                   | Pedido ao back-end                                                                                                                        |
| --- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Destinos do interno**: `GET /especialidades` exige `cadastros:consultar`, que o perfil Estudante não tem | Lista as filas ativas (`GET /filas?ativa=true`, `fila:consultar`), uma por especialidade, que já trazem o bloqueio para o aviso de RN-10 | Confirmar as filas como fonte dos destinos ou liberar a listagem de especialidades ativas a quem tem `encaminhamento:criar`               |
| 2   | **Cabeçalho e desfecho da origem** só vêm de `GET /atendimentos/{id}`, sensível (grava CONSULTAR_SENSIVEL) | Usa o detalhe, com `atendimento:consultar_sensivel` (Estudante e Supervisão têm)                                                         | Expor `AtendimentoResumo` por id, ou o desfecho na resposta do encerramento basta (`exigeEncaminhamento` não diz se é interno ou externo) |
| 3   | **Encaminhamento repetido**                                                                                | Depois de registrar, a tela troca o formulário pela confirmação                                                                          | Responsável aprovou um por atendimento: 409 `DUPLICIDADE` para repetição, inclusive concorrente (#26)                                     |
| 4   | **Motivo do interno**                                                                                      | Campo opcional, como a T-14                                                                                                              | Ausente retorna texto vazio; sugestão URGENTE exige motivo clínico, conforme decisão aprovada da #26                                      |

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
- **Divergência do OpenAPI (resolvida no #97):** a descrição da desistência ficou só com
  AGUARDANDO e EM_ATENDIMENTO, como a UI já fazia.
- **RN-12, evento (definido no #24):** o servidor emite `ausencia.registrada` (com
  `automatica` e `restricaoAplicada`) e `senha.status_alterado`; o transporte é da #19.

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

| Status | Provisório                                                                                     | Onde                              | Destrava                                                       | Troca a fazer                                                                             |
| ------ | ---------------------------------------------------------------------------------------------- | --------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 🔧     | `GET /auditoria`, `/auditoria/{id}` e `/auditoria/exportacao` sobre MSW, com eventos fictícios | `apps/web/src/mocks/auditoria.ts` | #29 entregue (a exportação exige `de` e `ate`)                 | Conferir filtros, detalhe e exportação contra a API real; apagar os handlers de auditoria |
| 🔧     | `GET /usuarios` (filtro por usuário) sobre MSW                                                 | `apps/web/src/mocks/auditoria.ts` | #29: usar `GET /auditoria/usuarios` (só `auditoria:consultar`) | Conferir contra a API real e mover o handler para junto da simulação de perfis, se houver |

### Lacunas do contrato da auditoria (decisão antes de integrar com a #29)

| #   | Lacuna                                                                                                                                                                                                     | O que o front faz hoje                                                                                                                     | Pedido ao back-end                                                                                                                                               |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Exportação sem todos os filtros**: `GET /auditoria/exportacao` só aceita `de`, `ate` e `usuarioId`, mas a T-18 pede "exportar resultado filtrado" e a tela também filtra por operação, módulo e registro | Envia os mesmos filtros da tela (`operacao`, `modulo` e `entidadeId` incluídos)                                                            | **Resolvida no contrato (#29):** a exportação aceita os seis filtros; `de` e `ate` passam a ser obrigatórios, com no máximo 366 dias                             |
| 2   | **Valores de `modulo` não enumerados**: o parâmetro e o campo são texto livre                                                                                                                              | Oferece os módulos do catálogo de permissões (`docs/04` §3) e `auth` para entrada e saída (proposta); valor desconhecido aparece como veio | **Resolvida no contrato (#29):** `ModuloAuditoria` enum: módulos do catálogo e `auth` (LOGIN e LOGOUT), como a tela já oferece                                   |
| 3   | **Registro afetado só por UUID**: `entidadeId` é `uuid`, mas o W-18 mostra o registro pelo identificador de negócio (ex.: senha F014)                                                                      | Valida UUID no campo e oferece "Filtrar por este registro" no detalhe do evento; a tabela mostra `entidade` e o início do UUID             | **Decidido (#29):** sem rótulo legível nesta versão; o filtro continua por `entidadeId`                                                                          |
| 4   | **Permissão do filtro por usuário**: `GET /usuarios` é da tag de perfis; quem tem só `auditoria:consultar` pode receber 403                                                                                | Se a lista falhar, o filtro fica só com "Todos" e um aviso; os demais filtros seguem                                                       | **Resolvida no contrato (#29):** `GET /auditoria/usuarios` (só `id` e `nome`) com `auditoria:consultar`. Ao integrar, trocar o `GET /usuarios` do filtro por ele |
| 5   | **Ordenação**: a T-18 pede "ordenação anunciada", e o contrato fixa a ordem cronológica decrescente                                                                                                        | Anuncia a ordem fixa (`aria-sort` e região `aria-live`), sem alternar                                                                      | Nenhuma, se a ordem fixa bastar; senão, incluir `ordenar`/`direcao`                                                                                              |
| 6   | **Perfil no evento**: o contrato traz `perfilNoMomento` já na listagem, e a T-18 o põe só no detalhe                                                                                                       | Mostra o perfil abaixo do nome do usuário, como no W-18                                                                                    | Nenhuma                                                                                                                                                          |

## Alertas de SLA (W-18, #49)

A tela (`apps/web/src/components/alertas/`, rota `/indicadores/alertas`) já consome a API pelo
cliente HTTP; hoje quem responde é a simulação MSW (`apps/web/src/mocks/alertas.ts`). Para
integrar: rodar com `NEXT_PUBLIC_API_MOCK=false` contra a API e apagar os handlers de alertas.

| Status | Provisório                                                                            | Onde                                                                 | Destrava                               | Troca a fazer                                                                                                                                                                                                                                  |
| ------ | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ⏳     | `GET /alertas`, `/reconhecimento` e `/escalonamento` sobre MSW, com alertas fictícios | `apps/web/src/mocks/alertas.ts`                                      | #28 (API, parte 9.3)                   | Conferir contra a API real; apagar os handlers                                                                                                                                                                                                 |
| ⏳     | Rota `/indicadores/alertas`, alcançada pelo cartão da home; não há item de menu       | `apps/web/src/app/(autenticado)/indicadores/alertas/`, `lib/home.ts` | Decisão (`tipo: decisão`) e #48 (W-17) | O W-18 junta alertas e auditoria, mas o supervisor tem `alertas:consultar` sem `auditoria:consultar`. Confirmar onde fica o acesso (aba em Indicadores, item próprio no menu ou junto da Auditoria) e, se for aba, a W-17 ligar para esta rota |

### Contrato dos alertas e integração da #28

Contrato mergeado no PR #127 com CI aprovado. As propostas foram aprovadas pelo responsável
em 28/10/2026 e estão registradas em [GH-28-aceite](entregas/GH-28-aceite.md). A API passou
na validação local; aguardar o merge da implementação para integrar a tela.

| Ponto     | Contrato definido                                                                                                                     | Integração pendente                                                                    |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Medidas   | `Alerta.escalonamentos[]` obrigatório, com ação, nome do autor e horário                                                              | Adotar os schemas compartilhados no lugar do tipo local opcional e trocar MSW pela API |
| Gravidade | Descrição textual pelos tempos ou causa do bloqueio, sem categoria nova                                                               | Manter descrição, respeitando a ordem da API                                           |
| Ordenação | ATIVO, RECONHECIDO, NORMALIZADO; nos abertos, bloqueio, maior excesso e disparo mais recente; histórico por normalização mais recente | Remover qualquer ordenação própria que contrarie a API                                 |
| Período   | `de`/`ate` opcionais sobre o disparo, ISO-8601 com fuso; sem período, todo o histórico paginado                                       | Enviar os filtros quando houver período selecionado                                    |
| Ações     | NORMALIZADO retorna 409 TRANSICAO_INVALIDA; entrada inválida retorna 422; reconhecer novamente preserva primeiro autor/horário        | Atualizar o mock e tratar os erros conforme o contrato                                 |
| Bloqueio  | Tempos nulos, quantidade de aguardando no disparo e origem FILA_BLOQUEADA                                                             | Manter a causa RN-10 no lugar dos tempos                                               |

A T-17 pede espera atual, mas a Tabela 20 do PDF principal define valores do disparo.
O contrato preserva esse retrato; a integração deve identificá-los como verificados no
momento do disparo, seguindo a precedência do PDF. A tela ainda usa polling HTTP; o canal
`/alertas` já emite `sla.excedido` e `sla.normalizado` e deve invalidar a consulta na integração.

## Telão e consulta pública (W-09 / W-10, #42)

Front da etapa 6.5 implementado e validado com dados fictícios. Rotas em `apps/publico`:
`/telao`, `/consulta` e `/demonstracao` (esta última apenas no modo simulado).
A aplicação não importa `web` nem autenticação.

- **#19:** conectar namespace `/painel`, eventos `chamada.exibir` e `painel.estado`.
  O contrato da #19 formaliza a query `unidadeId` já usada no cliente; o servidor valida a
  unidade e efetua a entrada na sala `unidade:{id}` sem autenticação.
- **#20:** usar `GET /publico/painel/{unidadeId}` e `GET /publico/senhas/{numero}`.
  Back-end implementado e validado localmente conforme o contrato do PR #122; aguardando
  merge da implementação. Critérios e decisões em [GH-20-aceite](entregas/GH-20-aceite.md).
  O snapshot HTTP não declara `sequencia`; o front aceita sua ausência e preserva a sequência
  de evento já conhecida para a mesma chamada. Confirmar a compatibilidade na integração.
- Configuração real em `apps/publico/.env.local`: simulação desligada, URLs HTTP/Socket.IO,
  UUID e nome da unidade. A API e o socket públicos não recebem cookies ou token de sessão.
- A projeção do telão tem apenas número, especialidade, local e sequência. A projeção da
  consulta é independente. Propriedades extras e o texto livre de orientação não são propagados.
  O back ainda deve assegurar a projeção pública **antes** de enviar dados pela rede (ADR-003).
- Consultas e recuperação HTTP do telão a cada 30 segundos. Queda de conexão preserva a chamada;
  a consulta preserva o último resultado com aviso de desatualização em falhas de atualização.
- O simulador é local, isolado em `apps/publico/src/mocks`, com eventos entre abas. Substitui
  apenas as dependências indisponíveis; não cria endpoints de API nem regras de produção.
- Sinal sonoro fica na #51. Relatório e capturas em [entregas/GH-42-validacao.md](entregas/GH-42-validacao.md).

## Painel de indicadores (W-17 / T-16, #48)

O front usa o cliente autenticado existente e os schemas da API #27 já implementada.
Integração local validada em 27/10/2026 com PostgreSQL e API reais, sem MSW:
login/refresh, cartões, filtros, CSV e evento EXPORTAR confirmado na auditoria.
O modo MSW continua habilitado em desenvolvimento; `NEXT_PUBLIC_API_MOCK=false`
usa as rotas reais de resumo, volume e exportação.

- Volume aceita período/turno, sem especialidade; a tela seleciona a especialidade na
  série agregada retornada, reutilizada pelo gráfico e pela tabela.
- Especialidades do seletor vêm do volume do período, sem acrescentar permissão de cadastros.
- Exportação recebe filtros aplicados e formato CSV. Auditoria é feita pela API, sem chamada extra do front.
- O schema/API de exportação aceita turno, mas o OpenAPI ainda não o lista; alinhar
  documentação em PR próprio de contrato. Nenhum contrato alterado nesta entrega.
- A simulação continua opcional. Para a API real, use `apps/web/.env.example`
  com `NEXT_PUBLIC_API_MOCK=false`. O cenário local persistido no banco é fictício
  e está descrito no relatório; não contém dados de pacientes reais.

Relatório e evidências: [GH-48](entregas/GH-48-validacao.md).
