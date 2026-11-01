# GH-51 — sinal sonoro no telão

Implementa a etapa 9.5 sobre o telão da #42. Som como reforço: destaque visual,
número, especialidade, local e anúncio assertivo permanecem independentes do áudio.
Fonte: requisitos Apêndice A, UI T-11/P-02 e wireframe W-09; UC-09, RF-05, RNF-06.

## Verificar antes do commit

1. Execute `corepack pnpm --filter publico dev`.
2. Abra http://localhost:3001/telao e clique em **Ativar som** (ou use Tab e Enter).
   Um sinal de teste curto confirma a liberação de áudio pelo navegador.
3. Em outra aba, abra http://localhost:3001/demonstracao e use **Nova chamada**
   e **Rechamar**. Cada evento aceito toca uma vez, junto do destaque.
4. Clique rapidamente nos controles: os sinais aguardam o término do anterior.
5. Use **Desativar som**: a reprodução e a fila param; chamadas visuais continuam.
6. Abra http://localhost:3001/telao?som=0: não há reprodução nem botão para ativar.
7. Arquivo inválido: `/telao?somArquivo=/sons/inexistente.wav`.
   A tela oferece nova tentativa e continua recebendo chamadas.

## Configuração do terminal

URL prevalece sobre ambiente. Alterações da URL exigem recarregar a página.
Variáveis `NEXT_PUBLIC_*` são incorporadas no build: em produção, gerar novo build.

| Configuração  | Variável de ambiente          | Parâmetro de URL | Padrão            |
| ------------- | ----------------------------- | ---------------- | ----------------- |
| Habilitar som | NEXT_PUBLIC_TELAO_SOM_ATIVO   | som              | true              |
| Volume        | NEXT_PUBLIC_TELAO_SOM_VOLUME  | volume           | 0.5               |
| Arquivo       | NEXT_PUBLIC_TELAO_SOM_ARQUIVO | somArquivo       | /sons/chamada.wav |

`som=false`, `som=0` ou `som=off` desabilitam. Volume entre 0 e 1; zero silencia,
valores inválidos usam 0.5. O arquivo deve ter caminho absoluto na própria aplicação;
URLs externas usam o sinal padrão. Para trocar, versione um áudio curto em
`apps/publico/public/sons` com licença compatível.

Exemplo: `/telao?som=1&volume=0.3&somArquivo=/sons/chamada.wav`.
A liberação por gesto é solicitada em cada abertura; não se presume autoplay permitido.
O WAV padrão é original, dura 0,65 s e está dedicado ao domínio público (CC0),
com origem e licença em `apps/publico/public/sons/LICENCA.md`.

## Validação

- 37 testes de unidade/componente: configuração, chamada, rechamada, desligado,
  volume zero, fila, duplicatas, snapshot silencioso, falha, cancelamento e desmontagem.
- 12 testes de navegador: incluem arquivo real, ativação por teclado, rechamada,
  ausência de sobreposição, som desligado, erro e regressão do telão/consulta.
- Acessibilidade: axe, contraste 7:1, aria-live e rodapé preservados.
- Lint, TypeScript, formatação e build de produção verificados.
- [Captura do telão com som ativo](../evidencias/GH-51/telao-som-ativo.png).

## Integração e entrega

O áudio acompanha eventos `chamada.exibir` aceitos pelo telão, inclusive `sequencia > 1`.
Snapshot HTTP, `painel.estado` e eventos duplicados não geram sons retroativos.
Não altera contratos, dados públicos, autenticação ou backend.
A demonstração continua usando dados fictícios enquanto #19/#20 não estão integradas.
O som também se aplica à fonte real existente, sem depender do mock.

CI remoto, revisão e merge na develop devem ser conferidos na PR com `Closes #51`.
