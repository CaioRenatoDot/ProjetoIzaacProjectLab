# Arquitetura e Stack

Documento de referência técnica. Toda decisão aqui deriva de um requisito da especificação
original e cita o identificador correspondente.

## 1. Visão geral

O sistema é um monorepo com três aplicações e pacotes compartilhados:

```
projeto-filas-clinica-escola/
├── apps/
│   ├── api/            NestJS  — regras de negócio, persistência, WebSocket
│   ├── web/            Next.js — aplicação operacional autenticada (W-01 a W-08, W-11 a W-18)
│   └── publico/        Next.js — telão da sala de espera e consulta de senha (W-09, W-10)
├── packages/
│   ├── contracts/      Tipos e schemas Zod gerados a partir do OpenAPI
│   ├── ui/             Design system acessível compartilhado entre web e publico
│   ├── eslint-config/  Configuração de lint compartilhada
│   └── tsconfig/       Bases de tsconfig
├── docs/
└── especificacao/
```

### Por que `publico` é uma aplicação separada

O telão (W-09) e a consulta do paciente (W-10) não têm autenticação, exibem apenas número da
senha, especialidade e local (P-03 / RNF-02), e exigem contraste 7:1 e tipografia mínima de
96 px em tela de 42" (P-02 / RNF-06). Separar evita que o bundle autenticado, os interceptadores
de sessão e o design system operacional cheguem a um terminal público — o que reduz a superfície
de exposição de dado sensível e permite escala tipográfica própria sem contaminar a aplicação
operacional.

## 2. Stack

| Camada | Escolha | Versão-alvo | Justificativa |
| --- | --- | --- | --- |
| Front-end | Next.js (App Router) + React + TypeScript | 15 / 19 | Server Components reduzem o JS enviado a terminais modestos da clínica; roteamento por segmento casa com a navegação por módulos (ADR-002) |
| Estado servidor | TanStack Query | 5 | Cache, revalidação por intervalo e invalidação por evento WebSocket no painel de fila (RNF-03) |
| Formulários | React Hook Form + Zod | — | Validação idêntica no cliente e no servidor, reaproveitando os schemas de `packages/contracts` |
| Estilo | Tailwind CSS + Radix Primitives | 4 / — | Radix entrega foco preso em modal, atributos `aria` corretos e navegação por teclado exigidos pelo RNF-06 sem reimplementação |
| Back-end | NestJS + TypeScript | 11 | Módulos, guards e interceptadores mapeiam diretamente RBAC (RNF-01) e auditoria implícita (RNF-05) |
| ORM | Prisma | 6 | Migrações versionadas, tipagem forte e transação interativa, necessária no "chamar próxima" |
| Banco | PostgreSQL | 16 | Bloqueio de linha com SKIP LOCKED, índices parciais e funções de janela para os indicadores (RF-10) |
| Tempo real | Socket.IO | 4 | Reconexão automática e salas por especialidade; adaptador Redis opcional para múltiplas instâncias (RNF-08) |
| Agendamento | @nestjs/schedule | — | Expiração de tolerância (RN-12) e varredura de SLA (RF-11) |
| Autenticação | JWT access + refresh em cookie httpOnly | — | Sessão curta em terminal compartilhado (T-01) |
| Testes | Vitest, Supertest, Playwright | — | Unidade, integração HTTP e E2E incluindo auditoria de acessibilidade com axe-core |
| Qualidade | ESLint, Prettier, Husky, lint-staged, Commitlint | — | Padrão único de código e de mensagem de commit |
| Infra local | Docker Compose (PostgreSQL + Adminer) | — | Ambiente idêntico para os cinco integrantes |
| CI | GitHub Actions | — | Lint, testes e build em todo PR |

## 3. Camadas do back-end

Cada módulo NestJS segue a mesma divisão:

```
modulo/
├── modulo.controller.ts     HTTP: validação de entrada, códigos de status, serialização
├── modulo.service.ts        Regra de negócio; é onde as RN vivem
├── modulo.repository.ts     Acesso ao Prisma; sem regra de negócio
├── dto/                     Schemas Zod de entrada e saída
├── events/                  Eventos de domínio emitidos para o gateway WebSocket
└── modulo.spec.ts           Testes de unidade da regra
```

**Regra do projeto:** nenhuma RN é implementada no controller nem no componente React. Toda
regra de negócio fica no service e tem teste de unidade que cita a RN no nome do caso.

## 4. Decisões transversais

### 4.1 Controle de acesso (RNF-01, RF-02)

Permissão é uma string `modulo:operacao` — por exemplo `triagem:criar`, `auditoria:consultar`.
O perfil (RF-02) é um conjunto dessas strings, editável na matriz de W-05. O guard do NestJS lê
a permissão exigida do decorator `@Requer('fila:chamar')` e a compara com as permissões do token.

No front-end, ação sem permissão **não é renderizada** — nunca renderizada desabilitada (T-09).
O estado "sem permissão" usa mensagem neutra, sem revelar existência ou volume de dados (item 3.1
da especificação de UI).

### 4.2 Auditoria implícita (RNF-05, RNF-07)

Um interceptador global grava em `audit_log` toda operação de escrita e toda leitura marcada como
sensível. A tabela é append-only: sem UPDATE, sem DELETE, garantido por permissão do usuário de
banco da aplicação. A exportação da própria trilha também gera evento (T-18).

