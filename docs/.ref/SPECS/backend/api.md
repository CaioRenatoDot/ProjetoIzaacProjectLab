# Spec: Backend — Mapa da API por módulo

> **Neste repositório:** o contrato da API é [`docs/api/openapi.yaml`](../../../api/openapi.yaml) (OpenAPI 3.1), e as convenções que valem para todos os endpoints (base `/api/v1`, autenticação, autorização `modulo:operacao`, erros RFC 7807 com `codigo`, paginação, idempotência, eventos Socket.IO, saúde) estão em [`docs/04-contrato-api.md`](../../../04-contrato-api.md). As projeções de senha (`SenhaPublica`, `SenhaResumo`, `SenhaDetalhe`) estão no ADR-003. **Este arquivo não define contrato**: é só o índice dos endpoints por módulo de `MODULOS/`, gerado a partir do `openapi.yaml` da branch `develop`. Mudança de endpoint é feita no `openapi.yaml`, em PR próprio, antes da implementação (`docs/05-fluxo-github.md` §4); depois, este mapa é atualizado.

## Endpoints por módulo
Coluna "Rastreabilidade": identificadores citados na descrição da operação no `openapi.yaml`.

### Autenticação (`MODULOS/usuarios-e-permissoes`)

| Endpoint | Operação | Rastreabilidade |
|---|---|---|
| `POST /auth/login` | Autenticar usuário | T-01 |
| `POST /auth/refresh` | Renovar access token | — |
| `POST /auth/logout` | Encerrar sessão | — |
| `GET /auth/me` | Dados da sessão atual | — |

### Perfis e permissões (`MODULOS/usuarios-e-permissoes`)

| Endpoint | Operação | Rastreabilidade |
|---|---|---|
| `GET /permissoes` | Catálogo de permissões | W-05, T-05 |
| `GET /perfis` | Listar perfis | — |
| `POST /perfis` | Criar perfil | UC-04, RF-02, T-05 |
| `GET /perfis/{id}` | Consultar perfil | — |
| `PUT /perfis/{id}` | Atualizar perfil | T-05 |
| `DELETE /perfis/{id}` | Excluir perfil | T-05 |
| `GET /usuarios` | Listar usuários | — |
| `POST /usuarios` | Criar usuário | — |

### Cadastros base (`MODULOS/cadastros-base`)

| Endpoint | Operação | Rastreabilidade |
|---|---|---|
| `GET /pacientes` | Listar pacientes | UC-03, RF-01, W-03 |
| `POST /pacientes` | Cadastrar paciente | UC-01, RF-01, W-04 |
| `GET /pacientes/{id}` | Consultar paciente | RN-13, W-06 |
| `PUT /pacientes/{id}` | Editar paciente | UC-02, RF-01 |
| `DELETE /pacientes/{id}` | Excluir paciente | T-03 |
| `GET /estudantes` | Listar estudantes/atendentes | W-03 |
| `POST /estudantes` | Cadastrar estudante/atendente | RN-06 |
| `GET /estudantes/{id}` | Consultar estudante | — |
| `PUT /estudantes/{id}` | Editar estudante | T-04 |
| `DELETE /estudantes/{id}` | Excluir estudante | — |
| `GET /supervisores` | Listar supervisores | RN-08, T-03 |
| `POST /supervisores` | Cadastrar supervisor | RN-07, RN-08 |
| `GET /supervisores/{id}` | Consultar supervisor | — |
| `PUT /supervisores/{id}` | Editar supervisor | — |
| `DELETE /supervisores/{id}` | Excluir supervisor | — |
| `GET /salas` | Listar salas | — |
| `POST /salas` | Cadastrar sala | RN-09 |
| `GET /salas/{id}` | Consultar sala | — |
| `PUT /salas/{id}` | Editar sala | — |
| `DELETE /salas/{id}` | Excluir sala | — |
| `GET /especialidades` | Listar especialidades/serviços | — |
| `POST /especialidades` | Cadastrar especialidade/serviço | RN-07, RN-11, RN-12 |
| `GET /especialidades/{id}` | Consultar especialidade | — |
| `PUT /especialidades/{id}` | Editar especialidade | — |
| `DELETE /especialidades/{id}` | Excluir especialidade | — |

