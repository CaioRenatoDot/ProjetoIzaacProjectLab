# Mapeamento de Módulos e Documentação — Clínica-Escola

Estrutura de documentação organizada conforme orientação passada em aula (mapear módulos primeiro, depois documentar cada um): `MODULOS/` por módulo de negócio e `SPECS/` por camada técnica. As instruções para quem trabalha no projeto (pessoa ou IA) estão no [`AGENTS.md`](../../AGENTS.md) da raiz, único para o projeto todo.

```
docs/.ref/
├── MODULOS/                          # RN, RF e UC por módulo de negócio
│   ├── usuarios-e-permissoes/spec.md
│   ├── cadastros-base/spec.md
│   ├── triagem-e-senha/spec.md
│   ├── fila/spec.md
│   ├── chamada-e-alocacao/spec.md
│   ├── atendimento/spec.md
│   ├── encaminhamento/spec.md
│   ├── ausencias-e-desistencias/spec.md
│   ├── indicadores-alertas-auditoria/spec.md
│   └── acesso-publico/spec.md        # telão e consulta de senha (apps/publico); sem RF/UC próprios
└── SPECS/                            # RNF e índices por camada técnica
    ├── requisitos-nao-funcionais.md  # RNF-01 a RNF-09
    ├── implantacao.md                # Docker (restrição do professor), ambientes, pendências
    ├── backend/
    │   ├── spec.md                   # módulos da API ↔ MODULOS ↔ RNF
    │   ├── api.md                    # endpoints do openapi.yaml por módulo
    │   └── plano-implementacao.md    # detalhamento técnico das etapas de 06-etapas.md (apps/api, packages/contracts)
    ├── database/
    │   ├── spec.md                   # inventário de dados × entidades do docs/03
    │   └── plano-implementacao.md    # schema, restrições e seed por etapa
    └── frontend/
        ├── spec.md                   # premissas P-01..P-04, mapa de telas W × T × UC
        └── plano-implementacao.md    # telas por etapa (apps/web, apps/publico, packages/ui)
```

## Relação com o resto de `docs/`
`docs/.ref/` **não substitui** os documentos do time; organiza o mesmo conteúdo por módulo e por camada e aponta para eles.

| Assunto | Fonte de verdade |
|---|---|
| Regras, casos de uso, dados, arquitetura geral, tecnologias | `especificacao/Documento de Requisitos de Sistema.pdf` (prevalece sobre tudo em `docs/`) |
| Stack, monorepo, decisões transversais | `docs/01-arquitetura.md`, `docs/adr/` |
| Responsáveis e pares de revisão | `docs/02-divisao-responsabilidades.md` |
| Modelo de dados | `docs/03-modelo-de-dados.md` |
| Contrato da API | `docs/04-contrato-api.md`, `docs/api/openapi.yaml` |
| Branches, commits, PR, Definition of Done | `docs/05-fluxo-github.md` |
| Etapas, partes e status | `docs/06-etapas.md` |

Ordem quando há divergência: Documento de Requisitos de Sistema → `docs/0x` e ADRs → `docs/.ref/`. Conflito de regra de negócio não resolvido por esses documentos não é decidido por conta própria: vira issue com a label `tipo: decisão`.

## Critério usado para separar MODULOS de SPECS
- **`MODULOS/`** = requisitos **funcionais (RF)**, regras de negócio (RN) e casos de uso (UC), agrupados por módulo de negócio. O módulo `acesso-publico` é a exceção: não tem RF/UC próprios, só referencia UC-08 e UC-09.
- **`SPECS/`** = requisitos **não funcionais (RNF)** e specs por camada técnica: backend, frontend (orientação do professor: "os specs de arquitetura podem ser tanto de backend quanto de frontend") e database.
- Nos módulos entram só notas e referências de arquitetura, nas seções "Entidades relacionadas" e "Dependências / Observações" e como `> Nota` junto ao requisito afetado.

