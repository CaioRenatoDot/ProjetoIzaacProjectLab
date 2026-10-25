# Modelo de Dados

Base para o schema Prisma. Nomes de tabela em `snake_case`, campos do domínio em português,
identificadores em UUID v7.

## 1. Enums

```
StatusSenha      AGUARDANDO | CHAMADA | AGUARDANDO_RECURSO | EM_ATENDIMENTO | PAUSADO
                 | PENDENTE_VALIDACAO | ENCERRADO | AUSENTE | DESISTENCIA
Prioridade       NORMAL | PREFERENCIAL | URGENTE
TipoAtendimento  PRIMEIRA_CONSULTA | RETORNO | ENCAIXE
Desfecho         ALTA | RETORNO_AGENDADO | ENCAMINHAMENTO_INTERNO | ENCAMINHAMENTO_EXTERNO
VinculoPaciente  EXTERNO | ALUNO | SERVIDOR
EnquadramentoLegal  IDOSO | GESTANTE | LACTANTE | PCD | OUTRO_PREVISTO_EM_NORMA
Turno            MANHA | TARDE | NOITE
TipoEncaminhamento  INTERNO | EXTERNO
OrigemDesistencia   PACIENTE | EQUIPE
TipoAlerta       SLA_EXCEDIDO | FILA_BLOQUEADA
StatusAlerta     ATIVO | RECONHECIDO | NORMALIZADO
OperacaoAuditoria  CRIAR | EDITAR | EXCLUIR | CONSULTAR_SENSIVEL | EXPORTAR | LOGIN | LOGOUT
```

Os nove status de senha seguem a Tabela 11 (ID07) do Documento de Requisitos. A premissa P-01
fala em "oito situações", mas a própria tabela lista nove; prevalece a tabela. Os rótulos vêm da P-01. O rótulo textual está sempre
presente na UI; cor é reforço, nunca o único portador de significado (RNF-06).

## 2. Diagrama de relacionamentos

```
                          ┌──────────────┐
                          │   unidade    │
                          └──────┬───────┘
                                 │
     ┌───────────────────────────┼────────────────────────────┐
     │                           │                            │
┌────▼─────┐              ┌──────▼──────┐             ┌───────▼────────┐
│ usuario  │──perfil─────▶│    perfil   │             │ especialidade  │
└────┬─────┘              └──────┬──────┘             └───────┬────────┘
     │                           │                            │
     │                    ┌──────▼──────────┐          ┌──────▼──────┐
     │                    │ perfil_permissao│          │    fila     │
     │                    └─────────────────┘          └──────┬──────┘
     │                                                        │
┌────▼──────┐   ┌──────────┐   ┌────────┐   ┌──────────┐      │
│ audit_log │   │ paciente │   │ sala   │   │supervisor│      │
└───────────┘   └────┬─────┘   └───┬────┘   └────┬─────┘      │
                     │             │             │            │
                ┌────▼─────┐       │        ┌────▼─────┐      │
                │ triagem  │       │        │estudante │      │
                └────┬─────┘       │        └────┬─────┘      │
                     │             │             │            │
                ┌────▼─────────────┴─────────────┴────────────▼──┐
                │                    senha                       │
                └────┬──────────────┬──────────────┬─────────────┘
                     │              │              │
              ┌──────▼─────┐ ┌──────▼──────┐ ┌─────▼──────────┐
              │  chamada   │ │  alocacao   │ │  atendimento   │
              └────────────┘ └─────────────┘ └───────┬────────┘
                                                     │
                                       ┌─────────────┴──────────┐
                                       │                        │
                                ┌──────▼──────┐        ┌────────▼────────┐
                                │encaminhamento│        │ pausa_atendimento│
                                └─────────────┘        └─────────────────┘
```

## 3. Entidades

### 3.1 Acesso e configuração

**unidade** — clínica-escola. Existe desde o início para atender RNF-08 (múltiplas unidades) sem
migração futura. `id`, `nome`, `ativo`.

