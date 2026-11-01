# Spec: Frontend

> **Neste repositório:** as decisões de interface que valem para o time estão em [`docs/adr/ADR-002-modelo-de-navegacao.md`](../../../adr/ADR-002-modelo-de-navegacao.md) (Modelo A, painel lateral só na fila), [`docs/adr/ADR-003-separacao-dado-sensivel.md`](../../../adr/ADR-003-separacao-dado-sensivel.md), [`docs/01-arquitetura.md`](../../../01-arquitetura.md) §1, §2 e §4.1, no Apêndice A do Documento de Requisitos de Sistema e em `especificacao/especificacao_ui.pdf` e `especificacao/wireframes_ui_v2.pdf`. Responsáveis por tela: [`docs/02-divisao-responsabilidades.md`](../../../02-divisao-responsabilidades.md). Código em `apps/web` (porta 3000), `apps/publico` (porta 3001) e `packages/ui`.

> Este arquivo é o espelho de `../backend/spec.md` para a camada de interface (orientação do professor: os specs de arquitetura podem ser tanto de backend quanto de frontend). Ainda é só documentação: não há código. Trechos dos documentos do grupo (DAS, `especificacao/especificacao_ui.pdf`, `especificacao/wireframes_ui_v2.pdf`) estão copiados sem alteração, com a fonte citada; as ligaduras tipográficas do PDF (por exemplo "ﬁ") foram normalizadas. O que é proposta nossa está marcado.

## Papel deste documento
Consolidar, do ponto de vista da interface, quais módulos de negócio (`MODULOS/`), quais telas e quais requisitos não funcionais (`../requisitos-nao-funcionais.md`) impactam as duas aplicações de interface.

Documentos relacionados:
- [`plano-implementacao.md`](plano-implementacao.md) — planejamento da implementação das aplicações e da biblioteca de componentes (proposta).
- [`../backend/spec.md`](../backend/spec.md) e [`../backend/api.md`](../backend/api.md) — o contrato que as telas consomem.
- [`../implantacao.md`](../implantacao.md) — Docker e ambientes.

## Aplicações de interface
Fonte: DAS §5.1.

O sistema é composto por três aplicações executáveis e um conjunto de pacotes compartilhados entre elas. As duas de interface são:

| Aplicação | Responsabilidade | Telas atendidas |
|---|---|---|
| Aplicação operacional | Toda a operação autenticada da clínica: acesso, cadastros, triagem, fila, alocação, atendimento, encaminhamento, ausências, indicadores e auditoria. | W-01 a W-08 e W-11 a W-18 |
| Aplicação pública | Telão da sala de espera e consulta da própria senha pelo paciente. Não tem autenticação, não tem menu e não conhece nenhum conceito clínico. | W-09 e W-10 |

### Por que a aplicação pública é separada
O telão e a consulta do paciente exibem apenas número da senha, especialidade e local. Mantê-los dentro da aplicação autenticada significaria levar até um terminal instalado na sala de espera o código de sessão, os interceptadores de autenticação e a biblioteca de componentes operacional — tudo material que não tem função ali e que amplia a superfície por onde dado sensível poderia escapar.

A separação tem ainda um benefício de acessibilidade: a aplicação pública usa uma escala tipográfica própria, dimensionada para leitura a distância em tela de 42 polegadas, sem que isso contamine a aplicação operacional, que precisa de densidade de informação.

### Pacotes compartilhados
Fonte: DAS §5.2.

| Pacote | Conteúdo | Quem consome |
|---|---|---|
| Contratos | Tipos e regras de validação derivados da especificação da interface de programação, escritos uma única vez | Serviço de negócio, aplicação operacional e aplicação pública |
| Biblioteca de componentes | Componentes visuais acessíveis: cartão de senha, etiqueta de status, etiqueta de prioridade, aviso de bloqueio, cronômetro, janela de confirmação e de justificativa, estado vazio | Aplicação operacional e aplicação pública |
| Padrões de código | Configuração de análise estática e bases de configuração da linguagem | Todas |

