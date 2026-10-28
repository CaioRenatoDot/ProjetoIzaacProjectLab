# GH-26 — Encaminhamento interno e externo

## Estado e fontes

Contrato preparado na branch `docs/GH-26-contrato-encaminhamento`, após a #22 (PR #124).
**Os endpoints ainda não foram implementados.** Conforme `AGENTS.md` §6, o contrato vai
em PR separado, aprovado pelo tech lead e pelo dono do módulo e mergeado antes da implementação.

Fontes: Documento de Requisitos de Sistema, UC-14/UC-15 (p. 31/32), RF-08 e Tabela 17
(p. 19); UI T-14 e wireframe W-14; `docs/01` §3/§4, `docs/03` §3.4, `docs/04`, OpenAPI,
ADR-003, `docs/.ref/MODULOS/encaminhamento/spec.md`, índices de backend/banco e
[issue #26](https://github.com/CaioRenatoDot/ProjetoIzaacProjectLab/issues/26).

## Critérios de aceite

| Critério                                                                    | Contrato                                                            | Verificação de execução necessária                                                    |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Interno de atendimento encerrado gera senha AGUARDANDO vinculada à original | `senhaGerada`, `senhaOrigemId`, registro/emissão na mesma transação | HTTP + PostgreSQL, vínculo, fila, prioridade, sequência e evento pós-commit; pendente |
| Especialidade inativa retorna 409 ESPECIALIDADE_INATIVA                     | Erro já catalogado e mantido no OpenAPI                             | Destino inexistente/inativo e outra unidade, sem escritas; pendente                   |
| Externo não gera senha                                                      | Variante EXTERNO exige instituição/motivo; `senhaGerada` nula       | Contagem de senhas antes/depois e auditoria; pendente                                 |

Também serão verificados destino bloqueado com aviso, ausência de fila ativa, estado/desfecho
da origem, duplicidade concorrente, rollback sem eventos, permissões e proteção dos dados clínicos.
`encaminhamento:consultar` e `encaminhamento:criar` já existem no catálogo; o POST exige criação.

## Decisões aprovadas

Em 28/10/2026, após conferir as lacunas na documentação, Neithan Rodrigues aprovou nesta sessão:

1. Reutilizar a triagem original como histórico, sem alterá-la nem criar uma avaliação
   clínica automática; herdar o tipo de atendimento da senha original.
2. Permitir um encaminhamento por atendimento. Repetição, inclusive simultânea, retorna
   `409 DUPLICIDADE`, evitando nova senha duplicada.
3. Sem `prioridadeSugerida`, herdar a prioridade atual da origem; respeitar a prioridade
   legal (RN-02); exigir motivo clínico ao sugerir URGENTE (RN-03). Motivo interno omitido
   é devolvido como texto vazio, conforme o campo opcional da T-14.

Essas decisões não estavam definidas no PDF; foram propostas e aprovadas pelo responsável,
não inferidas do código. `senha.triagem_id` é obrigatório e permite referência compartilhada;
a política normal de emissão única por triagem continua na #16. A emissão derivada da #26
precisa reutilizar numeração/fila dentro da transação do encaminhamento.

A pré-condição ENCERRADO vem dos UC-14/UC-15: PENDENTE_VALIDACAO ainda não permite registrar.
As filas ativas continuam como fonte dos destinos da tela; cabeçalho e desfecho seguem no
detalhe sensível já existente. Ajustes de UI ficam para a integração do front.

## Validação do contrato e próximos passos

Os schemas cobrem variantes, campos obrigatórios, motivo da urgência, projeção de resumo
na senha gerada e permissões do catálogo. Testes de schema não substituem a execução da API.
Os 87 testes de contratos passaram (sete casos novos). Lint, tipos, testes e build do
monorepo passaram; OpenAPI validado sem erros, com os cinco avisos preexistentes.
O motivo é conteúdo sensível da resposta individual, como define a Tabela 23; não pode ser
incluído no evento `senha.criada` nem em listagens.

Após revisão e merge do contrato com `Refs #26`, implementar o módulo e registrar os testes
dos critérios acima. O PR da implementação usará `Closes #26`. O relatório preserva as decisões
e evidências para o resumo final; a #28 continua fora do escopo.
