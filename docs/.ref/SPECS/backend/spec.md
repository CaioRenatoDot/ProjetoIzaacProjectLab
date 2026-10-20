# Spec: Backend

> **Neste repositório:** as decisões de arquitetura do back-end que valem para o time estão em [`docs/01-arquitetura.md`](../../../01-arquitetura.md) (§3 camadas, §4 decisões transversais), [`docs/04-contrato-api.md`](../../../04-contrato-api.md), [`docs/api/openapi.yaml`](../../../api/openapi.yaml) e nos ADRs ([`docs/adr/`](../../../adr/)). Este arquivo é o índice da camada pedido pelo professor (`SPECS → BACKEND`) e o mapeamento módulo de negócio × módulo da API; em caso de divergência prevalecem o Documento de Requisitos de Sistema e depois `docs/0x`. Código em `apps/api` (NestJS) e `packages/contracts` (Zod).

> Este arquivo é o mapeamento de alto nível pedido pelo professor no quadro (`SPECS → BACKEND`), agora com as decisões do documento de arquitetura do grupo (DAS). Ainda é só documentação: não há código. Trechos do DAS estão copiados sem alteração, com a fonte citada; o que é proposta nossa está marcado.

## Papel deste documento
Consolidar, do ponto de vista do backend, quais módulos de negócio (`MODULOS/`) e quais requisitos não funcionais (`requisitos-nao-funcionais.md`) impactam a camada de servidor/API, e registrar as decisões de arquitetura do servidor.

Sub-specs do backend:
- [`api.md`](api.md) — mapeamento da interface de programação (DAS cap. 9).
- [`plano-implementacao.md`](plano-implementacao.md) — planejamento da implementação do serviço de negócio e do pacote de contratos (proposta); o banco tem plano próprio em `../database/`.

Banco de dados (camada própria): [`../database/spec.md`](../database/spec.md) — visão de dados e inventário de dados (DAS cap. 7 e `pages-inv`) — e [`../database/plano-implementacao.md`](../database/plano-implementacao.md).

Implantação e Docker: [`../implantacao.md`](../implantacao.md). Interface: [`../frontend/spec.md`](../frontend/spec.md).

## Módulos que o backend precisa expor
| Módulo | Pasta | Principais RF |
|---|---|---|
| Usuários e Permissões | `MODULOS/usuarios-e-permissoes` | RF-02 |
| Cadastros Base | `MODULOS/cadastros-base` | RF-01 |
| Triagem e Senha | `MODULOS/triagem-e-senha` | RF-03 |
| Fila | `MODULOS/fila` | RF-04 |
| Chamada e Alocação | `MODULOS/chamada-e-alocacao` | RF-05, RF-06 |
| Atendimento | `MODULOS/atendimento` | RF-07 |
| Encaminhamento | `MODULOS/encaminhamento` | RF-08 |
| Ausências e Desistências | `MODULOS/ausencias-e-desistencias` | RF-09 |
| Indicadores, Alertas e Auditoria | `MODULOS/indicadores-alertas-auditoria` | RF-10, RF-11, RF-12 |

## Requisitos não funcionais que o backend precisa garantir
- **RNF-01** — Controle de acesso por perfil em toda operação exposta.
- **RNF-02** — Proteção de dados sensíveis (saúde) em trânsito e em repouso.
- **RNF-03** — Desempenho nas operações de fila.
- **RNF-04** — Disponibilidade durante o horário de funcionamento.
- **RNF-05** — Auditoria de toda operação relevante.
- **RNF-07** — Conformidade com a LGPD.
- **RNF-08** — Suporte a múltiplas especialidades/unidades simultâneas.
- **RNF-09** — Backup e recuperação de desastres.

(Detalhamento completo de cada um em `../requisitos-nao-funcionais.md`, com o atendimento técnico do DAS §10.4.)

## Estilo arquitetural adotado
Fonte: DAS §2.1.

O sistema é uma aplicação distribuída em três partes executáveis, com separação clara entre a interface de usuário e a lógica de negócio. A lógica de negócio é organizada em camadas: uma camada de entrada que trata protocolo, validação e códigos de resposta; uma camada de serviço, onde todas as regras de negócio vivem; e uma camada de acesso a dados, sem regra alguma.