Leituras auditadas: abertura de ficha de triagem, dados clínicos na tela de atendimento e
exportações. Cada uma grava `tipo = CONSULTA_SENSIVEL` com o identificador do registro consultado.

### 4.3 Dado sensível fora de listas (P-03, RNF-02)

Motivo do atendimento, justificativa clínica e observações do atendimento **nunca** são incluídos
em resposta de endpoint de listagem. O contrato define dois DTOs distintos por entidade —
`SenhaResumo` (listas, painéis, telão) e `SenhaDetalhe` (ficha individual, exige permissão
específica e gera auditoria).

Nome do paciente aparece parcialmente ("M. A. S.") em listas e painéis, e nunca no telão público.
A abreviação é feita no servidor, não no cliente — dado que não sai do servidor não vaza no
DevTools.

### 4.4 Concorrência na chamada de senha (RN-04)

Dois atendentes podem clicar em "Chamar próxima" ao mesmo tempo. A operação roda em transação com
bloqueio de linha e SKIP LOCKED sobre a fila, ordenando por prioridade, horário de chegada e
existência de agendamento prévio. Cada requisição recebe uma senha diferente; nenhuma senha é
chamada duas vezes.

Ações de mudança de estado em senha e atendimento usam bloqueio otimista pelo campo `versao`:
requisição com versão desatualizada recebe `409 Conflito` com o estado corrente no corpo.

### 4.5 Bloqueio por ausência de supervisor (RN-10, P-04)

O bloqueio é **por especialidade**, nunca global. Materializa-se em três lugares, todos derivados
do mesmo estado no servidor:

1. `GET /filas/{id}` retorna `bloqueio: { ativo, motivo, desde }` — o front renderiza o banner.
2. `POST /filas/{id}/chamadas` retorna `409` com `codigo: FILA_BLOQUEADA` — o botão fica
   desabilitado com a causa em texto acessível.
3. O bloqueio entra na lista de alertas de gestão (W-18) como alerta de origem distinta.

### 4.6 Tempo real (RNF-03)

Três namespaces Socket.IO:

| Namespace | Autenticação | Salas | Eventos |
| --- | --- | --- | --- |
| `/filas` | JWT obrigatório | `especialidade:{id}` | `senha.criada`, `senha.chamada`, `senha.status_alterado`, `fila.bloqueada`, `fila.desbloqueada` |
| `/painel` | Nenhuma | `unidade:{id}` | `chamada.exibir` — apenas número, especialidade e local |
| `/alertas` | JWT + permissão de gestão | `unidade:{id}` | `sla.excedido`, `sla.normalizado` |

O namespace `/painel` nunca transporta identificador de paciente, prioridade clínica ou dado de
saúde. Toda tela que consome WebSocket também faz polling de baixa frequência como degradação
graciosa; perda de conexão congela ações de escrita e mantém leitura com aviso de desatualização
(RNF-04).

### 4.7 Parâmetros da unidade

A seção 7 da especificação de UI lista cinco valores que dependem de definição da unidade. Nenhum
deles é constante no código: todos ficam na tabela `parametro_unidade`, editáveis por
administração.

| Parâmetro | Onde afeta | Padrão provisório |
| --- | --- | --- |
| Prazo de tolerância por especialidade | RN-12, W-15 | 5 minutos |
| Limite de SLA por fila | RF-11, W-18 | 25 minutos |
| Reincidências que disparam restrição | RN-13, W-06 | 3 ausências em 90 dias |
| Limite de estudantes por supervisor | RN-08, W-11 | 3 |
| Tamanho mínimo da justificativa de reclassificação | RN-01, W-07 | 20 caracteres |

Os padrões são provisórios e estão registrados como pendência na issue de decisão do backlog.

## 5. Requisitos não funcionais e onde são atendidos

| RNF | Atendimento técnico |
| --- | --- |
| RNF-01 Segurança e acesso | Guard de permissão por rota; ação sem permissão não renderizada; estado neutro de negação |
| RNF-02 Dado sensível | DTOs separados resumo/detalhe; TLS; coluna de dado clínico com acesso auditado |
| RNF-03 Desempenho | Índices em `(fila_id, status, prioridade, criado_em)`; WebSocket em vez de polling pesado; paginação obrigatória |
| RNF-04 Disponibilidade | Health check, restart automático em container, banner de perda de conexão com escrita congelada |
| RNF-05 Rastreabilidade | `audit_log` append-only alimentado por interceptador global |
| RNF-06 Usabilidade e acessibilidade | Design system sobre Radix, WCAG 2.1 AA no sistema e 7:1 no público, teste axe-core no CI |
| RNF-07 LGPD | Trilha de consulta a prontuário, aviso de registro por sessão, retenção configurável |
| RNF-08 Escalabilidade | API sem estado, adaptador Redis para Socket.IO, filtro por unidade em todas as consultas |
| RNF-09 Backup | Dump diário agendado do PostgreSQL, RPO 24h e RTO 4h documentados no runbook |

## 6. Ambientes

| Ambiente | Onde | Banco | Observação |
| --- | --- | --- | --- |
| Local | Docker Compose | `filas_dev` com seed | Seed cria perfis, 5 especialidades, salas, supervisores e pacientes fictícios |
| Homologação | Container único | `filas_hml` | Dados fictícios; usado na validação com a clínica |
| Produção | A definir com a instituição | `filas_prd` | Requer TLS, backup diário e política de retenção (RNF-07, RNF-09) |

Nenhum dado real de paciente entra em ambiente local ou de homologação.
