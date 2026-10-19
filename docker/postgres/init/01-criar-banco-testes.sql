-- Roda apenas na primeira inicialização do volume do PostgreSQL.
-- Cria o banco usado pelos testes de integração (Supertest), separado do filas_dev
-- para que os testes possam limpar dados sem apagar o seed de desenvolvimento.
CREATE DATABASE filas_test;
