# Divisão de Responsabilidades

Cinco integrantes: três com foco em front-end, dois com foco em back-end. A divisão abaixo segue
esse perfil e mantém cada pessoa dona de um conjunto coeso de módulos, do banco à tela quando for
back, e da tela ao consumo da API quando for front.

## 1. Quadro geral

| Integrante | Frente | Módulos sob responsabilidade | Telas / Endpoints |
| --- | --- | --- | --- |
| **Caio Renato dos Santos Claudino** | Front-end + tech lead | Design system, shell da aplicação, Fila, Alocação, Atendimento, Encaminhamento | W-08, W-11, W-12, W-13, W-14 |
| **Caio Gabriel Pereira de Menezes Correia** | Front-end | Acesso, Cadastros base, Perfis, Triagem, Emissão e reclassificação de senha | W-01 a W-07 |
| **Thalita Pereira de Andrade** | Front-end + QA | Aplicação pública, Ausências e desistências, Indicadores, Alertas e Auditoria, testes E2E e acessibilidade | W-09, W-10, W-15, W-16, W-17, W-18 |
| **Rildo Silva de Lima Junior** | Back-end | Autenticação e RBAC, Cadastros base, Triagem e senha, Ausências e desistências, Auditoria, Indicadores | RF-01, RF-02, RF-03, RF-09, RF-10, RF-12 |
| **Nathan Rodrigues da Costa Silva** | Back-end | Fila, Chamada, Alocação, Atendimento, Encaminhamento, WebSocket, Alertas de SLA, rotinas agendadas | RF-04 a RF-08, RF-11 |

## 2. Detalhamento por integrante

### Caio Renato dos Santos Claudino — Front-end, núcleo operacional (tech lead)

**Por que este recorte:** o painel de fila é a tela central do sistema, tem tempo real, regras de
ordenação visíveis e a maior densidade de estados. O ciclo alocação → atendimento →
encaminhamento é contínuo e compartilha o mesmo contexto de senha, então fica com uma pessoa só.

| Entrega | Rastreabilidade |
| --- | --- |
| Design system: cartão de senha, etiqueta de status, etiqueta de prioridade, banner de bloqueio, cronômetro, modal de confirmação e de justificativa, estado vazio | P-01, RNF-06 |
| Shell da aplicação: barra superior, menu lateral de módulos filtrado por permissão, indicador de perfil ativo | ADR-002, RNF-01 |
| W-08 Painel de fila: quadro por status, ordenação RN-04, ação única "Chamar próxima", banner de bloqueio, painel lateral de detalhes | UC-08, UC-09, RF-04, RF-05, RN-04, RN-10 |
| W-11 Alocação: três blocos (estudante, supervisor, sala), sugestão do sistema, alternativas com motivo de inaptidão | UC-10, RF-06, RN-05 a RN-09 |
| W-12 Atendimento: barra de ações por estado, cronômetro, aviso de acesso registrado | UC-11, UC-12, RF-07 |
| W-13 Encerramento e validação do supervisor | UC-13, RF-07, RN-11 |
| W-14 Encaminhamento interno e externo | UC-14, UC-15, RF-08 |
| Cliente WebSocket e política de revalidação do painel | RNF-03, RNF-04 |

**Como tech lead:** define o bootstrap do monorepo, revisa todos os PRs que alteram
`packages/contracts`, mantém o CI e é o desempate técnico.

### Caio Gabriel Pereira de Menezes Correia — Front-end, acesso e entrada do paciente

**Por que este recorte:** login, home e os cinco cadastros usam o mesmo par lista/formulário
parametrizado; triagem e emissão de senha são a continuação natural do cadastro do paciente.

| Entrega | Rastreabilidade |
| --- | --- |
| W-01 Login, erro genérico, bloqueio após cinco tentativas, sessão expirada preservando rota | T-01, RNF-01 |
| W-02 Home por perfil: cartões de indicador, lista principal e ação em destaque variando por perfil | RF-02, RF-10, RF-11 |
| W-03 Lista de cadastro genérica, parametrizada para as cinco entidades, com filtros persistentes | UC-03, RF-01 |
| W-04 Formulário genérico de cadastro e edição, verificação de duplicidade, seleção múltipla com busca | UC-01, UC-02, RF-01, RN-06, RN-08, RN-09 |
| W-05 Perfis e matriz de permissões, com marcação de módulo sensível | UC-04, RF-02, RNF-01 |
| W-06 Busca de paciente e ficha de triagem, campos condicionais, aviso de restrição por reincidência | UC-05, RF-03, RN-01 a RN-03, RN-13 |
| W-07 Senha emitida e modal de reclassificação de prioridade com justificativa obrigatória | UC-06, UC-07, RF-04, RN-01, RN-04 |

### Thalita Pereira de Andrade — Front-end público e de gestão + qualidade

**Por que este recorte:** as telas públicas têm um conjunto de requisitos de acessibilidade
próprio (contraste 7:1, tipografia ampliada, anúncio sonoro) que se beneficia de uma dona única,
e as telas de gestão são majoritariamente leitura, o que se combina bem com a frente de testes.