**parametro_unidade** — os cinco valores da seção 7 da especificação de UI.
`id`, `unidade_id`, `especialidade_id?`, `chave`, `valor`, `atualizado_por`, `atualizado_em`.
Chaves: `tolerancia_minutos`, `sla_minutos`, `reincidencias_restricao`, `janela_reincidencia_dias`,
`limite_estudantes_supervisor`, `justificativa_min_caracteres`.
Parâmetro com `especialidade_id` preenchido sobrepõe o da unidade.

**usuario** — `id`, `nome`, `identificacao` (matrícula ou e-mail, único), `senha_hash` (argon2id),
`perfil_id`, `unidade_id`, `ativo`, `tentativas_falhas`, `bloqueado_ate`, `ultimo_login_em`.

**perfil** — `id`, `nome` (único), `descricao`, `sistema` (boolean, perfil do sistema não é
editável nem excluível — T-05). Exclusão bloqueada quando há usuário vinculado.

**perfil_permissao** — `perfil_id`, `permissao` (string `modulo:operacao`). Chave primária
composta. O catálogo de permissões é constante no código e exposto por `GET /permissoes`.

**sessao** — uma por login, para renovar e revogar o refresh token (`docs/04` §2). `id`,
`usuario_id`, `token_hash` (SHA-256 do segredo do refresh; o segredo nunca é gravado),
`hash_anterior?` (aceito por 30 segundos depois da rotação), `rotacionada_em?`, `expira_em`
(login + 8 h), `manter_conectado` (cookie de refresh persistente ou de sessão), `revogada_em?`, `motivo_revogacao?` (`LOGOUT` | `REUSO` | `USUARIO_INATIVADO` |
`SENHA_REDEFINIDA`), `criado_em`.

**audit_log** — append-only (RNF-05). `id`, `usuario_id`, `perfil_nome_no_momento`, `operacao`,
`modulo`, `entidade`, `entidade_id`, `justificativa?`, `origem_ip`, `user_agent`, `sensivel`
(boolean), `ocorrido_em`. Índices em `(ocorrido_em)`, `(usuario_id, ocorrido_em)` e
`(entidade, entidade_id)`. Sem UPDATE e sem DELETE, garantido por grant do banco.

### 3.2 Cadastros base (RF-01)

**paciente** — `id`, `nome_completo`, `documento`, `data_nascimento`, `contato_telefone`, `contato_email`,
`vinculo` (VinculoPaciente), `unidade_id`, `restricao_ativa` (boolean, RN-13),
`restricao_ate?`, `ativo`. Duplicidade verificada por `documento` e por `nome_completo` +
`data_nascimento`. Campo derivado `iniciais` calculado no servidor para listas (ADR-003).

**estudante** — `id`, `nome`, `especialidade_id`, `nivel_formacao`, `ativo`.

- **estudante_habilitacao** — `estudante_id`, `habilitacao_id` (RN-06)
- **estudante_procedimento** — `estudante_id`, `procedimento_id` (RN-06)
- **estudante_disponibilidade** — `estudante_id`, `dia_semana`, `turno` (RN-05)

**supervisor** — `id`, `nome`, `limite_estudantes_simultaneos` (inteiro positivo, RN-08), `ativo`.

- **supervisor_especialidade** — `supervisor_id`, `especialidade_id` (RN-07)
- **supervisor_procedimento** — `supervisor_id`, `procedimento_id`
- **supervisor_disponibilidade** — `supervisor_id`, `dia_semana`, `turno` (RN-07)

**sala** — `id`, `identificacao`, `unidade_id`, `caracteristicas`, `situacao`, `ativo`.

- **sala_recurso** — `sala_id`, `recurso_id` (RN-09)

**especialidade** — `id`, `nome` (único), `descricao`, `exige_supervisao_docente` (RN-07),
`exige_validacao_encerramento` (RN-11), `unidade_id`, `ativo`.

- **especialidade_procedimento_requisito** — `especialidade_id`, `recurso_id` — recursos que a
  sala precisa ter para atender a especialidade (RN-09)

