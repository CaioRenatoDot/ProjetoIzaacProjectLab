# GH-20 — Endpoints públicos do telão e da consulta

## Estado da entrega

Contrato mergeado na `develop` no PR #122, após a implementação da #19 no PR #120.
Os dois endpoints estão implementados e validados localmente na branch
`feat/GH-20-endpoints-publicos`, sem alterar o contrato. A entrega ainda aguarda revisão,
CI remoto e merge da implementação para concluir a #20.

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

## Critérios de aceite verificados

| Critério da issue                                               | Evidência em `apps/api/src/publico/publico.int-spec.ts`                                                             | Resultado |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | --------- |
| Senha aguardando retorna posição e status sem dados de paciente | HTTP sem token; teste RN-04 ordena prioridade, chegada e agendamento e compara os seis campos públicos              | Passou    |
| Número inexistente retorna 404 neutro                           | Teste UC-08 compara respostas de inexistente, ontem e duplicada entre unidades, em RFC 7807                         | Passou    |
| A 31ª requisição do mesmo IP no minuto retorna 429              | Teste RNF-02 alterna rotas, forja `X-Forwarded-For`, confere `Retry-After` e liberação após 60 segundos             | Passou    |
| Chamadas do telão contêm apenas número, especialidade e local   | Teste UC-09 confere exatamente os três campos, atual e quatro anteriores, painel vazio e isolamento por unidade/dia | Passou    |

O envelope HTTP do telão inclui `servidorEm`, como já previsto no OpenAPI; esse campo
não faz parte das chamadas nem do evento `painel.estado` da #19.

Além desses testes, um smoke independente iniciou o `AppModule` compilado, com HTTP real
e dados fictícios em `filas_test`, e confirmou os quatro critérios. A saída resumida está
em [evidencias/GH-20/smoke.txt](../evidencias/GH-20/smoke.txt). Os cron jobs foram parados
somente nesse processo de smoke, para não alterar as massas durante a conferência.

## Validação local

- 80 testes do pacote `@filas/contracts` passaram, incluindo cinco casos novos da #20.
- As projeções recusam campos pessoais e clínicos, inclusive no histórico e na chamada atual.
- Consulta aceita estimativa nula, local nulo e os nove estados definidos no documento.
- OpenAPI validado sem erros; permanecem os cinco avisos preexistentes.
- Lint, tipos, testes e build do monorepo passaram localmente.
- Backend: 230 testes unitários e 209 testes de integração passaram.
- A suíte de integração padrão recriou exclusivamente `filas_test`, com as oito migrações;
  `filas_dev` não foi usado. RN-01 a RN-13 constam em 439 casos na verificação dos nomes.
- Testes de negócio cobrem o limite de 9/10 senhas, arredondamento, estimativa nula após
  chamada e isolamento dos IPs. Integração confirma que rechamadas, outro dia e outra fila
  não aumentam a amostra; a média não é multiplicada pela posição.
- O dia civil é `America/Sao_Paulo`, como na emissão da senha; o teste cobre emissão na
  data UTC anterior que ainda pertence ao dia local da consulta.
- O limiter é compartilhado pelas duas rotas. Respostas, inclusive erros, usam `no-store`;
  `Retry-After` é exposto no CORS, conferido também no smoke com origem da aplicação pública.

Comandos: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm contract:lint`,
`pnpm --filter api test:integracao` e `pnpm --filter api test:cobertura-rn`.

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
sem exigir novo campo na tela W-10. As duas regras têm testes de integração.

Este relatório registra o escopo, as decisões e a evidência da #20 para compor o resumo
final das entregas, junto aos relatórios das demais issues em `docs/entregas/`.

## Limites e conclusão

O limite por IP fica em memória e vale para uma instância. Antes de distribuir a API,
é necessário compartilhar o estado do limite, assim como o transporte da #19. O servidor
atual não confia em `X-Forwarded-For`; implantação com proxy exige configurar somente
proxies confiáveis para que cada cliente conserve seu próprio IP.

As respostas usam os schemas públicos aprovados, sem ler dados de paciente ou triagem.
Essas leituras não são sensíveis e não geram auditoria (ADR-003). Não há alteração de UI,
de `packages/contracts` ou do OpenAPI nesta implementação. Integração das telas continua
registrada em `docs/07-pendencias-integracao.md`.

Revisão, CI remoto e merge da implementação com `Closes #20` permanecem pendentes.