### Triagem (`MODULOS/triagem-e-senha`)

| Endpoint | Operação | Rastreabilidade |
|---|---|---|
| `POST /triagens` | Registrar triagem | UC-05, RF-03, RN-01, RN-02, RN-03 |
| `GET /triagens` | Listar triagens | — |
| `GET /triagens/{id}` | Consultar triagem completa | — |

### Senhas (`MODULOS/triagem-e-senha`)

| Endpoint | Operação | Rastreabilidade |
|---|---|---|
| `POST /senhas` | Emitir senha | UC-06, RF-04, RN-04, RN-10, T-07 |
| `GET /senhas/{id}` | Consultar senha | — |
| `PATCH /senhas/{id}/prioridade` | Reclassificar prioridade | UC-07, RF-03, RN-01, T-08 |
| `GET /senhas/{id}/reclassificacoes` | Histórico de reclassificações da senha | W-07 |

### Filas e chamadas (`MODULOS/fila`, `MODULOS/chamada-e-alocacao`)

| Endpoint | Operação | Rastreabilidade |
|---|---|---|
| `GET /filas` | Listar filas | UC-08, RF-04, T-09 |
| `POST /filas` | Criar fila | RF-04 |
| `GET /filas/{id}` | Consultar fila | T-09, RN-10 |
| `PUT /filas/{id}` | Editar fila | — |
| `DELETE /filas/{id}` | Excluir fila | — |
| `GET /filas/{id}/senhas` | Quadro de senhas da fila | UC-08, RF-04, RN-04 |
| `POST /filas/{id}/chamadas` | Chamar próxima senha | UC-09, RF-05, RN-04, RN-10, T-09, RN-03 |
| `POST /chamadas/{id}/rechamada` | Rechamar senha | T-11 |
| `DELETE /chamadas/{id}` | Cancelar chamada | RF-05, RN-04 |

### Alocação (`MODULOS/chamada-e-alocacao`)

| Endpoint | Operação | Rastreabilidade |
|---|---|---|
| `GET /senhas/{id}/alocacao/sugestoes` | Sugestões e alternativas de alocação | UC-10, RF-06, W-11, RN-05, RN-09, RN-07 |
| `POST /senhas/{id}/alocacao` | Confirmar alocação de recursos | UC-10, RF-06, T-10, RN-10 |
| `PUT /senhas/{id}/alocacao` | Trocar recurso de uma alocação | T-09 |
| `POST /senhas/{id}/aguardando-recurso` | Manter senha aguardando recurso | W-11 |

### Atendimento (`MODULOS/atendimento`)

| Endpoint | Operação | Rastreabilidade |
|---|---|---|
| `GET /atendimentos` | Listar atendimentos | W-02 |
| `GET /atendimentos/{id}` | Consultar atendimento | W-12 |
| `POST /senhas/{id}/atendimento` | Iniciar atendimento | UC-11, RF-07, T-13 |
| `POST /atendimentos/{id}/pausa` | Pausar atendimento | UC-12, RF-07, T-13 |
| `POST /atendimentos/{id}/retomada` | Retomar atendimento | UC-12, T-13 |
| `POST /atendimentos/{id}/encerramento` | Encerrar atendimento | UC-13, RF-07, RN-11, T-14 |
| `POST /atendimentos/{id}/validacao` | Validar ou recusar encerramento | UC-13, RN-11, W-13 |

### Encaminhamento (`MODULOS/encaminhamento`)

| Endpoint | Operação | Rastreabilidade |
|---|---|---|
| `POST /atendimentos/{id}/encaminhamentos` | Registrar encaminhamento | UC-14, UC-15, RF-08, T-14, RN-10 |

