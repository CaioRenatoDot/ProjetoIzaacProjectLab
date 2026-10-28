# GH-28 — Alertas de SLA e escalonamento

## Estado e fontes

Contrato preparado localmente na branch `docs/GH-28-contrato-alertas`, a partir da
`origin/develop` após o PR #126. Esta entrega contém contrato, testes de schemas e docs.
Implementação, revisão, CI remoto e merge pendentes. PR de contrato usa `Refs #28`.

Fontes conferidas: PDF de Requisitos UC-19 (p. 33), Tabelas 8/20/21; DOCX originais;
UI T-17; wireframe W-18; `docs/01` §3/§4, `docs/03` §3.1/§3.5, `docs/04` §7, OpenAPI,
ADR-003, `docs/05` §2–§4, etapas 9.3, pendências de integração e limitações; módulo de
indicadores/alertas e índices de backend/banco em `docs/.ref/`;
[issue #28](https://github.com/CaioRenatoDot/ProjetoIzaacProjectLab/issues/28).

## Critérios de aceite

| Critério da issue                                                        | Evidência necessária na implementação                                    | Estado                                |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------ | ------------------------------------- |
| Espera acima do SLA cria SLA_EXCEDIDO e entrega sla.excedido em /alertas | Rotina, PostgreSQL e cliente Socket.IO autenticado, isolados por unidade | Pendente                              |
| Espera volta ao limite e alerta fica NORMALIZADO                         | Nova execução, persistência e sla.normalizado após commit                | Pendente                              |
| Consulta do escalonamento mostra autor e horário                         | POST e GET /alertas reais, autoria e horário definidos no servidor       | Contrato preparado; execução pendente |

Também verificar: FILA_BLOQUEADA vindo da #19, reconhecimento, três permissões,
parâmetros configuráveis, paginação/filtros, auditoria das escritas, privacidade,
concorrência sem duplicar alertas e rollback sem eventos. Só concluir a etapa 9.3
quando a implementação passar e for revisada/mergeada.

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

## Validação e próxima etapa

Passaram lint, tipos, testes e build do monorepo, além de `pnpm contract:lint` (cinco
avisos preexistentes, nenhum erro). A suíte final de contratos passou com 95 testes,
incluindo oito casos novos de alertas; lint e tipos do pacote passaram após a revisão final.
Testes de schemas não demonstram execução da rotina ou dos endpoints. Aprovar e mergear
o contrato antes da implementação (AGENTS.md §6).
Depois testar os três critérios em HTTP/Socket.IO reais e registrar as evidências.
Só o PR de implementação usará `Closes #28`. Este relatório integra o resumo final das
issues #19, #20, #22, #26 e #28.