A comunicação entre a interface e a lógica de negócio acontece por dois canais: um canal de requisição e resposta, usado para toda leitura e toda escrita, e um canal de eventos, usado para propagar mudança de estado às telas que precisam refletir a fila em tempo quase real. O canal de eventos nunca é a única fonte de verdade — toda tela que o consome revalida periodicamente pelo canal de requisição, de modo que uma queda de conexão degrade a experiência sem invalidar a informação.

## Princípio de organização interna
Fonte: DAS §2.2.

Uma regra do projeto atravessa toda a arquitetura: nenhuma regra de negócio é implementada na camada de entrada nem em componente de interface. Regra de negócio mora na camada de serviço e tem teste automatizado que cita, no nome do caso de teste, o identificador da regra que verifica. Validação de formulário na interface existe para dar retorno imediato ao usuário, não para garantir a regra — a garantia é sempre do servidor, e ambos usam a mesma definição de validação, escrita uma única vez em um pacote compartilhado.

## Premissas transversais e consequência para o servidor
Fonte: DAS §3.3 (colunas "Premissa" e "Consequência arquitetural"; o conteúdo das premissas está em [`../frontend/spec.md`](../frontend/spec.md)).

| Premissa | Consequência arquitetural |
|---|---|
| P-01 | Máquina de estados explícita, concentrada em um único módulo do servidor, com teste cobrindo cada transição válida e cada transição proibida |
| P-02 | Biblioteca de componentes construída sobre primitivas acessíveis; verificação automática de acessibilidade na integração contínua |
| P-03 | Três projeções distintas para senha, escolhidas pelo tipo de consumidor, e não por filtro aplicado sobre um objeto único |
| P-04 | Um único estado no servidor alimenta as três manifestações: aviso permanente na fila, recusa da operação de chamada e item na lista de alertas de gestão |

## Mapeamento MODULOS × módulos do servidor × menu × inventário de dados
> Proposta (não consta no material do grupo): esta tabela é só de correspondência entre quatro vocabulários do próprio material (as pastas de `MODULOS/`, os módulos do serviço de negócio do DAS §5.3, os itens de menu de `especificacao/wireframes_ui_v2.pdf` e os grupos de Documento de Requisitos de Sistema §5). Não renomeia nem funde nenhuma pasta de `MODULOS/`. Divergência D-10: o `pages-arq` fala em "nove módulos", o menu de `05` tem 10 itens, o DAS tem 11 módulos de servidor e o inventário organiza os dados em 8 grupos (a introdução cita 11 módulos); a Figura 1 de `pages-arq` não está no material, então os nomes dos nove módulos não puderam ser confirmados.

| Pasta em `MODULOS/` | Módulo do servidor (DAS §5.3) | Item de menu (`05`) | Grupo do inventário (`pages-inv`) |
|---|---|---|---|
| `usuarios-e-permissoes` | Acesso | Acesso | Acesso e permissões (tabelas 6 a 8) |
| `cadastros-base` | Cadastros base | Cadastros | Cadastros base (tabelas 1 a 5) |
| `triagem-e-senha` | Triagem e senha | Triagem | Triagem (tabela 9); Fila, senha e chamada (tabelas 11 e 12) |
| `fila` | Fila e chamada | Fila | Fila, senha e chamada (tabelas 10 e 11) |
| `chamada-e-alocacao` | Fila e chamada (chamada); Alocação | Chamada | Fila, senha e chamada (tabela 13); Alocação e atendimento (tabela 14) |
| `atendimento` | Atendimento | Atendimento | Alocação e atendimento (tabelas 15 e 16) |
| `encaminhamento` | Encaminhamento | Encaminh. | Alocação e atendimento (tabela 17) |
| `ausencias-e-desistencias` | Ausências | Ausências | Ausências e desistências (tabelas 18 e 19) |
| `indicadores-alertas-auditoria` | Indicadores; Alertas; Auditoria | Indicadores; Auditoria | Alertas e escalonamento (tabelas 20 e 21); Trilha de auditoria (tabela 22) |
| `acesso-publico` | — (a aplicação pública consome as operações públicas, [`api.md`](api.md) §9.12) | — | — |

