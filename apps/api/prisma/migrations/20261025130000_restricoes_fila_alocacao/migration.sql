-- Parte 2.3 (#8), metade das tabelas da parte 2.2: invariantes do docs/03 §4 que o Prisma não
-- expressa. O UNIQUE (senha_id) do atendimento (RF-07) já veio na migração da parte 2.2.

-- RN-01: justificativa presente. O tamanho mínimo é do service (parâmetro justificativa_min_caracteres).
ALTER TABLE "reclassificacao_prioridade" ADD CONSTRAINT "reclassificacao_justificativa_check"
  CHECK (length(trim("justificativa")) > 0);

-- RN-03: urgência exige justificativa clínica.
ALTER TABLE "triagem" ADD CONSTRAINT "triagem_urgente_justificativa_check"
  CHECK ("prioridade" <> 'URGENTE' OR length(trim(coalesce("justificativa_clinica", ''))) > 0);

-- RN-05 e RN-09: estudante e sala sem duas alocações não liberadas. O supervisor fica de fora:
-- acompanha vários estudantes até o limite da RN-08, verificado no service.
CREATE UNIQUE INDEX "alocacao_estudante_ativa_key" ON "alocacao"("estudante_id") WHERE "liberada_em" IS NULL;
CREATE UNIQUE INDEX "alocacao_sala_ativa_key" ON "alocacao"("sala_id") WHERE "liberada_em" IS NULL;

-- RF-04: uma fila ativa por especialidade e unidade.
CREATE UNIQUE INDEX "fila_especialidade_ativa_key" ON "fila"("especialidade_id", "unidade_id") WHERE "ativa";

-- Coerência das colunas da parte 2.2.
ALTER TABLE "fila" ADD CONSTRAINT "fila_letra_senha_check" CHECK ("letra_senha" ~ '^[A-Z]$');
ALTER TABLE "fila" ADD CONSTRAINT "fila_sla_minutos_check" CHECK ("sla_minutos" IS NULL OR "sla_minutos" > 0);
ALTER TABLE "senha" ADD CONSTRAINT "senha_versao_check" CHECK ("versao" > 0);
ALTER TABLE "atendimento" ADD CONSTRAINT "atendimento_versao_check" CHECK ("versao" > 0);
ALTER TABLE "chamada" ADD CONSTRAINT "chamada_sequencia_check" CHECK ("sequencia" > 0);