O pacote de contratos é o ponto mais importante da organização interna. Como a definição de validação nasce nele e é usada tanto pela camada de entrada do servidor quanto pelo formulário da interface, deixa de existir a divergência de validação entre cliente e servidor — que é a origem mais comum de defeito em formulário com campo condicional, exatamente o caso da ficha de triagem e da janela de reclassificação de prioridade.

## Decisão de navegação
Fontes: DAS §11.2 e §5.4.

### Navegação por módulos, com painel lateral apenas na fila (DAS §11.2)
Os dois documentos de interface divergiam entre si, e a divergência estava declarada no próprio material. A especificação em texto descrevia uma navegação por área de trabalho de perfil, com painel lateral conduzindo todo o ciclo de atendimento sem troca de tela. Os wireframes na versão 2, mais recentes, mantinham a navegação por módulos e afirmavam explicitamente que a especificação deveria ser atualizada nesse ponto.

Foi adotada a navegação por módulos, por ser a definição do artefato mais recente e por ser a que orienta a atualização do outro. Um único elemento do modelo alternativo foi preservado: dentro do módulo de fila, o detalhe de uma senha abre painel lateral contextual com as ações permitidas ao perfil. Ações com formulário longo permanecem como telas próprias.

A área de trabalho por perfil não foi perdida: virou filtragem do menu por permissão, somada a uma tela inicial cujo conteúdo muda por perfil. O comportamento observado pelo usuário é próximo, sem o custo de manter seis layouts distintos.

Esta decisão tem pendência: confirmar o modelo com a coordenação da clínica-escola antes do início da etapa que constrói o módulo de fila. Se a coordenação preferir o modelo alternativo, o impacto se concentra nesse módulo, e os demais não mudam.

### Organização da aplicação operacional (DAS §5.4)
A navegação é por módulos: um menu lateral fixo lista os módulos disponíveis, e cada módulo tem tela própria. O menu é filtrado por permissão, de modo que o usuário só vê os módulos a que seu perfil tem acesso. A tela inicial muda de conteúdo conforme o perfil — indicadores, lista principal e ação em destaque variam —, o que reproduz o efeito de uma área de trabalho por perfil sem exigir a manutenção de seis layouts distintos.

Um único elemento do modelo alternativo de navegação foi preservado: dentro do módulo de fila, a ação de detalhe de uma senha abre um painel lateral contextual com as ações permitidas ao perfil, como reclassificar prioridade, registrar ausência ou registrar desistência. Ações que envolvem formulário longo — alocação, atendimento e encaminhamento — permanecem como telas próprias, porque um painel lateral não comporta a densidade delas sem prejudicar o uso por teclado.

### Regra de visibilidade de ação (DAS §5.5)
Ação para a qual o usuário não tem permissão não é renderizada. Nunca é renderizada em estado desabilitado, porque um botão desabilitado informa que a funcionalidade existe e que outra pessoa poderia usá-la, o que já é uma revelação. O estado de ausência de permissão usa mensagem neutra, sem indicar existência ou volume de dados por trás dela.

> Nota de divergência (D-05): `especificacao/especificacao_ui.pdf` declara como aprovado o "Modelo D — Híbrido" (workspace por perfil na entrada) e traz na seção 4 o "Mapa de navegação por workspace"; `especificacao/wireframes_ui_v2.pdf` (versão 2) afirma que "prevalece aqui o Modelo A, e a especificação deve ser atualizada nesse ponto"; o DAS §11.2 adota a navegação por módulos com painel lateral só na fila, pendente de confirmação com a coordenação. Esta spec segue o DAS §11.2. A seção 4 de `04` está **superada** por essa decisão e não foi copiada aqui. A atualização da seção de navegação de `04` é pendência registrada (DAS §14.2). **Decidido no repositório:** ADR-002 (Modelo A, painel lateral só na fila).

> Nota (D-27): `04` P-04 item 2 pede o botão "Chamar Próxima" **desabilitado** com a causa informada, e o DAS §5.5 proíbe o botão desabilitado por falta de permissão. Não é conflito: o bloqueio da fila por ausência de supervisor (RN-10) é uma condição do estado da fila, e não falta de permissão do usuário. Sem permissão de chamar, o botão não é renderizado; com permissão e fila bloqueada, aparece desabilitado com tooltip e texto acessível.

