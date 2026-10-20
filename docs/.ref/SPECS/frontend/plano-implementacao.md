# Plano de implementação: Frontend (biblioteca de componentes, aplicação operacional e aplicação pública)

> Proposta (não consta no material do grupo): ordem e recorte das etapas. O conteúdo técnico (telas, componentes, regras, seções) vem do DAS e dos documentos de interface do grupo (`especificacao/especificacao_ui.pdf`, `especificacao/wireframes_ui_v2.pdf`), com a fonte citada; a ordem espelha a do backend e o recorte em etapas é nosso. Este arquivo só planeja: **não há código, `Dockerfile` nem arquivo de composição** (fora de escopo).

Relacionados: [`spec.md`](spec.md) (decisões de interface), [`../backend/plano-implementacao.md`](../backend/plano-implementacao.md) (serviço e contratos; tem a definição de "Pronto quando" e as frentes), [`../backend/api.md`](../backend/api.md) e [`../implantacao.md`](../implantacao.md).


> **Alinhamento com o repositório:** o plano oficial do time, com partes numeradas, responsáveis e status, é [`docs/06-etapas.md`](../../../06-etapas.md); os marcos são as milestones M0 a M6 de [`docs/05-fluxo-github.md`](../../../05-fluxo-github.md) §6. Este arquivo **não substitui** esse plano: detalha, por camada, os entregáveis e os mecanismos críticos de cada etapa. Se divergir de `06-etapas.md`, vale `06-etapas.md`. Responsáveis por parte: `06-etapas.md` ("Partes por integrante") e [`docs/02-divisao-responsabilidades.md`](../../../02-divisao-responsabilidades.md).

| Etapa deste plano | Etapa de `06-etapas.md` |
|---|---|
| L0, L1 — Biblioteca de componentes | Etapa 1 (1.3 esqueleto de `packages/ui`, 1.4) e as etapas de cada tela |
| O0 — Shell, autenticação, tela inicial e menu | Etapa 3 (3.3, 3.4, 3.5) |
| O1 — Perfis e permissões | Etapa 3 (⭐ 3.6) |
| O2 — Cadastros base | Etapa 4 (4.2, 4.3) |
| O3 — Triagem e senha | Etapa 5 (5.3, 5.4) |
| O4 — Fila | Etapa 6 (6.4) |
| O5, O6 — Alocação e atendimento | Etapa 7 (7.3, 7.4) |
| O7 — Encaminhamento | Etapa 9 (⭐ 9.1) |
| O8 — Ausências e desistências | Etapa 8 (8.3) |
| O9 — Indicadores, alertas e auditoria | Etapa 9 (⭐ 9.2 a 9.4) |
| P0 a P2 — Aplicação pública | Etapa 6 (6.5) e Etapa 9 (⭐ 9.5 sinal sonoro) |

## Projetos cobertos
| Projeto | Tipo no DAS | Plano |
|---|---|---|
| Biblioteca de componentes | Pacote compartilhado (DAS §5.2) | (a) abaixo |
| Aplicação operacional | Aplicação (DAS §5.1) | (b) abaixo |
| Aplicação pública | Aplicação (DAS §5.1) | (c) abaixo |

## Formato de cada etapa
**Entregáveis** | **RF/RN/UC cobertos** | **Seções do DAS** | **Mecanismos críticos** | **Pronto quando**.

"Pronto quando" usa os itens do DAS §12.2 listados em [`../backend/plano-implementacao.md`](../backend/plano-implementacao.md). Para telas valem em especial: os quatro estados obrigatórios (carregando, vazio, erro de carga e ausência de permissão), acessibilidade verificada (navegação por teclado, rótulo visível e contraste) e revisão aprovada por alguém da outra frente. Cada etapa traz também os **testes Playwright** (ponta a ponta) e a **verificação de acessibilidade** (DAS §12.1: "Verificação automatizada das telas, integrada aos testes de ponta a ponta"). Mesmas frentes do plano do backend (sem nomes).

## Dependências
- Cada etapa de tela depende do contrato do módulo correspondente integrado no pacote de contratos (DAS §9.17). Com o contrato pronto, a tela é construída sobre uma simulação gerada a partir das próprias definições de validação; quando o servidor entrega, "a troca é de destino apenas".
- **A etapa da fila (W-08 e painel lateral) só começa depois de confirmado o modelo de navegação** com a coordenação da clínica-escola (DAS §11.2 e §14.1). Se a coordenação preferir o modelo alternativo, o impacto se concentra nesse módulo.

## (a) Biblioteca de componentes
Pacote compartilhado entre as duas aplicações, "construída sobre primitivas acessíveis" (P-02, DAS §3.3), com Tailwind CSS e primitivas Radix (DAS §10.2).

