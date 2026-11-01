-- CreateEnum
CREATE TYPE "VinculoPaciente" AS ENUM ('EXTERNO', 'ALUNO', 'SERVIDOR');

-- CreateEnum
CREATE TYPE "Turno" AS ENUM ('MANHA', 'TARDE', 'NOITE');

-- CreateEnum
CREATE TYPE "DiaSemana" AS ENUM ('DOMINGO', 'SEGUNDA', 'TERCA', 'QUARTA', 'QUINTA', 'SEXTA', 'SABADO');

-- CreateEnum
CREATE TYPE "SituacaoSala" AS ENUM ('DISPONIVEL', 'EM_MANUTENCAO', 'INDISPONIVEL');

-- CreateEnum
CREATE TYPE "OperacaoAuditoria" AS ENUM ('CRIAR', 'EDITAR', 'EXCLUIR', 'CONSULTAR_SENSIVEL', 'EXPORTAR', 'LOGIN', 'LOGOUT');

-- CreateEnum
CREATE TYPE "ChaveParametro" AS ENUM ('tolerancia_minutos', 'sla_minutos', 'reincidencias_restricao', 'janela_reincidencia_dias', 'limite_estudantes_supervisor', 'justificativa_min_caracteres');

-- CreateTable
CREATE TABLE "unidade" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "unidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parametro_unidade" (
    "id" UUID NOT NULL,
    "unidade_id" UUID NOT NULL,
    "especialidade_id" UUID,
    "chave" "ChaveParametro" NOT NULL,
    "valor" INTEGER NOT NULL,
    "atualizado_por" UUID,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "parametro_unidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "identificacao" TEXT NOT NULL,
    "senha_hash" TEXT NOT NULL,
    "perfil_id" UUID NOT NULL,
    "unidade_id" UUID NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "tentativas_falhas" INTEGER NOT NULL DEFAULT 0,
    "bloqueado_ate" TIMESTAMPTZ(3),
    "ultimo_login_em" TIMESTAMPTZ(3),

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "perfil" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "sistema" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "perfil_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "perfil_permissao" (
    "perfil_id" UUID NOT NULL,
    "permissao" TEXT NOT NULL,

    CONSTRAINT "perfil_permissao_pkey" PRIMARY KEY ("perfil_id","permissao")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL,
    "usuario_id" UUID,
    "perfil_nome_no_momento" TEXT,
    "operacao" "OperacaoAuditoria" NOT NULL,
    "modulo" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidade_id" UUID,
    "justificativa" TEXT,
    "origem_ip" TEXT,
    "user_agent" TEXT,
    "request_id" TEXT,
    "sensivel" BOOLEAN NOT NULL DEFAULT false,
    "ocorrido_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paciente" (
    "id" UUID NOT NULL,
    "nome_completo" TEXT NOT NULL,
    "documento" TEXT NOT NULL,
    "data_nascimento" DATE NOT NULL,
    "contato_telefone" TEXT,
    "contato_email" TEXT,
    "vinculo" "VinculoPaciente" NOT NULL,
    "unidade_id" UUID NOT NULL,
    "restricao_ativa" BOOLEAN NOT NULL DEFAULT false,
    "restricao_ate" DATE,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "paciente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estudante" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "especialidade_id" UUID NOT NULL,
    "nivel_formacao" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "estudante_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estudante_habilitacao" (
    "estudante_id" UUID NOT NULL,
    "habilitacao_id" UUID NOT NULL,

    CONSTRAINT "estudante_habilitacao_pkey" PRIMARY KEY ("estudante_id","habilitacao_id")
);

-- CreateTable
CREATE TABLE "estudante_procedimento" (
    "estudante_id" UUID NOT NULL,
    "procedimento_id" UUID NOT NULL,

    CONSTRAINT "estudante_procedimento_pkey" PRIMARY KEY ("estudante_id","procedimento_id")
);

-- CreateTable
CREATE TABLE "estudante_disponibilidade" (
    "estudante_id" UUID NOT NULL,
    "dia_semana" "DiaSemana" NOT NULL,
    "turno" "Turno" NOT NULL,

    CONSTRAINT "estudante_disponibilidade_pkey" PRIMARY KEY ("estudante_id","dia_semana","turno")
);

-- CreateTable
CREATE TABLE "supervisor" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "limite_estudantes_simultaneos" INTEGER,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "supervisor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supervisor_especialidade" (
    "supervisor_id" UUID NOT NULL,
    "especialidade_id" UUID NOT NULL,

    CONSTRAINT "supervisor_especialidade_pkey" PRIMARY KEY ("supervisor_id","especialidade_id")
);

-- CreateTable
CREATE TABLE "supervisor_procedimento" (
    "supervisor_id" UUID NOT NULL,
    "procedimento_id" UUID NOT NULL,

    CONSTRAINT "supervisor_procedimento_pkey" PRIMARY KEY ("supervisor_id","procedimento_id")
);

-- CreateTable
CREATE TABLE "supervisor_disponibilidade" (
    "supervisor_id" UUID NOT NULL,
    "dia_semana" "DiaSemana" NOT NULL,
    "turno" "Turno" NOT NULL,

    CONSTRAINT "supervisor_disponibilidade_pkey" PRIMARY KEY ("supervisor_id","dia_semana","turno")
);

-- CreateTable
CREATE TABLE "sala" (
    "id" UUID NOT NULL,
    "identificacao" TEXT NOT NULL,
    "unidade_id" UUID NOT NULL,
    "caracteristicas" TEXT,
    "situacao" "SituacaoSala" NOT NULL DEFAULT 'DISPONIVEL',
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "sala_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sala_recurso" (
    "sala_id" UUID NOT NULL,
    "recurso_id" UUID NOT NULL,

    CONSTRAINT "sala_recurso_pkey" PRIMARY KEY ("sala_id","recurso_id")
);

-- CreateTable
CREATE TABLE "especialidade" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "exige_supervisao_docente" BOOLEAN NOT NULL DEFAULT false,
    "exige_validacao_encerramento" BOOLEAN NOT NULL DEFAULT false,
    "unidade_id" UUID NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "especialidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "especialidade_procedimento_requisito" (
    "especialidade_id" UUID NOT NULL,
    "recurso_id" UUID NOT NULL,

    CONSTRAINT "especialidade_procedimento_requisito_pkey" PRIMARY KEY ("especialidade_id","recurso_id")
);

-- CreateTable
CREATE TABLE "habilitacao" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,

    CONSTRAINT "habilitacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "procedimento" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,

    CONSTRAINT "procedimento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurso" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,

    CONSTRAINT "recurso_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuario_identificacao_key" ON "usuario"("identificacao");

-- CreateIndex
CREATE UNIQUE INDEX "perfil_nome_key" ON "perfil"("nome");

-- CreateIndex
CREATE INDEX "audit_log_ocorrido_em_idx" ON "audit_log"("ocorrido_em");

-- CreateIndex
CREATE INDEX "audit_log_usuario_id_ocorrido_em_idx" ON "audit_log"("usuario_id", "ocorrido_em");

-- CreateIndex
CREATE INDEX "audit_log_entidade_entidade_id_idx" ON "audit_log"("entidade", "entidade_id");

-- CreateIndex
CREATE UNIQUE INDEX "paciente_documento_key" ON "paciente"("documento");

-- CreateIndex
CREATE INDEX "paciente_nome_completo_data_nascimento_idx" ON "paciente"("nome_completo", "data_nascimento");

-- CreateIndex
CREATE UNIQUE INDEX "especialidade_nome_key" ON "especialidade"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "habilitacao_nome_key" ON "habilitacao"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "procedimento_nome_key" ON "procedimento"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "recurso_nome_key" ON "recurso"("nome");

-- AddForeignKey
ALTER TABLE "parametro_unidade" ADD CONSTRAINT "parametro_unidade_unidade_id_fkey" FOREIGN KEY ("unidade_id") REFERENCES "unidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parametro_unidade" ADD CONSTRAINT "parametro_unidade_especialidade_id_fkey" FOREIGN KEY ("especialidade_id") REFERENCES "especialidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parametro_unidade" ADD CONSTRAINT "parametro_unidade_atualizado_por_fkey" FOREIGN KEY ("atualizado_por") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_perfil_id_fkey" FOREIGN KEY ("perfil_id") REFERENCES "perfil"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_unidade_id_fkey" FOREIGN KEY ("unidade_id") REFERENCES "unidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "perfil_permissao" ADD CONSTRAINT "perfil_permissao_perfil_id_fkey" FOREIGN KEY ("perfil_id") REFERENCES "perfil"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paciente" ADD CONSTRAINT "paciente_unidade_id_fkey" FOREIGN KEY ("unidade_id") REFERENCES "unidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estudante" ADD CONSTRAINT "estudante_especialidade_id_fkey" FOREIGN KEY ("especialidade_id") REFERENCES "especialidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estudante_habilitacao" ADD CONSTRAINT "estudante_habilitacao_estudante_id_fkey" FOREIGN KEY ("estudante_id") REFERENCES "estudante"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estudante_habilitacao" ADD CONSTRAINT "estudante_habilitacao_habilitacao_id_fkey" FOREIGN KEY ("habilitacao_id") REFERENCES "habilitacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estudante_procedimento" ADD CONSTRAINT "estudante_procedimento_estudante_id_fkey" FOREIGN KEY ("estudante_id") REFERENCES "estudante"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estudante_procedimento" ADD CONSTRAINT "estudante_procedimento_procedimento_id_fkey" FOREIGN KEY ("procedimento_id") REFERENCES "procedimento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estudante_disponibilidade" ADD CONSTRAINT "estudante_disponibilidade_estudante_id_fkey" FOREIGN KEY ("estudante_id") REFERENCES "estudante"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supervisor_especialidade" ADD CONSTRAINT "supervisor_especialidade_supervisor_id_fkey" FOREIGN KEY ("supervisor_id") REFERENCES "supervisor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supervisor_especialidade" ADD CONSTRAINT "supervisor_especialidade_especialidade_id_fkey" FOREIGN KEY ("especialidade_id") REFERENCES "especialidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supervisor_procedimento" ADD CONSTRAINT "supervisor_procedimento_supervisor_id_fkey" FOREIGN KEY ("supervisor_id") REFERENCES "supervisor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supervisor_procedimento" ADD CONSTRAINT "supervisor_procedimento_procedimento_id_fkey" FOREIGN KEY ("procedimento_id") REFERENCES "procedimento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supervisor_disponibilidade" ADD CONSTRAINT "supervisor_disponibilidade_supervisor_id_fkey" FOREIGN KEY ("supervisor_id") REFERENCES "supervisor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sala" ADD CONSTRAINT "sala_unidade_id_fkey" FOREIGN KEY ("unidade_id") REFERENCES "unidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sala_recurso" ADD CONSTRAINT "sala_recurso_sala_id_fkey" FOREIGN KEY ("sala_id") REFERENCES "sala"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sala_recurso" ADD CONSTRAINT "sala_recurso_recurso_id_fkey" FOREIGN KEY ("recurso_id") REFERENCES "recurso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "especialidade" ADD CONSTRAINT "especialidade_unidade_id_fkey" FOREIGN KEY ("unidade_id") REFERENCES "unidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "especialidade_procedimento_requisito" ADD CONSTRAINT "especialidade_procedimento_requisito_especialidade_id_fkey" FOREIGN KEY ("especialidade_id") REFERENCES "especialidade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "especialidade_procedimento_requisito" ADD CONSTRAINT "especialidade_procedimento_requisito_recurso_id_fkey" FOREIGN KEY ("recurso_id") REFERENCES "recurso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
