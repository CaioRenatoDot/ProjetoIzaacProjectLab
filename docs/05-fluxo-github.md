# Fluxo de Trabalho no GitHub

## 1. Repositório

Repositório único (monorepo), branch padrão `main` protegida.

**Proteção da `main`:**

- Merge apenas por Pull Request
- Uma aprovação obrigatória (ver pares de revisão em `docs/02-divisao-responsabilidades.md`)
- CI verde obrigatório: lint, testes, build e validação do contrato
- Sem push direto, inclusive para o tech lead
- Merge por *squash*, para que cada PR vire um commit na `main`

## 2. Branches

```
tipo/GH-<numero-da-issue>-descricao-curta
```

| Tipo | Uso |
| --- | --- |
| `feat` | Funcionalidade nova |
| `fix` | Correção de defeito |
| `docs` | Documentação, contrato, ADR |
| `chore` | Infraestrutura, dependências, CI |
| `refactor` | Mudança interna sem alterar comportamento |
| `test` | Apenas testes |

Exemplos: `feat/GH-42-chamar-proxima-senha`, `fix/GH-77-tolerancia-nao-expira`.

Uma branch por issue. Branch sem issue não é aceita — issue é o que dá rastreabilidade ao
requisito.

## 3. Commits

Conventional Commits, verificado por Commitlint no hook de `commit-msg`:

```
<tipo>(<escopo>): <resumo no imperativo, minúsculo, sem ponto final>

<corpo opcional explicando o porquê>

Refs #<numero-da-issue>
```

Escopos: `api`, `web`, `publico`, `contracts`, `ui`, `db`, `ci`, `docs`.

```
feat(api): implementa chamada da proxima senha com bloqueio de linha

Duas requisicoes simultaneas recebiam a mesma senha porque a selecao e a
atualizacao rodavam fora da mesma transacao.

Refs #42
```

O commit explica **por que**, não o que — o "o que" já está no diff.

## 4. Pull Requests

Título no mesmo formato do commit. O template preenche o corpo. Regras:

- PR pequeno: alvo de até 400 linhas alteradas. Acima disso, quebrar a issue.
- Marcar `Closes #N` para a issue fechar no merge.
- PR em rascunho enquanto estiver em andamento.
- PR que altere `docs/api/openapi.yaml` ou `packages/contracts` exige aprovação do tech lead e
  do back-end dono do módulo, e não pode conter implementação junto — contrato vai em PR próprio.
- Toda alteração de UI leva captura de tela ou vídeo curto no corpo do PR.

### Definition of Done

Uma issue só é fechada quando **todos** os itens valem:

1. Critérios de aceite da issue verificados manualmente
2. Testes automatizados cobrindo a regra de negócio citada (RN) na issue
3. Lint e formatação sem erro
4. Contrato atualizado, se o endpoint mudou
5. Estados de carregamento, vazio, erro e sem permissão implementados, no caso de tela
   (item 3.1 da especificação de UI)
6. Acessibilidade verificada quando há tela: navegação por teclado, rótulo visível, contraste
   (RNF-06)
7. Auditoria registrada quando a operação é sensível (RNF-05)
8. Revisado e aprovado por outra pessoa
9. CI verde

## 5. Labels