> Nota (D-28): `04` T-01 traz o campo "Manter conectado" como "Desabilitado em terminais compartilhados", e o DAS §3.2 traz "ausência de credencial persistente por padrão" nos terminais compartilhados da recepção. Os dois são consistentes.

## Premissas P-01 a P-04
Fonte: `especificacao/especificacao_ui.pdf` §1 (seção 1, "Premissas e decisões transversais"). As quatro decisões levantadas antes da aprovação foram resolvidas conforme abaixo. Estão marcadas como premissas por dependerem de validação final da unidade.

### P-01 | Nomenclatura e sinalização de status da senha
Oito status, com rótulo textual sempre presente. Cor é reforço, nunca o único portador de significado (exigência de RNF-06).

| Status | Rótulo na UI | Cor de apoio | Ícone | Ocorre a partir de |
|---|---|---|---|---|
| aguardando | Aguardando | Cinza-azulado | Relógio | UC-06 |
| chamada | Chamada | Azul | Alto-falante | UC-09 |
| aguardando alocação | Aguardando recurso | Âmbar | Ampulheta | UC-10 (exceção) |
| em atendimento | Em atendimento | Verde | Círculo preenchido | UC-11 |
| pausado | Pausado | Âmbar | Pausa | UC-12 |
| pendente de validação | Pendente de validação | Roxo | Escudo | UC-13 (exceção) |
| encerrado | Encerrado | Cinza | Verificação | UC-13 |
| ausente | Ausente | Vermelho | X | UC-16 |
| desistência | Desistência | Cinza escuro | Seta de saída | UC-17 |

> Nota: no PDF as células das linhas "em atendimento", "pausado" e "pendente de validação" saíram fora de ordem na extração. A tabela acima foi remontada pela ordem de aparição das cores (Verde, Âmbar, Roxo), dos ícones (Círculo preenchido, Pausa, Escudo) e dos casos de uso (UC-11, UC-12, UC-13 (exceção)). [posição reconstruída; confirmar no PDF original]

> Nota de divergência (D-08, P-05): o texto de P-01 diz "Oito status", mas a tabela lista **nove**. O mesmo ocorre no DAS §3.3 e §7.3, e a tabela 11 do inventário (Documento de Requisitos de Sistema §5) também lista nove. Aqui são documentados os nove. Pendência: o autor da especificação de interface corrige a contagem. **Decidido no repositório:** nove status (`docs/03-modelo-de-dados.md` §1).

> Nota de divergência (D-09): a chave de status em `04` é "aguardando alocação", com rótulo "Aguardando recurso"; o DAS e o inventário de dados usam "Aguardando recurso". O UC-10 diz "aguardando alocação de recurso". Nas specs técnicas usa-se "Aguardando recurso". **Decidido no repositório:** enum `AGUARDANDO_RECURSO`, rótulo "Aguardando recurso" (`docs/03` §1).

Prioridade é atributo separado do status e nunca compartilha a mesma cor. São três níveis: Urgente (RN-03), Preferencial (RN-02) e Normal. Urgente e Preferencial recebem etiqueta textual à esquerda do número da senha.

### P-02 | Nível de acessibilidade alvo
WCAG 2.1 nível AA para todo o sistema. Para o painel público (T-11) e a consulta do paciente (T-12), requisitos adicionais: contraste mínimo 7:1, corpo de texto do número da senha com no mínimo 96 px em tela de 42", navegação completa por teclado, rótulos ARIA em regiões dinâmicas e anúncio sonoro configurável a cada nova chamada.

### P-03 | Exibição de dados de triagem em listas
Dados de saúde e motivo do atendimento não aparecem em listas, painéis ou no painel público. Listas exibem apenas número da senha, iniciais ou nome parcial do paciente, especialidade, prioridade, status e horário. O conteúdo clínico é acessível apenas na ficha individual, mediante perfil autorizado, e cada abertura gera registro de auditoria (RNF-02, RNF-05, RNF-07).

O painel público exibe exclusivamente número da senha, especialidade e local de atendimento. Nunca nome completo.

