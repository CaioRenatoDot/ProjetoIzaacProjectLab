# Módulo: Usuários e Permissões

## Objetivo
Gerenciar os perfis de usuário do sistema e as permissões de acesso associadas a cada perfil, controlando quem pode visualizar e executar cada operação.

## Requisitos Não Funcionais relacionados
- **RNF-01** — Segurança e controle de acesso: o sistema deve garantir controle de acesso baseado em perfis de usuário, permitindo que cada usuário visualize e execute somente as operações autorizadas para sua função, especialmente no acesso a dados pessoais e informações de saúde. (ver detalhamento completo em `SPECS/requisitos-nao-funcionais.md`)

## Requisitos Funcionais
### RF-02 | Gerenciar perfis de usuário e permissões de acesso
O sistema deve permitir realizar o CRUD de perfis de usuário, definindo as operações e informações que cada perfil pode acessar.
**Implementa:** RNF-01.

## Casos de Uso
### UC-04 | Cadastrar perfil de usuário e definir permissões
**Atores:** Administrador do sistema

**Pré-condição:** Usuário autenticado com permissão administrativa.

**Fluxo Principal:**
1. Usuário acessa o menu "Perfis de Usuário".
2. Usuário clica em "Novo Perfil".
3. Sistema exibe formulário com a lista de operações/módulos disponíveis.
4. Usuário nomeia o perfil e seleciona as permissões correspondentes.
5. Usuário clica em "Salvar".
6. Sistema valida os dados.
7. Sistema salva o perfil.

**Fluxo Alternativo:** Usuário clica em "Cancelar" → sistema descarta os dados.

**Fluxo de Exceção:** Nome de perfil já existente → sistema exibe mensagem de duplicidade.

**Pós-condição:** Perfil de usuário criado e disponível para vinculação a usuários do sistema.

## Entidades relacionadas
- Perfil de Usuário
- Usuário (vínculo com os demais cadastros: Estudante/Atendente, Supervisor, Administrador, Recepcionista/Atendente, Gestão)
- Unidade
- Parâmetro de unidade
- Permissão de perfil

## Dependências / Observações
- É pré-requisito lógico para todos os outros módulos, já que RNF-01 exige controle de acesso baseado em perfil em todo o sistema.
- Dados de saúde (ligados ao módulo `triagem-e-senha`) exigem restrição de acesso definida aqui (ver RNF-02 em `SPECS/requisitos-nao-funcionais.md`).
- Perfis de exemplo nos wireframes (`especificacao/wireframes_ui_v2.pdf`, W-05): Administrador (sistema), Recepção, Triagem, Estudante, Supervisão, Gestão.
- Perfil do sistema não é editável nem removível; a exclusão de um perfil é recusada enquanto houver usuário vinculado (DAS §9.3).
- Permissão é formada por módulo e operação, e o perfil é um conjunto dessas permissões; a interface nunca decide permissão por nome de perfil (DAS §9.2 e §9.14). O catálogo de permissões está no DAS §9.14 (divergência D-12: `especificacao/especificacao_ui.pdf` T-05 descreve quatro colunas por módulo — consultar, criar, editar, excluir — e o DAS acrescenta operações próprias, como chamar, validar, reclassificar, exportar, reconhecer, escalonar e consultar informação sensível; segue-se o DAS, mais recente). **Decidido no repositório:** catálogo de `docs/04-contrato-api.md` §3.
- Autenticação e sessão (credencial de 15 minutos e de renovação de 8 horas, bloqueio após 5 tentativas): ver `SPECS/backend/api.md`, §9.2. Dados de usuário, perfil e parâmetros: `SPECS/database/spec.md` (tabelas 6 a 8).
