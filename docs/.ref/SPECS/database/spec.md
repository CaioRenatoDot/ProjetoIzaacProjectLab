# Spec: Banco de dados

> **Neste repositório:** o modelo de dados que vale para o time é [`docs/03-modelo-de-dados.md`](../../../03-modelo-de-dados.md) (enums, entidades, invariantes, máquina de estados da senha, retenção). O inventário de dados do grupo, com todos os campos e respostas possíveis, é o **Documento de Requisitos de Sistema §5** (tabelas 1 a 24). Este arquivo é o índice da camada pedido pelo professor (`SPECS → DATABASE`): liga cada tabela do inventário à entidade do banco e registra as divergências entre os documentos. Em caso de divergência prevalece o Documento de Requisitos de Sistema (`docs/06-etapas.md`, "Leitura antes de começar").

Plano de implementação do banco: [`plano-implementacao.md`](plano-implementacao.md). Quem fala com o banco é a API (`apps/api`, Prisma): [`../backend/spec.md`](../backend/spec.md).

## Onde está cada assunto
| Assunto | Documento |
|---|---|
| Convenções (UUID v7, `snake_case`, campos em português) | `docs/03-modelo-de-dados.md` (abertura) |
| Enums (status da senha, prioridade, operação de auditoria…) | `docs/03-modelo-de-dados.md` §1 |
| Entidades e campos | `docs/03-modelo-de-dados.md` §3; Documento de Requisitos §5 |
| Invariantes garantidas no banco | `docs/03-modelo-de-dados.md` §4 |
| Índice de ordenação da fila (RN-04) | `docs/03-modelo-de-dados.md` §3.3 (`idx_senha_ordem`) |
| Máquina de estados da senha (P-01) | `docs/03-modelo-de-dados.md` §5; Documento de Requisitos §7.3 (Figura 4) |
| Parâmetros da unidade | `docs/01-arquitetura.md` §4.7; Documento de Requisitos §5, tabela 8 |
| Dados sensíveis de saúde | Documento de Requisitos §5, tabela 23; ADR-003 |
| Retenção e LGPD | `docs/03-modelo-de-dados.md` §6; Documento de Requisitos §5, tabela 24, e §7.4 |
| Ambiente local (PostgreSQL 16, Adminer, `filas_dev`, `filas_test`) | `docker-compose.yml`, `docker/postgres/init/`; [`../implantacao.md`](../implantacao.md) |

## Inventário de dados × entidades do banco
Fonte das tabelas: Documento de Requisitos de Sistema §5. Fonte das entidades: `docs/03-modelo-de-dados.md` §3.

| Tabela do inventário | Entidade(s) do banco | Módulo (`MODULOS/`) |
|---|---|---|
| 1 – Dados de cadastro do paciente | `paciente` | cadastros-base |
| 2 – Dados de cadastro do estudante ou atendente | `estudante`, `estudante_habilitacao`, `estudante_procedimento`, `estudante_disponibilidade` | cadastros-base |
| 3 – Dados de cadastro do supervisor | `supervisor`, `supervisor_especialidade`, `supervisor_procedimento`, `supervisor_disponibilidade` | cadastros-base |
| 4 – Dados de cadastro da sala | `sala`, `sala_recurso` | cadastros-base |
| 5 – Dados de cadastro da especialidade ou serviço | `especialidade`, `especialidade_procedimento_requisito` | cadastros-base |
| (apoio, tabelas 2 a 5) | `habilitacao`, `procedimento`, `recurso` | cadastros-base |
| 6 – Dados de cadastro do usuário do sistema | `usuario` | usuarios-e-permissoes |
| 7 – Dados do perfil de usuário e suas permissões | `perfil`, `perfil_permissao` | usuarios-e-permissoes |
| 8 – Parâmetros de funcionamento da unidade | `parametro_unidade` (e `unidade`) | transversal |
| 9 – Dados da triagem do paciente | `triagem` | triagem-e-senha |
| 10 – Dados da fila de atendimento | `fila` | fila |
| 11 – Dados da senha | `senha` | triagem-e-senha, fila |
| 12 – Dados da reclassificação de prioridade da senha | `reclassificacao_prioridade` | triagem-e-senha |
| 13 – Dados da chamada de senha | `chamada` | chamada-e-alocacao |
| 14 – Dados da alocação de recursos ao atendimento | `alocacao` | chamada-e-alocacao |
| 15 – Dados do atendimento | `atendimento` | atendimento |
| 16 – Dados da pausa do atendimento | `pausa_atendimento` | atendimento |
| 17 – Dados do encaminhamento | `encaminhamento` | encaminhamento |
| 18 – Dados do registro de ausência | `ausencia` | ausencias-e-desistencias |
| 19 – Dados do registro de desistência voluntária | `desistencia` | ausencias-e-desistencias |
| 20 – Dados do alerta de gestão | `alerta` | indicadores-alertas-auditoria |
| 21 – Dados da medida de escalonamento | `escalonamento` | indicadores-alertas-auditoria |
| 22 – Dados do registro de auditoria | `audit_log` | indicadores-alertas-auditoria |
| 23 – Dados sensíveis de saúde e onde podem ser consultados | campos sensíveis de `triagem` e `atendimento` (ADR-003) | triagem-e-senha, atendimento |
| 24 – Prazos de retenção por categoria de dado | política de retenção (`docs/03` §6) | transversal |

## Divergências registradas
Decididas pelo time no repositório:
- **Oito × nove status de senha (D-08):** a premissa P-01 fala em "oito situações", mas a Tabela 11 lista nove. `docs/03-modelo-de-dados.md` §1 decide: prevalece a tabela (nove status).
- **"Aguardando alocação" × "Aguardando recurso" (D-09):** o enum é `AGUARDANDO_RECURSO` (`docs/03` §1), rótulo "Aguardando recurso".
- **Cinco × seis parâmetros da unidade (D-13):** `docs/03` §3.1 e a tabela 8 usam seis chaves, com `janela_reincidencia_dias` separada de `reincidencias_restricao`.
- **De onde se chega a Desistência (D-16):** `docs/03` §5 segue a pré-condição do UC-17: só a partir de `AGUARDANDO` e `EM_ATENDIMENTO`; nos demais status a desistência retorna `409 TRANSICAO_INVALIDA`. (O DAS também permitia a partir de "Chamada" e "Aguardando recurso".)
- **Justificativa de reclassificação:** o tamanho mínimo é validado no service pelo parâmetro `justificativa_min_caracteres`; no banco só há `CHECK` de justificativa não vazia (`docs/03` §4).

Ainda em aberto:
- **Retenção de "Cadastros base":** a tabela 24 do inventário traz "Cadastros base — Enquanto houver vínculo", que não aparece em `docs/03` §6. O grupo decide se entra na política.
- **Base legal e prazo de retenção de triagem e atendimento:** pendência com a coordenação (`docs/03` §6).