### Etapa L0 — Fundamentos
- **Entregáveis:** tokens de grid, tipografia e cores funcionais (`04` §2.1 a §2.3); configuração de estilo; infraestrutura de teste de componentes e de acessibilidade.
- **RF/RN/UC cobertos:** RNF-06.
- **Seções do DAS:** §5.2, §10.2, §3.3 (P-02); `04` §2.
- **Mecanismos críticos:** corpo nunca abaixo de 16 px em telas operacionais; todo par texto/fundo com contraste de 4.5:1 no mínimo; área de toque mínima de 44 × 44 px.
- **Pronto quando:** verificação automática de acessibilidade ligada na integração contínua.

### Etapa L1 — Componentes
- **Entregáveis (DAS §5.2 e `04` §2.4):** cartão de senha, etiqueta de status (nove status de P-01, com rótulo textual e cor apenas como reforço), etiqueta de prioridade, aviso/banner de bloqueio, cronômetro de espera, janela de confirmação e de justificativa, estado vazio; barra superior, navegação lateral colapsável, tabela com paginação e filtros persistentes, painel lateral contextual, toast.
- **RF/RN/UC cobertos:** RN-01 (janela de justificativa), RN-02 e RN-03 (etiquetas), RN-10 (banner de bloqueio), RNF-06.
- **Seções do DAS:** §5.2, §12.3; `04` P-01, P-02, §2.4, §3.
- **Mecanismos críticos:** foco preso em janela modal e navegação por teclado vindos das primitivas; ação destrutiva em botão vermelho à direita; os quatro estados de tela como componentes reutilizáveis.
- **Pronto quando:** cada componente tem teste de teclado, rótulo visível e contraste; "Urgente" e "Preferencial" recebem etiqueta textual à esquerda do número da senha.
- **Consumidores:** operacional e pública.

## (b) Aplicação operacional
Next.js 15 com React 19, roteamento por segmento espelhando a navegação por módulos (DAS §10.2), TanStack Query para estado de servidor, React Hook Form com Zod reaproveitando o pacote de contratos.

### Etapa O0 — Shell, autenticação, tela inicial e menu
- **Entregáveis:** estrutura da aplicação e shell com menu lateral fixo **filtrado por permissão**; login (W-01); sessão curta com renovação; tela inicial por perfil (W-02); os quatro estados obrigatórios; banner de perda de conexão com congelamento das ações de escrita; aviso de consulta registrada (uma vez por sessão).
- **RF/RN/UC cobertos:** RF-02, RNF-01, RNF-04, RNF-07.
- **Seções do DAS:** §5.4, §5.5, §9.2, §6.4, §12.3; `04` T-01, T-02.
- **Mecanismos críticos:** a interface nunca decide permissão por nome de perfil, e sim pela lista de permissões; ação sem permissão não é renderizada (nunca desabilitada); sem credencial persistente por padrão ("Manter conectado" desabilitado em terminal compartilhado); mensagem de credencial inválida única.
- **Pronto quando:** teste Playwright cobre login, expiração de sessão (retorna ao login preservando a rota de destino) e menu diferente por perfil; acessibilidade verificada em W-01 e W-02.
- **Contrato:** C0 e C1. **Telas:** W-01, W-02.

### Etapa O1 — Perfis e permissões
- **Entregáveis:** tela de perfis com matriz de permissões alimentada pelo catálogo (W-05); aviso de quantos usuários serão afetados antes de confirmar.
- **RF/RN/UC cobertos:** RF-02, UC-04.
- **Seções do DAS:** §9.2, §9.3, §9.14; `04` T-05. Divergência D-12 (colunas da matriz). **Decidido no repositório:** catálogo de `docs/04-contrato-api.md` §3.
- **Mecanismos críticos:** criação de perfil novo nunca exige alteração em código; configuração de perfis não é oferecida abaixo de 768 px.
- **Pronto quando:** teste Playwright cria um perfil e confirma o menu resultante.
- **Telas:** W-05.

### Etapa O2 — Cadastros base
- **Entregáveis:** lista genérica parametrizada por entidade (W-03) e formulário único de criação e edição (W-04) para as cinco entidades.
- **RF/RN/UC cobertos:** RF-01, UC-01 a UC-03, RN-06, RN-09.
- **Seções do DAS:** §9.4; `04` T-03 e T-04 (campos por entidade; ver D-04 e a pendência do autor do documento de funcionalidades).
- **Mecanismos críticos:** exclusão só oferecida sem vínculo ativo, com alternativa de inativar; link de abertura direta quando há duplicidade; campos de habilitação e procedimento em seleção múltipla com busca; tabela vira lista de cartões abaixo de 768 px.
- **Pronto quando:** teste Playwright cobre cadastrar, duplicidade, editar e tentativa de excluir com vínculo.
- **Contrato:** C2. **Telas:** W-03, W-04.

