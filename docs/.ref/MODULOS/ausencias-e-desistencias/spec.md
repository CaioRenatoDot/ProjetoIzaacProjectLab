# Módulo: Ausências e Desistências

## Objetivo
Tratar os casos de senha chamada e não atendida (ausência/no-show) e de desistência voluntária do paciente, distinguindo os dois casos para fins de indicadores.

## Regras de Negócio
### RN-12 | Tratamento de senha não atendida
Uma senha chamada e não atendida dentro do prazo de tolerância deve retornar à fila ou ser marcada como ausência, conforme política definida pela unidade.

### RN-13 | Restrição por reincidência de ausência
A reincidência de ausências por parte de um mesmo paciente pode gerar restrição temporária ou exigência de confirmação prévia para novos agendamentos, conforme política da unidade.

## Requisitos Funcionais
### RF-09 | Gerenciar ausências e desistências
O sistema deve permitir registrar a ausência (no-show) de pacientes chamados e não atendidos dentro do prazo de tolerância, bem como registrar desistências voluntárias com o motivo informado, distinguindo-se de ausências para fins de indicadores.
**Implementa:** RN-12, RN-13.

## Casos de Uso
### UC-16 | Registrar ausência (no-show)
**Atores:** Sistema / Atendente

**Pré-condição:** Senha chamada e prazo de tolerância expirado sem comparecimento do paciente.

**Fluxo Principal:**
1. Sistema identifica que o prazo de tolerância da senha chamada expirou.
2. Sistema marca a senha com status "ausente".
3. Sistema libera os recursos alocados para o próximo atendimento da fila.
4. Sistema registra a ausência no histórico do paciente.

**Fluxo Alternativo:** Usuário marca a ausência manualmente, antes do prazo de tolerância expirar.

**Fluxo de Exceção:** Paciente atinge o número de reincidências definido em política → sistema aplica restrição temporária ou exige confirmação prévia para novos agendamentos.

**Pós-condição:** Senha marcada como ausente; recursos alocados liberados para novo atendimento.

### UC-17 | Registrar desistência voluntária
**Atores:** Atendente / Paciente

**Pré-condição:** Senha com status "aguardando" ou "em atendimento".

**Fluxo Principal:**
1. Paciente ou usuário solicita a desistência do atendimento.
2. Sistema solicita o motivo da desistência (opcional).
3. Usuário informa o motivo, caso deseje.
4. Sistema registra a desistência, distinguindo-a de uma ausência.
5. Sistema remove a senha da fila ativa.

**Pós-condição:** Senha com status "desistência"; recursos eventualmente alocados são liberados.

## Entidades relacionadas
- Senha
- Paciente
- Ausência
- Desistência

## Dependências / Observações
- Depende de `fila` e `chamada-e-alocacao` (para liberar recursos ao registrar ausência).
- Alimenta o módulo `indicadores-alertas-auditoria` (taxa de ausência, quantidade de desistências).
- Ausência e desistência são tabelas separadas porque alimentam indicadores distintos (DAS §7.2).
- Nota de divergência (D-16): a pré-condição do UC-17 cita senha com status "aguardando" ou "em atendimento", mas a máquina de estados do DAS (§7.3) também permite a desistência a partir de "Chamada" e "Aguardando recurso". O texto do caso de uso foi mantido como no documento do grupo (ver `SPECS/database/spec.md`). **Decidido no repositório:** `docs/03` §5 segue o UC-17 (só a partir de `AGUARDANDO` e `EM_ATENDIMENTO`).
