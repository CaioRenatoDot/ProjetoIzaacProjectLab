# Contrato de API

O contrato formal está em [`docs/api/openapi.yaml`](api/openapi.yaml) (OpenAPI 3.1). Este
documento explica as convenções que valem para todos os endpoints e que não cabem no arquivo.

**Regra do projeto:** o contrato é alterado por PR próprio, revisado pelo tech lead e pelo
back-end dono do módulo, e mergeado **antes** da implementação. Front e back partem do mesmo
arquivo; divergência é bug de quem se afastou do contrato.

## 1. Convenções gerais

| Item | Definição |
| --- | --- |
| Base URL | `https://{host}/api/v1` |
| Formato | JSON, `Content-Type: application/json; charset=utf-8` |
| Nomes de campo | `camelCase` |
| Datas | ISO-8601 com offset, sempre — `2026-09-08T08:31:00-03:00` |
| Durações | inteiro em minutos, com sufixo no nome: `tempoEsperaMinutos` |
| Identificadores | UUID v7 em string |
| Idioma | mensagens de erro em português, prontas para exibição |

### Versionamento

A versão está no caminho (`/api/v1`). Mudança compatível — campo novo opcional, endpoint novo —
não muda a versão. Mudança incompatível — remoção de campo, mudança de tipo, mudança de
semântica — exige `/api/v2` e período de convivência.

## 2. Autenticação e sessão

`POST /auth/login` devolve o access token no corpo e o refresh token em cookie `httpOnly`,
`Secure`, `SameSite=Strict`. O access token vale 15 minutos; o refresh, 8 horas — a duração de um
turno da clínica.

```
Authorization: Bearer {accessToken}
```

Conteúdo do token:

```json
{
  "sub": "uuid-do-usuario",
  "nome": "Maria Silva",
  "perfilId": "uuid-do-perfil",
  "perfilNome": "Recepção",
  "unidadeId": "uuid-da-unidade",
  "permissoes": ["fila:consultar", "fila:chamar", "senha:criar"],
  "exp": 1757336400
}
```

O front nunca decide permissão por nome de perfil — decide pela lista `permissoes`. Perfis são
editáveis pela administração (RF-02); nome de perfil no código quebraria no primeiro perfil novo.

Cinco tentativas falhas bloqueiam temporariamente (T-01). A resposta de credencial inválida é
sempre a mesma, sem distinguir usuário inexistente de senha incorreta.

### Endpoints públicos

`/publico/*` não exige autenticação e serve apenas o telão (W-09) e a consulta de senha (W-10).
Rate limit de 30 requisições por minuto por IP. Nunca devolve nome de paciente, prioridade
clínica ou dado de saúde (ADR-003).

## 3. Autorização

Cada operação exige uma permissão `modulo:operacao`. O catálogo completo vem de
`GET /permissoes` e alimenta a matriz de W-05.

| Módulo | Operações |
| --- | --- |
| `cadastros` | consultar, criar, editar, excluir |
| `perfis` | consultar, criar, editar, excluir |
| `triagem` | consultar, criar, editar, consultar_sensivel |
| `senha` | consultar, criar, reclassificar |
| `fila` | consultar, criar, editar, excluir, chamar |
| `alocacao` | consultar, criar, editar |
| `atendimento` | consultar, criar, editar, validar, consultar_sensivel |
| `encaminhamento` | consultar, criar |
| `ausencia` | consultar, criar |
| `indicadores` | consultar, exportar |
| `alertas` | consultar, reconhecer, escalonar |
| `auditoria` | consultar, exportar |

Falta de permissão retorna **403** com corpo neutro, sem revelar existência ou volume de dados
(item 3.1 da especificação de UI). Recurso inexistente sob permissão negada também retorna 403,
nunca 404 — 404 revelaria que o recurso existe.

## 4. Erros

Todos os erros seguem RFC 7807 (Problem Details), com dois campos adicionais: `codigo`, estável e
legível por máquina, e `campos`, presente em erro de validação.

```json
{
  "type": "https://api.filas.local/erros/fila-bloqueada",
  "title": "Fila bloqueada",
  "status": 409,
  "detail": "A fila de Fisioterapia está com chamadas bloqueadas por ausência de supervisor habilitado.",
  "codigo": "FILA_BLOQUEADA",
  "instance": "/api/v1/filas/018f.../chamadas"
}
```

Erro de validação:

```json
{
  "title": "Dados inválidos",
  "status": 422,
  "codigo": "VALIDACAO",
  "campos": [
    { "campo": "justificativaClinica", "mensagem": "Justificativa é obrigatória para prioridade Urgente." }
  ]
}
```

O campo `mensagem` é exibido diretamente abaixo do campo no formulário. Toda mensagem descreve a
causa e o próximo passo, nunca apenas "erro" (item 3.2 da especificação de UI).

### Códigos de erro do domínio

