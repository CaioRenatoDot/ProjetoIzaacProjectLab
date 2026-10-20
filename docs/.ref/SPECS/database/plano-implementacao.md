# Plano de implementação: Banco de dados

> Proposta (não consta no material do grupo): ordem e recorte das etapas. O conteúdo técnico (invariantes, índices, parâmetros, carga inicial) vem do DAS e do inventário de dados (Documento de Requisitos de Sistema §5), com a fonte citada; o recorte em etapas B0 a B6 é nosso. Este arquivo só planeja: **não há código, migração nem arquivo de composição** (fora de escopo).

Relacionados: [`spec.md`](spec.md) (visão e inventário de dados), [`../backend/plano-implementacao.md`](../backend/plano-implementacao.md) (etapas do serviço de negócio que as migrações acompanham; tem a definição de "Pronto quando" do DAS §12.2 e as frentes), [`../backend/spec.md`](../backend/spec.md), [`../implantacao.md`](../implantacao.md) (Docker) e [`../frontend/plano-implementacao.md`](../frontend/plano-implementacao.md).


> **Alinhamento com o repositório:** o plano oficial do time, com partes numeradas, responsáveis e status, é [`docs/06-etapas.md`](../../../06-etapas.md); os marcos são as milestones M0 a M6 de [`docs/05-fluxo-github.md`](../../../05-fluxo-github.md) §6. Este arquivo **não substitui** esse plano: detalha, por camada, os entregáveis e os mecanismos críticos de cada etapa. Se divergir de `06-etapas.md`, vale `06-etapas.md`. Responsáveis por parte: `06-etapas.md` ("Partes por integrante") e [`docs/02-divisao-responsabilidades.md`](../../../02-divisao-responsabilidades.md).

| Etapa deste plano | Etapa de `06-etapas.md` |
|---|---|
| B0 — Instância e usuários | Etapa 0 (já entregue: `docker-compose.yml` com `db` e `adminer`) e Etapa 2 (2.3) |
| B1 a B5 — Migrações por agrupamento | Etapa 2 (2.1 acesso, cadastros e auditoria; 2.2 fila, senha, alocação, atendimento e encaminhamento; 2.3 restrições) |
| B6 — Carga inicial e cópia de segurança | Etapa 2 (2.4 seed); cópia de segurança fica para a Etapa 10 |

## Formato de cada etapa
**Entregáveis** | **RF/RN/UC cobertos** | **Seções do DAS** | **Mecanismos críticos** | **Pronto quando**. "Pronto quando" lista só o que é específico da etapa, além dos itens do DAS §12.2 listados em [`../backend/plano-implementacao.md`](../backend/plano-implementacao.md).

## Projeto coberto
Banco de dados, unidade implantável (DAS §8.2). PostgreSQL 16 (DAS §10.2), instância única com cópia de segurança diária (DAS §8.2), executada em contêiner (`../implantacao.md`). Só o serviço de negócio fala com o banco.

### Etapa B0 — Instância e usuários
- **Entregáveis:** serviços `db` e `adminer` do `docker-compose.yml` da raiz (já existentes) e o banco `filas_test` criado por `docker/postgres/init/01-criar-banco-testes.sql`; usuário de banco da aplicação **sem** permissão de alteração e remoção sobre a tabela de auditoria; verificação de prontidão ligada à conexão e às migrações.
- **RF/RN/UC cobertos:** RNF-05, RNF-04.
- **Seções do DAS:** §7.4 (trilha imutável), §8.2, §8.4, §10.2.
- **Mecanismos críticos:** revogação de permissões no próprio banco.
- **Pronto quando:** tentativa de alteração e de remoção na auditoria, feita com o usuário da aplicação, é negada.

### Etapas B1 a B5 — Migrações por agrupamento (DAS §7.2)
Migrações versionadas (Prisma, DAS §10.2), criadas pela ferramenta do projeto, uma por agrupamento e acompanhando as etapas do serviço.

| Etapa | Agrupamento (DAS §7.2) | Tabelas do inventário (`spec.md`) | Invariantes e índices (DAS §7.4, §7.5) | Acompanha a etapa |
|---|---|---|---|---|
| B1 | Acesso e configuração | 6, 7, 8, 22 | Trilha imutável (RNF-05) | 0 e 1 |
| B2 | Cadastros base | 1 a 5 (e tabelas de apoio) | — | 2 |
| B3 | Fila e senha | 9 a 13 | Justificativa mínima (RN-01); justificativa clínica em urgente (RN-03); fila ativa única por especialidade (RF-04); índice composto da ordenação da fila (fila, status, prioridade decrescente, chegada crescente, agendamento prévio) | 3 e 4 |
| B4 | Alocação e atendimento | 14 a 17 | Um atendimento por senha (RF-07); índice único parcial de estudante (RN-05) e de sala (RN-09) em alocações não liberadas | 5 a 7 |
| B5 | Ausência e gestão | 18 a 21 | — (limite de supervisão fica na camada de serviço, RN-08) | 8 e 9 |

- **Seções do DAS:** §7.1 a §7.5.
- **Pronto quando:** cada invariante da tabela tem teste que tenta violá-la e é recusada pelo banco; migrações aplicam do zero na composição local.

### Etapa B6 — Carga inicial e cópia de segurança
- **Entregáveis:** carga fictícia ("perfis, cinco especialidades, salas, supervisores e pacientes fictícios", DAS §8.1); parâmetros da unidade com valores provisórios (5 minutos, 25 minutos, 3 ausências em 90 dias, limite de 3 estudantes, 20 caracteres); rotina diária de extração (RPO de 24 h e RTO de 4 h, DAS §6.5).
- **RF/RN/UC cobertos:** RNF-09, RNF-07 (retenção configurável).
- **Seções do DAS:** §6.5, §7.6, §7.7, §8.1.
- **Mecanismos críticos:** nenhum dado real de paciente; parâmetros em tabela própria e editáveis, nunca constantes no código.
- **Pronto quando:** todos os integrantes sobem a composição e partem do mesmo estado; restauração da cópia diária testada e os tempos documentados no manual de operação (DAS §10.4).
