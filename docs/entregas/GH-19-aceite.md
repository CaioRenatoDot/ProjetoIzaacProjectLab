# GH-19 — Contrato e verificação do aceite

Esta entrega prepara o contrato da [issue #19](https://github.com/CaioRenatoDot/ProjetoIzaacProjectLab/issues/19).
Não conclui a issue. A implementação começa após aprovação e merge do PR de contrato,
conforme `AGENTS.md` §6 e `docs/05-fluxo-github.md` §4.

## Fontes conferidas

- Documento de Requisitos de Sistema: RN-07, RN-10, UC-09 e UC-10.
- `docs/01-arquitetura.md` §4.5 e §4.6: bloqueio por especialidade e namespaces.
- `docs/04-contrato-api.md` §7: eventos e cargas.
- `docs/api/openapi.yaml`: `Fila.bloqueio`, `ChamadaPublica` e estado público do telão.
- ADR-003: ausência de paciente, prioridade e dados clínicos na projeção pública.
- `docs/07-pendencias-integracao.md`: clientes existentes usam `especialidadeId` e `unidadeId`
  na query do handshake, até então registrados como proposta de adaptação.

## Escopo deste PR de contrato

- Completar `EventosFila` com `fila.desbloqueada` e `fila.metricas`, já documentados.
- Exportar schemas próprios para os eventos públicos, sem depender de `SenhaResumo`.
- Especificar os campos do handshake e a autorização das salas por unidade.
- Testar a recusa de dados pessoais e clínicos nas cargas públicas.

## Critérios da issue: evidência exigida na implementação

| Critério de aceite                                                                              | Verificação necessária                                            | Estado                                |
| ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------- |
| Sem supervisor disponível, chamar próxima retorna `409 FILA_BLOQUEADA` e emite `fila.bloqueada` | Integração HTTP + cliente Socket.IO real na especialidade correta | Pendente                              |
| Supervisor regularizado, consultar fila remove o bloqueio e emite `fila.desbloqueada`           | Integração com turno, habilitação e capacidade reais              | Pendente                              |
| Chamada chega a `/painel` sem paciente nem prioridade                                           | Inspeção das chaves recebidas por cliente Socket.IO real          | Pendente; schemas públicos preparados |
| `/filas` recusa conexão sem token                                                               | Handshake com cliente Socket.IO real                              | Pendente                              |

## Entregáveis adicionais a conferir antes de concluir a issue

- Bloqueio restrito à especialidade que exige supervisão, incluindo virada de turno,
  inativação e ocupação/liberação de supervisor.
- `bloqueio: { ativo, motivo, desde }` no detalhe e no quadro da fila.
- Os sete eventos solicitados no namespace `/filas`, emitidos após commit.
- `painel.estado` na conexão e reconexão; chamada atual e quatro anteriores sem dados pessoais.
- `/alertas` exige JWT e `alertas:consultar`; salas não atravessam unidades.
- Expiração do token encerra a conexão; CORS próprio do Socket.IO.
- Falha ou rollback não publica evento de uma escrita que não aconteceu.
- Testes citam RN-10; lint, tipos, testes e build passam; limitações de múltiplas instâncias
  ficam documentadas se o adaptador ainda for em memória.

Os eventos de SLA (#28), os endpoints públicos HTTP (#20) e as demais issues não fazem parte
deste PR. A issue #19 permanece aberta até a implementação, a revisão e o CI serem concluídos.