**habilitacao**, **procedimento**, **recurso** — tabelas de apoio, `id` + `nome`. Existem porque
RN-06 e RN-09 comparam conjuntos; texto livre tornaria a verificação de compatibilidade
impossível de fazer com confiança.

### 3.3 Fila e senha

**fila** — `id`, `especialidade_id`, `unidade_id`, `nome`, `letra_senha` (letra do número da
senha, ex.: F de F014), `ativa`, `bloqueada` (boolean, RN-10),
`bloqueada_motivo?`, `bloqueada_desde?`, `sla_minutos?` (sobrepõe o parâmetro da unidade).
Uma fila ativa por especialidade e unidade — restrição única parcial.

**triagem** — `id`, `paciente_id`, `profissional_id`, `especialidade_destino_id`,
`tipo_atendimento`, `prioridade`, **`motivo`** (sensível), `enquadramento_legal?`
(EnquadramentoLegal, valor único conforme Tabela 9 ID07; preenchido torna a prioridade PREFERENCIAL — RN-02),
**`justificativa_clinica?`** (obrigatória quando prioridade URGENTE, RN-03),
**`observacoes?`** (sensível), `concluida_em`, `criado_em`.
Os três campos em negrito só saem da API em `SenhaDetalhe` (ADR-003).

**senha** — agregado central.
`id`, `numero` (ex.: F014, único por dia/especialidade), `fila_id`, `triagem_id`, `paciente_id`,
`prioridade`, `tipo_atendimento`, `status` (StatusSenha), `tem_agendamento_previo` (boolean,
terceiro critério de RN-04), `chegada_em`, `chamada_em?`, `tolerancia_ate?`, `iniciada_em?`,
`encerrada_em?`, `senha_origem_id?` (encaminhamento interno, RF-08), `versao` (bloqueio otimista),
`criado_em`.

Índice de ordenação — implementa RN-04 diretamente:

```sql
CREATE INDEX idx_senha_ordem ON senha (fila_id, status, prioridade DESC, chegada_em ASC, tem_agendamento_previo DESC);
```

**reclassificacao_prioridade** — `id`, `senha_id`, `de_prioridade`, `para_prioridade`,
`justificativa` (obrigatória, RN-01), `usuario_id`, `ocorrido_em`. Histórico exibido em W-07.

**chamada** — `id`, `senha_id`, `usuario_id`, `local_exibicao`, `sequencia` (1 = primeira,
2+ = rechamadas), `chamado_em`. Alimenta o telão (W-09) e a lista de tolerância (W-15).

### 3.4 Alocação e atendimento

**alocacao** — `id`, `senha_id`, `estudante_id`, `supervisor_id?`, `sala_id`, `confirmada_em`,
`confirmada_por`, `liberada_em?`. Supervisor nulo apenas quando a especialidade não exige
supervisão docente (RN-07). Restrição única parcial garante que estudante e sala não
tenham duas alocações não liberadas ao mesmo tempo — é a RN-05 e a RN-09 no nível do banco, não só
no service. O supervisor fica de fora: acompanha vários estudantes até o limite da RN-08.

**atendimento** — `id`, `senha_id` (único), `alocacao_id`, `iniciado_em`, `encerrado_em?`,
`desfecho?`, `observacoes?` (sensível), `validacao_exigida` (copiado da especialidade no início,
para que mudança posterior no cadastro não altere atendimento em curso), `validado_por?`,
`validado_em?`, `parecer_supervisor?`, `versao`.

**pausa_atendimento** — `id`, `atendimento_id`, `motivo?`, `pausado_em`, `retomado_em?`,
`pausado_por`. Uma linha por pausa; o tempo efetivo de atendimento desconta a soma das pausas nos
indicadores (RF-10).

**encaminhamento** — `id`, `atendimento_id`, `tipo` (TipoEncaminhamento),
`especialidade_destino_id?` (interno), `instituicao_destino?` (externo), `motivo`,
`prioridade_sugerida?`, `senha_gerada_id?` (interno gera nova entrada de fila — RF-08),
`observacoes?`, `criado_em`, `criado_por`.