## Módulos do serviço de negócio
Fonte: DAS §5.3.

O serviço é dividido em módulos que espelham os módulos do menu da aplicação operacional. Cada módulo segue a mesma divisão interna: uma camada de entrada, que trata protocolo e serialização; uma camada de serviço, onde vivem as regras; uma camada de repositório, que fala com o banco; um conjunto de definições de entrada e saída; e os eventos de domínio que o módulo emite.

| Módulo | Responsabilidade principal | Requisitos | Regras |
|---|---|---|---|
| Acesso | Autenticação, sessão, catálogo de permissões, perfis e usuários | RF-02 | — |
| Cadastros base | Paciente, estudante ou atendente, supervisor, sala e especialidade ou serviço | RF-01 | RN-06, RN-08, RN-09 |
| Triagem e senha | Ficha de triagem, emissão de senha e reclassificação de prioridade | RF-03, RF-04 | RN-01, RN-02, RN-03, RN-04 |
| Fila e chamada | Filas por especialidade, quadro por status, chamada, rechamada, cancelamento e bloqueio | RF-04, RF-05 | RN-04, RN-10 |
| Alocação | Sugestão e confirmação de estudante, supervisor e sala | RF-06 | RN-05 a RN-09 |
| Atendimento | Início, pausa, retomada, encerramento e validação do supervisor | RF-07 | RN-11 |
| Encaminhamento | Encaminhamento interno, que gera nova senha, e externo, apenas registrado | RF-08 | — |
| Ausências | Ausência automática ou manual, desistência voluntária e política de reincidência | RF-09 | RN-12, RN-13 |
| Indicadores | Agregações de tempo de espera, tempo de atendimento, volume, taxa de ausência e desistências | RF-10 | — |
| Alertas | Monitoramento de tempo de espera, geração de alerta, reconhecimento e escalonamento | RF-11 | — |
| Auditoria | Registro imutável de operação e consulta a informação sensível | RF-12 | — |

## Concorrência
### Concorrência na chamada de senha
Fonte: DAS §6.1.

É o ponto de maior risco de concorrência do sistema. Dois atendentes da mesma especialidade podem acionar a chamada da próxima senha no mesmo segundo. Sem tratamento, ambos leriam a mesma primeira senha da fila e ambos a marcariam como chamada — o paciente seria chamado duas vezes e a senha seguinte seria pulada.

A operação roda dentro de uma única transação, com bloqueio da linha selecionada e salto das linhas já bloqueadas por outra transação. A ordenação segue a precedência definida na regra de negócio: primeiro a prioridade da senha, depois o horário de chegada e, por último, a existência de agendamento prévio. Cada requisição concorrente recebe uma senha diferente, e nenhuma senha é chamada duas vezes.

A operação de chamada e a de alocação aceitam ainda uma chave de idempotência informada pela interface. Repetição da mesma chave dentro de dez minutos devolve a resposta original sem executar de novo, o que cobre duplo clique e reenvio automático após reconexão.

### Concorrência em mudança de estado
Fonte: DAS §6.2.

Toda operação que altera o estado de uma senha ou de um atendimento exige que o cliente informe a versão do registro que ele tinha em mãos. Se a versão estiver desatualizada, a operação é recusada com um código específico de conflito e o estado atual acompanha a resposta, de modo que a tela possa recarregar mostrando exatamente o que mudou. É o caso, por exemplo, de um estudante tentando encerrar um atendimento que o supervisor acabou de devolver.

## Canal de eventos em tempo real
Fonte: DAS §6.3.

O canal de eventos é dividido em três espaços independentes, com regras de autenticação distintas. A separação existe para que o espaço público seja incapaz, por construção, de transportar informação clínica.

