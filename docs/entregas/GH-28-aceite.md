# GH-28 — Alertas de SLA e escalonamento

## Estado e fontes

Contrato mergeado na `develop` no [PR #127](https://github.com/CaioRenatoDot/ProjetoIzaacProjectLab/pull/127),
com CI nº 141 aprovado, conforme conferência em 28/10/2026. Implementação validada
localmente na branch `feat/GH-28-alertas-sla`, criada da `origin/develop` após esse merge.
OpenAPI e `packages/contracts` não mudam nesta implementação. Revisão, CI remoto e merge
do PR de implementação permanecem pendentes; a issue #28 continua aberta.

Fontes conferidas: PDF de Requisitos UC-19 (p. 33), Tabelas 8/20/21; DOCX originais;
UI T-17; wireframe W-18; `docs/01` §3/§4, `docs/03` §3.1/§3.5, `docs/04` §7, OpenAPI,
ADR-003, `docs/05` §2–§4, etapas 9.3, pendências de integração e limitações; módulo de
indicadores/alertas e índices de backend/banco em `docs/.ref/`;
[issue #28](https://github.com/CaioRenatoDot/ProjetoIzaacProjectLab/issues/28).

## Critérios de aceite

| Critério da issue                                                        | Evidência em alertas.int-spec.ts e no smoke                                                       | Estado |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- | ------ |
| Espera acima do SLA cria SLA_EXCEDIDO e entrega sla.excedido em /alertas | Rotina real, persistência e cliente Socket.IO; entrega restrita à unidade e após commit           | Passou |
| Espera volta ao limite e alerta fica NORMALIZADO                         | Chamada HTTP retira senha da espera; nova avaliação normaliza RECONHECIDO e emite sla.normalizado | Passou |
| Consulta do escalonamento mostra autor e horário                         | POST e GET /alertas reais; autoria da sessão, horário do servidor e auditoria única               | Passou |

Também passaram FILA_BLOQUEADA a partir da #19, recuperação de bloqueio na inicialização,
reconhecimento concorrente, três permissões independentes, parâmetros e precedência,
paginação/filtros/ordenação, limite exato e milissegundo acima, ausência de conteúdo clínico,
concorrência sem duplicação, novas ocorrências após normalização e rollback de todas as escritas.

## Decisões aprovadas em 28/10/2026

Após pesquisar as fontes, Neithan Rodrigues aprovou nesta sessão as propostas abaixo,
que complementam os requisitos e não são apresentadas como texto literal de RN/RF/UC:

1. Disparar se alguma senha AGUARDANDO ultrapassar o SLA; usar a maior espera e contar
   só as senhas acima do limite. Precedência: fila → parâmetro da especialidade → unidade.
2. Ordenar ATIVO, RECONHECIDO, NORMALIZADO. Em cada grupo aberto: bloqueio primeiro,
   depois maior excesso e disparo mais recente. Histórico pela normalização mais recente.
   ID crescente desempata. Sem categorias novas: gravidade descrita em texto.
3. `de`/`ate` opcionais sobre o disparo; sem período, todo o histórico paginado.
   Contrato usa instantes ISO-8601 com fuso, limites inclusivos, comparados pelo instante.
4. `escalonamentos[]` obrigatório, com ação, nome do autor e horário, em ordem de
   acionamento crescente e depois ID; vazio quando não houver medidas.
5. NORMALIZADO recusa reconhecimento/escalonamento com 409 TRANSICAO_INVALIDA.
   Reconhecer novamente RECONHECIDO devolve 200, preservando primeiro autor/horário.
6. Cada escalonamento válido registra uma medida, sem mudar o status do alerta nem criar
   automaticamente vagas ou atendentes.

## Requisitos preservados e divergências

A T-17 pede espera atual; a Tabela 20 do PDF principal define valores no disparo e prevalece.
Preservar tempos/quantidade do disparo, reavaliando a condição atual sem duplicar o alerta.
Comparação estrita pelo tempo exato; apresentação em minutos inteiros arredondados para cima.
FILA_BLOQUEADA tem tempos nulos e quantidade de aguardando no disparo; desbloqueio normaliza.
Sua fonte é o estado/evento da #19, sem recalcular disponibilidade de supervisor (RN-10).

Autor/horário vêm da sessão/servidor; entrada recusa esses campos. Strings de autor são nomes;
banco conserva UUIDs. `observacao` é operacional e fica null se omitida/vazia após trim.
Sem paciente ou conteúdo clínico em listas/eventos. Sem permissão: 403 neutro inclusive
para ID inexistente; autorizado com recurso inexistente/outra unidade: 404 neutro.

## Validação local

- Backend: 252 testes unitários e 238 de integração passaram. A #28 acrescenta oito
  casos unitários e doze de integração com HTTP, autenticação, PostgreSQL e Socket.IO reais.
- RN-01 a RN-13 constam em 490 casos na verificação dos nomes dos testes.
- Lint, tipos, testes e build do monorepo passaram; contratos: 95 testes, sem alteração
  dos schemas mergeados. OpenAPI válido com cinco avisos preexistentes e nenhum erro.
- Integração recriou exclusivamente `filas_test`, aplicando as dez migrações. Não houve
  reset, escrita de fixtures ou migração no `filas_dev` nesta execução.
- Um smoke independente iniciou o `AppModule` compilado, confirmou o registro da rotina
  `alertas-sla` e os três critérios em HTTP/Socket.IO. Cron parado apenas no processo isolado,
  para controlar a execução; dados fictícios em `filas_test`. [Saída](../evidencias/GH-28/smoke.txt).
- Comandos: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm contract:lint`,
  `pnpm --filter api test:integracao` e `pnpm --filter api test:cobertura-rn`.

## Garantias e limites da implementação

- Varredura a cada minuto, uma transação por fila ativa. Agregação no banco sem selecionar
  paciente/triagem. Falha de uma fila é registrada e não impede avaliar as demais.
- A transação bloqueia a linha da fila, o mesmo estado usado pela #19. Isso serializa
  avaliações de SLA/bloqueio entre instâncias sem acrescentar um advisory lock redundante.
  O índice parcial `alerta_fila_tipo_aberto_key` impede duplicação por inserção direta,
  incluindo RECONHECIDO. Uma fila pode ter as duas origens abertas simultaneamente.
- A migração exige que dados anteriores não tenham dois abertos do mesmo tipo por fila;
  não remove registros automaticamente. Normalizados continuam compondo o histórico.
- Reconhecimento e escalonamento bloqueiam o alerta por unidade. Repetir reconhecimento
  preserva primeiro ator/horário e não gera outra escrita/auditoria. Cada medida válida
  tem seu próprio registro/auditoria; normalizados recebem 409 TRANSICAO_INVALIDA.
- Todas as escritas de alertas e medidas gravam auditoria na mesma transação. Operações
  HTTP usam ator/perfil/IP/agente/request ID; rotinas usam ator nulo. O opt-in
  `@Auditar({ naTransacao: true })` existente evita duplicação no interceptador global.
- Eventos são publicados após commit. Teste confere a conclusão real da transação antes
  do evento e consulta a persistência por outra conexão. Falha de auditoria desfaz disparo,
  reconhecimento, medida e normalização; não publica evento da transação rejeitada.
- Bloqueio vem dos eventos da #19; ao iniciar, reconcilia bloqueios/alertas persistidos para
  recuperar mudanças durante a parada. O módulo não decide se há supervisor disponível.
- `GET /alertas` usa snapshot Repeatable Read para manter página/total coerentes e devolve
  as medidas com autor e horário. A listagem entrou na verificação global da ADR-003.
- A varredura de SLA acompanha filas ativas. Inativação, por si só, não é tratada como
  normalização da espera; uma fila inativada conserva seu alerta até retomar o monitoramento.
- O transporte Socket.IO e o barramento continuam locais ao processo, como na #19; a
  entrega entre várias instâncias requer adaptador/transporte compartilhado. Unicidade no
  PostgreSQL já vale entre instâncias. Auditoria automática conserva a limitação da #29
  de eventos sem usuário/coluna de unidade, registrada em `docs/08`.
- O front continua usando MSW/tipos locais: integração da W-18 fica para sua frente.

## Próxima etapa

Revisar o PR de implementação com `Closes #28`, conferir o CI remoto e mergear na `develop`
antes de fechar a issue. O diff supera o alvo aproximado de 400 linhas por incluir módulo,
migração e testes de concorrência/rollback/HTTP/Socket.IO; o contrato foi separado no PR #127.
Este relatório preserva as decisões e evidências para o resumo final das issues #19, #20,
#22, #26 e #28.
