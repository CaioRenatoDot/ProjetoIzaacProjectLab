# GH-48 — painel de indicadores

Tela W-17 / T-16 em `/indicadores`, na branch `feat/GH-48-tela-indicadores`.
Rastreabilidade: UC-18, RF-10, RNF-02 e UI T-16. Mantém o tema e os componentes de `@filas/ui`.

## Verificar antes do commit

1. Execute `corepack pnpm --filter web dev`.
2. No modo de simulação, entre com `admin@clinica.edu.br` / `senha-dev`.
3. Abra http://localhost:3000/indicadores pelo menu **Indicadores**.
4. Escolha período, especialidade e turno e clique em **Aplicar filtros**.
   Alterações no formulário só valem após aplicar.
5. Alterne **Gráfico** e **Tabela**. Os valores vêm da mesma série; a tabela permanece
   disponível ao leitor de tela no modo gráfico. Sólido, listrado e pontilhado diferenciam as séries.
6. Clique em **Exportar resultado**: o CSV usa os filtros aplicados, inclusive turno,
   mesmo que o formulário tenha alterações ainda não confirmadas.
7. Para o cenário fictício vazio, consulte 01/01/2019 a 31/01/2019:
   mostra **Sem dados disponíveis** e preserva os filtros.
8. No mock, turno **Noite** demonstra a nota de amostra pequena.
9. **Limpar filtros** retorna ao mês atual, todas as especialidades e turnos.
10. Em largura abaixo de 768 px, mostra orientação para abrir em computador/tablet.

## Escopo e estados

- Seis indicadores: espera, atendimento, atendidos, ausência, desistências e volume por especialidade.
- Médias nulas aparecem como **Sem estimativa**, sem inventar valores.
- Esqueleto de carregamento; erro com tentativa novamente; vazio preservando filtros.
- Sem `indicadores:consultar`: mensagem neutra. Sem `indicadores:exportar`: ação não renderizada.
- Recusa 403 da API não exibe volumes. Exportação não recebe cálculo ou auditoria no front.
- Gráfico e tabela mostram apenas dados agregados; schemas existentes descartam propriedades extras.
- Escolha de gráfico/tabela preservada ao aplicar novos filtros.
- Datas validadas com o contrato, mensagem no campo e foco no primeiro inválido.

## API e simulação

A #27 já tem controller, service e schemas na develop. O front consome pelo cliente
HTTP autenticado existente, com renovação da sessão:

- GET /indicadores/resumo: período, especialidade e turno.
- GET /indicadores/volume-por-especialidade: período e turno; o front seleciona a
  especialidade nessa resposta para manter gráfico/tabela no mesmo filtro.
- GET /indicadores/exportacao: mesmos filtros do resumo e formato=csv; download de Blob.

O seletor usa as especialidades com movimento retornadas pelo endpoint de volume.
Assim não exige `cadastros:consultar` além de `indicadores:consultar`.
As opções anteriores são mantidas quando o período não traz dados.

`NEXT_PUBLIC_API_MOCK=false` usa a API real. Com o mock ligado (padrão no desenvolvimento),
os resultados são fictícios: 142 atendidos no cenário geral; datas anteriores a 2020
simulam ausência de dados; Noite simula amostra pequena. Não são cálculos de produção.
A auditoria de exportação é responsabilidade da API #27, já implementada; o mock não
substitui a validação da trilha real.

**Divergência documental:** o OpenAPI não lista turno em exportacao, mas o schema
`ExportarIndicadoresQuery` e a API #27 já o aceitam. A tela encaminha turno para não
exportar dados fora do filtro. Não altera contratos neste PR; alinhar documentação em PR próprio.

A integração HTTP foi validada com API e PostgreSQL reais, incluindo autenticação,
filtros, cartões, CSV e auditoria. A simulação MSW permanece opcional.

## Validação

- Suíte completa web: 331 testes aprovados antes dos dois testes adicionais de consulta.
- Dois testes adicionais de consulta: filtros e projeção sem propriedades individuais.
- Quatro testes de navegador: filtros, tabela equivalente, WCAG AA, vazio, exportação,
  permissões e larguras de 767/768 px.
- Lint, TypeScript, formatação e build de produção verificados.
- Etapa 9.2 atualizada em docs/06-etapas.md.

## Evidências

- [Painel conectado à API real](../evidencias/GH-48/indicadores-api-real.png)

- [Cartões e gráfico](../evidencias/GH-48/indicadores-grafico.png)
- [Tabela e amostra pequena](../evidencias/GH-48/indicadores-tabela.png)
- [Sem dados](../evidencias/GH-48/indicadores-vazio.png)

CI remoto, revisão e merge na develop devem ser verificados na PR com `Closes #48`.

## Ambiente real validado neste computador

Docker Desktop e WSL ativos. PostgreSQL 16 no contêiner `filas-db`; oito migrações
aplicadas e seed fictício carregado. API na porta 3333 e web na porta 3000.

Os arquivos locais ignorados `.env` e `apps/web/.env.local` estão configurados;
`NEXT_PUBLIC_API_MOCK=false`. Nenhuma credencial local é versionada.

Para iniciar novamente, abra o Docker Desktop e execute na raiz:

```powershell
docker compose up -d
corepack pnpm --filter api prisma migrate deploy
corepack pnpm --filter api prisma db seed
corepack pnpm --filter api dev
```

Em outro terminal:

```powershell
corepack pnpm --filter web dev
```

Acesso real do seed: `admin@clinica.invalid` ou `gestao@clinica.invalid`;
senha definida em SEED_SENHA_USUARIOS (padrão local `senha-dev`).
O usuário `admin@clinica.edu.br` pertence à simulação.
Readiness: http://localhost:3333/api/v1/health/ready.

### Cenário persistido e resultados

O seed padrão contém cadastros, não atendimentos. Para validar resultados, foram
acrescentadas quatro senhas fictícias F901 a F904 no banco local `filas_dev`,
em Fisioterapia, com chegada às 09h de 27/10/2026: dois atendimentos encerrados,
uma ausência e uma desistência. Nenhum registro anterior foi apagado ou substituído.

A API calculou: espera média 15 min; atendimento médio 25 min; 2 atendidos;
taxa de ausência 33,3%; 1 desistência; volume de Fisioterapia 2/1/1.
O aviso de amostra pequena foi exibido.

Verificações de navegador com API real, sem MSW:

- Login e renovação da sessão após recarregar.
- Cartões e tabela com os valores calculados pelo PostgreSQL.
- Janeiro de 2019 sem dados, preservando filtros.
- Turno Noite sem dados; Limpar retorna ao mês atual.
- Exportação com período, especialidade e turno Manhã aplicados.
- CSV com linha `Total;4;15;25;2;33.3;1;1`.
- Evento real EXPORTAR confirmado no audit_log, com filtros na justificativa.
- Perfil Gestão acessa sem permissão de cadastros.
- Perfil Recepção recebe mensagem neutra, sem volumes ou exportação.
- Requisições de indicadores HTTP 200 com `fromServiceWorker=false`.
- Sem erros JavaScript no fluxo principal.

Os seis testes de integração da API #27 também passaram com PostgreSQL real,
no banco isolado `filas_test`, cobrindo cálculos, privacidade, período vazio,
volume, CSV/auditoria e permissões.

A validação local foi concluída. CI remoto, revisão e merge ainda devem ser
conferidos na PR.
