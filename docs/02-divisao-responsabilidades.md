# Divisão de Responsabilidades

Cinco integrantes: três com foco em front-end, dois com foco em back-end. Cada pessoa é dona de
um conjunto coeso de módulos, do banco à tela quando for back, e da tela ao consumo da API quando
for front. No front, a divisão abaixo é a que foi entregue: a planejada no início foi
redistribuída em 21/10/2026, junto com as issues #33 a #52.

## 1. Quadro geral

| Integrante                                  | Frente    | Módulos sob responsabilidade                                                                              | Telas / Endpoints                              |
| ------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| **Caio Renato dos Santos Claudino**         | Front-end | Shell da aplicação, Home, Perfis, Triagem e senha, Atendimento, Encaminhamento, Alertas e Auditoria       | W-02, W-05, W-06, W-07, W-12, W-13, W-14, W-18 |
| **Caio Gabriel Pereira de Menezes Correia** | Front-end | Ambiente e CI, Login, Cadastros base, Fila, Alocação, integração com a API real e testes de ponta a ponta | W-01, W-03, W-04, W-08, W-11                   |
| **Thalita Pereira de Andrade**              | Front-end | Aplicação pública, Ausências e desistências, Indicadores                                                  | W-09, W-10, W-15, W-16, W-17                   |
| **Rildo Silva de Lima Junior**              | Back-end  | Autenticação e RBAC, Cadastros base, Triagem e senha, Ausências e desistências, Auditoria, Indicadores    | RF-01, RF-02, RF-03, RF-09, RF-10, RF-12       |
| **Nathan Rodrigues da Costa Silva**         | Back-end  | Fila, Chamada, Alocação, Atendimento, Encaminhamento, WebSocket, Alertas de SLA, rotinas agendadas        | RF-04 a RF-08, RF-11                           |

## 2. Detalhamento por integrante

### Caio Renato dos Santos Claudino — Front-end: moldura, triagem e ciclo do atendimento

