-- Emissão de senha (#16): contador por fila e dia e unicidade do número no dia.

-- CreateTable
CREATE TABLE "contador_senha" (
    "fila_id" UUID NOT NULL,
    "dia" DATE NOT NULL,
    "ultimo" INTEGER NOT NULL,

    CONSTRAINT "contador_senha_pkey" PRIMARY KEY ("fila_id","dia")
);

-- AddForeignKey
ALTER TABLE "contador_senha" ADD CONSTRAINT "contador_senha_fila_id_fkey" FOREIGN KEY ("fila_id") REFERENCES "fila"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Número único por fila e dia no fuso da unidade (docs/03 §3.3). Rede de segurança do contador.
CREATE UNIQUE INDEX "senha_numero_dia_key" ON "senha"("fila_id", "numero", (("chegada_em" AT TIME ZONE 'America/Sao_Paulo')::date));

ALTER TABLE "contador_senha" ADD CONSTRAINT "contador_senha_ultimo_check" CHECK ("ultimo" > 0);