> Nota de divergência (D-31): `especificacao/especificacao_ui.pdf` T-12 (consulta do paciente, W-10) mostra "número, especialidade, posição atual, tempo médio estimado e status", mas o DAS §9.15 define a projeção pública como "Número, especialidade e local", "um tipo que não tem os demais campos"; a operação "Consultar posição de uma senha" (DAS §9.12) também não cabe nessa projeção. Nenhum dos dois foi alterado. Pendência: o grupo define se a consulta pública usa uma quarta variante de projeção ou se a projeção pública ganha posição e status. **Decidido no repositório:** `openapi.yaml` separa telão (número, especialidade, local) e consulta do paciente (`GET /publico/senhas/{numero}`: número, especialidade, status, posição, tempo estimado, local). Ver `SPECS/backend/api.md`.

### P-04 | Manifestação do bloqueio por ausência de supervisor (RN-10)
Combinação de três elementos, e não apenas um botão desabilitado:

1. Banner persistente no topo da fila afetada, com texto explicativo e nome da especialidade bloqueada.
2. Botão "Chamar Próxima" desabilitado, com tooltip e texto acessível informando a causa.
3. Notificação automática à gestão da unidade, visível em T-17.

O bloqueio é por especialidade, não global. Demais filas seguem operando normalmente.

## Fundamentos visuais
Fonte: `especificacao/especificacao_ui.pdf` §2.

### 2.1 Grid e layout
Grid de 12 colunas, largura máxima de conteúdo 1440 px, calha de 24 px. Espaçamento em múltiplos de 8 px. Área de toque mínima de 44 × 44 px em qualquer alvo interativo.

### 2.2 Tipografia
Fonte sem serifa de alta legibilidade. Escala: corpo 16 px, secundário 14 px, rótulo 13 px, título de seção 20 px, título de página 28 px. Corpo nunca abaixo de 16 px em telas operacionais, dado o perfil de usuários previsto em RNF-06. Painéis públicos usam escala própria, definida em T-11.

### 2.3 Cores funcionais
Além das cores de status de P-01: primária de ação, superfície neutra, superfície elevada, borda, texto primário, texto secundário, e as quatro semânticas (sucesso, alerta, erro, informação). Todo par texto/fundo respeita 4.5:1 no mínimo.

### 2.4 Componentes compartilhados
Barra superior com identificação da unidade, seletor de contexto de perfil e menu do usuário. Navegação lateral colapsável. Cartão de senha. Etiqueta de status. Etiqueta de prioridade. Tabela com paginação e filtros persistentes. Painel lateral contextual (drawer). Modal de confirmação. Modal de justificativa. Notificação transitória (toast). Banner de bloqueio. Cronômetro de espera. Estado vazio ilustrado.

## Padrões globais de comportamento
Fonte: `especificacao/especificacao_ui.pdf` §3.1 a §3.5, mais DAS §12.3.

### 3.1 Estados obrigatórios de toda tela
Toda tela de listagem ou consulta especifica quatro estados além do estado padrão: carregando (esqueleto de conteúdo, nunca spinner isolado em tabelas), vazio (ícone, frase explicativa e ação primária quando aplicável), erro de carga (mensagem e botão "Tentar novamente") e sem permissão (mensagem neutra, sem revelar existência ou volume de dados — exigência de RNF-01).

Complemento do DAS §12.3: "Toda tela de listagem ou consulta especifica quatro estados além do estado normal: carregando, apresentado como esqueleto do conteúdo e nunca como indicador isolado em tabela; vazio, com ícone, frase explicativa e ação primária quando aplicável; erro de carga, com mensagem e opção de nova tentativa; e ausência de permissão, com mensagem neutra que não revela existência nem volume de dados."

### 3.2 Padrão de mensagens
Validação de campo aparece abaixo do campo, em vermelho, com ícone, e o campo recebe borda de erro e aria-invalid. O foco vai para o primeiro campo inválido. Mensagens de sistema aparecem como toast de 5 segundos, exceto erros irreversíveis, que exigem descarte manual. Toda mensagem descreve a causa e o próximo passo, nunca apenas "erro".

