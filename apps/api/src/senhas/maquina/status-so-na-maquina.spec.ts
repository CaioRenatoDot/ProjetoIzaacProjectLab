import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const RAIZ = join(__dirname, '..', '..');
const PERMITIDOS = new Set(['senhas/maquina/maquina-senha.service.ts']);

function arquivos(pasta: string): string[] {
  return readdirSync(pasta).flatMap((nome) => {
    const caminho = join(pasta, nome);
    if (statSync(caminho).isDirectory()) return arquivos(caminho);
    return /\.ts$/.test(nome) && !/\.(spec|int-spec)\.ts$/.test(nome) ? [caminho] : [];
  });
}

describe('status da senha só muda pela máquina de estados (docs/03 §5)', () => {
  it('nenhum outro arquivo grava status em senha', () => {
    const violacoes = arquivos(RAIZ)
      .filter((caminho) => !PERMITIDOS.has(relative(RAIZ, caminho)))
      .filter((caminho) => {
        const codigo = readFileSync(caminho, 'utf8');
        return (
          [...codigo.matchAll(/senha\.(update|updateMany|upsert)\(([\s\S]*?)\n\s{0,6}\}\)/g)].some(
            ([, , corpo]) => /\bstatus\s*:/.test(corpo ?? ''),
          ) || /UPDATE\s+"?senha"?\s+SET[\s\S]{0,200}\bstatus\b/i.test(codigo)
        );
      })
      .map((caminho) => relative(RAIZ, caminho));

    expect(violacoes).toEqual([]);
  });
});
