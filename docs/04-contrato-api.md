# Contrato de API

O contrato formal está em [`docs/api/openapi.yaml`](api/openapi.yaml) (OpenAPI 3.1). Este
documento explica as convenções que valem para todos os endpoints e que não cabem no arquivo.

**Regra do projeto:** o contrato é alterado por PR próprio, revisado pelo tech lead e pelo
back-end dono do módulo, e mergeado **antes** da implementação. Front e back partem do mesmo
arquivo; divergência é bug de quem se afastou do contrato.

## 1. Convenções gerais

| Item            | Definição                                                    |
| --------------- | ------------------------------------------------------------ |
| Base URL        | `https://{host}/api/v1`                                      |
| Formato         | JSON, `Content-Type: application/json; charset=utf-8`        |
| Nomes de campo  | `camelCase`                                                  |
| Datas           | ISO-8601 com offset, sempre — `2026-09-08T08:31:00-03:00`    |
| Durações        | inteiro em minutos, com sufixo no nome: `tempoEsperaMinutos` |
| Identificadores | UUID v7 em string                                            |
| Idioma          | mensagens de erro em português, prontas para exibição        |

### Versionamento

A versão está no caminho (`/api/v1`). Mudança compatível — campo novo opcional, endpoint novo —
não muda a versão. Mudança incompatível — remoção de campo, mudança de tipo, mudança de
semântica — exige `/api/v2` e período de convivência.

## 2. Autenticação e sessão

`POST /auth/login` devolve o access token no corpo e o refresh token no cookie `filas_refresh`
(`HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth`). O access token vale 15 minutos; a
sessão, 8 horas contadas do login — a duração de um turno da clínica. A renovação não estende
esse prazo.

- **Rotação:** cada `POST /auth/refresh` troca o refresh token. Um refresh já trocado,
  reapresentado depois de 30 segundos, é tratado como roubo e revoga a sessão (a janela de 30
  segundos cobre duas abas renovando ao mesmo tempo).
- **`manterConectado`:** `false` grava o cookie de sessão (some ao fechar o navegador); `true`,
  um cookie persistente até o fim das 8 horas.
- **Logout:** usa só o cookie, funciona com o access token expirado e responde sempre 204.
- **Revogação:** logout, reuso de refresh, inativação do usuário e redefinição de senha encerram
  a sessão na hora, porque cada requisição confere a sessão no banco (§3).

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

Cinco tentativas falhas seguidas bloqueiam novos logins por 15 minutos (T-01): a quinta já
responde `401 BLOQUEIO_TEMPORARIO`, com `minutosRestantes` no corpo. Sessões abertas continuam,
para que tentativas erradas de terceiros não derrubem quem está trabalhando. A resposta de
credencial inválida é sempre a mesma para usuário inexistente, senha incorreta e conta inativa.

### Endpoints públicos

`/publico/*` não exige autenticação e serve apenas o telão (W-09) e a consulta de senha (W-10).
Rate limit de 30 requisições por minuto por IP. Nunca devolve nome de paciente, prioridade
clínica ou dado de saúde (ADR-003).

O limite é compartilhado pelos dois endpoints de `/publico/*`. A requisição que exceder o
limite recebe `429 LIMITE_REQUISICOES` em RFC 7807 e `Retry-After` em segundos.
O IP deve vir da conexão; cabeçalhos encaminhados só são aceitos de proxies explicitamente
confiáveis, para que `X-Forwarded-For` não permita contornar o limite.

`EstadoPainelPublico` e `ConsultaSenhaPublica`, em `@filas/contracts`, são projeções próprias
que recusam campos extras. O telão HTTP devolve `atual`, até quatro `anteriores` e `servidorEm`;
cada chamada contém só número, especialidade e local. A consulta devolve número,
especialidade, status, posição, estimativa e local, com `orientacao` opcional, conforme o OpenAPI.
Senha inexistente ou de outro dia recebe o mesmo `404 SENHA_NAO_ENCONTRADA` neutro.
Quando o número corresponde a mais de uma senha no dia, a resposta é o mesmo 404 neutro,
sem escolher arbitrariamente uma fila ou unidade.

