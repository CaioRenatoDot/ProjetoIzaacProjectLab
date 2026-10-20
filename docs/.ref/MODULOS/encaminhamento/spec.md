# Módulo: Encaminhamento

## Objetivo
Registrar os encaminhamentos internos (para outra especialidade da clínica-escola) e externos (para fora da clínica-escola) ao final de um atendimento.

## Requisitos Funcionais
### RF-08 | Gerenciar encaminhamentos
O sistema deve permitir registrar encaminhamentos internos e externos ao final do atendimento. Encaminhamentos internos entre especialidades da clínica-escola devem gerar automaticamente uma nova entrada de fila vinculada ao atendimento original; encaminhamentos externos devem ser registrados separadamente.

## Casos de Uso
### UC-14 | Registrar encaminhamento interno
**Atores:** Estudante/Atendente / Supervisor

**Pré-condição:** Atendimento encerrado com desfecho "encaminhamento interno".

**Fluxo Principal:**
1. Usuário seleciona a especialidade de destino.
2. Sistema valida se a especialidade está ativa.
3. Usuário confirma o encaminhamento.
4. Sistema gera uma nova entrada de fila vinculada ao atendimento original.
5. Sistema registra o encaminhamento.

**Fluxo de Exceção:** Especialidade de destino inexistente ou inativa → sistema exibe mensagem de erro e impede o encaminhamento.

**Pós-condição:** Nova entrada de fila criada na especialidade de destino, vinculada ao atendimento original.

### UC-15 | Registrar encaminhamento externo
**Atores:** Estudante/Atendente / Supervisor

**Pré-condição:** Atendimento encerrado com desfecho "encaminhamento externo".

**Fluxo Principal:**
1. Usuário informa os dados do encaminhamento externo (instituição/serviço de destino, motivo).
2. Usuário confirma o registro.
3. Sistema registra o encaminhamento externo, sem gerar nova entrada de fila.

**Fluxo de Exceção:** Dados obrigatórios não preenchidos → sistema exibe mensagem de erro.

**Pós-condição:** Encaminhamento externo registrado e vinculado ao atendimento original.

## Entidades relacionadas
- Encaminhamento
- Atendimento
- Especialidade/Serviço

## Dependências / Observações
- Disparado a partir do módulo `atendimento` (UC-13, desfecho de encerramento).
- Encaminhamento interno realimenta o módulo `fila` (nova entrada vinculada ao atendimento original).
- Uma especialidade de destino com bloqueio ativo por ausência de supervisor não impede o encaminhamento: apenas informa que a chamada está suspensa naquela fila (DAS §9.9; `especificacao/especificacao_ui.pdf` T-14). Especialidade de destino inativa recusa o encaminhamento interno.
- A senha gerada no encaminhamento interno fica vinculada à senha de origem pelo campo `senhaOrigem` (Documento de Requisitos de Sistema §5, tabela 11).
