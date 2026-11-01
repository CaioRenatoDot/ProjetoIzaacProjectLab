-- Parte 2.2 (#7): triagem, fila, senha, alocação, atendimento, ausência, desistência, alertas e
-- idempotência. CHECKs e índices únicos parciais ficam na parte 2.3 (#8).
-- As tabelas nascem liberadas para o filas_app pelo ALTER DEFAULT PRIVILEGES da migração anterior.

-- CreateEnum
CREATE TYPE "StatusSenha" AS ENUM ('AGUARDANDO', 'CHAMADA', 'AGUARDANDO_RECURSO', 'EM_ATENDIMENTO', 'PAUSADO', 'PENDENTE_VALIDACAO', 'ENCERRADO', 'AUSENTE', 'DESISTENCIA');

-- CreateEnum
CREATE TYPE "Prioridade" AS ENUM ('NORMAL', 'PREFERENCIAL', 'URGENTE');

-- CreateEnum
CREATE TYPE "TipoAtendimento" AS ENUM ('PRIMEIRA_CONSULTA', 'RETORNO', 'ENCAIXE');

-- CreateEnum
CREATE TYPE "EnquadramentoLegal" AS ENUM ('IDOSO', 'GESTANTE', 'LACTANTE', 'PCD', 'OUTRO_PREVISTO_EM_NORMA');

-- CreateEnum
CREATE TYPE "Desfecho" AS ENUM ('ALTA', 'RETORNO_AGENDADO', 'ENCAMINHAMENTO_INTERNO', 'ENCAMINHAMENTO_EXTERNO');

-- CreateEnum
CREATE TYPE "TipoEncaminhamento" AS ENUM ('INTERNO', 'EXTERNO');

-- CreateEnum
CREATE TYPE "OrigemDesistencia" AS ENUM ('PACIENTE', 'EQUIPE');

-- CreateEnum
CREATE TYPE "TipoAlerta" AS ENUM ('SLA_EXCEDIDO', 'FILA_BLOQUEADA');

-- CreateEnum
CREATE TYPE "StatusAlerta" AS ENUM ('ATIVO', 'RECONHECIDO', 'NORMALIZADO');

-- CreateEnum
CREATE TYPE "AcaoEscalonamento" AS ENUM ('REFORCO_ATENDENTE', 'VAGA_EXTRA');

-- CreateTable
CREATE TABLE "fila" (
    "id" UUID NOT NULL,
    "especialidade_id" UUID NOT NULL,
    "unidade_id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "letra_senha" CHAR(1) NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "bloqueada" BOOLEAN NOT NULL DEFAULT false,
    "bloqueada_motivo" TEXT,
    "bloqueada_desde" TIMESTAMPTZ(3),
    "sla_minutos" INTEGER,

    CONSTRAINT "fila_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "triagem" (
    "id" UUID NOT NULL,
    "paciente_id" UUID NOT NULL,
    "profissional_id" UUID NOT NULL,
    "especialidade_destino_id" UUID NOT NULL,
    "tipo_atendimento" "TipoAtendimento" NOT NULL,
    "prioridade" "Prioridade" NOT NULL,
    "motivo" TEXT NOT NULL,
    "enquadramento_legal" "EnquadramentoLegal",
    "justificativa_clinica" TEXT,
    "observacoes" TEXT,
    "concluida_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "triagem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "senha" (
    "id" UUID NOT NULL,
    "numero" TEXT NOT NULL,
    "fila_id" UUID NOT NULL,
    "triagem_id" UUID NOT NULL,
    "paciente_id" UUID NOT NULL,
    "prioridade" "Prioridade" NOT NULL,
    "tipo_atendimento" "TipoAtendimento" NOT NULL,
    "status" "StatusSenha" NOT NULL DEFAULT 'AGUARDANDO',
    "tem_agendamento_previo" BOOLEAN NOT NULL DEFAULT false,
    "chegada_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "chamada_em" TIMESTAMPTZ(3),
    "tolerancia_ate" TIMESTAMPTZ(3),
    "iniciada_em" TIMESTAMPTZ(3),
    "encerrada_em" TIMESTAMPTZ(3),
    "senha_origem_id" UUID,
    "versao" INTEGER NOT NULL DEFAULT 1,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "senha_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reclassificacao_prioridade" (
    "id" UUID NOT NULL,
    "senha_id" UUID NOT NULL,
    "de_prioridade" "Prioridade" NOT NULL,
    "para_prioridade" "Prioridade" NOT NULL,
    "justificativa" TEXT NOT NULL,
    "usuario_id" UUID NOT NULL,
    "ocorrido_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reclassificacao_prioridade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chamada" (
    "id" UUID NOT NULL,
    "senha_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "local_exibicao" TEXT NOT NULL,
    "sequencia" INTEGER NOT NULL DEFAULT 1,
    "chamado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chamada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alocacao" (
    "id" UUID NOT NULL,
    "senha_id" UUID NOT NULL,
    "estudante_id" UUID NOT NULL,
    "supervisor_id" UUID,
    "sala_id" UUID NOT NULL,
    "confirmada_por" UUID NOT NULL,
    "confirmada_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "liberada_em" TIMESTAMPTZ(3),

    CONSTRAINT "alocacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atendimento" (
    "id" UUID NOT NULL,
    "senha_id" UUID NOT NULL,
    "alocacao_id" UUID NOT NULL,
    "iniciado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "encerrado_em" TIMESTAMPTZ(3),
    "desfecho" "Desfecho",
    "observacoes" TEXT,
    "validacao_exigida" BOOLEAN NOT NULL,
    "validado_por" UUID,
    "validado_em" TIMESTAMPTZ(3),
    "parecer_supervisor" TEXT,
    "versao" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "atendimento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pausa_atendimento" (
    "id" UUID NOT NULL,
    "atendimento_id" UUID NOT NULL,
    "motivo" TEXT,
    "pausado_por" UUID NOT NULL,
    "pausado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retomado_em" TIMESTAMPTZ(3),

    CONSTRAINT "pausa_atendimento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "encaminhamento" (
    "id" UUID NOT NULL,
    "atendimento_id" UUID NOT NULL,
    "tipo" "TipoEncaminhamento" NOT NULL,
    "especialidade_destino_id" UUID,
    "instituicao_destino" TEXT,
    "motivo" TEXT NOT NULL,
    "prioridade_sugerida" "Prioridade",
    "senha_gerada_id" UUID,
    "observacoes" TEXT,
    "criado_por" UUID NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "encaminhamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ausencia" (
    "id" UUID NOT NULL,
    "senha_id" UUID NOT NULL,
    "automatica" BOOLEAN NOT NULL,
    "observacao" TEXT,
    "registrado_por" UUID,
    "registrado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ausencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "desistencia" (
    "id" UUID NOT NULL,
    "senha_id" UUID NOT NULL,
    "origem" "OrigemDesistencia" NOT NULL,
    "motivo" TEXT,
    "registrado_por" UUID NOT NULL,
    "registrado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "desistencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerta" (
    "id" UUID NOT NULL,
    "tipo" "TipoAlerta" NOT NULL,
    "fila_id" UUID NOT NULL,
    "unidade_id" UUID NOT NULL,
    "status" "StatusAlerta" NOT NULL DEFAULT 'ATIVO',
    "tempo_espera_minutos" INTEGER,
    "limite_minutos" INTEGER,
    "senhas_afetadas" INTEGER,
    "disparado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reconhecido_por" UUID,
    "reconhecido_em" TIMESTAMPTZ(3),
    "normalizado_em" TIMESTAMPTZ(3),

    CONSTRAINT "alerta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escalonamento" (
    "id" UUID NOT NULL,
    "alerta_id" UUID NOT NULL,
    "acao" "AcaoEscalonamento" NOT NULL,
    "observacao" TEXT,
    "acionado_por" UUID NOT NULL,
    "acionado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "escalonamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chave_idempotencia" (
    "usuario_id" UUID NOT NULL,
    "chave" UUID NOT NULL,
    "operacao" TEXT NOT NULL,
    "status_http" INTEGER NOT NULL,
    "resposta" JSONB NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chave_idempotencia_pkey" PRIMARY KEY ("usuario_id","chave")
);

-- CreateIndex
CREATE INDEX "fila_especialidade_id_idx" ON "fila"("especialidade_id");

-- CreateIndex
CREATE INDEX "triagem_paciente_id_idx" ON "triagem"("paciente_id");

-- CreateIndex
CREATE INDEX "idx_senha_ordem" ON "senha"("fila_id", "status", "prioridade" DESC, "chegada_em", "tem_agendamento_previo" DESC);

-- CreateIndex
CREATE INDEX "senha_paciente_id_idx" ON "senha"("paciente_id");

-- CreateIndex
CREATE INDEX "reclassificacao_prioridade_senha_id_idx" ON "reclassificacao_prioridade"("senha_id");

-- CreateIndex
CREATE INDEX "chamada_chamado_em_idx" ON "chamada"("chamado_em");

-- CreateIndex
CREATE UNIQUE INDEX "chamada_senha_id_sequencia_key" ON "chamada"("senha_id", "sequencia");

-- CreateIndex
CREATE INDEX "alocacao_senha_id_idx" ON "alocacao"("senha_id");

-- CreateIndex
CREATE UNIQUE INDEX "atendimento_senha_id_key" ON "atendimento"("senha_id");

-- CreateIndex
CREATE INDEX "pausa_atendimento_atendimento_id_idx" ON "pausa_atendimento"("atendimento_id");

-- CreateIndex
CREATE UNIQUE INDEX "encaminhamento_senha_gerada_id_key" ON "encaminhamento"("senha_gerada_id");

-- CreateIndex
CREATE INDEX "encaminhamento_atendimento_id_idx" ON "encaminhamento"("atendimento_id");

-- CreateIndex
CREATE INDEX "ausencia_senha_id_idx" ON "ausencia"("senha_id");

-- CreateIndex
CREATE INDEX "ausencia_registrado_em_idx" ON "ausencia"("registrado_em");

-- CreateIndex
CREATE UNIQUE INDEX "desistencia_senha_id_key" ON "desistencia"("senha_id");

-- CreateIndex
CREATE INDEX "desistencia_registrado_em_idx" ON "desistencia"("registrado_em");

-- CreateIndex
CREATE INDEX "alerta_fila_id_status_idx" ON "alerta"("fila_id", "status");

-- CreateIndex
CREATE INDEX "escalonamento_alerta_id_idx" ON "escalonamento"("alerta_id");

-- CreateIndex
CREATE INDEX "chave_idempotencia_criado_em_idx" ON "chave_idempotencia"("criado_em");

-- AddForeignKey
ALTER TABLE "fila" ADD CONSTRAINT "fila_especialidade_id_fkey" FOREIGN KEY ("especialidade_id") REFERENCES "especialidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fila" ADD CONSTRAINT "fila_unidade_id_fkey" FOREIGN KEY ("unidade_id") REFERENCES "unidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "triagem" ADD CONSTRAINT "triagem_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "paciente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "triagem" ADD CONSTRAINT "triagem_profissional_id_fkey" FOREIGN KEY ("profissional_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "triagem" ADD CONSTRAINT "triagem_especialidade_destino_id_fkey" FOREIGN KEY ("especialidade_destino_id") REFERENCES "especialidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "senha" ADD CONSTRAINT "senha_fila_id_fkey" FOREIGN KEY ("fila_id") REFERENCES "fila"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "senha" ADD CONSTRAINT "senha_triagem_id_fkey" FOREIGN KEY ("triagem_id") REFERENCES "triagem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "senha" ADD CONSTRAINT "senha_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "paciente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "senha" ADD CONSTRAINT "senha_senha_origem_id_fkey" FOREIGN KEY ("senha_origem_id") REFERENCES "senha"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reclassificacao_prioridade" ADD CONSTRAINT "reclassificacao_prioridade_senha_id_fkey" FOREIGN KEY ("senha_id") REFERENCES "senha"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reclassificacao_prioridade" ADD CONSTRAINT "reclassificacao_prioridade_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chamada" ADD CONSTRAINT "chamada_senha_id_fkey" FOREIGN KEY ("senha_id") REFERENCES "senha"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chamada" ADD CONSTRAINT "chamada_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alocacao" ADD CONSTRAINT "alocacao_senha_id_fkey" FOREIGN KEY ("senha_id") REFERENCES "senha"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alocacao" ADD CONSTRAINT "alocacao_estudante_id_fkey" FOREIGN KEY ("estudante_id") REFERENCES "estudante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alocacao" ADD CONSTRAINT "alocacao_supervisor_id_fkey" FOREIGN KEY ("supervisor_id") REFERENCES "supervisor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alocacao" ADD CONSTRAINT "alocacao_sala_id_fkey" FOREIGN KEY ("sala_id") REFERENCES "sala"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alocacao" ADD CONSTRAINT "alocacao_confirmada_por_fkey" FOREIGN KEY ("confirmada_por") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atendimento" ADD CONSTRAINT "atendimento_senha_id_fkey" FOREIGN KEY ("senha_id") REFERENCES "senha"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atendimento" ADD CONSTRAINT "atendimento_alocacao_id_fkey" FOREIGN KEY ("alocacao_id") REFERENCES "alocacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atendimento" ADD CONSTRAINT "atendimento_validado_por_fkey" FOREIGN KEY ("validado_por") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pausa_atendimento" ADD CONSTRAINT "pausa_atendimento_atendimento_id_fkey" FOREIGN KEY ("atendimento_id") REFERENCES "atendimento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pausa_atendimento" ADD CONSTRAINT "pausa_atendimento_pausado_por_fkey" FOREIGN KEY ("pausado_por") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encaminhamento" ADD CONSTRAINT "encaminhamento_atendimento_id_fkey" FOREIGN KEY ("atendimento_id") REFERENCES "atendimento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encaminhamento" ADD CONSTRAINT "encaminhamento_especialidade_destino_id_fkey" FOREIGN KEY ("especialidade_destino_id") REFERENCES "especialidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encaminhamento" ADD CONSTRAINT "encaminhamento_senha_gerada_id_fkey" FOREIGN KEY ("senha_gerada_id") REFERENCES "senha"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encaminhamento" ADD CONSTRAINT "encaminhamento_criado_por_fkey" FOREIGN KEY ("criado_por") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ausencia" ADD CONSTRAINT "ausencia_senha_id_fkey" FOREIGN KEY ("senha_id") REFERENCES "senha"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ausencia" ADD CONSTRAINT "ausencia_registrado_por_fkey" FOREIGN KEY ("registrado_por") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "desistencia" ADD CONSTRAINT "desistencia_senha_id_fkey" FOREIGN KEY ("senha_id") REFERENCES "senha"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "desistencia" ADD CONSTRAINT "desistencia_registrado_por_fkey" FOREIGN KEY ("registrado_por") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerta" ADD CONSTRAINT "alerta_fila_id_fkey" FOREIGN KEY ("fila_id") REFERENCES "fila"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerta" ADD CONSTRAINT "alerta_unidade_id_fkey" FOREIGN KEY ("unidade_id") REFERENCES "unidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerta" ADD CONSTRAINT "alerta_reconhecido_por_fkey" FOREIGN KEY ("reconhecido_por") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalonamento" ADD CONSTRAINT "escalonamento_alerta_id_fkey" FOREIGN KEY ("alerta_id") REFERENCES "alerta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalonamento" ADD CONSTRAINT "escalonamento_acionado_por_fkey" FOREIGN KEY ("acionado_por") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chave_idempotencia" ADD CONSTRAINT "chave_idempotencia_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

