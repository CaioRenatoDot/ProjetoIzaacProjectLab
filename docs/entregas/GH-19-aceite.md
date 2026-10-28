# GH-19 — Bloqueio de fila e tempo real

Implementação da [issue #19](https://github.com/CaioRenatoDot/ProjetoIzaacProjectLab/issues/19),
a partir do contrato aprovado e mergeado no PR #119. Os quatro critérios foram validados
localmente; implementação mergeada na `develop` no PR #120, com CI aprovado e merge
confirmados pelo responsável.

## Fontes conferidas

- Documento de Requisitos de Sistema: RN-07, RN-10, UC-09 e UC-10.
- `docs/01-arquitetura.md` §4.5 e §4.6: bloqueio por especialidade e namespaces.
- `docs/04-contrato-api.md` §7: handshake, autorização, salas, eventos e cargas.
- `docs/api/openapi.yaml`: `Fila.bloqueio`, `ChamadaPublica` e histórico do telão.
- ADR-003: projeção pública sem paciente, prioridade ou dados clínicos.
- `docs/07-pendencias-integracao.md`: integração com os clientes existentes.

## Critérios de aceite

| Critério                                                                                                    | Evidência em `apps/api/src/tempo-real/tempo-real.int-spec.ts`                                                  | Resultado local |
| ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | --------------- |
| Sem supervisor disponível, chamar próxima retorna `409 FILA_BLOQUEADA` e emite `fila.bloqueada` em `/filas` | Teste RN-10: chamada HTTP real, evento recebido e campos de bloqueio persistidos                               | Passou          |
| Supervisor regularizado, consultar fila remove o bloqueio e emite `fila.desbloqueada`                       | Mesmo teste RN-10: cadastra disponibilidade, consulta a API e confere evento, motivo e data limpos             | Passou          |
| Chamada chega a `/painel` sem paciente nem prioridade                                                       | Teste RNF-02: cliente sem autenticação recebe exatamente `numero`, `especialidade`, `local`, `sequencia`, `em` | Passou          |
| `/filas` recusa conexão sem token                                                                           | Teste RNF-01: cliente Socket.IO recebe `connect_error`                                                         | Passou          |

Além da suíte automatizada, um smoke separado iniciou o `AppModule` completo com
PostgreSQL `filas_test`, HTTP e Socket.IO reais, sem mock de autenticação ou de disponibilidade.
Os quatro critérios foram conferidos novamente; a saída está em
[evidencias/GH-19/smoke.txt](../evidencias/GH-19/smoke.txt). Os cron jobs foram parados somente nesse
processo de smoke para isolar os dados de teste; a configuração da aplicação continua ativa.

## Demais entregáveis verificados

- Bloqueio por especialidade, somente quando exige supervisão. O detalhe e o quadro reavaliam
  a disponibilidade antes de responder; a chamada verifica antes de selecionar a senha.
- Turno, habilitação e capacidade usam a mesma verificação da alocação. Testes reais cobrem
  ocupação/liberação, inativação e virada de turno sem bloquear outra especialidade.
- Uma rotina reavalia a cada minuto. Alterações sem mudança de estado não repetem evento nem
  reiniciam `bloqueada_desde`. Falha numa fila não impede reavaliar as demais.
- Os sete eventos solicitados em `/filas` são testados com clientes reais e isolamento entre
  especialidades. `ausencia.registrada`, já presente no contrato, também é repassado.
- `/painel` usa os schemas públicos aprovados no PR #119. A consulta seleciona apenas os três
  campos públicos; conexão e reconexão recebem a chamada atual e quatro anteriores do dia.
  Chamada e rechamada enviam a sequência e o instante previstos no contrato.
- `/filas` exige JWT e `fila:consultar`; `/alertas` exige JWT e `alertas:consultar`. A unidade
  vem da sessão; o servidor verifica a especialidade e decide a sala. Não há evento de join
  que permita ao cliente escolher outra sala.
- Token expirado encerra a conexão; reconexão com o token vencido é recusada. Sessão,
  permissão e unidade são revalidadas a cada 30 segundos nas conexões autenticadas.
- CORS é configurado também no Socket.IO; origem não autorizada é recusada no teste real.
- Bloqueio publica após commit. Testes de rollback conferem que não há bloqueio publicado
  após falha de commit, nem chamada/status publicados após uma chamada desfeita.
- `packages/contracts` e o OpenAPI não foram alterados nesta implementação.

## Validação local

- Backend: 226 testes unitários e 203 testes de integração passaram.
- Lint, typecheck, testes e build do monorepo passaram.
- A validação do OpenAPI passou com os cinco avisos já existentes no contrato, sem alterações no arquivo.
- A verificação dos nomes dos testes encontrou RN-01 a RN-13 em 429 casos.
- Integração executada exclusivamente no `filas_test`, com as migrações existentes e um
  setup temporário que preserva dados de testes anteriores. Não houve reset do banco.

Comandos padrão para reprodução:

```bash
pnpm --filter api lint
pnpm --filter api typecheck
pnpm --filter api test
pnpm --filter api test:integracao
pnpm --filter api test:cobertura-rn
pnpm --filter api build
```

O comando padrão `test:integracao` recria somente `filas_test`, conforme o setup existente
no repositório. O banco `filas_dev` não é usado pela suíte de integração.

## Limites desta entrega

Socket.IO usa o adaptador em memória, adequado a uma instância. Antes de distribuir a API
em várias instâncias, é necessário um adaptador compartilhado, como Redis. O cliente continua
responsável pela reconexão com token renovado e pela degradação via HTTP prevista em docs/04.

Os eventos de SLA (#28), os endpoints públicos HTTP (#20), as sugestões (#22), os
encaminhamentos (#26) e alterações nas telas permanecem fora desta entrega.
