// Falha se alguma regra de negócio (RN-01 a RN-13) não aparece no nome de um caso de teste da
// API (DAS §2.2). Lê os nomes coletados pelo Vitest (`vitest list --json`), e não os arquivos,
// para comentário não contar. Roda no job de integração do CI, que tem o banco de teste.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const REGRAS = Array.from({ length: 13 }, (_, i) => `RN-${String(i + 1).padStart(2, '0')}`);

const saida = join(mkdtempSync(join(tmpdir(), 'cobertura-rn-')), 'casos.json');
execFileSync(
  'pnpm',
  ['exec', 'vitest', 'list', '-c', 'vitest.cobertura.config.mts', `--json=${saida}`],
  {
    stdio: ['ignore', 'ignore', 'inherit'],
  },
);
// Só o nome do caso, sem os `describe` que o envolvem.
const nomes = JSON.parse(readFileSync(saida, 'utf8')).map(({ name }) => name.split(' > ').at(-1));

const semTeste = REGRAS.filter(
  (regra) => !nomes.some((nome) => new RegExp(`${regra}(?!\\d)`).test(nome)),
);
if (semTeste.length) {
  process.stderr.write(
    `Regras de negócio sem caso de teste com o identificador no nome: ${semTeste.join(', ')}\n`,
  );
  process.exit(1);
}
process.stdout.write(`RN-01 a RN-13 citadas em ${nomes.length} casos de teste.\n`);
