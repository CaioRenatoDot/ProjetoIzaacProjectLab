# Módulo: Acesso Público

> Este módulo **não tem requisito funcional nem caso de uso próprio**. Ele existe para espelhar a Figura 1 do documento de arquitetura do grupo, que traz um "módulo de acesso público" ligado diretamente ao sistema. Todo o conteúdo abaixo é referência ou citação, com a fonte indicada.

## Objetivo
Fonte: DAS §5.1, linha "Aplicação pública": "Telão da sala de espera e consulta da própria senha pelo paciente. Não tem autenticação, não tem menu e não conhece nenhum conceito clínico."

Fonte: Documento de Requisitos de Sistema §7: "O módulo de acesso público está ligado diretamente ao sistema, e não ao módulo de fila, por constituir aplicação separada, sem autenticação, conforme decisão registrada na arquitetura."

## Requisitos Funcionais / Casos de Uso
**Nenhum próprio.** Este módulo apenas reaproveita:
- **UC-08** (consultar fila e posição de espera — visão do paciente), descrito em `MODULOS/fila/spec.md`, com **RF-04**.
- **UC-09**, passo 4 (exibição da chamada no painel público), descrito em `MODULOS/chamada-e-alocacao/spec.md`, com **RF-05**.

Telas: W-09 (telão público da sala de espera) e W-10 (consulta de senha pelo paciente) em `especificacao/wireframes_ui_v2.pdf`; T-11 e T-12 em `especificacao/especificacao_ui.pdf`. Ver o mapa de telas em `SPECS/frontend/spec.md`.

## Requisitos Não Funcionais relacionados
- **RNF-02** — Proteção de dados sensíveis: nenhum dado de paciente chega à tela pública (ver `SPECS/requisitos-nao-funcionais.md`).
- **RNF-06** — Usabilidade e acessibilidade: telão legível a distância e consulta acessível a idosos e pessoas com deficiência (ver `SPECS/requisitos-nao-funcionais.md`).

## Operações públicas
Fonte: DAS §9.12 (tabela completa em `SPECS/backend/api.md`).

| Operação | Ação | Recurso | Permissão | Rastreabilidade |
|---|---|---|---|---|
| Consultar estado do telão da sala de espera | Consultar | Painel da unidade | Pública | UC-09, W-09, RF-05 |
| Consultar posição de uma senha | Consultar | Senha pública | Pública | UC-08, W-10, RF-04 |

As operações públicas não exigem autenticação e servem apenas ao telão e à consulta do paciente. Estão sujeitas a limite de trinta requisições por minuto por origem. Nunca devolvem nome de paciente, prioridade clínica ou dado de saúde. Senha inexistente ou de outro dia produz mensagem neutra, sem revelar se aquele número já existiu.

## Entidades relacionadas
- Senha (projeção pública: número, especialidade e local — DAS §9.15)
- Chamada

## Dependências / Observações
- Depende de `fila` (consulta de posição, UC-08) e de `chamada-e-alocacao` (chamada exibida no telão, UC-09).
- É uma aplicação separada da aplicação operacional (motivos em `SPECS/frontend/spec.md`, "Por que a aplicação pública é separada") e usa um espaço de eventos próprio, sem autenticação (`SPECS/backend/spec.md`, "Canal de eventos em tempo real").
- Divergência D-31: `especificacao/especificacao_ui.pdf` T-12 (consulta do paciente, W-10) mostra "número, especialidade, posição atual, tempo médio estimado e status", mas o DAS §9.15 define a projeção pública como "Número, especialidade e local", "um tipo que não tem os demais campos"; a operação "Consultar posição de uma senha" (DAS §9.12) também não cabe nessa projeção. Nenhum dos dois foi alterado. Pendência: o grupo define se a consulta pública usa uma quarta variante de projeção ou se a projeção pública ganha posição e status. **Decidido no repositório:** `openapi.yaml` separa telão (número, especialidade, local) e consulta do paciente (`GET /publico/senhas/{numero}`: número, especialidade, status, posição, tempo estimado, local). Ver `SPECS/backend/api.md`.
- Divergência D-15: o passo 4 do UC-09 cita "(paciente, senha)", mas P-03 e o DAS §9.12 limitam o painel público a número, especialidade e local. Ver a nota em `MODULOS/chamada-e-alocacao/spec.md`. **Decidido no repositório:** ADR-003, "Nota sobre o UC-09" (erro de redação; sem dado de paciente no painel).
