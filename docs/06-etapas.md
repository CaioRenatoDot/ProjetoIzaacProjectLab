# Etapas do Projeto

Acompanhamento do MVP do Sistema de Gestão de Filas. Cada etapa está dividida em partes
numeradas, com responsável e critério de pronto. **Quem concluir uma parte atualiza este arquivo
no mesmo PR** (troque ⬜ por ✅).

**Legenda:** ✅ concluído · 🔄 em andamento · ⬜ a fazer · ⭐ plus (opcional, se sobrar tempo)

---

## Visão geral

| # | Etapa | Status | Responsáveis |
| --- | --- | --- | --- |
| 0 | Ambiente local com Docker | ✅ | Caio Gabriel |
| 1 | Bootstrap do monorepo | ⬜ | 1-A Caio Renato → 1-B Caio Gabriel (Rildo e Nathan revisam, Ratificando Caio Gabriel e Caio Renato) |
| 2 | Banco de dados e seed | ⬜ | Rildo, Nathan |
| 3 | Acesso, permissões e auditoria | ⬜ | Rildo (back), Caio Gabriel e Caio Renato (front) |
| 4 | Cadastros base | ⬜ | Rildo (back), Caio Gabriel (front) |
| 5 | Triagem e emissão de senha | ⬜ | Rildo (back), Caio Gabriel (front) |
| 6 | Fila, chamada e telão | ⬜ | Nathan (back), Caio Renato e Thalita (front) |
| 7 | Alocação e atendimento | ⬜ | Nathan (back), Caio Renato (front) |
| 8 | Ausências e desistências | ⬜ | Rildo e Nathan (back), Thalita (front) |
| 9 | Funcionalidades extras | ⭐ | conforme o tempo |
| 10 | Qualidade e entrega | ⬜ | Thalita (QA) e todos |

### Ordem de execução

```
0 Docker ─▶ 1 Monorepo ─▶ 2 Banco ─┬─▶ 3 Acesso ─▶ 4 Cadastros ─▶ 5 Triagem/Senha ─┐
                                   │                                               ├─▶ 9 Extras ─▶ 10 Entrega
                                   └─▶ 6 Fila/Telão ─▶ 7 Atendimento ─▶ 8 Ausências ┘
```

As trilhas **3 → 5** (entrada do paciente) e **6 → 8** (núcleo da fila) andam em paralelo.
O front não precisa esperar o back: a partir da etapa 1, as telas são construídas sobre mocks
gerados do contrato (`docs/api/openapi.yaml`).

### O que o MVP precisa demonstrar

> Login → cadastrar paciente → triagem → senha emitida → senha aparece no painel de fila →
> "Chamar próxima" → senha aparece no telão → alocar estudante, supervisor e sala →
> iniciar atendimento → encerrar com desfecho. Ausência e desistência registráveis.

---

## ✅ Concluído

### Etapa 0 · Ambiente local com Docker

Objetivo: banco de dados idêntico na máquina dos cinco integrantes.

| Parte | Descrição | Status |
| --- | --- | --- |
| 0.1 | `docker-compose.yml` com PostgreSQL 16 e Adminer, volume persistente e healthcheck | ✅ |
| 0.2 | Script de init criando o banco de testes `filas_test`; `.env.example` e `.dockerignore` | ✅ |
| 0.3 | Ambiente validado (banco *healthy*, Adminer em `localhost:8080`) | ✅ |
| 0.4 | Cada integrante instala WSL2 + Docker Desktop e sobe o ambiente | ⬜ cada um na sua máquina |

**Como subir (PowerShell, dentro da pasta do repositório):**

```powershell
Copy-Item .env.example .env
docker compose up -d
docker compose ps        # "db" deve aparecer como healthy
```

Adminer: sistema **PostgreSQL**, servidor **db**, usuário **filas**, senha **filas**, base **filas_dev**.

**Também já existia antes do código:** documentação de arquitetura, divisão de
responsabilidades, modelo de dados, contrato da API (OpenAPI 3.1), fluxo do GitHub, ADR-001 a
ADR-003 e templates de issue e PR.

---

## ⬜ A fazer

### Etapa 1 · Bootstrap do monorepo

Objetivo: estrutura de pastas e ferramentas que todos vão usar.
**Pronto quando:** `pnpm dev` sobe as três aplicações e o CI fica verde na branch principal.

A etapa é dividida em duas partes sequenciais. A **1-B começa depois que a 1-A estiver mergeada**,
porque depende da raiz do monorepo e dos pacotes compartilhados.
Revisão: Rildo e Nathan (Ratificando Caio Gabriel e Caio Renato). Nesta etapa, a revisão é cruzada
entre os dois Caios.

