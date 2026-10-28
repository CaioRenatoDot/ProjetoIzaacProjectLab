# GH-22 — Sugestão automática de recursos

## Estado da entrega

Implementação validada localmente na branch `feat/GH-22-sugestao-alocacao`, a partir da
`develop` com a #20 mergeada no PR #123. Revisão, CI remoto e merge da #22 permanecem pendentes.
O endpoint e os tipos de resposta já constavam no OpenAPI; esta entrega não muda contrato.

## Fontes conferidas

- Documento de Requisitos de Sistema: UC-10, RF-06, RN-05 a RN-09.
- `especificacao/wireframes_ui_v2.pdf`, W-11, p. 12: sugestão, alternativas e motivos.
- `docs/01-arquitetura.md` §3 e §4, `docs/03-modelo-de-dados.md` §3.2 e §3.4.
- `docs/02-divisao-responsabilidades.md` §2, `docs/04-contrato-api.md` e ADR-003.
- OpenAPI: `GET /senhas/{id}/alocacao/sugestoes`, `SugestoesAlocacao`,
  `BlocoAlocacao` e `CandidatoAlocacao`.
- `docs/.ref/MODULOS/chamada-e-alocacao/spec.md` e índices de backend/banco.
- [Issue #22](https://github.com/CaioRenatoDot/ProjetoIzaacProjectLab/issues/22).

## Critérios de aceite

| Critério                                                             | Evidência em `apps/api/src/alocacao/alocacao.int-spec.ts`                                                                          | Resultado |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------- |
| Senha chamada com recursos compatíveis recebe uma sugestão por bloco | Teste `#22 RN-05 a RN-09`: GET HTTP real confere os três IDs aptos, sem repetir nas alternativas; POST confirma os mesmos recursos | Passou    |
| Estudante fora do turno aparece nas alternativas com motivo textual  | Teste `#22 RN-05`: estudante sem disponibilidade retorna `FORA_DO_TURNO` e texto em português                                      | Passou    |

Um smoke independente com `AppModule` compilado, autenticação real e PostgreSQL `filas_test`
confirmou os dois critérios e a confirmação HTTP 201 dos recursos sugeridos. Dados fictícios,
relógio fixado para turno válido e cron parado somente nesse processo. Saída em
[evidencias/GH-22/smoke.txt](../evidencias/GH-22/smoke.txt).

## Demais entregáveis

- `AptidaoAlocacaoService` concentra as verificações usadas na sugestão, confirmação e
  disponibilidade do supervisor. A confirmação conserva sua transação, bloqueio do supervisor,
  versão, idempotência e índices de exclusão mútua.
- Estudante: unidade, atividade, especialidade, turno e ocupação (RN-05/RN-06).
- Supervisor: atividade, habilitação, turno, ocupação e limite próprio ou vigente (RN-07/RN-08).
- Sala: unidade, atividade, recursos exigidos, situação e ocupação (RN-09).
- Sem supervisão exigida, `supervisor.aplicavel` é `false`, com sugestão nula e alternativas
  vazias, conforme o contrato; a tela existente oculta esse bloco.
- `alocacao:consultar` protege a rota. Sem token: 401; sem permissão: 403 neutro, inclusive
  para UUID inexistente. Senha de outra unidade: 404; estado não alocável: 409.
- GET não reserva recursos, não bloqueia a fila e não muda a versão da senha. Testes cobrem
  indisponibilidade após a sugestão e a recusa 409 na confirmação.
- O teste global de privacidade descobre a rota e inspeciona a resposta de sucesso com uma
  senha própria em CHAMADA; preserva a massa em EM_ATENDIMENTO para as demais listagens.

## Validação

- 237 testes unitários e 215 de integração do backend passaram.
- Testes de unidade citam RN-05 a RN-09; a verificação geral encontrou RN-01 a RN-13 em 452 casos.
- Lint, tipos, testes, build e OpenAPI do monorepo passaram. O OpenAPI mantém cinco avisos
  preexistentes, sem alterações nesta entrega.
- Integração padrão executada exclusivamente no `filas_test`, recriado com as migrações.
- Comandos: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm contract:lint`,
  `pnpm --filter api test:integracao` e `pnpm --filter api test:cobertura-rn`.

## Decisões de implementação e limites

- Preservada a limitação da RN-06 aprovada na #21: o modelo não guarda as exigências de nível,
  habilitações e procedimentos do atendimento. Confere-se a especialidade; a decisão pendente
  continua em `docs/08-pendencias.md`, sem inventar exigências na sugestão.
- Sala ocupada usa `ATENDIMENTO_ATIVO`, já previsto pelo contrato e pelo mock, com texto
  operacional em português. Falta de recursos ou manutenção usa `RECURSO_INDISPONIVEL_NA_SALA`.
- Cada bloco devolve uma sugestão e até vinte alternativas, ordenadas por nome e ID.
  O repositório lê lotes de até cem com cursor; o teste encontra um apto após cem inaptos.
  Quando não há apto, pode ser necessário percorrer todos os lotes da unidade.
- A resposta é um retrato da disponibilidade. A confirmação continua revalidando os recursos.
- Nomes exibidos pertencem aos recursos operacionais. Não se consultam dados de paciente ou
  triagem; esta leitura não exige auditoria sensível. Não há alteração de UI.

Este relatório guarda as mudanças, decisões e evidências para o resumo final das issues.
As entregas #26 e #28 continuam fora do escopo.