| Entrega                                                                                                                                     | Rastreabilidade                            |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Shell da aplicação: barra superior, menu lateral de módulos filtrado por permissão, componentes base (modais, toast, estados de tela) (#34) | ADR-002, RNF-01, RNF-06                    |
| W-02 Home por perfil: blocos e ação em destaque conforme as permissões (#35)                                                                | RF-02, RF-10, RF-11                        |
| W-05 Perfis e matriz de permissões, com marcação de módulo sensível (#36)                                                                   | UC-04, RF-02, RNF-01                       |
| W-06 Busca de paciente e ficha de triagem, campos condicionais, aviso de restrição por reincidência (#39)                                   | UC-05, RF-03, RN-01 a RN-03, RN-13         |
| W-07 Senha emitida e modal de reclassificação de prioridade com justificativa obrigatória (#40)                                             | UC-06, UC-07, RF-04, RN-01, RN-04          |
| W-12 Atendimento e W-13 Encerramento e validação do supervisor (#44)                                                                        | UC-11 a UC-13, RF-07, RN-11                |
| Sugestão automática de recursos na alocação (#45)                                                                                           | UC-10, RF-06, RN-05 a RN-09                |
| W-14 Encaminhamento interno e externo (#46)                                                                                                 | UC-14, UC-15, RF-08                        |
| W-18 Alertas de SLA e escalonamento (#49) e trilha de auditoria (#50)                                                                       | UC-19, UC-20, RF-11, RF-12, RNF-05, RNF-07 |

### Caio Gabriel Pereira de Menezes Correia — Front-end: acesso, cadastros, fila e testes

| Entrega                                                                                                                | Rastreabilidade                           |
| ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Ambiente local com Docker (#1) e aplicações `web` e `publico`, qualidade de código e CI (#3)                           | RNF-04, RNF-06                            |
| Etiqueta de status da senha (#5)                                                                                       | P-01, RNF-06                              |
| W-01 Login e sessão do front: erro genérico, bloqueio, sessão expirada preservando a rota (#33)                        | T-01, RNF-01                              |
| W-03 Lista e W-04 formulário genéricos de cadastro, com duplicidade, filtros e aviso de impacto (#37, #38, #140)       | UC-01 a UC-03, RF-01, RN-06, RN-08, RN-09 |
| W-08 Painel de fila: quadro por status, ordenação RN-04, "Chamar próxima", banner de bloqueio, painel lateral (#41)    | UC-08, UC-09, RF-04, RF-05, RN-04, RN-10  |
| W-11 Alocação: três blocos, alternativas com motivo de inaptidão (#43)                                                 | UC-10, RF-06, RN-05 a RN-09               |
| Testes de ponta a ponta com Playwright e axe-core, incluindo o fluxo da demonstração com API e banco reais no CI (#52) | RNF-06                                    |
| Integração das telas com a API real: triagem e senha (#52), perfis (#133) e cadastros (#142)                           | RF-01 a RF-04                             |

### Thalita Pereira de Andrade — Front-end: aplicação pública, ausências e indicadores

| Entrega                                                                                        | Rastreabilidade                            |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Aplicação `publico`: layout, escala tipográfica proporcional, alto contraste                   | P-02, RNF-06                               |
| W-09 Telão da sala de espera e W-10 consulta de senha pelo paciente (#42)                      | UC-08, UC-09, RF-04, RF-05, RNF-02, RNF-06 |
| W-15 Ausência e W-16 desistência voluntária, com aviso de reincidência (#47)                   | UC-16, UC-17, RF-09, RN-12, RN-13          |
| W-17 Indicadores: filtros, cartões, gráfico com tabela equivalente acessível, exportação (#48) | UC-18, RF-10                               |
| Sinal sonoro no telão (#51)                                                                    | P-02, RNF-06                               |

### Rildo Silva de Lima Junior — Back-end: acesso, cadastros e registro

**Por que este recorte:** é o eixo "cadastro, entrada e consulta". Autenticação e RBAC precisam
existir antes de qualquer outro módulo, e auditoria e indicadores são leitura sobre o que os
demais módulos escrevem — coeso com quem já domina o modelo de dados dos cadastros.

| Entrega                                                                                                   | Rastreabilidade       |
| --------------------------------------------------------------------------------------------------------- | --------------------- |
| Schema Prisma e migrações das entidades de cadastro, usuário, perfil e auditoria                          | RF-01, RF-02          |
| Autenticação JWT, refresh em cookie httpOnly, bloqueio por tentativas, sessão                             | T-01, RNF-01          |
| RBAC: catálogo de permissões, guard `@Requer`, CRUD de perfis e vínculo com usuários                      | RF-02, RNF-01         |
| CRUD das cinco entidades base, com verificação de duplicidade e bloqueio de exclusão com vínculo ativo    | RF-01, UC-01 a UC-03  |
| Triagem: criação, campos condicionais, prioridade legal automática, justificativa obrigatória em urgência | RF-03, RN-01 a RN-03  |
| Emissão de senha e reclassificação de prioridade com justificativa auditada                               | RF-04, RN-01, RN-04   |
| Ausências e desistências, política de reincidência e restrição de paciente                                | RF-09, RN-12, RN-13   |
| Interceptador de auditoria, tabela append-only e endpoints de consulta e exportação                       | RF-12, RNF-05, RNF-07 |
| Indicadores agregados em SQL, com granularidade mínima de especialidade e período                         | RF-10, RNF-02         |

### Nathan Rodrigues da Costa Silva — Back-end: fila, atendimento e tempo real

**Por que este recorte:** é o núcleo de regra do sistema. Ordenação, alocação e ciclo de
atendimento compartilham a máquina de estados da senha; separar entre duas pessoas criaria
conflito constante no mesmo agregado.

| Entrega                                                                                                                               | Rastreabilidade      |
| ------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| Schema e migrações de fila, chamada, alocação, atendimento e encaminhamento                                                           | RF-04 a RF-08        |
| Máquina de estados da senha, com os nove status da Tabela 11 do Documento de Requisitos e transições válidas                          | P-01                 |
| CRUD de filas e consulta do quadro por status, com ordenação da RN-04                                                                 | RF-04, RN-04         |
| "Chamar próxima" com transação e bloqueio de linha, rechamada, cancelamento                                                           | RF-05, UC-09         |
| Bloqueio de fila por ausência de supervisor e desbloqueio automático                                                                  | RN-10, P-04          |
| Motor de alocação: verificação de disponibilidade e compatibilidade, sugestão e lista de alternativas com motivo textual de inaptidão | RF-06, RN-05 a RN-09 |
| Ciclo do atendimento: início, pausa com motivo, retomada, encerramento com desfecho, validação do supervisor                          | RF-07, RN-11         |
| Encaminhamento interno gerando nova entrada de fila vinculada, e externo apenas registrado                                            | RF-08, UC-14, UC-15  |
| Gateway Socket.IO nos três namespaces                                                                                                 | RNF-03               |
| Rotinas agendadas: expiração de tolerância e varredura de SLA com geração de alerta                                                   | RN-12, RF-11         |
| Escalonamento: reconhecer alerta, acionar reforço, registrar autor e horário                                                          | RF-11, UC-19         |

## 3. Pares de revisão

Todo PR precisa de uma aprovação. A revisão cruza front e back para que a interpretação do
contrato seja verificada dos dois lados:

| Autor        | Revisor principal | Revisor alternativo |
| ------------ | ----------------- | ------------------- |
| Caio Renato  | Nathan            | Caio Gabriel        |
| Caio Gabriel | Rildo             | Caio Renato         |
| Thalita      | Rildo             | Caio Renato         |
| Rildo        | Nathan            | Thalita             |
| Nathan       | Rildo             | Caio Renato         |

PR que altera `packages/contracts` ou `docs/api/openapi.yaml` precisa ser visto por alguém do front
e pelo back-end dono do módulo, porque muda o acordo entre as duas pontas.

## 4. Trabalho compartilhado

Itens sem dono único, feitos em conjunto na Milestone M0:

| Item                                        | Quem                                                                                                                                                                                         |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bootstrap do monorepo, Docker Compose, CI   | Caio Renato conduz a parte 1-A (base e API); Caio Gabriel conduz a parte 1-B (front, qualidade e CI) e fez o Docker Compose; Rildo e Nathan revisam (Ratificando Caio Gabriel e Caio Renato) |
| Contrato OpenAPI inicial e geração de tipos | Rildo e Nathan escrevem; os três de front validam                                                                                                                                            |
| Seed de dados fictícios                     | Rildo                                                                                                                                                                                        |
| Glossário e padrão de nomenclatura          | Todos, em uma sessão                                                                                                                                                                         |

## 5. Como o front trabalha sem esperar o back

Regra do projeto: o contrato (`docs/api/openapi.yaml`) é escrito e mergeado **antes** da
implementação dos dois lados. Com ele, o front gera um mock (MSW) a partir dos próprios schemas e
constrói a tela sem depender do endpoint pronto. Quando o back entrega, a troca é de URL base —
se a tela quebrar, quem está errado é quem se desviou do contrato, e isso aparece no teste de
contrato do CI.
