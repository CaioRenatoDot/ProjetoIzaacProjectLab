# ADR-002 — Navegação por módulos (Modelo A) com painel lateral no módulo Fila

- **Status:** aceito, com pendência de validação pela unidade
- **Data:** 2026-09-08

## Contexto

Os dois documentos de interface entregues divergem entre si, e a divergência está declarada no
próprio material:

- A **Especificação de Interface de Usuário** abre afirmando que o modelo aprovado é o
  **Modelo D — Híbrido**: workspace por perfil na entrada, painel de fila com painel lateral
  contextual conduzindo todo o ciclo senha-atendimento sem troca de tela, CRUD tradicional para
  cadastros e painéis públicos separados.
- Os **Wireframes v2**, mais recentes, afirmam na nota de revisão: "A arquitetura de navegação por
  módulos foi mantida conforme os wireframes enviados. A especificação de UI em texto descrevia o
  Modelo D (painel contextual); prevalece aqui o **Modelo A**, e a especificação deve ser
  atualizada nesse ponto."

A diferença é concreta: no Modelo D, alocação (T-10), atendimento (T-13) e ausência (T-15) são
estados de um painel lateral dentro do painel de fila; no Modelo A, são telas próprias alcançadas
pelo menu de módulos lateral (Acesso, Cadastros, Triagem, Fila, Chamada, Atendimento,
Encaminhamento, Ausências, Indicadores, Auditoria).

## Decisão

Adotar o **Modelo A** como arquitetura de navegação, por ser a definição do artefato mais recente
e o que orienta explicitamente a atualização do outro documento. Rotas espelham os módulos do menu
lateral dos wireframes.

Preservar do Modelo D um único elemento: dentro do módulo Fila, a ação "Detalhes" de uma senha
abre um **painel lateral contextual** com as ações permitidas ao perfil (reclassificar, registrar
ausência, registrar desistência), como descrito no próprio W-08. Ações que envolvem formulário
longo — alocação, atendimento, encaminhamento — permanecem como telas próprias.

## Consequências

- O mapa de rotas segue os módulos: `/cadastros/{entidade}`, `/triagem`, `/fila`, `/chamada`,
  `/atendimento`, `/encaminhamento`, `/ausencias`, `/indicadores`, `/auditoria`.
- O "workspace por perfil" do Modelo D vira **filtragem do menu por permissão** (RNF-01): o
  usuário vê apenas os módulos que seu perfil acessa, e a home (W-02) muda de conteúdo por perfil.
  O comportamento observado pelo usuário é próximo, sem o custo de manter seis layouts distintos.
- A seção 4 da especificação de UI (mapa de navegação por workspace) precisa ser reescrita como
  mapa de módulos por permissão. Registrado como issue de documentação.
- Se a unidade preferir o Modelo D na validação, o impacto se concentra no módulo Fila; os demais
  módulos não mudam.

## Pendência

Confirmar o modelo com a coordenação da clínica-escola antes do início da Milestone M3 (Fila).
Enquanto não houver confirmação, este ADR vale como decisão do time.