### Ausências e desistências (`MODULOS/ausencias-e-desistencias`)

| Endpoint | Operação | Rastreabilidade |
|---|---|---|
| `POST /senhas/{id}/ausencia` | Registrar ausência (no-show) | UC-16, RF-09, RN-12, W-15, RN-13 |
| `POST /senhas/{id}/desistencia` | Registrar desistência voluntária | UC-17, RF-09, W-16 |

### Indicadores (`MODULOS/indicadores-alertas-auditoria`)

| Endpoint | Operação | Rastreabilidade |
|---|---|---|
| `GET /indicadores/resumo` | Indicadores consolidados do período | UC-18, RF-10, T-16 |
| `GET /indicadores/volume-por-especialidade` | Volume de atendimentos por especialidade | W-17 |
| `GET /indicadores/exportacao` | Exportar indicadores | T-18 |

### Alertas de SLA (`MODULOS/indicadores-alertas-auditoria`)

| Endpoint | Operação | Rastreabilidade |
|---|---|---|
| `GET /alertas` | Listar alertas | UC-19, RF-11, T-17 |
| `POST /alertas/{id}/reconhecimento` | Reconhecer alerta | T-17 |
| `POST /alertas/{id}/escalonamento` | Acionar medida de escalonamento | UC-19, RF-11, T-17 |

### Auditoria (`MODULOS/indicadores-alertas-auditoria`)

| Endpoint | Operação | Rastreabilidade |
|---|---|---|
| `GET /auditoria` | Consultar trilha de auditoria | UC-20, RF-12, T-18 |
| `GET /auditoria/{id}` | Detalhe do evento de auditoria | T-18 |
| `GET /auditoria/exportacao` | Exportar trilha filtrada | T-18 |

### Público (`MODULOS/acesso-publico`)

| Endpoint | Operação | Rastreabilidade |
|---|---|---|
| `GET /publico/painel/{unidadeId}` | Estado do telão da sala de espera | W-09, UC-09, RF-05 |
| `GET /publico/senhas/{numero}` | Consultar posição da senha | W-10, UC-08, RF-04 |
| `GET /health` | Liveness | — |

`GET /health/ready` (prontidão: banco e migrações) é acrescentado ao contrato na branch de bootstrap (`docs/04-contrato-api.md` §9).

## Divergências registradas
- **Consulta pública de senha (D-31):** a T-12 da especificação de UI pede número, especialidade, posição, tempo médio estimado e status; o DAS §9.15 limitava a projeção pública a número, especialidade e local. O contrato do time resolve com duas respostas distintas: o telão (`GET /publico/painel/{unidadeId}`, evento `chamada.exibir`) usa só número, especialidade e local, e a consulta do paciente (`GET /publico/senhas/{numero}`) devolve `numero`, `especialidade`, `status`, `posicao`, `tempoEstimadoMinutos` e `local`. Nenhuma das duas traz dado de paciente (ADR-003).
- **Painel público no UC-09 (D-15):** o passo 4 do UC-09 cita "(paciente, senha)". O ADR-003 ("Nota sobre o UC-09") trata como erro de redação: prevalece a regra geral, sem dado de paciente na tela pública.
- **RN-08 no cadastro de supervisor (D-06):** o DAS e a T-03/T-04 associam RN-08 ao cadastro de supervisor; a Tabela A do Documento de Requisitos só traz RN-06 e RN-09. O limite (`limite_estudantes_simultaneos`) existe no cadastro e é verificado na alocação (`docs/03` §3.2 e §4).
- **Matriz de permissões (D-12):** a T-05 descreve "quatro colunas por módulo" (consultar, criar, editar, excluir); o catálogo do time (`docs/04-contrato-api.md` §3) inclui também as operações próprias do módulo (`chamar`, `validar`, `consultar_sensivel`, `reclassificar`, `exportar`, `reconhecer`, `escalonar`), como a tabela 7 do inventário de dados prevê.
