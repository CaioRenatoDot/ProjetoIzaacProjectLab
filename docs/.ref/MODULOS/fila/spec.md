# Módulo: Gestão de Fila

## Objetivo
Gerenciar as filas de atendimento por especialidade/serviço e a ordenação dos pacientes dentro delas.

## Regras de Negócio
### RN-04 | Critério de ordenação da fila
A posição do paciente na fila deve ser determinada, nesta ordem de precedência: (1) prioridade da senha, (2) horário de chegada e (3) existência de agendamento prévio.

## Requisitos Funcionais
### RF-04 | Gerenciar fila de atendimento
O sistema deve permitir realizar o CRUD das filas de atendimento por especialidade ou serviço, incluindo criação, consulta, atualização e exclusão de filas, além de permitir visualizar pacientes aguardando chamados, em atendimento e demais status aplicáveis.
**Implementa:** RN-04.

## Casos de Uso
### UC-08 | Consultar fila e posição de espera
**Atores:** Atendente / Recepcionista / Gestão / Paciente

**Pré-condição:** Usuário autenticado com permissão de consulta (equipe) ou senha emitida presente na fila (paciente).

**Fluxo Principal:**
1. Equipe acessa o "Painel de Filas" e seleciona a especialidade — ou paciente consulta a senha no sistema/painel.
2. Sistema exibe a lista de senhas aguardando, ordenada por prioridade, horário de chegada e agendamento — ou, para o paciente, calcula e exibe a posição atual e o tempo médio estimado de espera.
3. Equipe aplica filtro adicional por tipo de atendimento (primeira consulta, retorno, encaixe), se desejar.

**Fluxo de Exceção:**
- Fila vazia → sistema exibe mensagem "Nenhuma senha aguardando".
- Dados insuficientes para estimar o tempo → sistema exibe apenas a posição na fila.

**Pós-condição:** Fila e/ou posição/tempo estimado exibidos conforme o critério e o ator.

## Entidades relacionadas
- Fila
- Senha
- Especialidade/Serviço

## Dependências / Observações
- Depende de `triagem-e-senha` (a senha e sua prioridade já devem existir).
- Alimenta o módulo `chamada-e-alocacao` (a "próxima senha" chamada é definida pela ordenação aqui).
- A consulta do paciente (UC-08) é atendida pela aplicação pública, tela W-10; a consulta da equipe é atendida pelo painel de fila, tela W-08 (ver `MODULOS/acesso-publico` e `SPECS/frontend/spec.md`).
- Há uma única fila ativa por especialidade, garantida por restrição do banco (DAS §7.4).
