-- Decisão aprovada na #26: um encaminhamento por atendimento, inclusive em concorrência.
CREATE UNIQUE INDEX "encaminhamento_atendimento_id_key" ON "encaminhamento"("atendimento_id");
DROP INDEX "encaminhamento_atendimento_id_idx";
