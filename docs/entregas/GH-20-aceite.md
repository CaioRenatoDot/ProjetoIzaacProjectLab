# GH-20 — Endpoints públicos do telão e da consulta

## Estado da entrega

Contrato preparado localmente na branch `docs/GH-20-contrato-publico`, a partir da
`develop` com a implementação da #19 mergeada no PR #120.
**A #20 ainda não está concluída: os endpoints HTTP não foram implementados.**
O contrato deve ser aprovado pelo tech lead e pelo dono do módulo e mergeado antes
da implementação, conforme `AGENTS.md` §6 e `docs/05-fluxo-github.md` §4.

## Fontes conferidas

- Documento de Requisitos de Sistema, UC-08 (p. 28), UC-09 e Apêndice A (p. 41).
- `especificacao/funcionalidades_casos_de_uso.docx`, UC-08; e
  `especificacao/especificacao_requisitos.docx`.
- `docs/01-arquitetura.md` §3 e §4; `docs/03-modelo-de-dados.md` §3.3.
- `docs/04-contrato-api.md` §2 e §4 e a tag Público no OpenAPI.
- ADR-003 e `docs/.ref/MODULOS/acesso-publico/spec.md`.
- `docs/.ref/SPECS/backend/`, `docs/.ref/SPECS/database/` e
  `docs/07-pendencias-integracao.md`, seção Telão e consulta pública.
- Descrição atual da [issue #20](https://github.com/CaioRenatoDot/ProjetoIzaacProjectLab/issues/20).

## Critérios de aceite e verificação prevista

| Critério da issue                                               | Contrato                                                                  | Evidência de execução necessária                                                            |
| --------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Senha aguardando retorna posição e status sem dados de paciente | `ConsultaSenhaPublica`, schema independente e estrito                     | Teste HTTP sem token, com ordenação RN-04, e conferência das chaves; pendente               |
| Número inexistente retorna 404 neutro                           | `SENHA_NAO_ENCONTRADA`, mesma mensagem para outro dia                     | Comparar respostas de número inexistente e de ontem; pendente                               |
| A 31ª requisição do mesmo IP no minuto retorna 429              | `LIMITE_REQUISICOES`, `Retry-After`, limite compartilhado em `/publico/*` | Testar as duas rotas, IPs distintos e cabeçalho encaminhado forjado; pendente               |
| Chamadas do telão contêm apenas número, especialidade e local   | `EstadoPainelPublico` com `ChamadaPublica` estrita                        | HTTP com chamada atual e quatro anteriores, painel vazio e isolamento por unidade; pendente |

O envelope HTTP do telão inclui `servidorEm`, como já previsto no OpenAPI; esse campo
não faz parte das chamadas nem do evento `painel.estado` da #19.

## Validação do contrato

- 80 testes do pacote `@filas/contracts` passaram, incluindo cinco casos novos da #20.
- As projeções recusam campos pessoais e clínicos, inclusive no histórico e na chamada atual.
- Consulta aceita estimativa nula, local nulo e os nove estados definidos no documento.
- OpenAPI validado sem erros; permanecem os cinco avisos preexistentes.
- Lint, tipos, testes e build do monorepo passaram localmente.

Esses testes validam schemas; não substituem os testes de negócio, HTTP e PostgreSQL
exigidos para concluir a implementação.

## Decisões aprovadas pelo responsável

O UC-08 manda exibir somente a posição quando os dados forem insuficientes, mas não define
o tamanho da amostra nem a fórmula da estimativa pública. O limite de 10 atendimentos em
`docs/08-pendencias.md` e no contrato de indicadores pertence à #27 e não define a #20.

Em 27/10/2026, Neithan Rodrigues aprovou explicitamente nesta sessão:

1. **Estimativa:** média entre chegada e primeira chamada das senhas da mesma fila no dia;
   permitir estimativa a partir de 10 senhas chamadas e retornar `null` abaixo disso.
   Cada senha conta uma vez; rechamadas não aumentam a amostra. O resultado é a média
   de espera da fila, sem multiplicá-la pela posição. O limite é a regra aprovada para
   esta entrega, independente do indicador de amostra pequena da #27.
2. **Número duplicado:** se mais de uma senha corresponder ao número no dia, devolver o
   mesmo 404 neutro de senha inexistente ou de outro dia. Não selecionar um registro
   arbitrariamente nem expor a duplicidade na resposta.

O segundo caso existe porque a migração `20261025150000_contador_senha` garante unicidade
por fila, número e dia, não entre todas as filas/unidades. A decisão mantém a rota atual,
sem exigir novo campo na tela W-10. As duas regras precisam de testes de integração.

Este relatório registra o escopo, as decisões e a evidência da #20 para compor o resumo
final das entregas, junto aos relatórios das demais issues em `docs/entregas/`.

## Próxima etapa

Revisar e mergear o contrato em PR com `Refs #20`. Depois implementar
o módulo público (controller, service, repository e DTO), executar os critérios acima,
atualizar este relatório e abrir o PR da implementação com `Closes #20`.
