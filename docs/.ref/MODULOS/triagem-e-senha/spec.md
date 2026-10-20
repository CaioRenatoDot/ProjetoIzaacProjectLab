# Módulo: Triagem e Emissão de Senha

## Objetivo
Registrar a triagem inicial do paciente, definir a prioridade do atendimento e emitir a senha que o posicionará na fila da especialidade/serviço adequado.

## Regras de Negócio
### RN-01 | Justificativa para reclassificação de prioridade
Alterações na classificação de prioridade de uma senha já emitida somente poderão ser realizadas mediante registro de justificativa, permitindo rastrear o motivo da reclassificação (ex.: agravamento identificado após a triagem).

### RN-02 | Prioridade legal
Pacientes enquadrados em prioridade legal (idosos, gestantes, lactantes, pessoas com deficiência, entre outros previstos em norma) devem ter posição preferencial nas filas de atendimento, conforme legislação aplicável.

### RN-03 | Urgência clínica
Casos de urgência clínica identificados na triagem poderão furar a fila padrão, desde que respeitado protocolo específico e registrado o critério clínico que motivou a priorização.

## Requisitos Funcionais
### RF-03 | Gerenciar triagem
O sistema deve permitir registrar a triagem inicial do paciente, coletando o motivo do atendimento e as informações mínimas necessárias para direcionamento à especialidade ou serviço adequado, tratando dados de saúde como informação sensível, com acesso restrito a perfis autorizados.
**Implementa:** RN-01, RN-02, RN-03.

## Casos de Uso
### UC-05 | Realizar triagem do paciente
**Atores:** Profissional de triagem

**Pré-condição:** Paciente cadastrado no sistema; usuário autenticado.

**Fluxo Principal:**
1. Usuário busca o paciente no sistema.
2. Sistema exibe os dados do paciente.
3. Usuário seleciona "Nova Triagem".
4. Sistema exibe o formulário de triagem (motivo do atendimento, especialidade de destino).
5. Usuário preenche o motivo do atendimento e demais dados solicitados.
6. Usuário classifica a prioridade do atendimento.
7. Usuário clica em "Concluir Triagem".
8. Sistema valida os dados obrigatórios.
9. Sistema registra a triagem, tratando os dados de saúde como informação sensível.
10. Sistema encaminha o paciente para emissão de senha.

**Fluxo Alternativo:**
- Paciente enquadrado em prioridade legal (idoso, gestante, PcD) → sistema sinaliza automaticamente a prioridade preferencial.
- Triagem identifica urgência clínica → usuário registra a justificativa e o sistema marca a senha como urgente.

**Fluxo de Exceção:** Campo obrigatório não preenchido → sistema exibe mensagem de erro e mantém a tela.

**Pós-condição:** Triagem registrada e disponível para emissão de senha.

### UC-06 | Emitir senha
**Atores:** Profissional de triagem / Sistema

**Pré-condição:** Triagem concluída para o paciente.

**Fluxo Principal:**
1. Sistema exibe o resumo da triagem realizada.
2. Usuário confirma a emissão da senha.
3. Sistema gera a senha, vinculando-a à especialidade e à classificação de prioridade definida na triagem.
4. Sistema posiciona a senha na fila conforme os critérios de ordenação.
5. Sistema exibe a senha gerada ao usuário/paciente.

**Fluxo Alternativo:** Usuário ajusta o tipo de atendimento (primeira consulta, retorno, encaixe) antes de confirmar a emissão.

**Fluxo de Exceção:** Especialidade sem fila configurada → sistema exibe erro e impede a emissão da senha.

**Pós-condição:** Senha emitida com status "aguardando" e inserida na fila correspondente.

### UC-07 | Reclassificar prioridade de senha
**Atores:** Profissional de triagem / Supervisor

**Pré-condição:** Senha emitida e ainda não atendida.

**Fluxo Principal:**
1. Usuário acessa a senha na fila.
2. Usuário seleciona "Reclassificar Prioridade".
3. Sistema solicita o registro de uma justificativa.
4. Usuário informa a justificativa e a nova classificação de prioridade.
5. Usuário confirma a alteração.
6. Sistema atualiza a posição da senha na fila.
7. Sistema registra a alteração para fins de auditoria.

**Fluxo de Exceção:** Usuário não informa justificativa → sistema impede a confirmação da reclassificação.

**Pós-condição:** Senha reposicionada na fila com a nova prioridade e justificativa registradas.

## Entidades relacionadas
- Paciente
- Triagem
- Senha
- Reclassificação de prioridade

## Dependências / Observações
- Depende de `cadastros-base` (Paciente, Especialidade/Serviço) já existirem.
- Alimenta diretamente o módulo `fila` (RN-04 usa a prioridade definida aqui como 1º critério de ordenação).
- Dados de saúde tratados aqui exigem controle de acesso do módulo `usuarios-e-permissoes` (RNF-01/RNF-02).
- Rastreabilidade (D-07): o DAS (DAS §5.3, §9.5 e §13.1) associa UC-06 e UC-07 também a RF-04 (módulo "Triagem e senha": RF-03, RF-04), enquanto `especificacao/especificacao_ui.pdf` (T-08) associa UC-07 a RF-03. O texto dos requisitos acima não muda.
- A senha tem três projeções (pública, resumo e detalhe); dado de saúde e motivo do atendimento ficam fora de listas, painéis e telão, e só a projeção de detalhe registra evento de consulta a informação sensível (P-03; DAS §9.15). Ver `SPECS/backend/api.md`.
- A reincidência de ausências é um aviso na resposta da busca de paciente e não bloqueia a triagem (DAS §9.10).