Para a #20, o responsável aprovou a estimativa pela média entre chegada e primeira chamada
das senhas da mesma fila no dia, com amostra mínima de 10 senhas chamadas. Rechamadas não
contam novamente. Abaixo desse mínimo, `tempoEstimadoMinutos` é `null`. A média não é
multiplicada pela posição. A origem e as decisões estão em `entregas/GH-20-aceite.md`.

## 3. Autorização

Cada operação exige uma permissão `modulo:operacao`. O guard valida o access token e confere no banco, a cada
requisição, a sessão aberta, o usuário ativo e as permissões do perfil: logout, inativação e
mudança de perfil valem na requisição seguinte. A lista `permissoes` do token serve só à interface
(menu e ações). O catálogo completo vem de
`GET /permissoes` e alimenta a matriz de W-05.

| Módulo           | Operações                                             |
| ---------------- | ----------------------------------------------------- |
| `cadastros`      | consultar, criar, editar, excluir                     |
| `perfis`         | consultar, criar, editar, excluir                     |
| `triagem`        | consultar, criar, editar, consultar_sensivel          |
| `senha`          | consultar, criar, reclassificar                       |
| `fila`           | consultar, criar, editar, excluir, chamar             |
| `alocacao`       | consultar, criar, editar                              |
| `atendimento`    | consultar, criar, editar, validar, consultar_sensivel |
| `encaminhamento` | consultar, criar                                      |
| `ausencia`       | consultar, criar                                      |
| `indicadores`    | consultar, exportar                                   |
| `alertas`        | consultar, reconhecer, escalonar                      |
| `auditoria`      | consultar, exportar                                   |

O catálogo é a constante `CATALOGO_PERMISSOES` de `packages/contracts/src/permissoes.ts`: a API
valida contra ela, inclusive na gravação de perfis, e permissão gravada no banco fora do catálogo
é ignorada. Usuários (`/usuarios`) usam o módulo `perfis` (`perfis:consultar`, `perfis:criar`,
`perfis:editar`). Ausência e desistência usam o mesmo módulo `ausencia` (`ausencia:consultar` e
`ausencia:criar`); não há módulo próprio de desistência.

