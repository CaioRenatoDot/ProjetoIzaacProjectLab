# Módulo: Cadastros Base

## Objetivo
Gerenciar o CRUD das entidades de cadastro base do sistema — Paciente, Estudante/Atendente, Supervisor, Sala e Especialidade/Serviço — garantindo que todo registro esteja disponível antes de ser referenciado pelos módulos de triagem, filas e alocação de recursos.

## Requisitos Funcionais
RF-01 consolida o CRUD das cinco entidades de cadastro base num único requisito genérico — a tabela abaixo detalha o que varia entre elas. Perfis de usuário (RF-02) ficam à parte por tratarem de permissões, não de dados operacionais.

### RF-01 | Gerenciar cadastros base
O sistema deve permitir realizar o CRUD (criar, consultar, atualizar e excluir) de cada um dos cadastros base listados na tabela abaixo, garantindo que todo registro esteja devidamente cadastrado antes de ser referenciado pelos módulos de triagem, filas e alocação de recursos.

Entidades cobertas por RF-01:

| Entidade | Dados / campos principais | Implementa |
|---|---|---|
| Paciente | Identificação, dados de contato e vínculo institucional (paciente externo, aluno ou servidor) | — |
| Estudante/Atendente | Especialidade, nível de formação, habilitações e procedimentos autorizados | RN-06 |
| Supervisor | Especialidades e procedimentos habilitados, disponibilidade por turno | — |
| Sala | Características, equipamentos e recursos disponíveis | RN-09 |
| Especialidade/Serviço | Referência para criação de filas, triagem e alocação de recursos | — |

**Implementa:** RN-06, RN-09 (derivado da tabela acima).

> Nota (D-06): o DAS (DAS §5.3 e §9.4) e a spec de interface (`especificacao/especificacao_ui.pdf`, T-03 e T-04) também associam **RN-08** (limite de estudantes por supervisor) ao cadastro de supervisor, mas a tabela acima (`especificacao/especificacao_requisitos.docx`) e a Tabela A do Documento de Requisitos de Sistema §3 só trazem RN-06 e RN-09. O texto do RF-01 segue o documento de requisitos; RN-08 fica como nota de rastreabilidade (ver Observações).

## Casos de Uso
Os UC-01 a UC-03 abaixo são genéricos e se aplicam às cinco entidades de cadastro base (Paciente, Estudante/Atendente, Supervisor, Sala, Especialidade/Serviço). O que varia entre elas — ator responsável, campos do formulário e regra de duplicidade — está na tabela ao final desta seção.

### UC-01 | Cadastrar registro base
**Atores:** Varia por entidade — ver tabela ao final da seção.

**Pré-condição:** Usuário autenticado com permissão para cadastrar a entidade correspondente.

**Fluxo Principal:**
1. Usuário acessa o menu da entidade desejada.
2. Usuário clica em "Novo [Entidade]".
3. Sistema exibe o formulário de cadastro específico da entidade (ver tabela).
4. Usuário preenche os campos obrigatórios.
5. Usuário clica em "Salvar".
6. Sistema valida os campos obrigatórios.
7. Sistema salva o novo registro.
8. Sistema exibe mensagem de sucesso e retorna à lista.

**Fluxo Alternativo:** Usuário clica em "Cancelar" a qualquer momento → sistema descarta os dados e retorna à lista.

**Fluxo de Exceção:**
- Campo obrigatório vazio → sistema exibe mensagem de erro e mantém a tela.
- Registro já cadastrado (para entidades com verificação de duplicidade) → sistema exibe mensagem de duplicidade e não salva.

**Pós-condição:** Novo registro cadastrado e disponível para uso nos módulos relacionados (triagem, filas, alocação).

### UC-02 | Editar registro base
**Atores:** Varia por entidade — mesmo ator responsável pelo cadastro (ver tabela).

**Pré-condição:** Registro já cadastrado; usuário autenticado com permissão.

**Fluxo Principal:**
1. Usuário acessa a lista da entidade.
2. Usuário seleciona o registro e clica em "Editar".
3. Sistema exibe o formulário preenchido com os dados atuais.
4. Usuário altera os campos desejados.
5. Usuário clica em "Salvar".
6. Sistema valida e atualiza o registro.
7. Sistema exibe mensagem de sucesso.

