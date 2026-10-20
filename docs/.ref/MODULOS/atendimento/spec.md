# Módulo: Atendimento

## Objetivo
Gerenciar o ciclo de vida do atendimento em si: início, pausa, retomada e encerramento, incluindo a validação do encerramento pelo supervisor quando exigida pelo protocolo.

## Regras de Negócio
### RN-11 | Validação do encerramento pelo supervisor
O encerramento do atendimento deve ser validado pelo supervisor docente responsável sempre que essa validação for exigida pelo protocolo do serviço correspondente.

## Requisitos Funcionais
### RF-07 | Gerenciar atendimentos
O sistema deve permitir realizar o CRUD dos registros de atendimento, possibilitando criar, consultar, atualizar e excluir registros conforme as permissões do usuário, além de permitir registrar o início, pausa, retomada, encaminhamento e encerramento do atendimento.
**Implementa:** RN-11.

## Casos de Uso
### UC-11 | Iniciar atendimento
**Atores:** Estudante/Atendente

**Pré-condição:** Recursos (estudante, supervisor, sala) alocados à senha.

**Fluxo Principal:**
1. Usuário acessa a senha alocada.
2. Usuário clica em "Iniciar Atendimento".
3. Sistema registra o horário de início.
4. Sistema atualiza o status para "em atendimento".

**Fluxo de Exceção:** Recurso alocado não está mais disponível no momento do início → sistema impede o início e solicita nova alocação.

**Pós-condição:** Atendimento em andamento, com horário de início registrado.

### UC-12 | Pausar / retomar atendimento
**Atores:** Estudante/Atendente

**Pré-condição:** Atendimento em andamento (para pausar) ou pausado (para retomar).

**Fluxo Principal:**
1. Pausar: usuário clica em "Pausar Atendimento".
2. Sistema solicita o motivo da pausa; usuário informa.
3. Sistema registra a pausa e o horário, atualizando o status para "pausado".
4. Retomar: usuário acessa o atendimento pausado e clica em "Retomar".
5. Sistema registra o horário de retomada e atualiza o status para "em atendimento".

**Fluxo de Exceção:**
- Motivo não informado, quando exigido pelo protocolo → sistema impede a confirmação da pausa.
- Sala ou estudante originalmente alocados não estão mais disponíveis na retomada → sistema solicita nova alocação de recurso.

**Pós-condição:** Atendimento pausado (com motivo registrado) ou retomado (status "em atendimento"), conforme a ação.

### UC-13 | Encerrar atendimento
**Atores:** Estudante/Atendente / Supervisor

**Pré-condição:** Atendimento com status "em atendimento".

**Fluxo Principal:**
1. Usuário clica em "Encerrar Atendimento".
2. Sistema solicita o registro do desfecho (alta, retorno agendado, encaminhamento interno ou externo).
3. Usuário informa o desfecho.
4. Sistema verifica se o protocolo do serviço exige validação do supervisor.
5. Supervisor valida o encerramento, quando exigido.
6. Sistema registra o horário de encerramento.
7. Sistema atualiza o status para "encerrado".

**Fluxo Alternativo:** Protocolo do serviço não exige validação de supervisor → sistema conclui o encerramento sem a etapa de validação.

**Fluxo de Exceção:** Supervisor não valida ou recusa o encerramento → sistema mantém o atendimento com status "pendente de validação".

**Pós-condição:** Atendimento encerrado (ou pendente de validação do supervisor), com desfecho registrado.

## Entidades relacionadas
- Atendimento
- Senha
- Supervisor
- Pausa de atendimento
- Alocação

## Dependências / Observações
- Depende de `chamada-e-alocacao` (recursos já alocados).
- O desfecho definido no encerramento (UC-13) dispara o módulo `encaminhamento`.
- A exigência de validação do supervisor é copiada da especialidade para o atendimento no momento em que ele começa; a recusa da validação não devolve o atendimento ao estado anterior, que permanece "pendente de validação" com o parecer do supervisor registrado (DAS §9.8).
- Cada pausa é uma linha por ocorrência; o tempo efetivo de atendimento desconta a soma das pausas nos indicadores (DAS §7.2).
