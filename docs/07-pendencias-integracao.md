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

| Issue (back-end)                              | O que destrava no front                            | Seção                                                   |
| --------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------- |
| #10 (3.1, login, refresh e bloqueio)          | Login e sessão reais (hoje sobre a simulação MSW)  | [Sessão e acesso](#sessão-e-acesso)                     |
| #11 (3.2, guard e catálogo de permissões)     | Permissões usadas em menu, home e telas            | [Sessão e acesso](#sessão-e-acesso)                     |
| #12 (3.6, API de perfis)                      | Tela de perfis (W-05)                              | [Perfis](#perfis-w-05-36)                               |
| #38 (4.3, cadastro de pacientes)              | Link "Cadastrar novo paciente" da triagem          | [Triagem e senha](#triagem-e-senha-w-06-e-w-07-39-e-40) |
| #15 (5.1, API de triagem)                     | Ficha de triagem (W-06)                            | [Triagem e senha](#triagem-e-senha-w-06-e-w-07-39-e-40) |
| #16 (5.2, emissão e reclassificação de senha) | Emissão da senha e modal de reclassificação (W-07) | [Triagem e senha](#triagem-e-senha-w-06-e-w-07-39-e-40) |

## Sessão e acesso

| Status | Provisório                                                                                                                                                                                          | Onde                                                     | Destrava                                | Troca a fazer                                                                                                                              |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| ⏳     | Login, refresh, logout e `/auth/me` sobre a simulação MSW, ligada por padrão no `pnpm dev` (`NEXT_PUBLIC_API_MOCK=false` desliga). Usuários simulados em `src/mocks/usuarios.ts`, senha `senha-dev` | `apps/web/src/mocks/`                                    | #10 (API, parte 3.1)                    | Rodar com `NEXT_PUBLIC_API_MOCK=false` contra a API e conferir os códigos de erro (lacunas abaixo); depois apagar os handlers de `/auth/*` |
| ⏳     | Testes Playwright entram pela sessão simulada (cookie `filas-mock-refresh`) e trocam permissões pelo cookie `filas-dev-permissoes`                                                                  | `apps/web/e2e/apoio.ts`, `apps/web/src/mocks/cookies.ts` | #10 e seed (parte 2.4)                  | Entrar por login real com usuários de seed de cada perfil; apagar os dois cookies                                                          |
| ⏳     | Rota `/acesso` redireciona direto para `/acesso/perfis`                                                                                                                                             | `apps/web/src/app/(autenticado)/acesso/page.tsx`         | quando o módulo Acesso tiver outra tela | Trocar o redirect por uma página do módulo                                                                                                 |
| ⏳     | Guard e catálogo de permissões                                                                                                                                                                      | —                                                        | #11 (API, parte 3.2)                    | Conferir que as permissões usadas em `lib/modulos.ts`, `lib/home.ts` e na tela de perfis existem no catálogo real                          |

### Lacunas do contrato de `/auth/*` (decisão antes de integrar com a #10)

| #   | Lacuna                                                                                                                                                                       | O que o front faz hoje                                                                                                                       | Pedido ao back-end                                                                                                                            |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Tempo restante do bloqueio** só existe no texto de `detail` (exemplo `bloqueado` do `openapi.yaml`)                                                                        | Exibe o `detail` de `BLOQUEIO_TEMPORARIO` como veio                                                                                          | Garantir o tempo no `detail`, ou acrescentar um campo (por exemplo `minutosRestantes`) em PR de contrato                                      |
| 2   | **Conta sem perfil (403 no login)** não tem `codigo` definido                                                                                                                | Decide pelo status 403 e usa texto próprio; a simulação devolve `SEM_PERFIL`                                                                 | Definir o `codigo` no contrato                                                                                                                |
| 3   | **Credencial inválida**: o front mostra um texto fixo para todo 401 que não seja `BLOQUEIO_TEMPORARIO`, para que nenhuma variação do servidor revele qual campo errou (T-01) | Texto em `apps/web/src/lib/sessao/login.ts`                                                                                                  | Nenhuma mudança; só aviso                                                                                                                     |
| 4   | **Cookie de refresh entre portas**: o front (3000) chama a API (3333) com `credentials: 'include'`                                                                           | A simulação guarda o refresh num cookie comum                                                                                                | A API precisa de CORS com `credentials: true` e origem do `apps/web`; com `SameSite=Strict`, web e API têm de ficar no mesmo site em produção |
| 5   | **"Manter conectado"**: o contrato tem `manterConectado`, mas não diz o efeito (cookie persistente ou de sessão)                                                             | Envia o valor; em terminal compartilhado o campo fica desabilitado por `NEXT_PUBLIC_TERMINAL_COMPARTILHADO=true` (**proposta**, a confirmar) | Definir o efeito no contrato e confirmar se "terminal compartilhado" é configuração por instalação                                            |

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