**Fluxo Alternativo:** Usuário clica em "Cancelar" → sistema descarta as alterações e retorna à lista.

**Fluxo de Exceção:** Campo obrigatório apagado → sistema exibe mensagem de erro e mantém a tela.

**Pós-condição:** Cadastro do registro atualizado.

### UC-03 | Consultar/listar registros base
**Atores:** Varia por entidade — inclui também perfis de alocação (ex.: atendente responsável pela alocação).

**Pré-condição:** Usuário autenticado com permissão de consulta.

**Fluxo Principal:**
1. Usuário acessa o menu da entidade.
2. Sistema exibe a lista paginada de registros cadastrados.
3. Usuário aplica filtro relevante à entidade (nome, especialidade, disponibilidade), se desejar.
4. Sistema exibe o resultado filtrado.

**Fluxo Alternativo:** Usuário não aplica filtro → sistema mantém a lista completa.

**Fluxo de Exceção:** Nenhum resultado encontrado para o filtro → sistema exibe mensagem correspondente.

**Pós-condição:** Lista de registros exibida conforme critério de busca.

### Variações por entidade (UC-01 a UC-03)
Fonte: Documento de Requisitos de Sistema §3, "Tabela A – Variação dos cadastros base" (reúne o que a especificação de requisitos e a especificação de funcionalidades registram sobre a variação; a mesma tabela fecha o §6, "Variações por entidade (UC-01 a UC-03)"). Transcrição sem alteração.

| Entidade | Ator | Campos | Duplicidade | Implementa |
|---|---|---|---|---|
| Paciente | Recepcionista / Atendente administrativo | Nome, contato, vínculo institucional | Sim | — |
| Estudante/Atendente | Coordenação / Secretaria acadêmica | Nome, especialidade, nível de formação, habilitações | Sim | RN-06 |
| Supervisor | Coordenação acadêmica | Nome, especialidades habilitadas, disponibilidade por turno | Não | — |
| Sala | Administração da unidade | Identificação, características, equipamentos, recursos | Não | RN-09 |
| Especialidade/Serviço | Coordenação acadêmica | Nome, descrição, exige supervisão docente (sim/não) | Sim | — |

> Nota (D-04): a lista completa de campos de cada entidade está no inventário de dados (Documento de Requisitos de Sistema §5, tabelas 1 a 5) e no modelo de dados do time ([`docs/03-modelo-de-dados.md`](../../../03-modelo-de-dados.md) §3.2). A regra de duplicidade do paciente é detalhada lá: por `documento` e por `nome_completo` + `data_nascimento`.

## Entidades relacionadas
- Paciente
- Estudante/Atendente
- Supervisor
- Sala
- Especialidade/Serviço

## Dependências / Observações
- Todos os outros módulos dependem destes cadastros (triagem, filas e alocação referenciam registros já cadastrados).
- Exclusão de registro com vínculo ativo em fila, alocação ou atendimento é recusada e a resposta sugere inativar o registro (DAS §9.4; `especificacao/especificacao_ui.pdf` T-03: "Excluir só é oferecida quando o registro não possui vínculo ativo"). Ver `SPECS/backend/api.md`.
- A verificação de duplicidade, quando existe para a entidade, devolve o identificador do registro já cadastrado, para a tela oferecer o link de abertura direta (DAS §9.4).
- Rastreabilidade (D-06): o DAS §5.3 e `especificacao/especificacao_ui.pdf` T-03/T-04 associam RN-08 ao cadastro de supervisor (limite de estudantes simultâneos), embora a tabela de RF-01 só traga RN-06 e RN-09.
- Habilitação, procedimento e recurso são tabelas de apoio (identificador e nome), não texto livre (Documento de Requisitos de Sistema §5, seção 1; `SPECS/database/spec.md`).

## Pendência
- Nenhuma. A tabela de variações por entidade, antes pendente com o autor do documento (orientação do professor), foi completada pelo próprio grupo na Tabela A do Documento de Requisitos de Sistema.
