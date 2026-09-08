# ADR-001 — Stack TypeScript de ponta a ponta

- **Status:** aceito
- **Data:** 2026-09-08
- **Decidem:** os cinco integrantes do time

## Contexto

O time tem cinco pessoas: três com foco em front-end (Caio Renato, Caio Gabriel, Thalita) e duas
com foco em back-end (Rildo, Nathan). O sistema tem 20 casos de uso, 18 telas e prazo de projeto
acadêmico. As telas de fila e telão exigem atualização em tempo real (RNF-03) e o sistema inteiro
exige RBAC e trilha de auditoria (RNF-01, RNF-05).

## Decisão

Next.js 15 + React 19 no front-end, NestJS 11 no back-end, PostgreSQL 16 com Prisma, tudo em
TypeScript, em um monorepo pnpm + Turborepo.

## Consequências

**A favor**

- Uma linguagem só. Os schemas Zod de validação são escritos uma vez em `packages/contracts` e
  usados no controller do NestJS e no formulário React — não há divergência de validação entre
  cliente e servidor, que é a origem mais comum de bug em formulário com regra condicional
  (RN-01, RN-03).
- O time de front consegue ler e revisar o back, e vice-versa, com duas pessoas apenas no back.
- NestJS tem guard e interceptador de primeira classe, que é exatamente a forma de implementar
  RNF-01 e RNF-05 sem espalhar `if` por controller.
- Socket.IO com NestJS entrega o tempo real do painel de fila sem infraestrutura adicional.

**Contra**

- Node.js exige atenção com operações de CPU pesada; os relatórios de RF-10 devem ser agregados
  em SQL, não em memória.
- O ecossistema muda rápido; as versões são fixadas no `package.json` e só sobem em issue própria.

## Alternativas consideradas

| Alternativa | Motivo da recusa |
| --- | --- |
| Spring Boot + React | Duas linguagens, duas cadeias de build; com dois back-enders, o custo de contexto não compensa |
| .NET + Angular | Nenhum integrante declarou familiaridade; curva alta para o prazo |
| FastAPI + React | Bom para os relatórios, mas o tempo real e o RBAC exigiriam mais código próprio que no NestJS |