### 3.3 Confirmação e destrutividade
Exclusão de cadastro base, cancelamento de chamada e registro de ausência manual exigem modal de confirmação com nome do registro afetado. Reclassificação de prioridade exige modal de justificativa com campo obrigatório (RN-01). Ações destrutivas usam botão vermelho, sempre à direita, com o botão neutro à esquerda.

### 3.4 Auditoria implícita
Toda tela que exibe ou altera dado sensível registra a operação em segundo plano. A UI não confirma esse registro ao usuário, mas as telas que abrem prontuário ou triagem exibem, uma única vez por sessão, um aviso discreto de que consultas são registradas (RNF-07).

### 3.5 Responsividade
Três breakpoints: ≥1280 px (operacional completo), 768–1279 px (navegação colapsada, painel lateral vira tela cheia), <768 px (somente consulta e ações simples; alocação de recursos e configuração de perfis não são oferecidas em mobile). O painel público tem tratamento próprio.

### Visibilidade de ação
Ver "Regra de visibilidade de ação (DAS §5.5)" acima: ação sem permissão não é renderizada, nunca desabilitada.

## Mapa de telas
> Proposta (não consta no material do grupo): tabela de correspondência entre as duas séries de telas (W, dos wireframes versão 2; T, da especificação de interface em texto), os casos de uso, os requisitos funcionais e o módulo. Fontes: DAS §13.1, `especificacao/especificacao_ui.pdf` §6.1 e títulos de `especificacao/wireframes_ui_v2.pdf`. Onde a correspondência W ↔ T vem apenas da semelhança de título (W-01, W-02), está marcado com "(por título)".

Divergência D-18: a numeração de telas convive em duas séries (T-01..T-18 em `04`, W-01..W-18 em `05`). O DAS §1.3 usa a série W, por ser a mais recente. Divergência D-17: `05` diz "20 telas" na capa, mas lista W-01 a W-18, e o DAS §1.2 diz "dezoito telas".

| Tela (W) | Título (`05`) | Tela (T) | Casos de uso | RF | Módulo (`MODULOS/`) | Aplicação |
|---|---|---|---|---|---|---|
| W-01 | Login | T-01 (por título) | — (RNF-01) | — (RNF-01) | `usuarios-e-permissoes` | operacional |
| W-02 | Tela inicial por perfil | T-02 (por título) | — (RNF-01) | RF-02 | `usuarios-e-permissoes` | operacional |
| W-03 | Lista de registros (genérica) | T-03 | UC-03 | RF-01 | `cadastros-base` | operacional |
| W-04 | Formulário de cadastro e edição | T-04 | UC-01, UC-02 | RF-01 | `cadastros-base` | operacional |
| W-05 | Perfis de usuário e permissões | T-05 | UC-04 | RF-02 | `usuarios-e-permissoes` | operacional |
| W-06 | Buscar paciente e registrar triagem | T-06 | UC-05 | RF-03 | `triagem-e-senha` | operacional |
| W-07 | Senha emitida e reclassificação de prioridade | T-07, T-08 | UC-06, UC-07 | RF-03, RF-04 (D-07) | `triagem-e-senha` | operacional |
| W-08 | Painel de fila (equipe) | T-09 | UC-08, UC-09 | RF-04, RF-05 | `fila`, `chamada-e-alocacao` | operacional |
| W-09 | Telão público da sala de espera | T-11 | UC-09 | RF-05 | `acesso-publico` (chamada em `chamada-e-alocacao`) | pública |
| W-10 | Consulta de senha pelo paciente | T-12 | UC-08 | RF-04 | `acesso-publico` (consulta em `fila`) | pública |
| W-11 | Alocação de recursos ao atendimento | T-10 | UC-10 | RF-06 | `chamada-e-alocacao` | operacional |
| W-12 | Atendimento em andamento | T-13 | UC-11 a UC-13 | RF-07 | `atendimento` | operacional |
| W-13 | Encerramento e validação do supervisor | T-13 | UC-11 a UC-13 | RF-07 | `atendimento` | operacional |
| W-14 | Registrar encaminhamento | T-14 | UC-14, UC-15 | RF-08 | `encaminhamento` | operacional |
| W-15 | Registrar ausência (no-show) | T-15 | UC-16 | RF-09 | `ausencias-e-desistencias` | operacional |
| W-16 | Registrar desistência voluntária | T-15 | UC-17 | RF-09 | `ausencias-e-desistencias` | operacional |
| W-17 | Painel de indicadores | T-16 | UC-18 | RF-10 | `indicadores-alertas-auditoria` | operacional |
| W-18 | Alertas de SLA e trilha de auditoria | T-17, T-18 | UC-19, UC-20 | RF-11, RF-12 | `indicadores-alertas-auditoria` | operacional |