| Label | Cor | Uso |
| --- | --- | --- |
| `tipo: feature` | `#0E8A16` | Funcionalidade nova |
| `tipo: bug` | `#D73A4A` | Defeito |
| `tipo: docs` | `#0075CA` | Documentação e contrato |
| `tipo: chore` | `#FEF2C0` | Infraestrutura, CI, dependências |
| `tipo: decisão` | `#5319E7` | Pendência que precisa de definição da unidade |
| `camada: back-end` | `#1D76DB` | Trabalho na API |
| `camada: front-end` | `#C5DEF5` | Trabalho em web ou publico |
| `camada: banco` | `#006B75` | Migração ou schema |
| `camada: infra` | `#BFD4F2` | Monorepo, Docker, CI |
| `módulo: acesso` | `#E4E669` | Autenticação, perfis, permissões |
| `módulo: cadastros` | `#E4E669` | Cinco entidades base |
| `módulo: triagem` | `#E4E669` | Triagem e emissão de senha |
| `módulo: fila` | `#E4E669` | Fila, chamada, telão |
| `módulo: alocação` | `#E4E669` | Estudante, supervisor, sala |
| `módulo: atendimento` | `#E4E669` | Ciclo do atendimento e encaminhamento |
| `módulo: ausências` | `#E4E669` | Ausência e desistência |
| `módulo: indicadores` | `#E4E669` | Indicadores, alertas, auditoria |
| `prioridade: alta` | `#B60205` | Bloqueia outras issues |
| `prioridade: média` | `#FBCA04` | Caminho normal |
| `prioridade: baixa` | `#0E8A16` | Pode escorregar de milestone |
| `acessibilidade` | `#7057FF` | Item com requisito de RNF-06 |
| `lgpd` | `#D4C5F9` | Toca dado sensível ou auditoria (RNF-02, RNF-07) |
| `bloqueada` | `#000000` | Depende de outra issue ou de decisão externa |

O arquivo `.github/labels.yml` tem a lista em formato importável.

## 6. Milestones

| Milestone | Objetivo | Entrega verificável |
| --- | --- | --- |
| **M0 — Fundação** | Monorepo, banco, CI, contrato, design system base | `pnpm dev` sobe as três aplicações; CI verde na `main` |
| **M1 — Acesso e cadastros** | Login, perfis, permissões, cinco cadastros base | Administrador cria perfil, usuário e os cinco cadastros |
| **M2 — Triagem e senha** | Triagem, emissão de senha, reclassificação | Paciente triado recebe senha posicionada na fila |
| **M3 — Fila, chamada e alocação** | Painel de fila, chamar próxima, telão, alocação | Senha percorre aguardando → chamada → alocada, com telão exibindo |
| **M4 — Atendimento e encaminhamento** | Ciclo completo do atendimento e encaminhamentos | Senha vai de alocada a encerrada, com validação do supervisor |
| **M5 — Ausências, indicadores e auditoria** | No-show, desistência, indicadores, SLA, trilha | Gestão vê indicadores e alertas; auditoria consultável |
| **M6 — Acessibilidade, testes e entrega** | WCAG AA, E2E, documentação final, implantação | Auditoria de acessibilidade sem violação crítica; sistema em homologação |

Cada milestone termina com uma demonstração do fluxo ponta a ponta que ela habilita. Milestone
não fecha com issue aberta: ou a issue entrega, ou é movida com justificativa no comentário.

## 7. Anatomia de uma issue

Toda issue do backlog segue esta estrutura, e nenhuma entra sem rastreabilidade:

```markdown
## Contexto
Por que isso existe, citando o documento de origem.

## Rastreabilidade
UC-09 · RF-05 · RN-04, RN-10 · W-08 / T-09

## Escopo
- [ ] Item verificável
- [ ] Item verificável

## Fora de escopo
O que explicitamente não entra, com a issue que cobre.

## Critérios de aceite
**Dado** que ... **quando** ... **então** ...

## Dependências
Depende de #N. Bloqueia #M.

## Notas técnicas
Endpoint, tabela, decisão de arquitetura relevante.
```

O critério de aceite é escrito de forma que qualquer pessoa do time consiga verificar sem
perguntar ao autor. "Funcionar corretamente" não é critério de aceite.

## 8. Quadro do projeto

Um GitHub Project (tabela) com as colunas:

`Backlog` → `Pronta para começar` → `Em andamento` → `Em revisão` → `Concluída`

Uma issue só entra em `Pronta para começar` quando não tem dependência aberta. Limite de duas
issues em `Em andamento` por pessoa — trabalho parado em revisão é resolvido antes de começar
outro.

## 9. Ritmo

| Cerimônia | Quando | Duração |
| --- | --- | --- |
| Planejamento da milestone | Início de cada milestone | 1h |
| Acompanhamento | Duas vezes por semana | 15 min |
| Revisão e demonstração | Fim da milestone | 45 min |

Impedimento não espera a próxima reunião: vai para o comentário da issue com a label
`bloqueada` no mesmo dia.