### Etapa O3 — Triagem e senha
- **Entregáveis:** busca de paciente e ficha de triagem (W-06); senha emitida e reclassificação de prioridade (W-07).
- **RF/RN/UC cobertos:** RF-03, RF-04, UC-05 a UC-07, RN-01, RN-02, RN-03, RNF-02, RNF-07.
- **Seções do DAS:** §9.5, §9.10 (aviso de reincidência), §9.15, §11.3; `04` T-06 a T-08.
- **Mecanismos críticos:** campos condicionais validados pelo mesmo esquema do servidor; modal de justificativa obrigatória; lista só com a projeção de resumo e a ficha com a projeção de detalhe (duas requisições); aviso de restrição por reincidência sem bloquear a triagem.
- **Pronto quando:** teste Playwright cobre triagem com prioridade urgente (exige justificativa clínica) e reclassificação sem justificativa (mensagem abaixo do campo).
- **Contrato:** C3. **Telas:** W-06, W-07.

### Etapa O4 — Fila (depende da confirmação do modelo de navegação)
- **Entregáveis:** painel de fila da equipe (W-08) com ação única "Chamar próxima" no topo; painel lateral contextual com as ações permitidas (reclassificar prioridade, registrar ausência, registrar desistência); cliente do canal de eventos (espaço "Filas") com revalidação periódica.
- **RF/RN/UC cobertos:** RF-04, RF-05, UC-08, UC-09, RN-04, RN-10, premissa P-04.
- **Seções do DAS:** §5.4, §6.3, §6.4, §9.6, §11.2; `04` T-09. Divergência D-05 (modelo de navegação) e nota D-27 (botão desabilitado por bloqueio, não por permissão). **Decidido no repositório:** ADR-002 (Modelo A, painel lateral só na fila).
- **Mecanismos críticos:** invalidação do cache disparada por evento; indicação de sincronização; as três manifestações do bloqueio (banner persistente, botão desabilitado com causa, alerta à gestão); chave de idempotência enviada na chamada (duplo clique).
- **Pronto quando:** teste Playwright cobre a chamada e a exibição do bloqueio; queda de conexão exibe aviso permanente e congela as escritas.
- **Contrato:** C4. **Telas:** W-08. **Bloqueio:** confirmação com a coordenação (DAS §14.2).

### Etapa O5 — Alocação
- **Entregáveis:** tela de alocação de estudante, supervisor e sala (W-11), com blocos, alternativas e motivo de inaptidão vindo do servidor.
- **RF/RN/UC cobertos:** RF-06, UC-10, RN-05 a RN-10.
- **Seções do DAS:** §9.7; `04` T-10.
- **Mecanismos críticos:** motivo do servidor, sem a interface deduzir; bloco de supervisor omitido quando a especialidade não exige; recarga das alternativas quando o recurso deixa de estar disponível; não oferecida em mobile.
- **Pronto quando:** teste Playwright cobre confirmação, recusa por recurso indisponível e senha mantida em "Aguardando recurso".
- **Contrato:** C5. **Telas:** W-11.

### Etapa O6 — Atendimento
- **Entregáveis:** atendimento em andamento (W-12), encerramento e validação do supervisor (W-13).
- **RF/RN/UC cobertos:** RF-07, UC-11 a UC-13, RN-11, RNF-07.
- **Seções do DAS:** §9.8, §6.2; `04` T-13.
- **Mecanismos críticos:** versão do registro enviada em toda mudança de estado e recarga ao receber o código de conflito; status "Pendente de validação" com o parecer do supervisor; aviso de acesso registrado ao abrir dados clínicos.
- **Pronto quando:** teste Playwright cobre iniciar, pausar, retomar, encerrar com validação e recusa.
- **Contrato:** C6. **Telas:** W-12, W-13.

### Etapa O7 — Encaminhamento
- **Entregáveis:** tela de registro de encaminhamento interno e externo (W-14), exibindo o número da nova senha gerada.
- **RF/RN/UC cobertos:** RF-08, UC-14, UC-15.
- **Seções do DAS:** §9.9; `04` T-14.
- **Mecanismos críticos:** destino com bloqueio ativo não impede o encaminhamento, só informa a suspensão da chamada; recusa por especialidade inativa.
- **Pronto quando:** teste Playwright cobre os dois tipos de encaminhamento.
- **Contrato:** C7. **Telas:** W-14.

### Etapa O8 — Ausências e desistências
- **Entregáveis:** registro de ausência (W-15) e de desistência voluntária (W-16).
- **RF/RN/UC cobertos:** RF-09, UC-16, UC-17, RN-12, RN-13.
- **Seções do DAS:** §9.10; `04` T-15.
- **Mecanismos críticos:** confirmação explícita para ausência manual antes do vencimento da tolerância, mostrando o tempo restante; modal de confirmação com o nome do registro; aviso de reincidência.
- **Pronto quando:** teste Playwright cobre ausência manual com confirmação e desistência.
- **Contrato:** C8. **Telas:** W-15, W-16.