### 3.5 Ausência, desistência e alertas

**ausencia** — `id`, `senha_id`, `automatica` (boolean — expiração de tolerância, RN-12),
`observacao?`, `registrado_por?`, `registrado_em`.

**desistencia** — `id`, `senha_id`, `origem` (OrigemDesistencia), `motivo?`, `registrado_por`,
`registrado_em`. Tabela separada de `ausencia` porque os dois alimentam indicadores distintos
(W-16, RF-10).

**alerta** — `id`, `tipo` (TipoAlerta), `fila_id`, `unidade_id`, `status` (StatusAlerta),
`tempo_espera_minutos?`, `limite_minutos?`, `senhas_afetadas?`, `disparado_em`,
`reconhecido_por?`, `reconhecido_em?`, `normalizado_em?`.

**escalonamento** — `id`, `alerta_id`, `acao` (`REFORCO_ATENDENTE` | `VAGA_EXTRA`),
`observacao?`, `acionado_por`, `acionado_em`. Registra autor e horário, como exige T-17.

**contador_senha** — `fila_id`, `dia` (data no fuso da unidade), `ultimo`. Chave primária
(`fila_id`, `dia`). A emissão faz `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` na mesma
transação que cria a senha, o que serializa emissões simultâneas na mesma fila. A partir da
milésima senha do dia o número segue com quatro dígitos (F1000).

### 3.6 Idempotência

**chave_idempotencia** — `usuario_id`, `chave` (UUID do header `Idempotency-Key`), `operacao`
(método e rota), `status_http`, `resposta` (JSON), `criado_em`. Chave primária
(`usuario_id`, `chave`). Guarda a resposta original por 10 minutos para a chamada e a alocação
(`docs/04` §6); linhas mais antigas podem ser apagadas por rotina.

## 4. Invariantes garantidas no banco

Regra que depende só do service quebra quando alguém esquece uma chamada. Estas são garantidas
por restrição:

| Invariante                                 | Mecanismo                                                                                                                                            | Regra  |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Uma senha por atendimento                  | `UNIQUE (senha_id)` em `atendimento`                                                                                                                 | RF-07  |
| Estudante sem duas alocações ativas        | índice único parcial `WHERE liberada_em IS NULL`                                                                                                     | RN-05  |
| Sala sem duas alocações ativas             | índice único parcial `WHERE liberada_em IS NULL`                                                                                                     | RN-09  |
| Justificativa presente na reclassificação  | `CHECK (length(trim(justificativa)) > 0)`; o tamanho mínimo é validado no service pelo parâmetro `justificativa_min_caracteres`, editável (Tabela 8) | RN-01  |
| Justificativa clínica presente em urgência | `CHECK (prioridade <> 'URGENTE' OR length(trim(justificativa_clinica)) > 0)`                                                                         | RN-03  |
| Limite de estudantes por supervisor        | verificado no service, dentro da transação de alocação                                                                                               | RN-08  |
| Auditoria imutável                         | `REVOKE UPDATE, DELETE ON audit_log`                                                                                                                 | RNF-05 |
| Uma fila ativa por especialidade           | índice único parcial `WHERE ativa`                                                                                                                   | RF-04  |
| Número da senha único por fila e dia       | índice único `(fila_id, numero, (chegada_em AT TIME ZONE 'America/Sao_Paulo')::date)`                                                                | UC-06  |

O limite de supervisor (RN-08) e o tamanho mínimo da justificativa (RN-01) não viram restrição
declarativa, porque dependem de contagem ou de parâmetro editável da unidade. O limite fica dentro da
mesma transação que cria a alocação, com bloqueio na linha do supervisor.

Os CHECKs da RN-01 e da RN-03 repetem uma validação que o service já faz. Se algum deles disparar,
o filtro de erros responde 422 `VALIDACAO` com o campo (`common/errors/restricoes-banco.ts`), e não 500.

## 5. Máquina de estados da senha (P-01)

