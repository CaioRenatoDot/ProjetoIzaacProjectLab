-- Parte 2.3 (#8), metade de acesso e configuração: usuário da aplicação, auditoria imutável,
-- parâmetros da unidade e restrições das tabelas da parte 2.1.
-- Os invariantes de triagem, fila, senha e alocação entram com as tabelas da parte 2.2 (#7).

-- ── Usuário de banco da aplicação (RNF-05) ──
-- O docker/postgres/init/02-*.sh cria o filas_app com LOGIN e senha. Aqui ele só é criado
-- (sem login) se ainda não existir, para que a migração rode em qualquer banco.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'filas_app') THEN
    CREATE ROLE filas_app NOLOGIN;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO filas_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO filas_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO filas_app;
-- Tabelas criadas pelas próximas migrações (sempre rodadas pelo administrador) já nascem liberadas.
-- Toda tabela imutável nova precisa do próprio REVOKE, como o audit_log abaixo.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO filas_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO filas_app;

-- Trilha append-only: a aplicação só insere e consulta.
REVOKE UPDATE, DELETE, TRUNCATE ON "audit_log" FROM filas_app;
-- O histórico de migrações é só do administrador. O banco shadow do `prisma migrate dev`
-- não tem essa tabela, por isso a checagem.
DO $$
BEGIN
  IF to_regclass('public._prisma_migrations') IS NOT NULL THEN
    REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON "_prisma_migrations" FROM filas_app;
  END IF;
END
$$;

-- ── Restrições da parte 2.1 ──
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_tentativas_falhas_check" CHECK ("tentativas_falhas" >= 0);
ALTER TABLE "supervisor" ADD CONSTRAINT "supervisor_limite_estudantes_check"
  CHECK ("limite_estudantes_simultaneos" IS NULL OR "limite_estudantes_simultaneos" > 0);
ALTER TABLE "perfil_permissao" ADD CONSTRAINT "perfil_permissao_formato_check"
  CHECK ("permissao" ~ '^[a-z_]+:[a-z_]+$');
ALTER TABLE "parametro_unidade" ADD CONSTRAINT "parametro_unidade_valor_check" CHECK ("valor" > 0);

-- ── Parâmetros da unidade (Tabela 8) ──
-- Um valor geral por chave (especialidade nula) e um por especialidade: NULLS NOT DISTINCT faz
-- o nulo contar como valor repetido. O Prisma declara o índice sem essa opção (@@unique).
CREATE UNIQUE INDEX "parametro_unidade_chave_key" ON "parametro_unidade"("unidade_id", "especialidade_id", "chave")
  NULLS NOT DISTINCT;

-- Unidade única do MVP, com id fixo para o seed (parte 2.4) e os testes reaproveitarem.
INSERT INTO "unidade" ("id", "nome", "ativo")
VALUES ('01900000-0000-7000-8000-000000000001', 'Clínica-Escola', true)
ON CONFLICT ("id") DO NOTHING;

-- Valores provisórios da Tabela 8; editáveis pela administração (docs/01 §4.7).
INSERT INTO "parametro_unidade" ("id", "unidade_id", "chave", "valor", "atualizado_em")
VALUES
  ('01900000-0000-7000-8000-000000000101', '01900000-0000-7000-8000-000000000001', 'tolerancia_minutos', 5, now()),
  ('01900000-0000-7000-8000-000000000102', '01900000-0000-7000-8000-000000000001', 'sla_minutos', 25, now()),
  ('01900000-0000-7000-8000-000000000103', '01900000-0000-7000-8000-000000000001', 'reincidencias_restricao', 3, now()),
  ('01900000-0000-7000-8000-000000000104', '01900000-0000-7000-8000-000000000001', 'janela_reincidencia_dias', 90, now()),
  ('01900000-0000-7000-8000-000000000105', '01900000-0000-7000-8000-000000000001', 'limite_estudantes_supervisor', 3, now()),
  ('01900000-0000-7000-8000-000000000106', '01900000-0000-7000-8000-000000000001', 'justificativa_min_caracteres', 20, now())
ON CONFLICT DO NOTHING;
