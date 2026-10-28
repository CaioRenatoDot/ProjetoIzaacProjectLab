# Revisão das entregas de backend — 28/10/2026

Auditoria das #19, #20, #22, #26, #28 e da verificação compartilhada #30, sobre a
`develop` em `d842fd4` (PR #128). Código, contrato, fontes da especificação, critérios
atuais do GitHub e testes foram confrontados. A revisão encontrou duas falhas na #19;
a correção está na branch `fix/GH-19-concorrencia-auditoria-bloqueio`, pendente de merge.

## Resultado por issue

| Issue | Implementação conferida                | Evidência atual e conclusão                                                                                                                               |
| ----- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #19   | PR #120, merge e CI confirmados        | Quatro critérios passaram; revisão adicional reproduziu corrida e falta de auditoria, agora corrigidas nesta branch                                       |
| #20   | PR #123, merge e CI confirmados        | Quatro critérios passaram: projeção pública, posição, 404 neutro e 31ª requisição 429; estimativa/duplicidade seguem decisões aprovadas                   |
| #22   | PR #124, merge e CI confirmados        | Dois critérios passaram; sugestões e confirmação compartilham aptidão. Supervisor inaplicável segue `aplicavel:false` do contrato; limitação RN-06 abaixo |
| #26   | PR #126, merge e CI confirmados        | Três critérios passaram: senha interna vinculada, destino inativo 409 e externo sem senha; concorrência/auditoria/rollback conferidos                     |
| #28   | PR #128, merge e CI nº 143 confirmados | Três critérios passaram: evento de disparo, normalização e medidas com autor/horário; issue ainda aberta na consulta, pode ser fechada pelo responsável   |
| #30   | Issue fechada; verificações no CI      | Dois critérios confirmados também pelo caminho negativo: ausência de RN e vazamento de campo rejeitados                                                   |

Foram conferidos controllers, services, repositories, projeções/schemas, autenticação,
auditoria, barramento/gateway, cron, migrações/índices, testes e workflow das entregas.
As fontes e decisões detalhadas permanecem em `GH-19-aceite.md`, `GH-20-aceite.md`,
`GH-22-aceite.md`, `GH-26-aceite.md` e `GH-28-aceite.md`, neste diretório.

## Falhas reproduzidas e corrigidas

1. **Concorrência RN-10:** a chamada lia `bloqueada:false` sem proteger a fila; outra
   transação confirmava o bloqueio e a chamada ainda retornava 201/criava registro.
   A chamada agora lê a fila com `FOR SHARE` na transação. Chamadores continuam concorrentes
   com `SKIP LOCKED`, mas a alteração do bloqueio espera a chamada em andamento concluir.
   Depois do bloqueio confirmado, novas chamadas recebem 409 FILA_BLOQUEADA.
2. **Auditoria RNF-05:** bloqueio/desbloqueio automáticos escreviam na fila sem `audit_log`.
   Agora auditam na mesma transação; o caminho de falta de supervisor na alocação também
   audita fila e transição da senha, embora a resposta seja 409. Falha da auditoria desfaz
   todas essas mudanças e não publica eventos; estado inalterado não duplica registro.

A regressão concorrente consulta a espera de lock real no PostgreSQL, sem depender de um
atraso arbitrário. A auditoria tem testes de persistência, não duplicação e rollback nos
dois caminhos. O `AppModule` compilado reproduziu os problemas antes e confirmou a correção:
[evidência anterior](../evidencias/revisao-final/antes.txt) e
[evidência posterior](../evidencias/revisao-final/depois.txt).

## Validação final

- Backend: **254 testes unitários e 241 de integração**, todos aprovados.
- Monorepo: lint, tipos, testes e build aprovados. Contratos: 95 testes; web: 333;
  público: 37; UI: 20. OpenAPI válido, com cinco avisos preexistentes.
- RN-01 a RN-13 presentes em 495 nomes de casos. Teste negativo confirmou rejeição de
  coleção sem RN-13, sem aceitar identificador só no describe nem RN-130 como RN-13.
- Teste negativo de privacidade injetou `motivo` numa resposta HTTP real: o gate falhou
  apontando `/api/v1/filas/:id/senhas $.motivo`. A alteração temporária foi integralmente
  restaurada; a suíte completa voltou a passar. [Saída](../evidencias/revisao-final/gates-GH-30.txt).
- Integração e reproduções usaram exclusivamente `filas_test`, dez migrações e dados
  fictícios. Nenhum reset/migração no `filas_dev`; OpenAPI e contratos não mudaram na correção.

## Limites da conclusão

Os critérios das issues foram exercitados; isso não equivale a afirmar que toda a
especificação do sistema está encerrada. A **RN-06 permanece incompleta**: faltam no modelo
as exigências de nível, habilitações e procedimentos do atendimento. Foi preservada a
checagem de especialidade combinada na #21; o complemento exige decisão do grupo, sem
inventar requisitos (ver `docs/08-pendencias.md`).

Socket.IO e rate limit continuam locais a uma instância, como documentado nas entregas.
Integração das telas e implantação das aplicações em Docker permanecem tarefas próprias.
Os PRs originais têm merge e CI confirmados; a correção pós-revisão da #19 ainda requer
PR, revisão humana, CI remoto e merge antes de considerar essas duas lacunas encerradas.