| Espaço de eventos | Autenticação | Agrupamento | Eventos publicados |
|---|---|---|---|
| Filas | Obrigatória, com verificação de permissão | Por especialidade | Senha criada; senha chamada; status de senha alterado; senha reclassificada; fila bloqueada; fila desbloqueada; métricas da fila |
| Painel público | Nenhuma | Por unidade | Exibir chamada, contendo apenas número, especialidade, local e sequência; estado do painel no momento da conexão, para reconstruir a tela após reconexão |
| Alertas | Obrigatória, com permissão de consulta de alertas | Por unidade | Tempo de espera excedido; tempo de espera normalizado |

O espaço público não conhece identificador de paciente, prioridade clínica nem qualquer dado de saúde. Não se trata de um filtro aplicado antes do envio, e sim de um conjunto de campos que simplesmente não existe naquele caminho.

## Degradação em caso de perda de conexão
Fonte: DAS §6.4.

Toda tela que consome o canal de eventos também revalida a informação pelo canal de requisição em intervalo curto. A perda da conexão de eventos, portanto, não deixa a tela cega: ela passa a atualizar por consulta periódica. Quando a conexão cai por completo, a aplicação exibe um aviso permanente, congela as ações de escrita e mantém a leitura do último estado conhecido com indicação explícita de que a informação pode estar desatualizada. O telão mantém a última chamada visível, com uma indicação discreta da queda, porque apagar a tela de uma sala de espera é pior do que exibir informação levemente atrasada.

## Rotinas disparadas por tempo
Fonte: DAS §6.5.

| Rotina | O que faz | Regra ou requisito |
|---|---|---|
| Expiração de tolerância | Varre as senhas chamadas cujo prazo de tolerância venceu, marca ausência ou devolve à fila conforme a política da unidade, e libera os recursos alocados | RN-12, UC-16 |
| Varredura de tempo de espera | Compara o tempo de espera de cada fila ativa com o limite configurado, gera alerta quando ultrapassa e normaliza o alerta quando o tempo volta ao limite | RF-11, UC-19 |
| Cópia de segurança do banco | Executa a extração diária dos dados, com objetivo de ponto de recuperação de vinte e quatro horas e objetivo de tempo de recuperação de quatro horas | RNF-09 |

## Custo computacional
Fonte: DAS §6.6.

A plataforma de execução do servidor é orientada a entrada e saída e não lida bem com processamento pesado de processador dentro do mesmo processo que atende requisições. Por isso, os indicadores de gestão são calculados por agregação no próprio banco de dados, com funções de janela, e não montados em memória a partir de listas carregadas. A mesma preocupação sustenta a exigência de paginação obrigatória em toda listagem, sem exceção.

## Tecnologias do servidor
Fonte: DAS §10.2 (linhas de servidor, dados e apoio). Versões fixadas: "as versões são fixadas e só sobem por decisão registrada" (§10.1). As tecnologias de interface estão em [`../frontend/spec.md`](../frontend/spec.md); a tabela completa está no `AGENTS.md` da raiz.

| Camada | Tecnologia | Versão de referência | Justificativa |
|---|---|---|---|
| Linguagem | TypeScript | 5 | Tipagem estática compartilhada entre servidor e interface, permitindo que o contrato seja verificado em tempo de compilação nos dois lados |
| Serviço de negócio | NestJS | 11 | Módulos, guardas e interceptadores mapeiam diretamente o controle de acesso por permissão e a auditoria implícita |
| Mapeamento objeto-relacional | Prisma | 6 | Migrações versionadas, tipagem forte e transação interativa, esta última necessária na chamada da próxima senha |
| Banco de dados | PostgreSQL | 16 | Bloqueio de linha com salto de linhas bloqueadas, índices parciais e funções de janela para os indicadores |
| Canal de tempo real | Socket.IO | 4 | Reconexão automática e agrupamento por especialidade; adaptador externo opcional quando houver mais de uma instância do serviço |
| Agendamento de rotinas | Módulo de agendamento do NestJS | — | Expiração de tolerância e varredura de tempo de espera |
| Autenticação | Credencial de acesso e de renovação em marcador de navegador protegido | — | Sessão curta, adequada a terminal compartilhado na recepção |
| Testes | Vitest, Supertest e Playwright | — | Unidade, integração da camada de entrada e ponta a ponta, incluindo verificação automática de acessibilidade |
| Ambiente local | Docker Compose, com banco e administrador de banco | — | Ambiente idêntico para os cinco integrantes, sem instalação manual de dependência |

