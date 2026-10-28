# GH-26 — Encaminhamento interno e externo

## Estado e fontes

Contrato mergeado na `develop` no PR #125, após a #22 (PR #124). A implementação está
validada localmente na branch `feat/GH-26-encaminhamento`, sem alterar o contrato.
Revisão, CI remoto e merge da implementação permanecem pendentes para concluir a #26.

Fontes: Documento de Requisitos de Sistema, UC-14/UC-15 (p. 31/32), RF-08 e Tabela 17
(p. 19); UI T-14 e wireframe W-14; `docs/01` §3/§4, `docs/03` §3.4, `docs/04`, OpenAPI,
ADR-003, `docs/.ref/MODULOS/encaminhamento/spec.md`, índices de backend/banco e
[issue #26](https://github.com/CaioRenatoDot/ProjetoIzaacProjectLab/issues/26).

## Critérios de aceite

| Critério                                                     | Evidência em `apps/api/src/encaminhamentos/encaminhamentos.int-spec.ts`                                                   | Resultado |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- | --------- |
| Interno encerrado gera senha AGUARDANDO vinculada à original | UC-14: ciclo HTTP de início/encerramento e encaminhamento, fila correta, vínculo, triagem preservada e evento após commit | Passou    |
| Especialidade inativa retorna 409 ESPECIALIDADE_INATIVA      | UC-14: destino inativo/inexistente e outra unidade recusados, sem senha gerada                                            | Passou    |
| Externo não gera senha                                       | UC-15: quantidade de senhas não muda; instituição/motivo/observações persistidos e auditoria única                        | Passou    |

Também passaram destino bloqueado com aviso, ausência de fila ativa, estado/desfecho
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

## Validação local

- 87 testes de contratos passaram, usando os schemas do PR #125 sem alterações.
- Backend: 244 testes unitários e 226 de integração passaram. A conferência reforçada do
  commit e da restrição única passou novamente nos onze testes de integração da #26.
- RN-01 a RN-13 constam em 470 casos na verificação dos nomes dos testes.
- Lint, tipos, testes e build do monorepo passaram; OpenAPI validado sem erros, com cinco
  avisos preexistentes.
- Um smoke independente iniciou o `AppModule` compilado, com autenticação e HTTP reais,
  e confirmou os três critérios e o destino bloqueado. Dados fictícios em `filas_test`;
  relógio fixado para alocação e cron parado somente no processo do smoke. Saída em
  [evidencias/GH-26/smoke.txt](../evidencias/GH-26/smoke.txt).
- Integração padrão recriou exclusivamente `filas_test`, aplicando as nove migrações.
  `filas_dev` não foi usado pelos testes nem recebeu a migração nesta execução.
- Comandos: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm contract:lint`,
  `pnpm --filter api test:integracao` e `pnpm --filter api test:cobertura-rn`.

## Garantias e limites da implementação

- `SenhasService.emitirNaFila` compartilha a emissão normal e a derivada: fila ativa,
  contador diário, número e criação. O encaminhamento reutiliza a triagem original;
  o fluxo normal da #16 continua recusando emissão repetida da mesma triagem.
- Origem bloqueada para escrita e índice único `encaminhamento_atendimento_id_key` impedem
  duplicidade; duas requisições geram 201/409 e uma senha. Inserção direta duplicada também
  recebe P2002. Origens distintas na mesma fila geram números distintos sob concorrência.
- Auditoria, encaminhamento, senha e contador participam da mesma transação. O marcador
  `@Auditar({ naTransacao: true })` evita duplicar o registro global. A auditoria aponta
  para o ID do encaminhamento e usa ator/perfil, IP, agente e request ID da requisição.
- Falha de auditoria retorna 500 e desfaz todos os registros e o contador, sem evento.
  `senha.criada` usa apenas `SenhaResumo` e é publicado após o commit real da transação.
- RN-02 respeita o enquadramento legal; RN-03 exige motivo na urgência sugerida; RN-11
  impede encaminhar antes da validação e permite após aprovação. Triagem e tipo originais
  foram conferidos no banco e não são alterados.
- O POST exige `encaminhamento:criar`; `consultar` sozinho recebe 403, inclusive para
  atendimento inexistente. Sem token: 401; origem de outra unidade: 404 neutro.
- A migração acrescenta unicidade e exige que registros anteriores atendam à decisão
  de um encaminhamento por atendimento. Não há migração de dados clínicos.
- Não há alteração de UI, OpenAPI ou `packages/contracts` neste PR de implementação.

O motivo é conteúdo sensível da resposta individual, como define a Tabela 23; não pode ser
incluído no evento `senha.criada` nem em listagens. Revisão, CI remoto e merge da implementação
com `Closes #26` permanecem pendentes. O relatório preserva as decisões e evidências para o
resumo final; a #28 continua fora do escopo.