Toda rota exige uma permissão (`@Requer`) ou é marcada pública (`@Publico`); rota sem nenhum dos
dois é recusada com 403. Operações sem permissão própria que só exigem sessão (como `GET /auth/me`)
usam `@Autenticado`.

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
    {
      "campo": "justificativaClinica",
      "mensagem": "Justificativa é obrigatória para prioridade Urgente."
    }
  ]
}
```

O campo `mensagem` é exibido diretamente abaixo do campo no formulário. Toda mensagem descreve a
causa e o próximo passo, nunca apenas "erro" (item 3.2 da especificação de UI).

### Códigos de erro do domínio

| Código                       | HTTP        | Quando                                                                                                                                                                                                                                                          | Regra        |
| ---------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| `VALIDACAO`                  | 422         | Campo obrigatório ausente ou inválido                                                                                                                                                                                                                           | —            |
| `DUPLICIDADE`                | 409         | Registro já cadastrado; o corpo traz `recursoExistenteId` para o link de W-04. Critérios: paciente por documento ou nome + nascimento; especialidade e perfil por nome; estudante por nome + especialidade (decidido na #81); sempre sem diferenciar maiúsculas | UC-01        |
| `IMPACTO_EM_USO`             | 409         | `PUT` ou `PATCH` de sala, especialidade, estudante ou supervisor que muda campo que afeta alocação em curso, sem `?confirmar=true`; o corpo traz `impacto` (`emUso`, `campos`) e nada é gravado (#79)                                                           | T-04         |
| `VINCULO_ATIVO`              | 409         | Exclusão de cadastro com vínculo ativo; o `detail` diz com o que o registro está vinculado e sugere inativar (`PATCH`)                                                                                                                                          | T-03         |
| `TRANSICAO_INVALIDA`         | 409         | Mudança de status não prevista na máquina de estados                                                                                                                                                                                                            | P-01         |
| `VERSAO_DESATUALIZADA`       | 409         | Bloqueio otimista; corpo traz o estado atual                                                                                                                                                                                                                    | —            |
| `FILA_BLOQUEADA`             | 409         | Chamada em fila sem supervisor disponível                                                                                                                                                                                                                       | RN-10        |
| `FILA_VAZIA`                 | 409         | "Chamar próxima" sem senha aguardando                                                                                                                                                                                                                           | UC-09        |
| `SEM_FILA_CONFIGURADA`       | 409         | Emissão de senha para especialidade sem fila ativa                                                                                                                                                                                                              | UC-06        |
| `JUSTIFICATIVA_OBRIGATORIA`  | 422         | Reclassificação sem justificativa                                                                                                                                                                                                                               | RN-01        |
| `RECURSO_INDISPONIVEL`       | 409         | Recurso deixou de estar disponível entre a sugestão e a confirmação                                                                                                                                                                                             | RN-05, RN-09 |
| `LIMITE_SUPERVISAO_ATINGIDO` | 409         | Supervisor no limite de estudantes simultâneos                                                                                                                                                                                                                  | RN-08        |
| `SUPERVISOR_INDISPONIVEL`    | 409         | Nenhum supervisor habilitado; dispara bloqueio da fila                                                                                                                                                                                                          | RN-07, RN-10 |
| `DESFECHO_OBRIGATORIO`       | 422         | Encerramento sem desfecho                                                                                                                                                                                                                                       | UC-13        |
| `PERFIL_SISTEMA`             | 409         | Edição ou exclusão de perfil do sistema                                                                                                                                                                                                                         | T-05         |
| `ESPECIALIDADE_INATIVA`      | 409         | Encaminhamento interno para especialidade inativa                                                                                                                                                                                                               | UC-14        |
| `PACIENTE_COM_RESTRICAO`     | 200 + aviso | Reincidência de ausências; **não bloqueia**: vem em `avisos[]` de `GET /pacientes/{id}`, e a busca traz `restricaoAtiva` e `restricaoAte`                                                                                                                       | RN-13        |

`PACIENTE_COM_RESTRICAO` não é erro: vem em `avisos[]` do detalhe do paciente (`GET /pacientes/{id}`),
e a busca de W-06 usa `restricaoAtiva` e `restricaoAte`, porque a triagem é permitida.

### Códigos técnicos

Valem para qualquer endpoint. A lista completa de códigos fica em `CodigoErro`
(`packages/contracts/src/erros.ts`); código novo entra lá e nesta seção no mesmo PR de contrato.

| Código                | HTTP | Quando                                                                               |
| --------------------- | ---- | ------------------------------------------------------------------------------------ |
| `CORPO_INVALIDO`      | 400  | Corpo que não é JSON válido (erro de sintaxe, antes de qualquer validação)           |
| `NAO_AUTENTICADO`     | 401  | Sem token, token inválido ou expirado                                                |
| `CREDENCIAL_INVALIDA` | 401  | Login recusado; mesma resposta para usuário inexistente e senha incorreta (§2)       |
| `BLOQUEIO_TEMPORARIO` | 401  | Login durante o bloqueio por tentativas (§2)                                         |
| `SEM_PERMISSAO`       | 403  | Falta de permissão, inclusive sobre recurso inexistente (§3)                         |
| `NAO_ENCONTRADO`      | 404  | Rota inexistente                                                                     |
| `LIMITE_REQUISICOES`  | 429  | Limite de requisições dos endpoints públicos atingido; `Retry-After` em segundos     |
| `BANCO_INDISPONIVEL`  | 503  | Readiness com o banco fora (§9)                                                      |
| `ERRO_INTERNO`        | 500  | Falha inesperada; o corpo não traz detalhe técnico, só o `X-Request-Id` no cabeçalho |

## 5. Paginação, filtro e ordenação

```
GET /pacientes?pagina=1&tamanho=20&busca=silva&vinculo=ALUNO&ordenar=nome&direcao=asc
```

| Parâmetro | Padrão       | Limite |
| --------- | ------------ | ------ |
| `pagina`  | 1            | —      |
| `tamanho` | 20           | 100    |
| `ordenar` | por endpoint | —      |
| `direcao` | `asc`        | —      |

Resposta:

```json
{
  "dados": [],
  "meta": { "pagina": 1, "tamanho": 20, "total": 143, "totalPaginas": 8 }
}
```

Toda listagem é paginada, sem exceção (RNF-03).
`ordenar` aceita só os campos listados em cada endpoint do `openapi.yaml`; valor fora da lista
retorna `422 VALIDACAO`.
`tamanho` acima de 100, `pagina` menor que 1 ou valor não inteiro retornam `422 VALIDACAO`
com o parâmetro em `campos`; o servidor não corta o valor em silêncio.

## 6. Idempotência e concorrência

`POST /filas/{id}/chamadas` e `POST /senhas/{id}/alocacao` aceitam o header
`Idempotency-Key: {uuid}`. Repetição com a mesma chave em até 10 minutos devolve a resposta
original, sem executar de novo — cobre duplo clique e reenvio por reconexão.

Endpoints que mudam estado de senha ou atendimento exigem o campo `versao` no corpo. Versão
divergente retorna 409 `VERSAO_DESATUALIZADA` com o estado atual, e o front recarrega mostrando o
que mudou.

## 7. Eventos de tempo real

Socket.IO em três namespaces. A conexão autenticada envia o access token no `auth` do handshake.

O handshake usa os seguintes campos; a entrada na sala acontece no servidor, sem evento
genérico para o cliente escolher salas:

| Namespace  | Handshake                                       | Validação da sala                                           |
| ---------- | ----------------------------------------------- | ----------------------------------------------------------- |
| `/filas`   | `auth: { token }`, `query: { especialidadeId }` | Exige `fila:consultar` e especialidade da unidade da sessão |
| `/painel`  | `query: { unidadeId }`, sem token               | Unidade existente; somente projeção pública                 |
| `/alertas` | `auth: { token }`                               | Exige `alertas:consultar`; unidade derivada da sessão       |

Token inválido ou permissão insuficiente recusa a conexão. A conexão autenticada é encerrada
quando o access token expira; o cliente reconecta com um token renovado.

### `/filas` — autenticado, sala `especialidade:{id}`

O serviço emite os eventos de domínio pelo `EventosDominio` (`apps/api/src/common/eventos`)
depois do commit; os tipos estão em `EventosFila` de `@filas/contracts`. O gateway assina e
repassa para a sala.

| Evento                  | Corpo                                                            | Origem |
| ----------------------- | ---------------------------------------------------------------- | ------ |
| `senha.criada`          | `SenhaResumo`                                                    | UC-06  |
| `senha.chamada`         | `{ senha: SenhaResumo, chamada: Chamada }` (também na rechamada) | UC-09  |
| `senha.status_alterado` | `{ senhaId, filaId, statusAnterior, status, versao }`            | P-01   |
| `senha.reclassificada`  | `{ senhaId, prioridade, novaPosicao }`                           | UC-07  |
| `ausencia.registrada`   | `{ senha: SenhaResumo, automatica, restricaoAplicada }`          | UC-16  |
| `fila.bloqueada`        | `{ filaId, especialidade, motivo, desde }` (emitido na alocação) | RN-10  |
| `fila.desbloqueada`     | `{ filaId, especialidade, em }`                                  | RN-10  |
| `fila.metricas`         | `{ filaId, aguardando, emAtendimento, tempoMedioEsperaMinutos }` | W-08   |

### `/painel` — público, sala `unidade:{id}`

| Evento           | Corpo                                                          |
| ---------------- | -------------------------------------------------------------- |
| `chamada.exibir` | `{ numero, especialidade, local, sequencia, em }`              |
| `painel.estado`  | `{ atual, anteriores[] }` — enviado no connect, para reconexão |

Apenas esses campos. O namespace não conhece paciente, prioridade nem triagem (ADR-003).

`ChamadaPublica`, `ChamadaExibida`, `EstadoPainel` e `EventosPainel` são exportados por
`@filas/contracts`. `painel.estado` contém `atual: ChamadaPublica | null` e até quatro
`anteriores`, conforme o estado do telão no OpenAPI. Não contém `servidorEm`, que pertence à
resposta HTTP, nem herda campos de `SenhaResumo`. Os schemas públicos recusam campos extras.

### `/alertas` — autenticado com permissão `alertas:consultar`, sala `unidade:{id}`

| Evento            | Corpo                         |
| ----------------- | ----------------------------- |
| `sla.excedido`    | `Alerta`                      |
| `sla.normalizado` | `{ alertaId, normalizadoEm }` |

Os schemas `Alerta` e `AlertaNormalizado` e a interface `EventosAlertas` ficam em
`@filas/contracts`. Os eventos são publicados após o commit e se aplicam às duas origens:
`SLA_EXCEDIDO` e `FILA_BLOQUEADA`. No bloqueio, os tempos são nulos; a normalização decorre do
desbloqueio da mesma fila (RN-10), sem inferir disponibilidade no módulo de alertas.

`GET /alertas` e o evento `sla.excedido` incluem `escalonamentos[]`, com medida, autor e horário
(Tabela 21). O corpo de criação só aceita `acao` e `observacao` operacional opcional; autor e
horário vêm da sessão e do servidor. Nenhuma projeção inclui paciente ou conteúdo clínico.
Filtros, ordenação, período por disparo e transições estão definidos no OpenAPI. As decisões
aprovadas e o acompanhamento da implementação estão em [GH-28-aceite](entregas/GH-28-aceite.md).

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

| Endpoint            | Uso                                              |
| ------------------- | ------------------------------------------------ |
| `GET /health`       | Liveness — responde sem tocar o banco            |
| `GET /health/ready` | Readiness — verifica banco e migrações aplicadas |

Toda resposta traz `X-Request-Id`, propagado para o log e para o `audit_log`, o que permite ligar
um relato de usuário a uma linha de log.

## 10. Encaminhamento (UC-14, UC-15)

`POST /atendimentos/{id}/encaminhamentos` exige `encaminhamento:criar`. A origem deve
pertencer à unidade da sessão, estar ENCERRADA e ter o desfecho correspondente ao tipo.
PENDENTE_VALIDACAO ainda não cumpre a pré-condição. Estado/desfecho divergente: 409
`TRANSICAO_INVALIDA`; repetição: 409 `DUPLICIDADE`, inclusive em concorrência.

Decisões aprovadas pelo responsável para a #26: um encaminhamento por atendimento;
senha interna reutiliza a triagem original, preservando-a, herda o tipo de atendimento
e fica vinculada por `senhaOrigemId`. Sem prioridade sugerida, herda a atual; a prioridade
legal é respeitada (RN-02) e sugestão URGENTE exige motivo clínico (RN-03). Motivo interno
não informado volta como texto vazio. Origem e evidências em `entregas/GH-26-aceite.md`.

Registro e emissão interna são atômicos; o evento `senha.criada` só sai após commit e usa
`SenhaResumo`. Destino sem fila ativa: 409 `SEM_FILA_CONFIGURADA`; especialidade inexistente
ou inativa: 409 `ESPECIALIDADE_INATIVA`. Bloqueio da fila permite emitir e gera aviso
`FILA_BLOQUEADA` (RN-10). Externo exige instituição e motivo e não gera senha.

`EncaminhamentoEntrada` e `Encaminhamento` são os schemas compartilhados. O motivo da
resposta individual é sensível; não entra em listas nem eventos. Escrita registra auditoria.