## Detalhamento por tela
O detalhamento de cada tela fica nos documentos do grupo e **não é copiado aqui**:
- `especificacao/especificacao_ui.pdf` §5 (T-01 a T-18): objetivo, perfis, estrutura, campos, ações, validações, estados, responsivo, acessibilidade e rastreabilidade.
- `especificacao/wireframes_ui_v2.pdf` (W-01 a W-18): wireframes de baixa fidelidade.
- Matriz de rastreabilidade: `especificacao/especificacao_ui.pdf` §6 (casos de uso → telas; regras de negócio → pontos de interface).

Como `04` e `05` valem juntos quando não conflitam (precedência em `../../README.md`), apenas a tabela abaixo é copiada, por ser a fonte de campos da UI de cadastros.

### T-04 | Campos por entidade
Fonte: `especificacao/especificacao_ui.pdf` T-04, "Campos por entidade".

| Entidade | Campos | Verificação de duplicidade |
|---|---|---|
| Paciente | Nome, documento, contato, vínculo institucional (externo / aluno / servidor) | Sim |
| Estudante/Atendente | Nome, especialidade, nível de formação, habilitações, procedimentos autorizados, disponibilidade por turno | Sim [posição incerta na extração] |
| Supervisor | Nome, especialidades habilitadas, procedimentos habilitados, disponibilidade por turno, limite de estudantes simultâneos | Não [posição incerta na extração] |
| Sala | Identificação, características, equipamentos, recursos, situação | Não [posição incerta na extração] |
| Especialidade/Serviço | Nome, descrição, exige supervisão docente (sim/não), exige validação de encerramento (sim/não), política de tolerância | Sim [posição incerta na extração] |

> Nota: no PDF a coluna "Verificação de duplicidade" saiu solta na extração (valores na ordem Sim, Sim, Não, Não, Sim). A ordem sugere a atribuição acima, mas não é certa; por isso estes valores **não** foram usados para preencher a tabela de variações por entidade do UC-01 a UC-03 em `MODULOS/cadastros-base/spec.md`.

> Nota de divergência (D-04): a lista de campos de T-04 é mais longa que a tabela "Variações por entidade" de Documento de Requisitos de Sistema §6 (por exemplo, Paciente com "documento"; Supervisor com "limite de estudantes simultâneos"; Especialidade com "exige validação de encerramento" e "política de tolerância"). O autor do documento de funcionalidades decide qual lista vale (ver `MODULOS/cadastros-base/spec.md`).

## Terminais e clientes
Fonte: DAS §8.3.

| Cliente | Uso | Requisito específico |
|---|---|---|
| Estação da recepção e da triagem | Operação completa | Sessão curta, por ser terminal compartilhado; sem credencial persistente por padrão |
| Terminal do telão | Somente exibição, sem interação | Tela de 42 polegadas em orientação paisagem, projetada para resolução de 1920 por 1080 |
| Celular do paciente | Consulta da própria senha | Texto ampliável sem quebra de layout e alvos de toque ampliados |
| Estação de gestão | Indicadores, alertas e auditoria | Telas de gestão não são oferecidas abaixo de 768 pixels de largura |

## Tempo real e perda de conexão
Fontes: DAS §6.3 e §6.4. A tabela completa dos três espaços de eventos está em [`../backend/spec.md`](../backend/spec.md); aqui, os dois espaços que a interface consome.

| Espaço de eventos | Autenticação | Agrupamento | Eventos publicados |
|---|---|---|---|
| Filas | Obrigatória, com verificação de permissão | Por especialidade | Senha criada; senha chamada; status de senha alterado; senha reclassificada; fila bloqueada; fila desbloqueada; métricas da fila |
| Painel público | Nenhuma | Por unidade | Exibir chamada, contendo apenas número, especialidade, local e sequência; estado do painel no momento da conexão, para reconstruir a tela após reconexão |

