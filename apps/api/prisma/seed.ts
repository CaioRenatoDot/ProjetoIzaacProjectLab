import { PrismaClient } from '@prisma/client';

import { executarSeed } from './seed/executar';

/** `pnpm --filter api prisma db seed`. A senha dos usuários de teste vem de SEED_SENHA_USUARIOS. */
async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    await executarSeed(prisma, process.env.SEED_SENHA_USUARIOS ?? 'senha-dev');
    process.stdout.write('Seed concluído: dados fictícios carregados.\n');
  } finally {
    await prisma.$disconnect();
  }
}

void main();