| Entrega | Rastreabilidade |
| --- | --- |
| Aplicação `publico`: layout, escala tipográfica proporcional, alto contraste | P-02, RNF-06 |
| W-09 Telão da sala de espera: chamada atual, quatro anteriores, sinal sonoro, comportamento em queda de conexão | UC-09, RF-05, RNF-02, RNF-06 |
| W-10 Consulta de senha pelo paciente: posição, tempo estimado, mensagens neutras, uso em celular | UC-08, RF-04, RNF-06 |
| W-15 Ausência: lista de tolerância em curso, modal de ausência manual, aviso de reincidência | UC-16, RF-09, RN-12, RN-13 |
| W-16 Desistência voluntária, distinta de ausência | UC-17, RF-09 |
| W-17 Indicadores: filtros, cartões, gráfico com tabela equivalente acessível, exportação | UC-18, RF-10 |
| W-18 Alertas de SLA e trilha de auditoria, com marcação de consulta a prontuário | UC-19, UC-20, RF-11, RF-12, RNF-05, RNF-07 |
| **QA:** suíte Playwright dos fluxos críticos e verificação axe-core no CI | RNF-06 |

**Nota:** esta é a única atribuição montada sem informação prévia de perfil. Se Thalita preferir
back-end, a troca natural é assumir o módulo de Indicadores e Auditoria no servidor (hoje com
Rildo) e devolver W-17 e W-18 para o front.

### Rildo Silva de Lima Junior — Back-end: acesso, cadastros e registro

**Por que este recorte:** é o eixo "cadastro, entrada e consulta". Autenticação e RBAC precisam
existir antes de qualquer outro módulo, e auditoria e indicadores são leitura sobre o que os
demais módulos escrevem — coeso com quem já domina o modelo de dados dos cadastros.

| Entrega | Rastreabilidade |
| --- | --- |
| Schema Prisma e migrações das entidades de cadastro, usuário, perfil e auditoria | RF-01, RF-02 |
| Autenticação JWT, refresh em cookie httpOnly, bloqueio por tentativas, sessão | T-01, RNF-01 |
| RBAC: catálogo de permissões, guard `@Requer`, CRUD de perfis e vínculo com usuários | RF-02, RNF-01 |
| CRUD das cinco entidades base, com verificação de duplicidade e bloqueio de exclusão com vínculo ativo | RF-01, UC-01 a UC-03 |
| Triagem: criação, campos condicionais, prioridade legal automática, justificativa obrigatória em urgência | RF-03, RN-01 a RN-03 |
| Emissão de senha e reclassificação de prioridade com justificativa auditada | RF-04, RN-01, RN-04 |
| Ausências e desistências, política de reincidência e restrição de paciente | RF-09, RN-12, RN-13 |
| Interceptador de auditoria, tabela append-only e endpoints de consulta e exportação | RF-12, RNF-05, RNF-07 |
| Indicadores agregados em SQL, com granularidade mínima de especialidade e período | RF-10, RNF-02 |

### Nathan Rodrigues da Costa Silva — Back-end: fila, atendimento e tempo real

**Por que este recorte:** é o núcleo de regra do sistema. Ordenação, alocação e ciclo de
atendimento compartilham a máquina de estados da senha; separar entre duas pessoas criaria
conflito constante no mesmo agregado.

| Entrega | Rastreabilidade |
| --- | --- |
| Schema e migrações de fila, chamada, alocação, atendimento e encaminhamento | RF-04 a RF-08 |
| Máquina de estados da senha, com os oito status de P-01 e transições válidas | P-01 |
| CRUD de filas e consulta do quadro por status, com ordenação da RN-04 | RF-04, RN-04 |
| "Chamar próxima" com transação e bloqueio de linha, rechamada, cancelamento | RF-05, UC-09 |
| Bloqueio de fila por ausência de supervisor e desbloqueio automático | RN-10, P-04 |
| Motor de alocação: verificação de disponibilidade e compatibilidade, sugestão e lista de alternativas com motivo textual de inaptidão | RF-06, RN-05 a RN-09 |
| Ciclo do atendimento: início, pausa com motivo, retomada, encerramento com desfecho, validação do supervisor | RF-07, RN-11 |
| Encaminhamento interno gerando nova entrada de fila vinculada, e externo apenas registrado | RF-08, UC-14, UC-15 |
| Gateway Socket.IO nos três namespaces | RNF-03 |
| Rotinas agendadas: expiração de tolerância e varredura de SLA com geração de alerta | RN-12, RF-11 |
| Escalonamento: reconhecer alerta, acionar reforço, registrar autor e horário | RF-11, UC-19 |

## 3. Pares de revisão

Todo PR precisa de uma aprovação. A revisão cruza front e back para que a interpretação do
contrato seja verificada dos dois lados:

| Autor | Revisor principal | Revisor alternativo |
| --- | --- | --- |
| Caio Renato | Nathan | Caio Gabriel |
| Caio Gabriel | Rildo | Caio Renato |
| Thalita | Rildo | Caio Renato |
| Rildo | Nathan | Thalita |
| Nathan | Rildo | Caio Renato |

PR que altera `packages/contracts` ou `docs/api/openapi.yaml` exige aprovação do tech lead e do
back-end dono do módulo, porque muda o acordo entre as duas pontas.

## 4. Trabalho compartilhado

Itens sem dono único, feitos em conjunto na Milestone M0:

| Item | Quem |
| --- | --- |
| Bootstrap do monorepo, Docker Compose, CI | Caio Renato conduz; Rildo e Nathan revisam |
| Contrato OpenAPI inicial e geração de tipos | Rildo e Nathan escrevem; os três de front validam |
| Seed de dados fictícios | Rildo |
| Glossário e padrão de nomenclatura | Todos, em uma sessão |

## 5. Como o front trabalha sem esperar o back

Regra do projeto: o contrato (`docs/api/openapi.yaml`) é escrito e mergeado **antes** da
implementação dos dois lados. Com ele, o front gera um mock (MSW) a partir dos próprios schemas e
constrói a tela sem depender do endpoint pronto. Quando o back entrega, a troca é de URL base —
se a tela quebrar, quem está errado é quem se desviou do contrato, e isso aparece no teste de
contrato do CI.