```
                         ┌──────────────┐
      desistência ◀──────│  AGUARDANDO  │◀──── retorno à fila por tolerância (UC-09, RN-12)
       (UC-17)           └──────┬───────┘
                                │ chamar (UC-09, RN-04)
                         ┌──────▼───────┐
                         │   CHAMADA    │──── tolerância expira ou marcação manual ───▶ AUSENTE (UC-16)
                         └──────┬───────┘
                                │ alocar (UC-10)
              sem sala compatível│
        ┌───────────────────────┤
┌───────▼────────────┐          │
│ AGUARDANDO_RECURSO │──alocar──┤
└────────────────────┘          │
                                │ iniciar (UC-11)
                         ┌──────▼─────────┐  pausar (UC-12)   ┌──────────┐
      desistência ◀──────│ EM_ATENDIMENTO │──────────────────▶│ PAUSADO  │
       (UC-17)           │                │◀──────────────────│          │
                         └──────┬─────────┘  retomar (UC-12)  └──────────┘
                                │ encerrar com desfecho (UC-13)
                ┌───────────────┴────────────────┐
                │ exige validação                │ não exige validação
      ┌─────────▼──────────┐   supervisor   ┌────▼────────┐
      │ PENDENTE_VALIDACAO │───── valida ──▶│  ENCERRADO  │
      └─────────┬──────────┘    (RN-11)     └─────────────┘
                │ recusa
                └──▶ permanece PENDENTE_VALIDACAO, com parecer registrado (RN-11)
```

**DESISTENCIA** é alcançável somente a partir de **AGUARDANDO** e **EM_ATENDIMENTO**, conforme a
pré-condição do UC-17 no Documento de Requisitos. Em qualquer outro status, a desistência retorna
`409 TRANSICAO_INVALIDA`. Um paciente já chamado que não comparece sai como AUSENTE, pelo prazo de
tolerância (UC-16).

Transições não previstas retornam `409 Conflito` com `codigo: TRANSICAO_INVALIDA`. A máquina fica
em um único módulo do back-end e tem teste de unidade cobrindo cada aresta e cada transição
proibida.

Implementação: `apps/api/src/senhas/maquina/` (`TRANSICOES` e `MaquinaSenha.transicionar`).
Toda transição confere a `versao`, incrementa a versão e grava os horários na mesma transação de
quem chama; o evento `senha.status_alterado` sai depois do commit. Um teste reprova qualquer outro
arquivo que grave `status` em `senha`. Leitura do diagrama adotada:

- **Alocar não muda o status.** A senha CHAMADA alocada continua CHAMADA até iniciar; a senha em
  AGUARDANDO_RECURSO alocada vai direto para EM_ATENDIMENTO ao iniciar.
- **Retorno à fila por tolerância** (CHAMADA → AGUARDANDO) limpa `chamada_em` e `tolerancia_ate`
  e mantém a `chegada_em` original: o paciente volta à posição que tinha pela RN-04.
- **Horários:** chamar grava `chamada_em` e `tolerancia_ate` (parâmetro `tolerancia_minutos`);
  iniciar grava `iniciada_em` (retomar a pausa não); ENCERRADO, AUSENTE e DESISTENCIA gravam
  `encerrada_em`. PENDENTE_VALIDACAO ainda não encerra.

## 6. Retenção e LGPD (RNF-07)

| Dado                     | Retenção                         | Observação                                                                  |
| ------------------------ | -------------------------------- | --------------------------------------------------------------------------- |
| Triagem e atendimento    | conforme política da instituição | Base legal e prazo a confirmar com a coordenação                            |
| `audit_log`              | mínimo 5 anos                    | Nunca apagado por rotina automática                                         |
| Senha, chamada, alocação | 2 anos                           | Após o prazo, anonimizar `paciente_id` mantendo o agregado para indicadores |
| Dados de indicador       | indefinido                       | Já agregados, sem identificação individual                                  |

A anonimização substitui o vínculo com o paciente por um identificador irreversível, preservando
os indicadores de RF-10 sem manter dado pessoal além do necessário. O prazo exato depende de
definição da instituição e está registrado como pendência no backlog.
