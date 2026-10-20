# AGENTS.md

Instruções para quem trabalha neste repositório, pessoa ou assistente de IA. Vale para o projeto todo (arquivo único, por orientação do professor). Em caso de dúvida, os documentos citados aqui prevalecem sobre este resumo.

## 1. O projeto
Sistema de Gestão de Filas para Atendimento em Clínicas-Escola: triagem, emissão e ordenação de senha, chamada, alocação de estudante/supervisor/sala, atendimento, encaminhamento, ausências e desistências, indicadores, alertas de SLA e trilha de auditoria. Monorepo com três aplicações e pacotes compartilhados.

## 2. Leia antes de mexer
| Ordem | Documento | Para quê |
|---|---|---|
| 1 | `especificacao/Documento de Requisitos de Sistema.pdf` | Fonte de verdade: regras, casos de uso, dados, arquitetura geral. Se algo em `docs/` divergir dele, prevalece o PDF |
| 2 | `README.md` | Visão geral, stack, portas e comandos |
| 3 | `docs/06-etapas.md` | Etapa e parte da sua tarefa, responsável, critério de pronto |
| 4 | `docs/05-fluxo-github.md` §2 a §4 | Branch, commit, PR e Definition of Done |
| 5 | `docs/.ref/` | RN, RF e UC por módulo (`MODULOS/`) e índices por camada (`SPECS/backend`, `SPECS/frontend`, `SPECS/database`) |

Por frente:
- **Back-end:** `docs/01-arquitetura.md` §3 e §4, `docs/03-modelo-de-dados.md`, `docs/04-contrato-api.md`, `docs/api/openapi.yaml`, ADR-003, `docs/.ref/SPECS/backend/` e `docs/.ref/SPECS/database/`.
- **Front-end:** ADR-002, ADR-003, `docs/04-contrato-api.md`, Apêndice A do PDF, `especificacao/wireframes_ui_v2.pdf`, `especificacao/especificacao_ui.pdf`, `docs/.ref/SPECS/frontend/`.

Ordem quando documentos divergem: PDF de requisitos → `docs/0x` e ADRs → `docs/.ref/`. Divergência de regra de negócio que esses documentos não resolvem não é decidida no código: abre-se issue com a label `tipo: decisão`.

## 3. Estrutura
```
apps/api/            NestJS 11 — regras de negócio, Prisma, Socket.IO (porta 3333, base /api/v1)
apps/web/            Next.js 15 — aplicação operacional autenticada (porta 3000)
apps/publico/        Next.js 15 — telão e consulta de senha, sem autenticação (porta 3001)
packages/contracts/  schemas Zod compartilhados entre API e telas
packages/ui/         design system acessível (Tailwind + Radix)
packages/eslint-config/, packages/tsconfig/
docs/                arquitetura, dados, contrato, fluxo, etapas, ADRs, docs/.ref/
especificacao/       documentos originais (somente leitura)
```
Stack completa e versões: `docs/01-arquitetura.md` §2 (ADR-001). Versões ficam fixadas no `package.json` e só sobem em issue própria.

## 4. Como rodar
```bash
cp .env.example .env
docker compose up -d                      # PostgreSQL 16 (db) e Adminer (localhost:8080)
pnpm install
pnpm --filter api prisma migrate dev
pnpm dev                                  # api, web e publico
pnpm lint && pnpm typecheck && pnpm test
```
Banco de desenvolvimento `filas_dev`; testes de integração usam `filas_test` (criado pelo script de init do compose), nunca `filas_dev`.

## 5. Regras de código
1. **Regra de negócio só no service** (`docs/01` §3). Nenhuma RN no controller nem no componente React. Toda RN tem teste de unidade que cita o identificador no nome do caso (ex.: `RN-04`).
2. **Módulo NestJS:** `controller` (HTTP), `service` (regra), `repository` (Prisma, sem regra), `dto/` (Zod), `events/`.
3. **Permissão** é a string `modulo:operacao`, exigida com `@Requer('fila:chamar')`; decide-se pela lista de permissões, **nunca pelo nome do perfil** (`docs/04` §3). Sem permissão: 403 neutro, inclusive para recurso inexistente.
4. **Ação sem permissão não é renderizada**, nunca desabilitada (`docs/01` §4.1).
5. **Dado sensível fora de listas** (ADR-003): `SenhaPublica`, `SenhaResumo` e `SenhaDetalhe` são tipos distintos; motivo, justificativa clínica, observações e nome completo nunca saem em listagem; nome abreviado no servidor; `SenhaDetalhe` grava `CONSULTAR_SENSIVEL` antes de responder.
6. **Auditoria implícita:** interceptador global grava toda escrita e leitura sensível em `audit_log`, que é append-only por grant do banco (`docs/01` §4.2).
7. **Concorrência:** "Chamar próxima" em transação com `SKIP LOCKED`; mudança de estado de senha e atendimento com `versao` (409 `VERSAO_DESATUALIZADA`); `Idempotency-Key` em chamada e alocação (`docs/04` §6).
8. **Parâmetros da unidade nunca são constantes no código** (`parametro_unidade`, `docs/01` §4.7).
9. **Paginação obrigatória** em toda listagem (20 padrão, teto 100); erros em RFC 7807 com `codigo` estável (`docs/04` §4 e §5).
10. **Nenhum dado real de paciente** em ambiente local ou de homologação.
11. Comentários só quando necessários para entender o código.

## 6. Contrato primeiro
`docs/api/openapi.yaml` e `packages/contracts` mudam em **PR próprio, sem implementação junto**, aprovado pelo tech lead e pelo back-end dono do módulo, e mergeado antes da implementação dos dois lados (`docs/04-contrato-api.md`, `docs/05` §4). O front trabalha sobre mock gerado do contrato.

## 7. Fluxo no GitHub
Resumo de `docs/05-fluxo-github.md`:
- Branch: `tipo/GH-<issue>-descricao-curta` (`feat`, `fix`, `docs`, `chore`, `refactor`, `test`). Uma branch por issue; sem issue, sem branch.
- Commit: Conventional Commits, `<tipo>(<escopo>): <resumo no imperativo, minúsculo, sem ponto final>`, escopos `api`, `web`, `publico`, `contracts`, `ui`, `db`, `ci`, `docs`; rodapé `Refs #<issue>`. O corpo explica **por quê**.
- PR: até ~400 linhas, `Closes #N`, rascunho enquanto em andamento, captura de tela em mudança de UI, uma aprovação (pares em `docs/02` §3), squash merge.
- Quem conclui uma parte atualiza `docs/06-etapas.md` (⬜ → ✅) no mesmo PR.
- Definition of Done: `docs/05` §4.

## 8. Docker
Orientação do professor: o projeto é construído e executado com Docker. Hoje o compose sobe o banco e o Adminer; colocar as aplicações em contêiner está registrado como pendência em `docs/.ref/SPECS/implantacao.md`.

## 9. Regras para assistentes de IA
- **Operações de git (`add`, `commit`, `push`) ficam com o integrante.** A IA prepara as mudanças e sugere a mensagem de commit no padrão da §7, mas não as executa.
- Não alterar `especificacao/` (documentos originais).
- Não inventar requisito. Texto de RN, RF, RNF e UC é copiado do documento do grupo; proposta própria vai marcada como proposta.
- Não mudar contrato e implementação no mesmo PR (§6).
- Seguir os padrões de código já existentes no módulo antes de criar um novo.
