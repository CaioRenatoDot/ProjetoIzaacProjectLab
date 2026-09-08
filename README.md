# Sistema de Gestão de Filas para Atendimento em Clínicas-Escola

Sistema de gestão do ciclo completo de atendimento em clínicas-escola: triagem do paciente,
emissão e ordenação de senha, chamada, alocação de estudante/supervisor/sala, condução do
atendimento, encaminhamento, registro de ausências e desistências, indicadores, alertas de SLA
e trilha de auditoria.

## Documentação do projeto

| Documento | Conteúdo |
| --- | --- |
| [docs/01-arquitetura.md](docs/01-arquitetura.md) | Stack escolhida, estrutura do monorepo, decisões transversais |
| [docs/02-divisao-responsabilidades.md](docs/02-divisao-responsabilidades.md) | Quem faz o quê, por módulo e por tela |
| [docs/03-modelo-de-dados.md](docs/03-modelo-de-dados.md) | Entidades, relacionamentos, enums e invariantes |
| [docs/04-contrato-api.md](docs/04-contrato-api.md) | Convenções REST, autenticação, erros, eventos de tempo real |
| [docs/api/openapi.yaml](docs/api/openapi.yaml) | Contrato formal da API (OpenAPI 3.1) |
| [docs/05-fluxo-github.md](docs/05-fluxo-github.md) | Branches, commits, PRs, labels, milestones, Definition of Done |
| [docs/issues/](docs/issues/) | Backlog completo, uma issue por arquivo de milestone |
| [docs/adr/](docs/adr/) | Registros de decisão de arquitetura |
| [especificacao/](especificacao/) | Documentos originais entregues pelo cliente (requisitos, casos de uso, UI, wireframes) |

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

| Camada | Tecnologia |
| --- | --- |
| Front-end operacional | Next.js 15 (App Router) + React 19 + TypeScript |
| Front-end público | Next.js 15 (aplicação separada, sem autenticação) |
| Back-end | NestJS 11 + TypeScript |
| Banco de dados | PostgreSQL 16 |
| ORM | Prisma |
| Tempo real | Socket.IO |
| Monorepo | pnpm workspaces + Turborepo |
| Testes | Vitest (unidade), Supertest (integração), Playwright (E2E) |

Detalhes e justificativas em [docs/01-arquitetura.md](docs/01-arquitetura.md).

## Time

| Integrante | Frente |
| --- | --- |
| Caio Renato dos Santos Claudino | Front-end — núcleo operacional + tech lead |
| Caio Gabriel Pereira de Menezes Correia | Front-end — acesso, cadastros e triagem |
| Thalita Pereira de Andrade | Front-end — públicos e gestão + QA |
| Rildo Silva de Lima Junior | Back-end — acesso, cadastros, triagem e registros |
| Nathan Rodrigues da Costa Silva | Back-end — fila, atendimento e tempo real |

Detalhamento em [docs/02-divisao-responsabilidades.md](docs/02-divisao-responsabilidades.md).

## Como rodar (após a issue de bootstrap)

```bash
pnpm install
docker compose up -d          # PostgreSQL
pnpm --filter api prisma migrate dev
pnpm dev                      # sobe api, web e publico
```

| Aplicação | Porta |
| --- | --- |
| API | 3333 |
| Web (operacional) | 3000 |
| Público (telão + consulta de senha) | 3001 |
