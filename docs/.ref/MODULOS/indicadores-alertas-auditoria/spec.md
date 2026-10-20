# Módulo: Indicadores, Alertas e Auditoria

## Objetivo
Gerar indicadores operacionais das filas e atendimentos, monitorar SLA de tempo de espera com alertas de escalonamento, e disponibilizar a trilha de auditoria das operações do sistema.

## Requisitos Funcionais
### RF-10 | Gerenciar indicadores e consultas
O sistema deve permitir realizar consultas aos dados de atendimento e gerar indicadores relacionados às filas, incluindo tempo médio de espera, tempo médio de atendimento, quantidade de pacientes atendidos, taxa de ausência, quantidade de desistências e volume de atendimentos por especialidade e período.

### RF-11 | Gerenciar alertas de SLA e escalonamento
O sistema deve monitorar o tempo de espera por fila e gerar alerta para a gestão da unidade quando esse tempo ultrapassar o limite definido (SLA), permitindo o acionamento de medidas de escalonamento, como abertura de vaga extra ou reforço de atendentes.

### RF-12 | Consultar trilha de auditoria
O sistema deve permitir a consulta aos registros de auditoria das operações realizadas pelos usuários, incluindo identificação do usuário, operação realizada, data e horário, restringindo esse acesso a perfis autorizados.

## Casos de Uso
### UC-18 | Consultar indicadores de atendimento
**Atores:** Gestão da unidade

**Pré-condição:** Usuário autenticado com permissão de gestão.

**Fluxo Principal:**
1. Usuário acessa o menu "Indicadores".
2. Usuário seleciona o período e a especialidade desejados.
3. Sistema calcula e exibe os indicadores (tempo médio de espera, tempo médio de atendimento, taxa de ausência, volume de atendimentos).

**Fluxo de Exceção:** Não há dados suficientes no período selecionado → sistema exibe mensagem "Sem dados disponíveis".

**Pós-condição:** Indicadores exibidos conforme o filtro selecionado.

### UC-19 | Visualizar alertas de SLA
**Atores:** Gestão da unidade

**Pré-condição:** Existe fila com tempo de espera sendo monitorado pelo sistema.

**Fluxo Principal:**
1. Sistema monitora continuamente o tempo de espera das filas ativas.
2. Sistema identifica fila com tempo de espera acima do limite definido (SLA).
3. Sistema gera um alerta e notifica a gestão da unidade.
4. Usuário (gestor) visualiza o alerta no painel de gestão.

**Fluxo Alternativo:** Gestor aciona medida de escalonamento (reforço de atendente, abertura de vaga extra) a partir do alerta.

**Pós-condição:** Alerta de SLA emitido e visível à gestão da unidade.

### UC-20 | Consultar trilha de auditoria
**Atores:** Administrador do sistema / Gestão

**Pré-condição:** Usuário autenticado com permissão de auditoria.

**Fluxo Principal:**
1. Usuário acessa o menu "Auditoria".
2. Usuário aplica filtros (usuário, período, tipo de operação).
3. Sistema exibe os registros de auditoria correspondentes ao filtro.

**Fluxo de Exceção:** Nenhum registro encontrado para o filtro aplicado → sistema exibe mensagem correspondente.

**Pós-condição:** Registros de auditoria exibidos conforme o filtro selecionado.

## Entidades relacionadas
- Indicador (agregação calculada no banco, sem tabela própria — DAS §6.6)
- Alerta de SLA
- Medida de escalonamento
- Registro de Auditoria

## Dependências / Observações
- Consome dados de praticamente todos os demais módulos (fila, atendimento, ausências/desistências).
- Relaciona-se com **RNF-05** (rastreabilidade e auditoria) — ver `SPECS/requisitos-nao-funcionais.md`.
- O alerta tem duas origens: "Tempo de espera excedido" e "Fila bloqueada por ausência de supervisor" (Documento de Requisitos de Sistema §5, tabela 20; DAS §9.11).
- Toda exportação, de indicador ou de auditoria, gera ela própria um evento na trilha, inclusive a exportação da trilha (DAS §9.11).
