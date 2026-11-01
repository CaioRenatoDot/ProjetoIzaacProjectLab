# Spec: Implantação e Docker

> **Neste repositório:** o ambiente local já existe: [`docker-compose.yml`](../../../docker-compose.yml) (PostgreSQL 16 e Adminer), `.env.example` e `docker/postgres/init/01-criar-banco-testes.sql`, entregues na Etapa 0 de [`docs/06-etapas.md`](../../06-etapas.md). Os ambientes estão em [`docs/01-arquitetura.md`](../../01-arquitetura.md) §6. Este arquivo registra a restrição do professor e o que ainda falta para atendê-la.

## Restrição de projeto: Docker
**O projeto deve ser construído e executado com Docker (orientação do professor).**

Fonte: feedback do professor, repassado pelo grupo. É **restrição de projeto**, e não requisito não funcional novo (a lista RNF-01 a RNF-09 do Documento de Requisitos de Sistema §4 não muda).

## O que existe hoje
| Serviço (`docker-compose.yml`) | Imagem | Porta no host | Papel |
|---|---|---|---|
| `db` (`filas-db`) | `postgres:16-alpine` | `${POSTGRES_PORT:-5432}` | Banco `filas_dev`; o script de init cria `filas_test` para os testes de integração |
| `adminer` (`filas-adminer`) | `adminer:4.8.1` | `${ADMINER_PORT:-8080}` | Administração do banco (servidor `db`, usuário `filas`) |

As aplicações (`api` na 3333, `web` na 3000, `publico` na 3001) rodam no Node da máquina com `pnpm dev` (README da raiz).

```bash
cp .env.example .env
docker compose up -d
docker compose ps        # "db" deve aparecer como healthy
```

## Ambientes
Fonte: `docs/01-arquitetura.md` §6.

| Ambiente | Onde | Banco | Observação |
|---|---|---|---|
| Local | Docker Compose | `filas_dev` com seed | Seed cria perfis, 5 especialidades, salas, supervisores e pacientes fictícios |
| Homologação | Container único | `filas_hml` | Dados fictícios; usado na validação com a clínica |
| Produção | A definir com a instituição | `filas_prd` | Requer TLS, backup diário e política de retenção (RNF-07, RNF-09) |

Nenhum dado real de paciente entra em ambiente local ou de homologação.

## Saúde e reinício (RNF-04)
`GET /api/v1/health` (vivacidade, sem tocar o banco) e `GET /api/v1/health/ready` (banco e migrações aplicadas), com `X-Request-Id` em toda resposta (`docs/04-contrato-api.md` §9). `docs/01-arquitetura.md` §5 prevê "restart automático em container".

## Pendências para atender a restrição
> Proposta (não consta nos documentos do time): itens para o grupo decidir e encaixar em `docs/06-etapas.md`.

- **Aplicações em contêiner.** Hoje só o banco roda em Docker. Para o projeto ser "executado com Docker", faltam `Dockerfile` de `apps/api`, `apps/web` e `apps/publico` e os serviços correspondentes no compose (com `healthcheck` ligado a `/health/ready` e `restart: unless-stopped`). Sugestão: parte da Etapa 10 (Qualidade e entrega) ou uma parte nova da Etapa 1.
- **Imagem de homologação.** "Container único" (`docs/01` §6) não diz como as três aplicações são empacotadas numa imagem só.
- **Backup diário do PostgreSQL** (RNF-09, RPO 24 h, RTO 4 h no runbook, `docs/01` §5): sem rotina definida ainda.
