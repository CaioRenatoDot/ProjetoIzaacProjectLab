#!/bin/sh
# Roda apenas na primeira inicialização do volume (depois do 01, que cria o filas_test).
# Cria o usuário de banco da aplicação (filas_app), que não é dono das tabelas: assim o
# REVOKE de UPDATE/DELETE no audit_log vale de fato (RNF-05). As migrações continuam com
# o POSTGRES_USER, dono das tabelas. Os GRANTs nas tabelas ficam na migração.
set -e

psql -v ON_ERROR_STOP=1 -v senha="${FILAS_APP_PASSWORD:-filas_app}" \
  --username "$POSTGRES_USER" --dbname postgres <<'EOSQL'
SELECT format('CREATE ROLE filas_app LOGIN PASSWORD %L', :'senha')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'filas_app')
\gexec
SELECT format('ALTER ROLE filas_app LOGIN PASSWORD %L', :'senha')
\gexec
GRANT CONNECT ON DATABASE filas_dev TO filas_app;
GRANT CONNECT ON DATABASE filas_test TO filas_app;
EOSQL
