# O que falta

Visão única do que ainda não está pronto, de back e de front, e do que já se sabe sobre cada
ponto. Complementa dois documentos:

- [`06-etapas.md`](06-etapas.md): partes, responsáveis e status.
- [`07-pendencias-integracao.md`](07-pendencias-integracao.md): troca do MSW pela API, tela por
  tela, e lacunas do contrato.

**Quem fechar um item daqui atualiza este arquivo no mesmo PR.** Situação conferida em 28/10/2026.

## 1. Back-end pronto

Tudo na `develop`, com testes de unidade e de integração rodando no CI (job "Testes de
integração da API (PostgreSQL)").

| Issue | Entrega                                                                                                                                     | Contrato |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| #31   | Erros RFC 7807, validação Zod (422), paginação, log JSON com `redact`, CORS                                                                 | #67      |
| #6    | Schema de acesso, cadastros base e auditoria (22 tabelas)                                                                                   | —        |
| #7    | Schema de triagem, fila, senha, alocação, atendimento, alertas e idempotência                                                               | —        |
| #8    | Usuário `filas_app`, `REVOKE` no `audit_log`, parâmetros da unidade, CHECKs e únicos parciais (RN-01, RN-03, RN-05, RN-09, RF-04)           | —        |
| #10   | Login, refresh rotativo com detecção de reuso, bloqueio por tentativas, `/auth/me`                                                          | #71      |
| #11   | Guard global (`@Requer`, `@Publico`, `@Autenticado`) e auditoria implícita                                                                  | #73      |
| #12   | Perfis, catálogo de permissões e usuários (inativar, desbloquear, redefinir senha)                                                          | #76      |
| #13   | Salas, especialidades e cadastros de apoio                                                                                                  | #78      |
| #14   | Pacientes, estudantes e supervisores                                                                                                        | #82      |
| #15   | Triagem (RN-02, RN-03), lista sem campo clínico, detalhe auditado, `comFila` em especialidades                                              | #93      |
| #16   | Emissão de senha (número por fila e dia sob concorrência, RN-04), reclassificação (RN-01), histórico, `GET /parametros`, eventos de domínio | #95      |
| #17   | Máquina de estados da senha (matriz 9 × 9 testada), versão, horários e evento `senha.status_alterado`                                       | #97      |
| #18   | Filas, quadro RN-04 com métricas, chamar próxima com `SKIP LOCKED` e `Idempotency-Key`, rechamada e cancelamento                            | #99      |
| #21   | Alocação (RN-05 a RN-09), troca, manter aguardando, `SUPERVISOR_INDISPONIVEL` com bloqueio da fila; ocupação real nos cadastros             | #101     |
| #22   | Sugestões com avaliação compartilhada de aptidão, alternativas e motivos; implementação mergeada no PR #124                                 | —        |
| #20   | Endpoints HTTP públicos do telão e da consulta, estimativa e limite por IP; implementação mergeada no PR #123                               | #122     |
| #19   | Bloqueio automático e Socket.IO, PR #120; correção de concorrência/auditoria em revisão                                                     | #119     |
| #28   | Alertas de SLA, reconhecimento, escalonamento e eventos; implementação mergeada no PR #128                                                  | #127     |
| #26   | Encaminhamento interno/externo, emissão compartilhada e auditoria transacional; implementação mergeada no PR #126                           | #125     |
| #23   | Atendimento: iniciar, pausar, retomar, encerrar (libera a alocação), validação RN-11 com recusa e reenvio, tempo efetivo                    | #103     |
| #25   | Desistência (só AGUARDANDO e EM_ATENDIMENTO), libera recursos, nunca grava ausência                                                         | #105     |
| #24   | Rotina de tolerância (RN-12: volta à fila uma vez, depois ausência), ausência manual, restrição por reincidência (RN-13)                    | #107     |
| #27   | Indicadores (resumo, volume e exportação CSV), agregados no banco, sem dado de paciente                                                     | #109     |
| #29   | Consulta, detalhe e exportação CSV da trilha de auditoria                                                                                   | #84      |
| #9    | Seed fictício de acesso, cadastros e filas (usuários no README)                                                                             | —        |
| #30   | Integração no CI, verificação de RN-01 a RN-13 nos nomes dos casos (`test:cobertura-rn`) e teste que reprova listagem com campo clínico     | —        |

## 2. Back-end que falta

As entregas #19, #20, #22, #26 e #28 foram mergeadas na `develop`. Na revisão final,
duas lacunas da #19 foram reproduzidas e corrigidas localmente: concorrência entre chamada
e bloqueio, e auditoria do bloqueio automático. A correção ainda precisa de revisão/CI/merge;
[relatório e evidências](entregas/revisao-final-backend-nathan.md). A RN-06 continua com a
limitação de modelo descrita na seção 3; a verificação de nomes de testes não a resolve.

### Aviso de impacto na edição de cadastro (#79)

Decidido na #79: opção A, só para os campos que afetam alocações em curso (T-04). O `PUT` dos
quatro cadastros sem `?confirmar=true` responde `409 IMPACTO_EM_USO` com o impacto, e a W-04
reenvia depois da confirmação. Contrato no #137 e API no PR da #79 (também no `PATCH` de inativar).
Falta a troca no front (#38): trocar o aviso calculado no formulário pelo 409 e apagar a regra
local.

### Valores provisórios que as Etapas 6 a 8 precisam substituir

Campos que o contrato já devolve, mas que hoje saem fixos porque a tabela de origem ainda não
existe. Quem criar a tabela troca o valor e remove a linha:

| Campo                               | Onde                                | Valor hoje | Vem de                                                              |
| ----------------------------------- | ----------------------------------- | ---------- | ------------------------------------------------------------------- |
| Filtro `disponivel` de supervisores | `cadastros/supervisores.service.ts` | só `ativo` | comparar a ocupação com o limite de cada um (a alocação já confere) |

## 3. Limitações conhecidas e dívidas técnicas

| Ponto                                                  | Efeito                                                                                                            | Saída prevista                                                                        |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Auditoria implícita fora da transação da escrita (#11) | Se o `audit_log` falhar depois da escrita, ela já aconteceu e o cliente recebe 500                                | Operação crítica grava com `AuditoriaService.registrar(dados, tx)` na mesma transação |
| Bloqueio de identificação inexistente em memória (#10) | Zera quando a API reinicia e só vale com uma instância                                                            | Aceito para o MVP; com mais instâncias, mover para o banco ou Redis                   |
| Trilha de auditoria sem coluna de unidade (#29)        | O filtro por unidade passa pelo usuário; eventos de rotina (sem usuário) aparecem para todas as unidades          | Coluna `unidade_id` no `audit_log` se houver mais de uma unidade                      |
| Documento do paciente único no sistema todo (#6)       | Duas unidades não cadastram o mesmo documento                                                                     | Rever junto com RNF-08 (múltiplas unidades)                                           |
| Usuários sem tela                                      | A API de usuários (#12) não tem tela: criar, inativar e desbloquear o login (bloqueio por tentativas) só pela API | Decidir onde administrar usuários (front)                                             |
| Aplicações fora do Docker                              | O compose sobe só banco e Adminer (`docs/.ref/SPECS/implantacao.md`)                                              | `Dockerfile` de `api`, `web` e `publico` (orientação do professor)                    |
| Backup diário (RNF-09)                                 | Sem rotina                                                                                                        | Etapa 10                                                                              |
| Proteção da `develop`                                  | Merge sem aprovação e sem CI obrigatório                                                                          | Configurar a proteção no GitHub (dono do repositório)                                 |
| `audit_log` sem índice por módulo                      | Filtro por módulo pode ficar lento com volume                                                                     | Medir com dados reais antes de criar                                                  |

### Garantias automáticas no CI

- `pnpm --filter api test:cobertura-rn`: falha se alguma RN-01 a RN-13 não aparece no nome de um
  caso de teste (lê os nomes pelo `vitest list`, não os arquivos). Teste novo de regra cita a RN.
- `src/listagens-sem-dado-sensivel.int-spec.ts`: descobre as listagens pelos controllers, chama
  cada uma e falha se aparecer `motivo`, `justificativaClinica`, `observacoes` ou `nomeCompleto`.
  Exceções explícitas: `nomeCompleto` em `GET /pacientes` (#14) e `bloqueio.motivo` da fila (RN-10).
- `src/senhas/maquina/status-so-na-maquina.spec.ts`: falha se outro arquivo gravar `status` em senha.

### Armadilhas já encontradas

- O Prisma envia número do JavaScript como `bigint` em `$queryRaw`: funções como
  `make_interval` precisam de cast (`::int`), e `COUNT` volta `BigInt` (converter antes do JSON).
- `prisma migrate dev` cria um banco shadow sem `_prisma_migrations`: SQL manual que mexe nela
  precisa de `to_regclass`.
- O `prisma migrate reset` recusa rodar quando chamado por agente de IA; no terminal e no CI
  funciona normalmente.
- Testes de integração rodam sem reset entre execuções na máquina de cada um: use nomes,
  documentos e datas únicos por teste (ver `apps/api/src/cadastros/pessoas.int-spec.ts`).
- `gh pr checks --json` não existe em todas as versões do `gh`; use `statusCheckRollup`.
- Dentro de `prisma.$transaction(async (tx) => ...)`, **toda** leitura usa o `tx` (inclusive
  `ParametrosService.vigentes(..., tx)` e `SenhaProjecao`). Uma consulta pelo `PrismaService`
  pede outra conexão do pool enquanto a transação segura a sua: com várias transações
  simultâneas o pool esgota e tudo trava até o timeout. Para reproduzir, rode a integração com
  `&connection_limit=2` na `DATABASE_URL_TEST`.

### RN-06 incompleta

A RN-06 pede compatibilidade de "especialidade, nível de formação, habilitações e procedimentos
autorizados". O modelo guarda o que o **estudante** tem, mas nada guarda o que o **atendimento**
exige: a alocação confere só a especialidade (combinado no #101). Falta decidir de onde vêm as
exigências (por exemplo, listas de habilitações e procedimentos na especialidade ou na triagem).

### Motivo obrigatório da pausa

O `openapi.yaml` diz que o motivo da pausa é obrigatório "quando o protocolo do serviço exige", mas
o modelo não tem onde configurar esse protocolo. Hoje o motivo é sempre opcional.

## 4. Decisões em aberto

| Decisão                                                  | Onde           | Valor em uso                                                   |
| -------------------------------------------------------- | -------------- | -------------------------------------------------------------- |
| Política da RN-12 (devolver à fila ou marcar ausência)   | #107           | Volta à fila uma vez; na segunda expiração, ausência           |
| Confirmação do modelo de navegação                       | ADR-002        | Modelo A, painel lateral só na fila                            |
| Exigências da RN-06 (nível, habilitações, procedimentos) | §2 acima       | Só a especialidade                                             |
| Horário dos turnos (RN-05, RN-07)                        | `docs/03` §3.2 | 07-12, 12-18, 18-22 (provisório)                               |
| Quem valida o encerramento (RN-11)                       | #103           | Quem tem `atendimento:validar`                                 |
| Efeito e prazo da restrição (RN-13)                      | #107           | Temporária até hoje + `janela_reincidencia_dias`; só aviso     |
| Exportação de indicadores em xlsx                        | #109           | Só csv                                                         |
| Fórmulas dos indicadores e limite de amostra pequena     | #109           | Coorte pela chegada; amostra pequena abaixo de 10 atendimentos |
| Valores definitivos dos parâmetros da unidade            | `docs/01` §4.7 | 5, 25, 3, 90, 3 e 20 (Tabela 8)                                |
| Base legal e prazo de retenção de triagem e atendimento  | `docs/03` §6   | Sem rotina de retenção                                         |

## 5. Front-end: o que fazer ao integrar com a API real

Detalhe por tela em [`07-pendencias-integracao.md`](07-pendencias-integracao.md). Pronto para
trocar agora (🔧 lá):

| Tela                                 | Troca                                                                                                                                               | API      |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Login e sessão (W-01)                | Rodar com `NEXT_PUBLIC_API_MOCK=false`; ler `minutosRestantes` do bloqueio; apagar `MENSAGEM_SEM_PERFIL` (não existe mais 403 no login)             | #10      |
| Menu, home e telas                   | Conferir as permissões contra `CATALOGO_PERMISSOES` de `@filas/contracts`                                                                           | #11      |
| Cadastros (W-03, W-04)               | Trocar o MSW; importar os schemas de `@filas/contracts` (`cadastros.ts`, `pessoas.ts`); inativar com `PATCH`; listas de apoio pelos endpoints novos | #13, #14 |
| Trilha de auditoria (W-18)           | Exportação passa a exigir `de` e `ate`; filtro de usuário por `GET /auditoria/usuarios`                                                             | #29      |
| Painel de fila (W-08)                | Trocar o MSW por `GET /filas`, quadro e chamada; ler `chamadaId` do `SenhaResumo` para rechamar e cancelar                                          | #18      |
| Alocação e atendimento (W-11 a W-13) | Trocar o MSW pelos endpoints de alocação e atendimento; `versao` é sempre a da senha; após `exigeEncaminhamento`, seguir para a W-14                | #21, #23 |
| Ausências (W-15, W-16)               | Trocar o MSW por `POST /senhas/{id}/ausencia` e `/desistencia`; ligar `ausencia.registrada` (via #19) às ausências automáticas                      | #24, #25 |
| Indicadores (W-17)                   | `GET /indicadores/resumo`, `/volume-por-especialidade` e `/exportacao` (só csv); mostrar a nota quando `amostraPequena`                             | #27      |

Ainda falta integrar no front o tempo real do painel/telão (W-08 a W-10), os alertas (W-18) e o estado da conexão Socket.IO; os endpoints e eventos de #19, #20 e #28 já foram entregues no back.

Também ficam com o front: rota `/acesso` com tela própria, TanStack Query na tela de perfis,
formulário de perfil com React Hook Form e o schema do contrato, layout de impressão da senha,
visão consolidada e seletor de turno do painel (dependem das lacunas 4 e 5 da fila) e o local da
tela de alertas no menu.

## Entrega da #19

Bloqueio automático e namespaces Socket.IO implementados com o contrato do PR #119.
Os quatro critérios de aceite e as verificações adicionais estão registrados em
[entregas/GH-19-aceite.md](entregas/GH-19-aceite.md). Implementação mergeada na `develop`
no PR #120; #20, #22, #26 e #28 não foram incluídas nessa entrega.
