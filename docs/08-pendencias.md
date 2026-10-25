# O que falta

Visão única do que ainda não está pronto, de back e de front, e do que já se sabe sobre cada
ponto. Complementa dois documentos:

- [`06-etapas.md`](06-etapas.md): partes, responsáveis e status.
- [`07-pendencias-integracao.md`](07-pendencias-integracao.md): troca do MSW pela API, tela por
  tela, e lacunas do contrato.

**Quem fechar um item daqui atualiza este arquivo no mesmo PR.** Situação em 25/10/2026.

## 1. Back-end pronto

Tudo na `develop`, com testes de unidade e de integração rodando no CI (job "Testes de
integração da API (PostgreSQL)").

| Issue       | Entrega                                                                                                                                     | Contrato |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| #31         | Erros RFC 7807, validação Zod (422), paginação, log JSON com `redact`, CORS                                                                 | #67      |
| #6          | Schema de acesso, cadastros base e auditoria (22 tabelas)                                                                                   | —        |
| #7          | Schema de triagem, fila, senha, alocação, atendimento, alertas e idempotência                                                               | —        |
| #8          | Usuário `filas_app`, `REVOKE` no `audit_log`, parâmetros da unidade, CHECKs e únicos parciais (RN-01, RN-03, RN-05, RN-09, RF-04)           | —        |
| #10         | Login, refresh rotativo com detecção de reuso, bloqueio por tentativas, `/auth/me`                                                          | #71      |
| #11         | Guard global (`@Requer`, `@Publico`, `@Autenticado`) e auditoria implícita                                                                  | #73      |
| #12         | Perfis, catálogo de permissões e usuários (inativar, desbloquear, redefinir senha)                                                          | #76      |
| #13         | Salas, especialidades e cadastros de apoio                                                                                                  | #78      |
| #14         | Pacientes, estudantes e supervisores                                                                                                        | #82      |
| #15         | Triagem (RN-02, RN-03), lista sem campo clínico, detalhe auditado, `comFila` em especialidades                                              | #93      |
| #16         | Emissão de senha (número por fila e dia sob concorrência, RN-04), reclassificação (RN-01), histórico, `GET /parametros`, eventos de domínio | #95      |
| #17         | Máquina de estados da senha (matriz 9 × 9 testada), versão, horários e evento `senha.status_alterado`                                       | #97      |
| #29         | Consulta, detalhe e exportação CSV da trilha de auditoria                                                                                   | #84      |
| #9          | Seed fictício de acesso, cadastros e filas (usuários no README)                                                                             | —        |
| #30 (parte) | Testes de integração no CI                                                                                                                  | —        |

## 2. Back-end que falta

### Depende do schema da parte 2.2 (#7, pronto) e das Etapas 6 e 7

As issues que bloqueavam outras (#7, #17, #18, #21, #23) passaram para o Rildo em 25/10/2026;
as que não bloqueiam ninguém seguem com o Nathan:

| Issue                   | Dono           | Depende de    | Observação                                                                                                          |
| ----------------------- | -------------- | ------------- | ------------------------------------------------------------------------------------------------------------------- |
| #18, #21, #23           | Rildo          | —             | Fila e chamada, alocação, atendimento; toda mudança de status pela `MaquinaSenha` (#17)                             |
| #19, #20, #22, #26, #28 | Nathan         | #18, #21, #23 | Socket.IO, endpoints públicos, sugestão automática, encaminhamento, alertas                                         |
| #24                     | Rildo          | #17, #18      | Ausência e restrição por reincidência; política "devolver à fila ou marcar ausência" (RN-12) sem parâmetro definido |
| #25                     | Rildo          | #17, #21      | Desistência                                                                                                         |
| #27                     | Rildo          | #23, #24, #25 | Indicadores                                                                                                         |
| #30 (resto)             | Rildo e Nathan | Etapas 5 a 8  | Teste que exige RN-01 a RN-13 no nome dos casos e teste de contrato que reprova listagem com campo clínico          |

### Valores provisórios que as Etapas 6 a 8 precisam substituir

Campos que o contrato já devolve, mas que hoje saem fixos porque a tabela de origem ainda não
existe. Quem criar a tabela troca o valor e remove a linha:

| Campo                                             | Onde                                      | Valor hoje | Vem de                        |
| ------------------------------------------------- | ----------------------------------------- | ---------- | ----------------------------- |
| `Sala.ocupada`                                    | `apps/api/src/cadastros/salas.service.ts` | `false`    | alocação não liberada (#21)   |
| `Estudante.ocupado`                               | `cadastros/estudantes.service.ts`         | `false`    | atendimento ativo (#23)       |
| `Supervisor.ocupacaoAtual`                        | `cadastros/supervisores.service.ts`       | `0`        | alocações não liberadas (#21) |
| `PacienteDetalhe.ausenciasUltimos90Dias`          | `cadastros/pacientes.service.ts`          | `0`        | ausência (#24)                |
| Filtros `disponivel` de estudantes e supervisores | mesmos arquivos                           | só `ativo` | ocupação acima                |

## 3. Limitações conhecidas e dívidas técnicas

| Ponto                                                  | Efeito                                                                                                            | Saída prevista                                                                        |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Auditoria implícita fora da transação da escrita (#11) | Se o `audit_log` falhar depois da escrita, ela já aconteceu e o cliente recebe 500                                | Operação crítica grava com `AuditoriaService.registrar(dados, tx)` na mesma transação |
| Bloqueio de identificação inexistente em memória (#10) | Zera quando a API reinicia e só vale com uma instância                                                            | Aceito para o MVP; com mais instâncias, mover para o banco ou Redis                   |
| Trilha de auditoria sem coluna de unidade (#29)        | O filtro por unidade passa pelo usuário; eventos de rotina (sem usuário) aparecem para todas as unidades          | Coluna `unidade_id` no `audit_log` se houver mais de uma unidade                      |
| Documento do paciente único no sistema todo (#6)       | Duas unidades não cadastram o mesmo documento                                                                     | Rever junto com RNF-08 (múltiplas unidades)                                           |
| Usuários sem tela                                      | A API de usuários (#12) não tem tela: criar, inativar e desbloquear o login (bloqueio por tentativas) só pela API | Decidir onde administrar usuários (front)                                             |
| Aplicações fora do Docker                              | O compose sobe só banco e Adminer (`docs/.ref/SPECS/implantacao.md`)                                              | `Dockerfile` de `api`, `web` e `publico` (orientação do professor)                    |
| Backup diário (RNF-09)                                 | Sem rotina                                                                                                        | Etapa 10                                                                              |
| Proteção da `develop`                                  | Merge sem aprovação e sem CI obrigatório                                                                          | Configurar a proteção no GitHub (dono do repositório)                                 |
| `audit_log` sem índice por módulo                      | Filtro por módulo pode ficar lento com volume                                                                     | Medir com dados reais antes de criar                                                  |

### Armadilhas já encontradas

- O Prisma envia número do JavaScript como `bigint` em `$queryRaw`: funções como
  `make_interval` precisam de cast (`::int`), e `COUNT` volta `BigInt` (converter antes do JSON).
- `prisma migrate dev` cria um banco shadow sem `_prisma_migrations`: SQL manual que mexe nela
  precisa de `to_regclass`.
- O `prisma migrate reset` recusa rodar quando chamado por agente de IA; no terminal e no CI
  funciona normalmente.
- Testes de integração rodam sem reset entre execuções na máquina de cada um: use nomes,
  documentos e datas únicos por teste (ver `apps/api/src/cadastros/pessoas.int-spec.ts`).
- `gh pr checks --json` não existe em todas as versões do `gh`; use `statusCheckRollup`.

## 4. Decisões em aberto

| Decisão                                                 | Onde           | Valor em uso                                     |
| ------------------------------------------------------- | -------------- | ------------------------------------------------ |
| Aviso de impacto ao editar cadastro em uso              | #79            | O formulário avisa sozinho (W-04)                |
| Critério de duplicidade do estudante                    | #81            | Nome + especialidade, sem diferenciar maiúsculas |
| Política da RN-12 (devolver à fila ou marcar ausência)  | #24            | A definir antes da rotina de tolerância          |
| Confirmação do modelo de navegação                      | ADR-002        | Modelo A, painel lateral só na fila              |
| Valores definitivos dos parâmetros da unidade           | `docs/01` §4.7 | 5, 25, 3, 90, 3 e 20 (Tabela 8)                  |
| Base legal e prazo de retenção de triagem e atendimento | `docs/03` §6   | Sem rotina de retenção                           |

## 5. Front-end: o que fazer ao integrar com a API real

Detalhe por tela em [`07-pendencias-integracao.md`](07-pendencias-integracao.md). Pronto para
trocar agora (🔧 lá):

| Tela                       | Troca                                                                                                                                               | API      |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Login e sessão (W-01)      | Rodar com `NEXT_PUBLIC_API_MOCK=false`; ler `minutosRestantes` do bloqueio; apagar `MENSAGEM_SEM_PERFIL` (não existe mais 403 no login)             | #10      |
| Menu, home e telas         | Conferir as permissões contra `CATALOGO_PERMISSOES` de `@filas/contracts`                                                                           | #11      |
| Perfis (W-05)              | Cliente HTTP para `PerfisApi`; usar `usuariosAfetados` e o aviso `PERFIL_SEM_CONSULTA`                                                              | #12      |
| Cadastros (W-03, W-04)     | Trocar o MSW; importar os schemas de `@filas/contracts` (`cadastros.ts`, `pessoas.ts`); inativar com `PATCH`; listas de apoio pelos endpoints novos | #13, #14 |
| Trilha de auditoria (W-18) | Exportação passa a exigir `de` e `ate`; filtro de usuário por `GET /auditoria/usuarios`                                                             | #29      |
| Triagem (W-06)             | Cliente HTTP para `TriagemApi`; importar `TriagemEntrada` e `prioridadeEfetiva` de `@filas/contracts`; especialidades por `?comFila=true`           | #15      |
| Senha (W-07)               | `POST /senhas`, `PATCH /senhas/{id}/prioridade` (ler `senha.prioridade` e `senha.versao`), histórico; mínimo da justificativa por `GET /parametros` | #16      |
| Testes de ponta a ponta    | Entrar com os usuários do seed (`<perfil>@clinica.invalid`, senha `senha-dev`, README)                                                              | #10, #9  |

Ainda dependem do back: painel de fila e telão (W-08 a
W-10: #17 a #20), alocação e atendimento (W-11 a W-13: #21 a #23), ausências (W-15, W-16: #24,
#25), indicadores (W-17: #27), alertas (W-18: #28) e o estado real da conexão Socket.IO.

Também ficam com o front: rota `/acesso` com tela própria, TanStack Query na tela de perfis,
formulário de perfil com React Hook Form e o schema do contrato, layout de impressão da senha,
visão consolidada e seletor de turno do painel (dependem das lacunas 4 e 5 da fila) e o local da
tela de alertas no menu.