#### Parte 1-A · Base do monorepo e API · Caio Renato

| Parte | Descrição | Responsável |
| --- | --- | --- |
| 1.1 | pnpm workspaces + Turborepo + `packages/tsconfig` + `packages/eslint-config` | Caio Renato |
| 1.2 | `apps/api` em NestJS 11, com `GET /health` e `GET /health/ready` | Caio Renato |
| 1.3 | `packages/contracts` (schemas Zod) e `packages/ui` (design system, esqueleto) | Caio Renato |

**Pronto quando:** `pnpm install` e `pnpm --filter api dev` funcionam, e `GET /api/v1/health` responde 200.

#### Parte 1-B · Aplicações front, qualidade e CI · Caio Gabriel

| Parte | Descrição | Responsável |
| --- | --- | --- |
| 1.4 | `apps/web` (porta 3000) e `apps/publico` (porta 3001) em Next.js 15, consumindo `packages/ui` | Caio Gabriel |
| 1.5 | Prettier, Husky, lint-staged, Commitlint e GitHub Actions (lint, teste, build) | Caio Gabriel |

**Pronto quando:** `pnpm dev` sobe as três aplicações, um commit fora do padrão é recusado e o CI fica verde no PR.

### Etapa 2 · Banco de dados e seed

Objetivo: schema Prisma completo e dados fictícios para desenvolver.
**Pronto quando:** `prisma migrate dev` cria todas as tabelas e o seed popula o banco.

| Parte | Descrição | Responsável |
| --- | --- | --- |
| 2.1 | Schema de acesso, cadastros base e auditoria | Rildo |
| 2.2 | Schema de fila, senha, chamada, alocação, atendimento e encaminhamento | Nathan |
| 2.3 | Restrições no banco (únicos parciais, CHECKs, `audit_log` somente leitura) e tabela de parâmetros da unidade | Rildo, Nathan |
| 2.4 | Seed: unidade, perfis, usuários de teste, 5 especialidades, salas, estudantes, supervisores e pacientes fictícios | Rildo |

> Nenhum dado real de paciente em ambiente de desenvolvimento ou homologação.

### Etapa 3 · Acesso, permissões e auditoria

Objetivo: usuário entra no sistema e só vê o que o perfil permite; ações sensíveis ficam registradas.
**Pronto quando:** login funciona, o menu muda conforme o perfil e as operações aparecem no `audit_log`.

| Parte | Descrição | Responsável |
| --- | --- | --- |
| 3.1 | Login com JWT + refresh em cookie, bloqueio após 5 tentativas | Rildo |
| 3.2 | Guard de permissão (`modulo:operacao`) e interceptador global de auditoria | Rildo |
| 3.3 | Tela W-01 · Login (erro genérico, sessão expirada) | Caio Gabriel |
| 3.4 | Shell da aplicação: barra superior e menu lateral filtrado por permissão | Caio Renato |
| 3.5 | Tela W-02 · Home por perfil | Caio Gabriel |
| ⭐ 3.6 | Tela W-05 · Perfis e matriz de permissões editável | Caio Gabriel, Rildo |

### Etapa 4 · Cadastros base

Objetivo: cadastrar paciente, estudante, supervisor, sala e especialidade.
**Pronto quando:** as cinco entidades podem ser criadas, editadas, listadas e inativadas.

| Parte | Descrição | Responsável |
| --- | --- | --- |
| 4.1 | API das 5 entidades + tabelas de apoio (habilitação, procedimento, recurso), verificação de duplicidade, inativação no lugar de exclusão | Rildo |
| 4.2 | Tela W-03 · Lista genérica paginada com filtros | Caio Gabriel |
| 4.3 | Tela W-04 · Formulário genérico de cadastro e edição | Caio Gabriel |

### Etapa 5 · Triagem e emissão de senha

Objetivo: paciente triado recebe senha posicionada na fila.
**Pronto quando:** a triagem gera senha com a prioridade correta e a reclassificação fica auditada.

| Parte | Descrição | Responsável |
| --- | --- | --- |
| 5.1 | API de triagem: prioridade legal automática (RN-02), justificativa obrigatória em urgência (RN-03) | Rildo |
| 5.2 | Emissão de senha (ex.: F014) e reclassificação com justificativa (RN-01, RN-04) | Rildo |
| 5.3 | Tela W-06 · Busca de paciente e ficha de triagem | Caio Gabriel |
| 5.4 | Tela W-07 · Senha emitida e modal de reclassificação | Caio Gabriel |

