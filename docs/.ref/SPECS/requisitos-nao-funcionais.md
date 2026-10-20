# Requisitos Não Funcionais (RNF)

> **Neste repositório:** o atendimento técnico de cada RNF decidido pelo time está em [`docs/01-arquitetura.md`](../../01-arquitetura.md) §5. O texto dos RNF vem do Documento de Requisitos de Sistema §4.

Requisitos transversais — não pertencem a um módulo específico, valem para o sistema como um todo. Cada módulo em `MODULOS/` referencia os RNFs que mais se aplicam a ele.

## RNF-01 | Segurança e controle de acesso
O sistema deve garantir controle de acesso baseado em perfis de usuário, permitindo que cada usuário visualize e execute somente as operações autorizadas para sua função, especialmente no acesso a dados pessoais e informações de saúde.
> Módulo relacionado: `usuarios-e-permissoes`.
>
> Atendimento técnico (Fonte: DAS §10.4): Guarda de permissão por operação, declarada de forma explícita em cada ponto de entrada; ação sem permissão não é renderizada na interface; resposta de negação neutra

## RNF-02 | Proteção de dados sensíveis
O sistema deve proteger os dados pessoais e informações de saúde armazenados e transmitidos, utilizando mecanismos adequados de segurança e restringindo o acesso a informações sensíveis somente a usuários autorizados.
> Módulo relacionado: `triagem-e-senha`.
>
> Atendimento técnico (Fonte: DAS §10.4): Projeções distintas para senha; transporte criptografado; colunas de dado clínico com acesso auditado; nome abreviado no servidor

## RNF-03 | Desempenho
O sistema deve responder às operações relacionadas à consulta, atualização e gerenciamento das filas em condições normais de utilização.
> Módulo relacionado: `fila`.
>
> Atendimento técnico (Fonte: DAS §10.4): Índice composto que implementa a ordenação da fila; canal de eventos no lugar de consulta periódica pesada; paginação obrigatória em toda listagem

## RNF-04 | Disponibilidade
O sistema deve permanecer disponível durante o horário de funcionamento da clínica-escola, com mecanismos de recuperação em caso de falhas que possam interromper o gerenciamento das filas e dos atendimentos.
> Atendimento técnico (Fonte: DAS §10.4): Verificações de vivacidade e de prontidão; reinício automático do contêiner; aviso de perda de conexão com congelamento das ações de escrita
>
> Como o contêiner é reiniciado automaticamente e como as verificações de saúde são ligadas: ver [`implantacao.md`](implantacao.md) (restrição de projeto: Docker).

## RNF-05 | Rastreabilidade e auditoria
O sistema deve manter registros de auditoria das operações relevantes realizadas pelos usuários, incluindo identificação do usuário, operação realizada, data e horário.
> Módulo relacionado: `indicadores-alertas-auditoria`.
>
> Atendimento técnico (Fonte: DAS §10.4): Registro de auditoria imutável, alimentado por interceptador global e protegido por revogação de permissão no banco

## RNF-06 | Usabilidade e acessibilidade
O sistema deve fornecer interfaces de exibição e chamada de senha acessíveis, considerando as necessidades de pacientes idosos e pessoas com deficiência.
> Módulo relacionado: `chamada-e-alocacao`.
>
> Atendimento técnico (Fonte: DAS §10.4): Biblioteca de componentes sobre primitivas acessíveis; conformidade com o nível AA no sistema e contraste reforçado nas telas públicas; verificação automática na integração contínua

## RNF-07 | Conformidade legal (LGPD)
O sistema deve tratar dados pessoais e de saúde em conformidade com a Lei Geral de Proteção de Dados (LGPD), incluindo trilha de consultas a informações de prontuário.
> Módulo relacionado: `triagem-e-senha`, `indicadores-alertas-auditoria`.
>
> Atendimento técnico (Fonte: DAS §10.4): Trilha de consulta a informação clínica; aviso de registro exibido uma vez por sessão nas telas que abrem prontuário; política de retenção configurável

## RNF-08 | Escalabilidade
O sistema deve suportar o funcionamento simultâneo de múltiplas especialidades e, quando aplicável, múltiplas unidades, sem degradação perceptível de desempenho.
> Atendimento técnico (Fonte: DAS §10.4): Serviço sem estado em memória; adaptador externo para o canal de eventos; filtro por unidade em todas as consultas

## RNF-09 | Backup e recuperação de desastres
O sistema deve realizar backup periódico dos dados e definir objetivos de tempo e ponto de recuperação (RTO/RPO).
> Atendimento técnico (Fonte: DAS §10.4): Extração diária agendada do banco, com objetivos de ponto e de tempo de recuperação documentados no manual de operação
>
> Fonte: DAS §6.5. Rotina "Cópia de segurança do banco": "Executa a extração diária dos dados, com objetivo de ponto de recuperação de vinte e quatro horas e objetivo de tempo de recuperação de quatro horas". Divergência D-22: o texto do RNF-09 pede para "definir" RTO/RPO; o DAS já traz os valores (RPO de 24 h e RTO de 4 h). O texto do RNF não foi alterado.
