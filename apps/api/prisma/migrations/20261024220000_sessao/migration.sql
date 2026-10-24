-- Sessão de login para renovar e revogar o refresh token (#10, docs/04 §2).

-- CreateEnum
CREATE TYPE "MotivoRevogacao" AS ENUM ('LOGOUT', 'REUSO', 'USUARIO_INATIVADO', 'SENHA_REDEFINIDA');

-- CreateTable
CREATE TABLE "sessao" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "hash_anterior" TEXT,
    "rotacionada_em" TIMESTAMPTZ(3),
    "expira_em" TIMESTAMPTZ(3) NOT NULL,
    "manter_conectado" BOOLEAN NOT NULL DEFAULT false,
    "revogada_em" TIMESTAMPTZ(3),
    "motivo_revogacao" "MotivoRevogacao",
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sessao_usuario_id_idx" ON "sessao"("usuario_id");

-- AddForeignKey
ALTER TABLE "sessao" ADD CONSTRAINT "sessao_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- A sessão sempre expira depois de criada (login + 8 h).
ALTER TABLE "sessao" ADD CONSTRAINT "sessao_expira_depois_check" CHECK ("expira_em" > "criado_em");