## Ordem de leitura sugerida
1. `MODULOS/usuarios-e-permissoes` — base de acesso, todo o resto depende dele.
2. `MODULOS/cadastros-base` — entidades usadas por todos os outros módulos.
3. `MODULOS/triagem-e-senha` → `MODULOS/fila` → `MODULOS/chamada-e-alocacao` → `MODULOS/atendimento` → `MODULOS/encaminhamento` — fluxo principal do atendimento.
4. `MODULOS/ausencias-e-desistencias` — casos alternativos do fluxo acima.
5. `MODULOS/indicadores-alertas-auditoria` — consome dados de todos os anteriores.
6. `SPECS/` — requisitos transversais e índices por camada; os planos de implementação por último.

## Origem do conteúdo
O texto de RN, RF e RNF é o da especificação de requisitos (`especificacao/especificacao_requisitos.docx`, reproduzido no Documento de Requisitos de Sistema §3 e §4), e o texto dos UC é o do Documento de Requisitos §6 (versão enxuta da especificação de funcionalidades). Foi copiado sem alteração e só reorganizado por módulo; nenhum requisito foi inventado. Trechos que não vêm dos documentos do grupo (tabelas de correspondência, recortes de plano) levam o marcador `> Proposta (não consta no material do grupo):`.

### Referências ao DAS
Parte das notas cita o **DAS — Documento de Arquitetura de Software** do grupo, que não está versionado neste repositório (o Documento de Requisitos o menciona no §2). O conteúdo dele foi incorporado aos documentos do time; para conferir uma citação, use:

| Seção do DAS | Onde está neste repositório |
|---|---|
| §1–§2 (finalidade, estilo arquitetural) | `docs/01-arquitetura.md` §1 e §3 |
| §3 (metas, restrições, premissas) | `docs/01-arquitetura.md` §4; Documento de Requisitos, Apêndice A §4 |
| §5 (componentes, módulos, organização da interface) | `docs/01-arquitetura.md` §1 e §3; ADR-002 |
| §6 (concorrência, tempo real, rotinas) | `docs/01-arquitetura.md` §4.4 a §4.6; `docs/04-contrato-api.md` §6 e §7 |
| §7 (dados, invariantes, estados, retenção) | `docs/03-modelo-de-dados.md` |
| §8 (implantação e ambientes) | `docs/01-arquitetura.md` §6; `SPECS/implantacao.md` |
| §9 (API, autorização, projeções, erros, versionamento) | `docs/04-contrato-api.md`; `docs/api/openapi.yaml`; ADR-003 |
| §10 (tecnologias) | `docs/01-arquitetura.md` §2; Documento de Requisitos §7.5 (Tabela B); ADR-001 |
| §11.2 (navegação) | ADR-002 |
| §12 (qualidade, Definition of Done) | `docs/05-fluxo-github.md` §4 |
| §13 (equipe e responsabilidades) | `docs/02-divisao-responsabilidades.md` |
| §14 (riscos e pendências) | issues `tipo: decisão`; pendências abaixo |

## Pendências
Resolvidas:
- **`AGENTS.md` por módulo** — o professor indicou um `AGENTS.md` único para o projeto todo, na raiz.
- **Tabela de variações por entidade do RF-01** — completada pelo grupo na Tabela A do Documento de Requisitos §3 e transcrita em `MODULOS/cadastros-base/spec.md`.
- **`SPECS/frontend/` e `SPECS/database/`** — criados.
- **Modelo de navegação (Modelo D × Modelo A)** — ADR-002: Modelo A, painel lateral só na fila. Falta a confirmação da coordenação antes da M3.
- **Oito × nove status de senha** — `docs/03` §1: nove (prevalece a tabela).
- **Painel público no UC-09 e consulta pública (D-15, D-31)** — ADR-003 e `openapi.yaml`; ver `SPECS/backend/api.md`.
- **Ferramenta de administração do banco** — Adminer (`docker-compose.yml`).

Em aberto (para o grupo ou a coordenação):
- Confirmação do modelo de navegação com a coordenação (ADR-002).
- Valores definitivos dos parâmetros da unidade (`docs/01` §4.7, padrões provisórios).
- Base legal e prazo de retenção de triagem e atendimento; retenção de "Cadastros base" da tabela 24 (`SPECS/database/spec.md`).
- Ambiente de produção com a instituição (TLS, backup diário, retenção).
- Aplicações em contêiner para atender a orientação do professor sobre Docker (`SPECS/implantacao.md`).
- Atualizar a seção 4 da especificação de UI para o mapa de módulos por permissão (ADR-002).