### Etapa 6 · Fila, chamada e telão

Objetivo: equipe chama a próxima senha e o telão mostra a chamada em tempo real.
**Pronto quando:** a senha vai de *aguardando* para *chamada* e aparece no telão sem recarregar.

| Parte | Descrição | Responsável |
| --- | --- | --- |
| 6.1 | Máquina de estados da senha, com teste de cada transição | Nathan |
| 6.2 | Quadro da fila ordenado (RN-04) e "Chamar próxima" sem chamada duplicada | Nathan |
| 6.3 | Bloqueio da fila por falta de supervisor (RN-10) e eventos em tempo real (Socket.IO) | Nathan |
| 6.4 | Tela W-08 · Painel de fila | Caio Renato |
| 6.5 | Tela W-09 · Telão e W-10 · Consulta de senha pelo paciente | Thalita |

### Etapa 7 · Alocação e atendimento

Objetivo: conduzir o atendimento do início ao encerramento.
**Pronto quando:** a senha vai de *chamada* até *encerrada*, com validação do supervisor quando exigida.

| Parte | Descrição | Responsável |
| --- | --- | --- |
| 7.1 | Alocação de estudante, supervisor e sala, com verificação de disponibilidade e compatibilidade (RN-05 a RN-09) | Nathan |
| 7.2 | Iniciar, pausar, retomar e encerrar com desfecho; validação do supervisor (RN-11) | Nathan |
| 7.3 | Tela W-11 · Alocação | Caio Renato |
| 7.4 | Telas W-12 · Atendimento e W-13 · Encerramento e validação | Caio Renato |
| ⭐ 7.5 | Sugestão automática de recursos, com o motivo de inaptidão | Nathan, Caio Renato |

### Etapa 8 · Ausências e desistências

Objetivo: tratar o paciente que não comparece e o que desiste.
**Pronto quando:** a tolerância expira e marca ausência automaticamente, e a desistência fica registrada à parte.

| Parte | Descrição | Responsável |
| --- | --- | --- |
| 8.1 | Rotina de expiração da tolerância, ausência manual e restrição por reincidência (RN-12, RN-13) | Nathan, Rildo |
| 8.2 | Registro de desistência, separado de ausência | Rildo |
| 8.3 | Telas W-15 · Ausências e W-16 · Desistência | Thalita |

### Etapa 9 · Funcionalidades extras ⭐

Entram se o MVP estiver pronto antes do prazo.

| Parte | Descrição | Responsável |
| --- | --- | --- |
| ⭐ 9.1 | Encaminhamento interno (gera nova senha) e externo · W-14 | Nathan, Caio Renato |
| ⭐ 9.2 | Indicadores com filtros, gráfico e exportação · W-17 | Rildo, Thalita |
| ⭐ 9.3 | Alertas de tempo de espera (SLA) e escalonamento | Nathan, Thalita |
| ⭐ 9.4 | Tela da trilha de auditoria · W-18 | Rildo, Thalita |
| ⭐ 9.5 | Sinal sonoro no telão | Thalita |

### Etapa 10 · Qualidade e entrega

Objetivo: garantir que o sistema funciona e está pronto para a demonstração.

| Parte | Descrição | Responsável |
| --- | --- | --- |
| 10.1 | Testes de unidade das regras de negócio e teste que garante que listas não expõem dado sensível | Todos |
| 10.2 | Teste de ponta a ponta (Playwright) do fluxo triagem → encerramento + verificação de acessibilidade | Thalita |
| 10.3 | README final com o "como rodar" e ensaio da demonstração | Todos |

---

## Partes por integrante

| Integrante | Partes |
| --- | --- |
| Caio Renato | 1.1–1.3 (1-A), 3.4, 6.4, 7.3, 7.4 · ⭐ 7.5, 9.1 |
| Caio Gabriel | 0.1–0.3, 1.4–1.5 (1-B), 3.3, 3.5, 4.2, 4.3, 5.3, 5.4 · ⭐ 3.6 |
| Thalita | 6.5, 8.3, 10.2 · ⭐ 9.2–9.5 |
| Rildo | 2.1, 2.3, 2.4, 3.1, 3.2, 4.1, 5.1, 5.2, 8.1, 8.2 · ⭐ 3.6, 9.2, 9.4 |
| Nathan | 2.2, 2.3, 6.1–6.3, 7.1, 7.2, 8.1 · ⭐ 7.5, 9.1, 9.3 |