O espaço público não conhece identificador de paciente, prioridade clínica nem qualquer dado de saúde. Não se trata de um filtro aplicado antes do envio, e sim de um conjunto de campos que simplesmente não existe naquele caminho.

Toda tela que consome o canal de eventos também revalida a informação pelo canal de requisição em intervalo curto. A perda da conexão de eventos, portanto, não deixa a tela cega: ela passa a atualizar por consulta periódica. Quando a conexão cai por completo, a aplicação exibe um aviso permanente, congela as ações de escrita e mantém a leitura do último estado conhecido com indicação explícita de que a informação pode estar desatualizada. O telão mantém a última chamada visível, com uma indicação discreta da queda, porque apagar a tela de uma sala de espera é pior do que exibir informação levemente atrasada.

## Tecnologias de interface
Fonte: DAS §10.2 (linhas de interface). "As versões são fixadas e só sobem por decisão registrada" (§10.1).

| Camada | Tecnologia | Versão de referência | Justificativa |
|---|---|---|---|
| Linguagem | TypeScript | 5 | Tipagem estática compartilhada entre servidor e interface, permitindo que o contrato seja verificado em tempo de compilação nos dois lados |
| Interface de usuário | Next.js com React | 15 e 19 | Renderização no servidor reduz o volume de código enviado a terminais modestos da clínica; o roteamento por segmento espelha diretamente a navegação por módulos adotada |
| Estado de servidor na interface | TanStack Query | 5 | Cache, revalidação por intervalo e invalidação disparada por evento do canal de tempo real, exatamente o comportamento exigido pelo painel de fila |
| Formulários | React Hook Form com Zod | — | Validação idêntica no cliente e no servidor, reaproveitando as definições do pacote de contratos |
| Estilo e componentes | Tailwind CSS com primitivas Radix | 4 | As primitivas entregam foco preso em janela modal, atributos de acessibilidade corretos e navegação por teclado, tudo exigido pelo requisito de acessibilidade, sem reimplementação própria |
| Testes | Vitest, Supertest e Playwright | — | Unidade, integração da camada de entrada e ponta a ponta, incluindo verificação automática de acessibilidade |

## RNF e decisões de interface
Fontes: `especificacao/especificacao_ui.pdf` §6.3 e DAS §10.4.

| RNF | Decisão correspondente (`04` §6.3) |
|---|---|
| RNF-01 | Workspaces por perfil; ação sem permissão não é exibida; estado "sem permissão" neutro |
| RNF-02 | P-03: dado clínico fora de listas e do painel público |
| RNF-03 | T-09: atualização automática com indicação de sincronização |
| RNF-04 | Banner de perda de conexão com congelamento de escrita e leitura preservada |
| RNF-05 | Item 3.4: auditoria implícita em todas as telas sensíveis |
| RNF-06 | P-02: WCAG AA no sistema, contraste 7:1 e escala ampliada em T-11 e T-12 |
| RNF-07 | Aviso de consulta registrada em T-06 e T-13; marcação distinta em T-18 |
| RNF-08 | T-09: visão consolidada multiespecialidade e filtro por unidade |
| RNF-09 | Sem manifestação direta de interface |

> Nota: a linha RNF-01 de `04` ("Workspaces por perfil") reflete o Modelo D, superado nesse ponto (ver "Decisão de navegação" acima); as demais linhas não foram alteradas.

Atendimento técnico de cada RNF (DAS §10.4): ver [`../requisitos-nao-funcionais.md`](../requisitos-nao-funcionais.md). Linhas com efeito direto na interface:
- RNF-01: "ação sem permissão não é renderizada na interface; resposta de negação neutra".
- RNF-04: "aviso de perda de conexão com congelamento das ações de escrita".
- RNF-06: "Biblioteca de componentes sobre primitivas acessíveis; conformidade com o nível AA no sistema e contraste reforçado nas telas públicas; verificação automática na integração contínua".
- RNF-07: "aviso de registro exibido uma vez por sessão nas telas que abrem prontuário".
