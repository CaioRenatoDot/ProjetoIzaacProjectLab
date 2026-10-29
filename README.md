# Sistema de Gestão de Filas para Atendimento em Clínicas-Escola

Sistema de gestão do ciclo completo de atendimento em clínicas-escola: triagem do paciente,
emissão e ordenação de senha, chamada, alocação de estudante/supervisor/sala, condução do
atendimento, encaminhamento, registro de ausências e desistências, indicadores, alertas de SLA
e trilha de auditoria.

## Andamento

| #   | Etapa                          | Status |
| --- | ------------------------------ | ------ |
| 0   | Ambiente local com Docker      | ✅     |
| 1   | Bootstrap do monorepo          | ⬜     |
| 2   | Banco de dados e seed          | ⬜     |
| 3   | Acesso, permissões e auditoria | ⬜     |
| 4   | Cadastros base                 | ⬜     |
| 5   | Triagem e emissão de senha     | ⬜     |
| 6   | Fila, chamada e telão          | ⬜     |
| 7   | Alocação e atendimento         | ⬜     |
| 8   | Ausências e desistências       | ⬜     |
| 9   | Funcionalidades extras ⭐      | ⬜     |
| 10  | Qualidade e entrega            | ⬜     |

Partes, responsáveis e critérios de pronto em **[docs/06-etapas.md](docs/06-etapas.md)**.

## Documentação do projeto

| Documento                                                                    | Conteúdo                                                                               |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| [docs/01-arquitetura.md](docs/01-arquitetura.md)                             | Stack escolhida, estrutura do monorepo, decisões transversais                          |
| [docs/02-divisao-responsabilidades.md](docs/02-divisao-responsabilidades.md) | Quem faz o quê, por módulo e por tela                                                  |
| [docs/03-modelo-de-dados.md](docs/03-modelo-de-dados.md)                     | Entidades, relacionamentos, enums e invariantes                                        |
| [docs/04-contrato-api.md](docs/04-contrato-api.md)                           | Convenções REST, autenticação, erros, eventos de tempo real                            |
| [docs/api/openapi.yaml](docs/api/openapi.yaml)                               | Contrato formal da API (OpenAPI 3.1)                                                   |
| [docs/05-fluxo-github.md](docs/05-fluxo-github.md)                           | Branches, commits, PRs, labels, milestones, Definition of Done                         |
| [docs/06-etapas.md](docs/06-etapas.md)                                       | Etapas do MVP: o que está feito, o que falta e quem faz                                |
| [docs/08-pendencias.md](docs/08-pendencias.md)                               | O que falta de back e de front, limitações conhecidas e decisões em aberto             |
| [docs/adr/](docs/adr/)                                                       | Registros de decisão de arquitetura                                                    |
| [especificacao/](especificacao/)                                             | Documentos originais entregues pelo cliente (requisitos, casos de uso, UI, wireframes) |

## Rastreabilidade

Todo artefato aponta para os identificadores da especificação original:

- **RN-01 a RN-13** — regras de negócio
- **RF-01 a RF-12** — requisitos funcionais
- **RNF-01 a RNF-09** — requisitos não funcionais
- **UC-01 a UC-20** — casos de uso
- **W-01 a W-18** — wireframes (versão 2)
- **T-01 a T-18** — telas da especificação de UI

Nenhuma issue entra no backlog sem pelo menos um identificador de rastreabilidade.

## Stack

| Camada                | Tecnologia                                                 |
| --------------------- | ---------------------------------------------------------- |
| Front-end operacional | Next.js 15 (App Router) + React 19 + TypeScript            |
| Front-end público     | Next.js 15 (aplicação separada, sem autenticação)          |
| Back-end              | NestJS 11 + TypeScript                                     |
| Banco de dados        | PostgreSQL 16                                              |
| ORM                   | Prisma                                                     |
| Tempo real            | Socket.IO                                                  |
| Monorepo              | pnpm workspaces + Turborepo                                |
| Testes                | Vitest (unidade), Supertest (integração), Playwright (E2E) |

Detalhes e justificativas em [docs/01-arquitetura.md](docs/01-arquitetura.md).

## Time

| Integrante                              | Frente                                            |
| --------------------------------------- | ------------------------------------------------- |
| Caio Renato dos Santos Claudino         | Front-end — núcleo operacional + tech lead        |
| Caio Gabriel Pereira de Menezes Correia | Front-end — acesso, cadastros e triagem           |
| Thalita Pereira de Andrade              | Front-end — públicos e gestão + QA                |
| Rildo Silva de Lima Junior              | Back-end — acesso, cadastros, triagem e registros |
| Nathan Rodrigues da Costa Silva         | Back-end — fila, atendimento e tempo real         |

