# Entrega da #47 — ausência e desistência

## Estado

Front implementado e verificado com API simulada. A issue continua em andamento:
integração com back-end real, CI, revisão e merge ainda não foram verificados.
As branches remotas foram atualizadas e inspecionadas nesta sessão; não continham
as implementações de #24, #25 nem o painel completo de #41.

## Como verificar

1. Execute `corepack pnpm --filter web dev`.
2. Abra `http://localhost:3000/ausencias`.
3. Entre com `admin@clinica.edu.br` / `senha-dev`.
4. Clique em **Reiniciar demonstração** e em **Detalhes** de uma senha.
5. No painel lateral, escolha a ação disponível. Os formulários abrem como modal.

| Critério                                   | Verificação feita                                                                                                  | Resultado         |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ | ----------------- |
| RN-12: ausência antes do fim da tolerância | F014 → Detalhes → Registrar ausência; Confirmar bloqueado até marcar confirmação explícita; tempo restante visível | Aprovado com mock |
| RN-13: restrição por reincidência          | Confirmar ausência de F014; aviso com efeito da política em aria-live                                              | Aprovado com mock |
| Senha Chamada não oferece desistência      | Detalhes de F013; só ausência aparece                                                                              | Aprovado com mock |
| Desistência separada de ausência           | F015/F016; origem paciente/equipe, motivo opcional, endpoint e status próprios                                     | Aprovado com mock |
| Ausência automática                        | F017 expira no simulador; polling recebe o registro e notifica sem modal                                           | Aprovado com mock |
| Modal abaixo de 768 px                     | Navegador em 390 × 844; modal ocupa o viewport inteiro                                                             | Aprovado          |
| Acessibilidade                             | axe WCAG AA, foco preso e devolvido ao gatilho no painel e modal                                                   | Aprovado          |
| Carregamento, vazio, erro e sem permissão  | Testes de componente e HTTP                                                                                        | Aprovado          |
| Concorrência                               | 409 impede repetir a escrita com versão antiga e oferece atualização                                               | Aprovado com mock |

## Evidências

Todos os dados das capturas são fictícios.

- [Painel lateral](../evidencias/GH-47/painel-lateral.png)
- [Ausência antecipada](../evidencias/GH-47/ausencia-desktop.png)
- [Restrição aplicada](../evidencias/GH-47/ausencia-restricao.png)
- [Desistência](../evidencias/GH-47/desistencia-desktop.png)
- [Modal no celular](../evidencias/GH-47/ausencia-celular.png)

## Verificações locais

- Web: 205 testes aprovados.
- Componentes compartilhados: 18 testes aprovados.
- Navegador: 6 testes aprovados, incluindo WCAG AA.
- Lint de web e UI aprovado.
- Build de web e UI aprovado; o build web inclui a verificação de tipos.

Comandos:

```powershell
corepack pnpm --filter web test
corepack pnpm --filter @filas/ui test
corepack pnpm --filter web lint
corepack pnpm --filter @filas/ui lint
corepack pnpm --filter @filas/ui build
corepack pnpm --filter web build
corepack pnpm --filter web exec playwright test ausencias.e2e.ts --workers=1
```

## Pendências para encerrar a issue

- [ ] APIs #24/#25 disponíveis e fluxo real validado, incluindo liberação de recursos e auditoria.
- [ ] Registro automático real conectado; o evento de status atual não traz toda a resposta de ausência/restrição.
- [ ] `PainelOcorrenciasSenha` integrado ao painel de fila definitivo de #41.
- [ ] Novas alterações commitadas e enviadas pelo integrante.
- [ ] PR para develop com CI verde e aprovação.
- [ ] Etapa 8.3 marcada como concluída no mesmo PR após as verificações restantes.
- [ ] Merge e fechamento da issue pelo integrante.

Detalhes técnicos em [pendências de integração](../07-pendencias-integracao.md#ausência-e-desistência-w-15-e-w-16-47).