## Garantia técnica de cada regra de negócio
Fonte: DAS §13.2.

| Regra | Garantia técnica |
|---|---|
| RN-01 Justificativa para reclassificação | Restrição de verificação no banco sobre o tamanho mínimo, somada à validação compartilhada entre servidor e formulário |
| RN-02 Prioridade legal | Enquadramento legal registrado na triagem sinaliza automaticamente a prioridade preferencial; a etiqueta aparece no cartão da senha |
| RN-03 Urgência clínica | Restrição de verificação condicional exigindo justificativa clínica quando a prioridade é urgente |
| RN-04 Ordenação da fila | Índice composto que ordena por prioridade, horário de chegada e existência de agendamento prévio; a mesma ordenação serve à consulta do quadro e à seleção da próxima senha |
| RN-05 Disponibilidade do estudante | Índice único parcial impedindo duas alocações não liberadas para o mesmo estudante |
| RN-06 Compatibilidade do estudante | Comparação de conjuntos entre as habilitações e procedimentos do estudante e os exigidos pela especialidade |
| RN-07 Disponibilidade do supervisor | Verificação de habilitação e de turno na alocação; ausência total dispara o bloqueio da fila |
| RN-08 Limite de estudantes por supervisor | Contagem dentro da transação de alocação, com bloqueio na linha do supervisor |
| RN-09 Compatibilidade da sala | Comparação entre os recursos da sala e os recursos exigidos pela especialidade, mais índice único parcial impedindo dupla alocação |
| RN-10 Bloqueio por ausência de supervisor | Estado único de bloqueio na fila, alimentando o aviso na tela, a recusa da chamada e o alerta de gestão |
| RN-11 Validação do encerramento | Exigência copiada da especialidade no início do atendimento, com estado intermediário de pendência de validação |
| RN-12 Senha não atendida | Rotina agendada de expiração de tolerância, que marca ausência ou devolve à fila conforme a política |
| RN-13 Restrição por reincidência | Contagem de ausências dentro da janela configurada, apresentada como aviso na busca de paciente e no registro de ausência, sem bloquear a triagem |

## Riscos arquiteturais
Fonte: DAS §14.1.

| Risco | Impacto | Mitigação |
|---|---|---|
| A coordenação da clínica preferir a navegação por área de trabalho de perfil | Retrabalho concentrado no módulo de fila; os demais módulos não mudam em nenhum dos cenários | Confirmar o modelo antes do início da etapa que constrói o módulo de fila |
| Ambiente de produção indefinido | Impossibilidade de validar transporte criptografado, cópia de segurança e retenção em condições reais | Manter homologação equivalente à produção em tudo que está sob controle da equipe, e registrar como pendência os itens que dependem da instituição |
| Valores de comportamento ainda não definidos pela unidade | Sistema funcionando com números provisórios, que podem não refletir a prática da clínica | Nenhum valor está fixado em código; todos são parâmetros editáveis, com possibilidade de valor específico por especialidade |
| Volume de escrita concorrente maior que o previsto | Contenção na seleção da próxima senha na fila | A seleção já usa bloqueio de linha com salto de linhas bloqueadas, que degrada distribuindo senhas diferentes em vez de serializar as requisições |
| Equipe com uma única pessoa dominando o canal de eventos | Dependência de pessoa em uma parte crítica | Revisão cruzada obrigatória e testes de integração cobrindo os três espaços de eventos |

## Evolução prevista
Fonte: DAS §14.3.

Três caminhos de evolução estão contemplados pela arquitetura, sem exigir reestruturação. O suporte a múltiplas unidades já está no modelo de dados e no filtro de todas as consultas, restando apenas exercitá-lo. A execução do serviço em mais de uma instância depende apenas de habilitar o adaptador externo do canal de eventos. E os relatórios podem migrar para uma réplica de leitura do banco, já que são agregações e não dependem de escrita.
