# Módulo: Chamada e Alocação de Recursos

## Objetivo
Chamar a próxima senha da fila e alocar os recursos necessários ao atendimento: estudante/atendente, supervisor (quando exigido) e sala.

## Regras de Negócio
### RN-05 | Disponibilidade do estudante/atendente
Um estudante/atendente somente poderá ser alocado para um atendimento quando estiver disponível no turno correspondente e não possuir outro atendimento ativo simultaneamente.

### RN-06 | Compatibilidade do estudante com o atendimento
O estudante/atendente somente poderá ser alocado para atendimentos compatíveis com sua especialidade, nível de formação, habilitações e procedimentos autorizados.

### RN-07 | Disponibilidade do supervisor
Um atendimento que exija supervisão docente somente poderá ser iniciado quando existir supervisor habilitado e disponível para aquele tipo de atendimento.

### RN-08 | Limite de estudantes por supervisor
O sistema deve respeitar o limite máximo de estudantes que podem ser supervisionados simultaneamente por cada supervisor, conforme configuração da unidade, especialidade ou serviço.

### RN-09 | Compatibilidade da sala
A sala somente poderá ser atribuída ao atendimento quando estiver disponível e possuir as características, equipamentos e recursos necessários para a especialidade ou procedimento.

### RN-10 | Bloqueio de chamada por ausência de supervisor
A ausência de supervisor habilitado e disponível para uma especialidade deve impedir a chamada de novas senhas para essa especialidade até que a situação seja regularizada.

## Requisitos Funcionais
### RF-05 | Gerenciar chamadas de senha
O sistema deve permitir realizar o CRUD das chamadas de senha, possibilitando registrar, consultar, atualizar e cancelar chamadas, considerando automaticamente os critérios de prioridade, horário de chegada, tipo de atendimento e disponibilidade dos recursos necessários.
**Implementa:** RN-10.

### RF-06 | Gerenciar alocação de recursos
O sistema deve permitir realizar o CRUD das alocações de atendimento, possibilitando registrar, consultar, atualizar e remover a associação entre estudante/atendente, supervisor e sala, validando previamente a disponibilidade e compatibilidade dos recursos.
**Implementa:** RN-05, RN-06, RN-07, RN-08, RN-09.

## Casos de Uso
### UC-09 | Chamar próxima senha
**Atores:** Atendente / Recepcionista

**Pré-condição:** Existe ao menos uma senha com status "aguardando" na fila da especialidade.

**Fluxo Principal:**
1. Usuário acessa o "Painel de Filas".
2. Usuário clica em "Chamar Próxima".
3. Sistema identifica a próxima senha conforme os critérios de ordenação da fila.
4. Sistema exibe a chamada (paciente, senha) no painel público.
5. Usuário confirma a chamada.
6. Sistema atualiza o status da senha para "chamada".

**Fluxo Alternativo:** Existe senha marcada como urgência clínica → sistema a prioriza automaticamente sobre as demais.

**Fluxo de Exceção:** Paciente não comparece dentro do prazo de tolerância → sistema retorna a senha à fila ou a marca como ausente.

**Pós-condição:** Senha com status "chamada", exibida no painel público de atendimento.

> Nota (D-15): o passo 4 deste caso de uso cita "(paciente, senha)", mas a premissa P-03 de `especificacao/especificacao_ui.pdf` e o DAS (§6.3 e §9.12) limitam o painel público a número da senha, especialidade e local, e nunca nome do paciente. O texto do caso de uso foi mantido como no documento do grupo; vale a decisão posterior. **Decidido no repositório:** ADR-003, "Nota sobre o UC-09" (erro de redação; sem dado de paciente no painel).

### UC-10 | Alocar recursos ao atendimento (estudante, supervisor e sala)
**Atores:** Atendente / Sistema

**Pré-condição:** Senha com status "chamada".

**Fluxo Principal:**
1. Sistema verifica a disponibilidade e a compatibilidade do estudante/atendente com o atendimento.
2. Sistema verifica a disponibilidade do supervisor e o limite de estudantes supervisionados.
3. Sistema verifica a disponibilidade e a compatibilidade da sala.
4. Sistema associa estudante, supervisor e sala à senha.
5. Usuário confirma a alocação.
6. Sistema registra o vínculo do atendimento aos recursos alocados.

**Fluxo Alternativo:** Atendimento não exige supervisão docente → sistema não realiza a verificação de supervisor e segue para a verificação de sala.

**Fluxo de Exceção:**
- Nenhum supervisor disponível para a especialidade → sistema bloqueia novas chamadas para a especialidade e notifica a gestão.
- Nenhuma sala compatível disponível → sistema mantém a senha aguardando alocação de recurso.

**Pós-condição:** Estudante, supervisor e sala alocados e vinculados ao atendimento.

## Entidades relacionadas
- Senha
- Estudante/Atendente
- Supervisor
- Sala
- Chamada
- Alocação

## Dependências / Observações
- Depende de `fila` (para saber qual é a "próxima senha") e de `cadastros-base` (Estudante/Atendente, Supervisor, Sala).
- Alimenta o módulo `atendimento` (o início do atendimento exige recursos já alocados aqui).
- O status de senha "Aguardando recurso" (D-09) corresponde à chave "aguardando alocação" de P-01 em `especificacao/especificacao_ui.pdf` e ao termo "aguardando alocação de recurso" do UC-10. **Decidido no repositório:** enum `AGUARDANDO_RECURSO`, rótulo "Aguardando recurso" (`docs/03` §1).
- O bloqueio por ausência de supervisor (RN-10, premissa P-04) se manifesta em três lugares ao mesmo tempo — aviso permanente na fila, recusa da operação de chamada e item na lista de alertas de gestão —, todos alimentados por um único estado no servidor (DAS §3.3 e §9.6).
- A chamada e a alocação aceitam chave de idempotência: a repetição da mesma chave dentro de dez minutos devolve a resposta original sem executar de novo (DAS §6.1).
- O painel público (telão) é parte do módulo `acesso-publico`.