Detalhamento em [docs/02-divisao-responsabilidades.md](docs/02-divisao-responsabilidades.md).

## Como rodar (após a issue de bootstrap)

Pré-requisitos: Docker Desktop (no Windows, com WSL2), Node 22 ou superior e pnpm 10.

```bash
cp .env.example .env          # no PowerShell: Copy-Item .env.example .env
docker compose up -d          # PostgreSQL e Adminer
pnpm install                  # instala dependências e os hooks do Husky
pnpm --filter api prisma migrate dev
pnpm dev                      # sobe api, web e publico
```

O banco tem dois usuários: o administrador (`filas`, dono das tabelas, usado pelas migrações via
`DIRECT_URL`) e o da aplicação (`filas_app`, usado pela API via `DATABASE_URL`), que não altera
nem apaga o `audit_log` (RNF-05). O `filas_app` é criado na primeira subida do volume; quem já
tinha o volume antes disso precisa recriá-lo uma vez, o que apaga os dados locais:

```bash
docker compose down -v && docker compose up -d
pnpm --filter api prisma migrate dev
```

Em desenvolvimento, o `apps/web` usa uma simulação da API (MSW, `apps/web/src/mocks/`) até o login
real (#10). Entre com `admin@clinica.edu.br` e a senha `senha-dev`. Para usar a API real, defina
`NEXT_PUBLIC_API_MOCK=false` em `apps/web/.env.local`.

Qualidade (o CI roda os mesmos comandos em todo PR):

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm contract:lint            # valida docs/api/openapi.yaml
pnpm format                   # formata com Prettier
```

Testes de ponta a ponta (Playwright, com verificação de acessibilidade pelo axe-core):

```bash
pnpm --filter web exec playwright install chromium   # uma vez, baixa o navegador
pnpm test:e2e                 # tudo: telas simuladas (web e publico) e o fluxo real
pnpm --filter web e2e         # telas do web sobre a simulação (MSW)
pnpm --filter publico e2e     # telão e consulta de senha
pnpm --filter web e2e:real    # fluxo da demonstração com API e banco reais
```

O fluxo real (`apps/web/e2e-real/`) percorre login → cadastro → triagem → senha → chamada no telão
→ alocação → atendimento encerrado, mais ausência e desistência. Ele precisa do banco no ar
(`docker compose up -d`) e das portas 3000, 3001 e 3333 livres (pare o `pnpm dev` antes), e
**recria o banco `filas_test`** a cada execução; o `filas_dev` não é tocado. A API roda com o
relógio deslocado para uma segunda às 14h (`relogio-deslocado.cjs`), porque a alocação depende do
dia e do turno.

Dados fictícios para desenvolver (idempotente: pode rodar de novo sem duplicar nem desfazer o que
foi editado pela tela):

```bash
pnpm --filter api prisma db seed
```

Usuários de teste (senha `senha-dev`, ou o valor de `SEED_SENHA_USUARIOS` no `.env`):

| Usuário                      | Perfil                                                    |
| ---------------------------- | --------------------------------------------------------- |
| `admin@clinica.invalid`      | Administrador (todas as permissões, perfil do sistema)    |
| `recepcao@clinica.invalid`   | Recepção                                                  |
| `triagem@clinica.invalid`    | Triagem                                                   |
| `estudante@clinica.invalid`  | Estudante                                                 |
| `supervisao@clinica.invalid` | Supervisão                                                |
| `gestao@clinica.invalid`     | Gestão                                                    |
| `inativo@clinica.invalid`    | Conta inativa (o login responde como credencial inválida) |

O seed cria também 5 especialidades, salas, estudantes, supervisores, cadastros de apoio e 24
pacientes fictícios (o segundo com restrição por reincidência). Cada especialidade tem uma fila ativa, com a letra da senha: Fisioterapia F, Psicologia P,
Nutrição N, Odontologia O e Fonoaudiologia A.

Testes de integração (banco real, só no `filas_test`; recriam o banco de teste do zero a cada
execução e exigem o `docker compose up -d`):

```bash
pnpm --filter api test:integracao
```

No CI, o job "Testes de integração da API (PostgreSQL)" roda a mesma suíte em todo PR, com um
PostgreSQL 16 próprio.

Os commits passam pelo Commitlint (Conventional Commits, escopos de `docs/05-fluxo-github.md` §3) e
pelo lint-staged, que aplica ESLint e Prettier só nos arquivos alterados.

| Aplicação                           | Porta                         |
| ----------------------------------- | ----------------------------- |
| API                                 | 3333                          |
| Web (operacional)                   | 3000                          |
| Público (telão + consulta de senha) | 3001 (`/telao` e `/consulta`) |
| Adminer                             | 8080                          |
