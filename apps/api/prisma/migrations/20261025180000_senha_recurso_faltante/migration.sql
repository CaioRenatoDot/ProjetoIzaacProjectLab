-- Alocação (#21): recurso faltante da senha em AGUARDANDO_RECURSO ("Manter aguardando").

-- CreateEnum
CREATE TYPE "RecursoFaltante" AS ENUM ('ESTUDANTE', 'SUPERVISOR', 'SALA');

-- AlterTable
ALTER TABLE "senha" ADD COLUMN     "recurso_faltante" "RecursoFaltante",
ADD COLUMN     "recurso_faltante_observacao" TEXT;


ALTER TABLE "senha" ADD CONSTRAINT "senha_recurso_faltante_check"
  CHECK ("recurso_faltante" IS NULL OR "status" = 'AGUARDANDO_RECURSO');
