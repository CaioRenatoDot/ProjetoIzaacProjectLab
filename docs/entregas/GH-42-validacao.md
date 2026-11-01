# GH-42 — telão e consulta pública

Front-end da etapa 6.5 implementado na aplicação `publico`, independente de login e de `web`.
Os critérios foram verificados com dados fictícios. Integração com os serviços reais #19/#20,
CI remoto, revisão e merge continuam a cargo da entrega integrada do time.

## Abrir e testar

Execute `corepack pnpm --filter publico dev` e acesse:

- `http://localhost:3001/telao`: chamada atual e quatro anteriores, unidade e relógio.
- `http://localhost:3001/consulta`: acompanhamento da senha pelo celular.
- `http://localhost:3001/demonstracao`: controles da simulação, em uma segunda aba.

Na demonstração: **Nova chamada**, **Rechamar**, **Simular queda**, **Reconectar**,
**Limpar chamadas** e **Reiniciar demonstração**. Os controles usam somente dados fictícios
armazenados no navegador. Não existe integração de demonstração com dados clínicos reais.

Senhas de teste:

| Número | Situação                                           |
| ------ | -------------------------------------------------- |
| F014   | Chamada inicial: dirigir-se à Sala 03              |
| F015   | Aguardando: 4ª posição, aproximadamente 22 minutos |
| F020   | Aguardando: posição disponível, sem estimativa     |
| F021   | Ausente: procurar a recepção                       |
| F022   | Desistência: procurar a recepção                   |
| F999   | Inexistente: mensagem neutra                       |

Uma nova chamada pode mudar o status de F015 na consulta. A atualização da consulta e o polling
de recuperação do telão ocorrem a cada 30 segundos. Chamadas e rechamadas por evento são imediatas.
A demonstração só está habilitada quando a simulação está ativa, padrão em desenvolvimento.

## Verificação do escopo

| Requisito                                                | Evidência                                                                                                                                       |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Telão só recebe número, especialidade, local e sequência | Testes de projeção descartam nome, prioridade, dados clínicos, posição e estimativa; teste de navegador confirma ausência desses dados no telão |
| Nova chamada move a anterior; histórico de quatro        | Testes de apresentação e de navegador                                                                                                           |
| Rechamada destaca brevemente e anuncia novamente         | Sequência atualizada, sem duplicar histórico; aria-live assertivo e destaque estático por quatro segundos, sem piscar                           |
| Queda mantém a última chamada                            | Teste avança 60 segundos desconectado e verifica retenção                                                                                       |
| Reconexão reconstrói painel                              | Consumo de painel.estado e recuperação HTTP; teste com chamada ocorrida durante a queda                                                         |
| Sem chamadas                                             | Mensagem neutra e relógio preservado                                                                                                            |
| Consulta inexistente ou de outro dia                     | Erro 404 com texto fixo neutro, sem expor detalhe da API                                                                                        |
| Sem estimativa                                           | Exibe posição e nota explicativa                                                                                                                |
| Chamada, ausência e desistência                          | Orientação de dirigir-se ao local ou procurar a recepção                                                                                        |
| Texto ampliado em 200% a 375 px                          | Verificação de largura e captura; sem rolagem horizontal                                                                                        |
| Acessibilidade                                           | axe, contraste de texto calculado ≥ 7:1 nos elementos verificados, teclado, atualização em aria-live                                            |
| Estados de carregamento e erro                           | Testes de componente, recuperação e preservação do último resultado                                                                             |
| Atualização automática                                   | Testes de componente e navegador avançam o relógio em 30 segundos                                                                               |

## Identidade visual

As telas reutilizam o tema CSS de `@filas/ui`, com as mesmas cores, fonte, campos,
botões e bordas da aplicação operacional. O compartilhamento se limita ao tema,
sem importar `web` ou autenticação. Permanecem as escalas de leitura das telas públicas,
o contraste de texto de 7:1 e a ampliação de texto na consulta.

## Evidências visuais

- [Telão com chamada e histórico](../evidencias/GH-42/telao-chamada.png)
- [Telão sem chamadas](../evidencias/GH-42/telao-vazio.png)
- [Consulta em 375 px](../evidencias/GH-42/consulta-375.png)
- [Consulta com texto a 200%](../evidencias/GH-42/consulta-200.png)

## Validação local

- 22 testes de unidade/componente aprovados.
- 9 testes de navegador aprovados, incluindo a separacao do rodape em 1920 x 1080, 1734 x 976 e 1366 x 768.
- Lint, TypeScript e build de produção aprovados.
- Testes públicos incluídos no workflow de CI, após a suíte de web.

```powershell
corepack pnpm --filter publico test
corepack pnpm --filter publico lint
corepack pnpm --filter publico typecheck
corepack pnpm --filter publico build
corepack pnpm --filter publico exec playwright test --workers=2
```

## Adaptação aos serviços reais

Configure `apps/publico/.env.local` a partir do exemplo da aplicação e defina
`NEXT_PUBLIC_API_MOCK=false`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SOCKET_URL`,
`NEXT_PUBLIC_UNIDADE_ID` com o UUID real e `NEXT_PUBLIC_UNIDADE_NOME`.

O cliente HTTP não envia cookies nem Authorization. O Socket.IO conecta ao namespace
`/painel` sem autenticação e escuta `chamada.exibir` e `painel.estado`.
As respostas HTTP e os eventos são reconstruídos em projeções locais explícitas; propriedades
extras não são repassadas ao telão. Os DTOs e os serviços da API ainda precisam garantir
que dados privados nunca sejam enviados pela rede.

**Pontos a confirmar com #19/#20, sem alterar o contrato neste PR:**

1. O contrato não define o handshake para entrar na sala `unidade:{id}`.
   O cliente usa **proposta** de query `unidadeId`; ajustar quando #19 definir o protocolo.
2. O evento de chamada possui sequência; `ChamadaPublica` no snapshot HTTP não possui.
   Snapshots sem esse campo são aceitos; para a mesma chamada preserva-se a sequência já recebida.
3. O nome da unidade não vem no endpoint público do painel; usa configuração do terminal.
4. A consulta consome status, posição, estimativa e local e exibe orientações públicas fixas;
   o campo livre `orientacao` não é encaminhado ao componente.
5. Confirmar quais transições além de CHAMADA devem exibir o local quando a equipe publicar
   os endpoints. No front, CHAMADA mostra o local; demais estados seguem a orientação da equipe.

Sinal sonoro permanece fora do escopo (#51). Não foram alterados os documentos originais,
o contrato compartilhado nem funcionalidades da aplicação operacional.