| Código | HTTP | Quando | Regra |
| --- | --- | --- | --- |
| `VALIDACAO` | 422 | Campo obrigatório ausente ou inválido | — |
| `DUPLICIDADE` | 409 | Registro já cadastrado; o corpo traz `recursoExistenteId` para o link de W-04 | UC-01 |
| `VINCULO_ATIVO` | 409 | Exclusão de cadastro com vínculo ativo; sugere inativar | T-03 |
| `TRANSICAO_INVALIDA` | 409 | Mudança de status não prevista na máquina de estados | P-01 |
| `VERSAO_DESATUALIZADA` | 409 | Bloqueio otimista; corpo traz o estado atual | — |
| `FILA_BLOQUEADA` | 409 | Chamada em fila sem supervisor disponível | RN-10 |
| `FILA_VAZIA` | 409 | "Chamar próxima" sem senha aguardando | UC-09 |
| `SEM_FILA_CONFIGURADA` | 409 | Emissão de senha para especialidade sem fila ativa | UC-06 |
| `JUSTIFICATIVA_OBRIGATORIA` | 422 | Reclassificação sem justificativa | RN-01 |
| `RECURSO_INDISPONIVEL` | 409 | Recurso deixou de estar disponível entre a sugestão e a confirmação | RN-05, RN-09 |
| `LIMITE_SUPERVISAO_ATINGIDO` | 409 | Supervisor no limite de estudantes simultâneos | RN-08 |
| `SUPERVISOR_INDISPONIVEL` | 409 | Nenhum supervisor habilitado; dispara bloqueio da fila | RN-07, RN-10 |
| `DESFECHO_OBRIGATORIO` | 422 | Encerramento sem desfecho | UC-13 |
| `ESPECIALIDADE_INATIVA` | 409 | Encaminhamento interno para especialidade inativa | UC-14 |
| `PACIENTE_COM_RESTRICAO` | 200 + aviso | Reincidência de ausências; **não bloqueia**, apenas avisa | RN-13 |

`PACIENTE_COM_RESTRICAO` não é erro: vem como `avisos[]` na resposta de busca de paciente, porque
a triagem é permitida (W-06).

## 5. Paginação, filtro e ordenação

```
GET /pacientes?pagina=1&tamanho=20&busca=silva&vinculo=ALUNO&ordenar=nome&direcao=asc
```

| Parâmetro | Padrão | Limite |
| --- | --- | --- |
| `pagina` | 1 | — |
| `tamanho` | 20 | 100 |
| `ordenar` | por endpoint | — |
| `direcao` | `asc` | — |

Resposta:

```json
{
  "dados": [],
  "meta": { "pagina": 1, "tamanho": 20, "total": 143, "totalPaginas": 8 }
}
```

Toda listagem é paginada, sem exceção (RNF-03).

## 6. Idempotência e concorrência

`POST /filas/{id}/chamadas` e `POST /senhas/{id}/alocacao` aceitam o header
`Idempotency-Key: {uuid}`. Repetição com a mesma chave em até 10 minutos devolve a resposta
original, sem executar de novo — cobre duplo clique e reenvio por reconexão.

Endpoints que mudam estado de senha ou atendimento exigem o campo `versao` no corpo. Versão
divergente retorna 409 `VERSAO_DESATUALIZADA` com o estado atual, e o front recarrega mostrando o
que mudou.

## 7. Eventos de tempo real

Socket.IO em três namespaces. A conexão autenticada envia o access token no `auth` do handshake.

### `/filas` — autenticado, sala `especialidade:{id}`

| Evento | Corpo | Origem |
| --- | --- | --- |
| `senha.criada` | `SenhaResumo` | UC-06 |
| `senha.chamada` | `{ senha: SenhaResumo, chamada: Chamada }` | UC-09 |
| `senha.status_alterado` | `{ senhaId, statusAnterior, status, versao }` | P-01 |
| `senha.reclassificada` | `{ senhaId, prioridade, novaPosicao }` | UC-07 |
| `fila.bloqueada` | `{ filaId, especialidade, motivo, desde }` | RN-10 |
| `fila.desbloqueada` | `{ filaId, especialidade, em }` | RN-10 |
| `fila.metricas` | `{ filaId, aguardando, emAtendimento, tempoMedioEsperaMinutos }` | W-08 |

### `/painel` — público, sala `unidade:{id}`

| Evento | Corpo |
| --- | --- |
| `chamada.exibir` | `{ numero, especialidade, local, sequencia, em }` |
| `painel.estado` | `{ atual, anteriores[] }` — enviado no connect, para reconexão |

Apenas esses campos. O namespace não conhece paciente, prioridade nem triagem (ADR-003).

### `/alertas` — autenticado com permissão `alertas:consultar`, sala `unidade:{id}`

| Evento | Corpo |
| --- | --- |
| `sla.excedido` | `Alerta` |
| `sla.normalizado` | `{ alertaId, normalizadoEm }` |

### Degradação

Toda tela que consome WebSocket também revalida por HTTP a cada 30 segundos. Perda de conexão
mostra banner persistente, congela ações de escrita e mantém a leitura do último estado com aviso
de desatualização (RNF-04). O telão mantém a última chamada visível com indicação discreta de
queda.

## 8. Cabeçalhos de auditoria

Toda requisição autenticada registra usuário, perfil no momento da ação, IP e user-agent. O front
não envia nada extra, com uma exceção: operações que exigem justificativa mandam o campo
`justificativa` no corpo, e ele é copiado para o `audit_log` (visível no detalhe de W-18).

Requisições a endpoints marcados como sensíveis geram `CONSULTAR_SENSIVEL`. São eles:
`GET /senhas/{id}` com `incluirTriagem=true`, `GET /triagens/{id}`,
`GET /atendimentos/{id}` e todas as exportações.

## 9. Saúde e observabilidade

| Endpoint | Uso |
| --- | --- |
| `GET /health` | Liveness — responde sem tocar o banco |
| `GET /health/ready` | Readiness — verifica banco e migrações aplicadas |

Toda resposta traz `X-Request-Id`, propagado para o log e para o `audit_log`, o que permite ligar
um relato de usuário a uma linha de log.
