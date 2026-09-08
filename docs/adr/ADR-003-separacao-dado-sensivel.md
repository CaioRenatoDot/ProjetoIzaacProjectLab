# ADR-003 — Separação de dado sensível no contrato da API

- **Status:** aceito
- **Data:** 2026-09-08

## Contexto

A premissa P-03 da especificação de UI e os requisitos RNF-02 e RNF-07 impõem que motivo do
atendimento e demais dados de saúde não apareçam em listas, painéis nem no telão público; que o
telão exiba somente número da senha, especialidade e local; que listas exibam nome parcial; e que
cada abertura de conteúdo clínico gere registro de auditoria.

Se o mesmo objeto `Senha` for devolvido por todos os endpoints, basta um `console.log`, uma aba
de rede aberta na sala de espera ou um componente novo esquecido para vazar dado de saúde — e a
auditoria de consulta (RNF-07) fica impossível de determinar, porque não há como saber se o campo
clínico foi de fato consultado ou apenas trafegou junto.

## Decisão

O contrato define três projeções distintas e mutuamente exclusivas para senha:

| Projeção | Endpoints | Campos | Auditoria |
| --- | --- | --- | --- |
| `SenhaPublica` | `GET /publico/*`, evento `chamada.exibir` | número, especialidade, local | nenhuma |
| `SenhaResumo` | listagens, painel de fila, indicadores | número, iniciais do paciente, especialidade, tipo, prioridade, status, horários | nenhuma |
| `SenhaDetalhe` | `GET /senhas/{id}`, tela de atendimento | resumo + triagem completa, motivo, justificativa, observações | evento `CONSULTA_SENSIVEL` |

Regras de implementação:

1. A abreviação do nome do paciente acontece no servidor. O nome completo não sai da API em
   nenhum endpoint de listagem.
2. `SenhaDetalhe` exige a permissão `triagem:consultar_sensivel` e sempre grava auditoria antes de
   responder.
3. Endpoint sob `/publico` roda em um controller sem o guard de sessão e com um serializador
   próprio que só conhece os três campos de `SenhaPublica` — não é filtro por omissão, é um tipo
   que não tem os outros campos.
4. Teste de contrato no CI falha se qualquer resposta de listagem contiver as chaves `motivo`,
   `justificativaClinica`, `observacoes` ou `nomeCompleto`.

## Consequências

- Mais tipos para manter, e algumas telas precisam de duas requisições (resumo na lista, detalhe
  ao abrir a ficha). É um custo aceito.
- A trilha de RNF-07 passa a ser verdadeira: um registro `CONSULTA_SENSIVEL` significa que alguém
  de fato abriu o conteúdo clínico.
- O item 4 dá ao requisito de privacidade uma verificação automática, em vez de depender de
  revisão humana em cada PR.
