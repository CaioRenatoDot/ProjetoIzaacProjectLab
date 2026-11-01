/**
 * O `next build` com `distDir` próprio (`.next-e2e`) reescreve o `next-env.d.ts`, que é
 * versionado, para apontar para a pasta nova. Roda logo depois do build do fluxo real e devolve a
 * referência ao `.next`, para o teste não deixar o arquivo alterado no Git.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const arquivo = 'next-env.d.ts';
const conteudo = readFileSync(arquivo, 'utf8');
const restaurado = conteudo.replaceAll('./.next-e2e/types/', './.next/types/');
if (restaurado !== conteudo) writeFileSync(arquivo, restaurado);