### Etapa O9 — Indicadores, alertas e auditoria
- **Entregáveis:** painel de indicadores (W-17); alertas de SLA e trilha de auditoria (W-18); cliente do espaço de eventos "Alertas".
- **RF/RN/UC cobertos:** RF-10, RF-11, RF-12, UC-18 a UC-20, RNF-05, RNF-07.
- **Seções do DAS:** §9.11, §6.3, §8.3; `04` T-16 a T-18.
- **Mecanismos críticos:** telas de gestão não oferecidas abaixo de 768 px; reconhecimento muda a apresentação sem remover o alerta; marcação distinta das consultas sensíveis na trilha; exportação gera evento na trilha.
- **Pronto quando:** teste Playwright cobre alerta, reconhecimento, escalonamento e filtro da trilha; suíte de ponta a ponta do fluxo crítico "do acesso ao encerramento do atendimento" fechada (DAS §12.1).
- **Contrato:** C9. **Telas:** W-17, W-18.

## (c) Aplicação pública
Next.js (DAS §10.2) leve, **sem autenticação, sem menu e sem conceito clínico** (DAS §5.1). Consome só as operações públicas ([`../backend/api.md`](../backend/api.md) §9.12) e o espaço público de eventos. Não carrega o código de sessão nem a parte operacional da biblioteca de componentes.

### Etapa P0 — Base e escala tipográfica própria
- **Entregáveis:** aplicação separada no monorepo e na composição (`publica`); escala tipográfica própria para leitura a distância em tela de 42"; contraste reforçado.
- **RF/RN/UC cobertos:** RNF-06, RNF-02.
- **Seções do DAS:** §5.1, §3.1, §8.3; `04` P-02.
- **Mecanismos críticos:** contraste mínimo de 7:1; número da senha com no mínimo 96 px em tela de 42"; resolução de projeto 1920 × 1080 em paisagem.
- **Pronto quando:** verificação automática de acessibilidade com os limites reforçados; nenhum dependente de sessão no pacote da aplicação.
- **Contrato:** C0 e C4 (projeção pública).

### Etapa P1 — Telão da sala de espera (W-09)
- **Entregáveis:** chamada atual (número, especialidade, local), últimas quatro chamadas, relógio e identificação da unidade; sinal sonoro configurável; chamada anunciada por região `aria-live` assertiva.
- **RF/RN/UC cobertos:** RF-05, UC-09 (passo do painel público), RNF-06, RNF-02.
- **Seções do DAS:** §6.3 (espaço "Painel público"), §6.4, §9.12; `04` T-11. Divergência D-15 (UC-09 cita "(paciente, senha)", mas o painel mostra só número, especialidade e local). **Decidido no repositório:** ADR-003, "Nota sobre o UC-09" (erro de redação; sem dado de paciente no painel).
- **Mecanismos críticos:** o espaço público não conhece dado de paciente; reconstrução do estado do painel ao reconectar; perda de conexão mantém a última chamada visível com indicação discreta; sem animação piscante; limite de 30 requisições por minuto por origem.
- **Pronto quando:** teste Playwright simula nova chamada, rechamada e queda de conexão; teste de contrato garante que nenhum campo fora de número, especialidade, local e sequência chega à tela.
- **Telas:** W-09.

### Etapa P2 — Consulta de senha pelo paciente (W-10)
- **Entregáveis:** campo de consulta pelo número da senha; resultado conforme a T-12 de `04` (número, especialidade, posição, tempo médio estimado e status), sujeito à pendência D-31; atualização automática.
- **RF/RN/UC cobertos:** RF-04, UC-08, RNF-06.
- **Seções do DAS:** §8.3, §9.12; `04` T-12. Divergência D-31: o resultado acima segue a T-12 (`04`), mas o DAS §9.15 limita a projeção pública a número, especialidade e local; **pendência** do grupo antes de implementar esta etapa (ver `../backend/api.md` §9.15). **Decidido no repositório:** `openapi.yaml` separa telão (número, especialidade, local) e consulta do paciente (`GET /publico/senhas/{numero}`: número, especialidade, status, posição, tempo estimado, local). Ver `SPECS/backend/api.md`.
- **Mecanismos críticos:** senha inexistente ou de outro dia mostra mensagem neutra; dados insuficientes mostram só a posição; prioridade para celular, texto ampliável sem quebra de layout, corpo mínimo de 18 px e alvos de toque ampliados.
- **Pronto quando:** teste Playwright em viewport de celular cobre senha válida, inexistente, já chamada, ausente e desistente.
- **Telas:** W-10.
