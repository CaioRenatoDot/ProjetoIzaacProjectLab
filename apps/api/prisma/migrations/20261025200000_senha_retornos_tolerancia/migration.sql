-- Rotina de tolerância (#24, RN-12): a senha volta à fila uma vez; na segunda expiração, ausência.

-- AlterTable
ALTER TABLE "senha" ADD COLUMN     "retornos_tolerancia" INTEGER NOT NULL DEFAULT 0;


ALTER TABLE "senha" ADD CONSTRAINT "senha_retornos_tolerancia_check" CHECK ("retornos_tolerancia" >= 0);

-- Varredura da rotina: senhas chamadas com tolerância vencida.
CREATE INDEX "senha_tolerancia_idx" ON "senha"("tolerancia_ate") WHERE "status" = 'CHAMADA';