| #   | Lacuna                                                                                                                                                                                               | O que o front faz hoje                                                            | Pedido ao back-end                                                                                                                  |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Mínimo da justificativa da unidade** (`justificativaMinCaracteres`) não tem endpoint. O `PATCH /senhas/{id}/prioridade` o valida no servidor, mas o modal precisa do número para orientar a pessoa | `TriagemApi.parametros()` devolve 20 (valor provisório do `openapi.yaml`)         | Expor o parâmetro, por exemplo em `GET /auth/me` ou em um `GET /parametros`. AGENTS.md §5.8 proíbe constante no código              |
| 2   | **`TriagemDetalhe` não traz `especialidadeId`**; a tela de emissão usa o id para saber a especialidade e a fila                                                                                      | O mock devolve `especialidadeId`                                                  | Incluir `especialidadeId` na resposta de `POST /triagens` (ou o front passa a depender só do nome)                                  |
| 3   | **`POST /senhas` e `SEM_FILA_CONFIGURADA`:** a tela exibe a mensagem do servidor como causa e próximo passo ("peça à administração para configurar a fila")                                          | O mock devolve o texto completo                                                   | Garantir que `detail` do 409 traga a causa **e** o próximo passo (T-07), ou combinar que o texto fica no front a partir de `codigo` |
| 4   | **Código do aviso de fila bloqueada (RN-10)** em `SenhaEmitida.avisos[]` não está definido                                                                                                           | A tela mostra qualquer `avisos[].mensagem` num banner, sem olhar o `codigo`       | Definir o `codigo` (o mock usa `FILA_BLOQUEADA`) e garantir `mensagem` legível                                                      |
| 5   | **Resposta do `PATCH /senhas/{id}/prioridade`** devolve `{ senha, novaPosicao }`, mas o front lê `prioridade`/`versao` no nível de cima                                                              | O mock devolve `{ prioridade, novaPosicao, versao }`                              | Ao integrar, o cliente HTTP mapeia `senha.prioridade` e `senha.versao`; nenhuma mudança de contrato, só aviso                       |
| 6   | **Aviso de reincidência (RN-13):** a spec do módulo diz que vem como aviso na busca do paciente, mas `Paciente` só tem `restricaoAtiva` e `restricaoAte`, sem texto de política                      | A tela monta o banner com `restricaoAte` e a frase "A triagem continua permitida" | Confirmar se `restricaoAtiva`/`restricaoAte` bastam ou se a busca passa a devolver `avisos[]` com a política                        |
| 7   | **Busca de paciente devolve `nomeCompleto`**; a issue #39 pede resultado resumido (nome abreviado, P-03)                                                                                             | A tela só exibe `iniciais` e documento mascarado                                  | Avaliar uma projeção de resumo para a busca (sem nome completo e documento inteiro), como em `SenhaResumo`                          |
| 8   | **Especialidades "ativas com fila"**: o contrato só filtra por `ativa`                                                                                                                               | A tela filtra `filasVinculadas > 0` no cliente                                    | Aceitar um filtro `comFila=true` ou garantir `filasVinculadas` confiável                                                            |
| 9   | **Erro 422 de validação** devolve `campos[]`; a ficha valida localmente com o mesmo critério                                                                                                         | A tela só usa a validação local                                                   | Manter `campos[].campo` igual aos nomes de `TriagemEntrada`, para o front mapear o erro do servidor ao campo                        |

### Pendências só do front (sem depender de API)

| Status | Provisório                                                                                     | Onde                                                      | Troca a fazer                                                                                                                                                      |
| ------ | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ⏳     | Schema Zod da ficha é uma cópia local, com RN-02 e RN-03                                       | `apps/web/src/lib/triagem/schema.ts`                      | Quando a #15 criar o schema oficial em `packages/contracts`, importar de lá e apagar a cópia (e `prioridadeEfetiva`, se o servidor passar a devolver a prioridade) |
| ⏳     | "Imprimir senha" só chama `window.print()`, sem layout de impressão                            | `apps/web/src/components/triagem/etapa-senha.tsx`         | Criar estilo de impressão com a senha em destaque (e decidir se há impressora térmica)                                                                             |
| ⏳     | Link "Cadastrar novo paciente" aponta para `/cadastros/pacientes/novo`, rota ainda inexistente | `apps/web/src/components/triagem/etapa-busca.tsx`         | Alinhar o caminho com a tela W-04 (4.3, Caio Gabriel) e voltar à triagem depois de cadastrar                                                                       |
| ⏳     | Posição estimada na fila é fixa no mock                                                        | `apps/web/src/lib/triagem/api-em-memoria.ts`              | Usar `posicaoEstimada` real da API                                                                                                                                 |
| ⏳     | Modal de reclassificação ainda não é aberto pelo painel de fila                                | `apps/web/src/components/senha/modal-reclassificacao.tsx` | Parte 6.4 (#41): abrir a partir de "Detalhes" da senha, só se `podeReclassificar(status)` (`lib/triagem/reclassificacao.ts`)                                       |
| ⏳     | Testes Playwright rodam contra os dados em memória                                             | `apps/web/e2e/triagem.e2e.ts`                             | Com API real, rodar contra o banco de teste com seed (paciente com restrição, especialidade sem fila, especialidade bloqueada)                                     |
