/**
 * Dados fictícios do ambiente local (docs/01 §6). Nenhum nome, documento ou contato é de pessoa
 * real (RNF-07): documentos sequenciais, telefones (00) e e-mails no domínio reservado `.invalid`.
 * Os ids são fixos para todos partirem do mesmo estado e os testes poderem referenciá-los.
 */

export const UNIDADE = '01900000-0000-7000-8000-000000000001';

const id = (grupo: number, numero: number) =>
  `01900000-0000-7000-8000-${String(grupo).padStart(4, '0')}${String(numero).padStart(8, '0')}`;

export const PERFIS = [
  {
    id: id(1, 1),
    nome: 'Administrador',
    descricao: 'Perfil do sistema, com acesso total.',
    sistema: true,
    permissoes: 'todas' as const,
  },
  {
    id: id(1, 2),
    nome: 'Recepção',
    descricao: 'Cadastros, chamada da fila e registro de ausência.',
    sistema: false,
    permissoes: [
      'cadastros:consultar',
      'cadastros:criar',
      'cadastros:editar',
      'fila:consultar',
      'fila:chamar',
      'senha:consultar',
      'ausencia:consultar',
      'ausencia:criar',
    ],
  },
  {
    id: id(1, 3),
    nome: 'Triagem',
    descricao: 'Triagem do paciente, emissão e reclassificação de senha.',
    sistema: false,
    permissoes: [
      'cadastros:consultar',
      'triagem:consultar',
      'triagem:criar',
      'triagem:editar',
      'triagem:consultar_sensivel',
      'senha:consultar',
      'senha:criar',
      'senha:reclassificar',
      'fila:consultar',
    ],
  },
  {
    id: id(1, 4),
    nome: 'Estudante',
    descricao: 'Condução do atendimento e encaminhamento.',
    sistema: false,
    permissoes: [
      'fila:consultar',
      'alocacao:consultar',
      'atendimento:consultar',
      'atendimento:criar',
      'atendimento:editar',
      'atendimento:consultar_sensivel',
      'encaminhamento:consultar',
      'encaminhamento:criar',
    ],
  },
  {
    id: id(1, 5),
    nome: 'Supervisão',
    descricao: 'Validação do encerramento e reclassificação de prioridade.',
    sistema: false,
    permissoes: [
      'fila:consultar',
      'senha:consultar',
      'senha:reclassificar',
      'alocacao:consultar',
      'atendimento:consultar',
      'atendimento:validar',
      'atendimento:consultar_sensivel',
      'alertas:consultar',
    ],
  },
  {
    id: id(1, 6),
    nome: 'Gestão',
    descricao: 'Indicadores, alertas de tempo de espera e trilha de auditoria.',
    sistema: false,
    permissoes: [
      'indicadores:consultar',
      'indicadores:exportar',
      'alertas:consultar',
      'alertas:reconhecer',
      'alertas:escalonar',
      'auditoria:consultar',
      'auditoria:exportar',
      'fila:consultar',
    ],
  },
];

/** Um usuário por perfil, mais um inativo para testar a resposta neutra do login. */
export const USUARIOS = [
  {
    id: id(2, 1),
    nome: 'Administração (fictício)',
    identificacao: 'admin@clinica.invalid',
    perfilId: id(1, 1),
    ativo: true,
  },
  {
    id: id(2, 2),
    nome: 'Recepção (fictício)',
    identificacao: 'recepcao@clinica.invalid',
    perfilId: id(1, 2),
    ativo: true,
  },
  {
    id: id(2, 3),
    nome: 'Triagem (fictício)',
    identificacao: 'triagem@clinica.invalid',
    perfilId: id(1, 3),
    ativo: true,
  },
  {
    id: id(2, 4),
    nome: 'Estudante (fictício)',
    identificacao: 'estudante@clinica.invalid',
    perfilId: id(1, 4),
    ativo: true,
  },
  {
    id: id(2, 5),
    nome: 'Supervisão (fictício)',
    identificacao: 'supervisao@clinica.invalid',
    perfilId: id(1, 5),
    ativo: true,
  },
  {
    id: id(2, 6),
    nome: 'Gestão (fictício)',
    identificacao: 'gestao@clinica.invalid',
    perfilId: id(1, 6),
    ativo: true,
  },
  {
    id: id(2, 7),
    nome: 'Conta inativa (fictício)',
    identificacao: 'inativo@clinica.invalid',
    perfilId: id(1, 2),
    ativo: false,
  },
];

export const HABILITACOES = [
  'Radiologia odontológica',
  'Avaliação psicológica',
  'Terapia manual',
  'Avaliação nutricional',
  'Audiometria',
].map((nome, i) => ({ id: id(3, i + 1), nome }));

export const PROCEDIMENTOS = [
  'Profilaxia',
  'Restauração',
  'Psicoterapia individual',
  'Cinesioterapia',
  'Plano alimentar',
  'Terapia da fala',
].map((nome, i) => ({ id: id(4, i + 1), nome }));

export const RECURSOS = [
  'Cadeira odontológica',
  'Maca',
  'Divã',
  'Balança antropométrica',
  'Cabine acústica',
  'Espelho terapêutico',
].map((nome, i) => ({ id: id(5, i + 1), nome }));

const R = Object.fromEntries(RECURSOS.map((r) => [r.nome, r.id]));
const H = Object.fromEntries(HABILITACOES.map((h) => [h.nome, h.id]));
const P = Object.fromEntries(PROCEDIMENTOS.map((p) => [p.nome, p.id]));

export const ESPECIALIDADES = [
  {
    id: id(6, 1),
    nome: 'Fisioterapia',
    letraSenha: 'F',
    exigeSupervisaoDocente: true,
    exigeValidacaoEncerramento: true,
    recursos: [R['Maca']!],
  },
  {
    id: id(6, 2),
    nome: 'Psicologia',
    letraSenha: 'P',
    exigeSupervisaoDocente: true,
    exigeValidacaoEncerramento: false,
    recursos: [R['Divã']!],
  },
  {
    id: id(6, 3),
    nome: 'Nutrição',
    letraSenha: 'N',
    exigeSupervisaoDocente: false,
    exigeValidacaoEncerramento: false,
    recursos: [R['Balança antropométrica']!],
  },
  {
    id: id(6, 4),
    nome: 'Odontologia',
    letraSenha: 'O',
    exigeSupervisaoDocente: true,
    exigeValidacaoEncerramento: true,
    recursos: [R['Cadeira odontológica']!],
  },
  {
    id: id(6, 5),
    nome: 'Fonoaudiologia',
    letraSenha: 'A',
    exigeSupervisaoDocente: false,
    exigeValidacaoEncerramento: true,
    recursos: [R['Cabine acústica']!, R['Espelho terapêutico']!],
  },
];

const E = Object.fromEntries(ESPECIALIDADES.map((e) => [e.nome, e.id]));

/** Uma fila ativa por especialidade (RF-04), com a letra do número da senha. */
export const FILAS = ESPECIALIDADES.map((especialidade, i) => ({
  id: id(11, i + 1),
  especialidadeId: especialidade.id,
  nome: especialidade.nome,
  letraSenha: especialidade.letraSenha,
}));

export const SALAS = [
  {
    id: id(7, 1),
    identificacao: 'Sala 01',
    caracteristicas: 'Consultório com pia',
    situacao: 'DISPONIVEL' as const,
    recursos: [R['Maca']!],
  },
  {
    id: id(7, 2),
    identificacao: 'Sala 02',
    caracteristicas: 'Ambiente silencioso',
    situacao: 'DISPONIVEL' as const,
    recursos: [R['Divã']!],
  },
  {
    id: id(7, 3),
    identificacao: 'Sala 03',
    caracteristicas: 'Box odontológico',
    situacao: 'DISPONIVEL' as const,
    recursos: [R['Cadeira odontológica']!],
  },
  {
    id: id(7, 4),
    identificacao: 'Sala 04',
    caracteristicas: 'Consultório amplo',
    situacao: 'DISPONIVEL' as const,
    recursos: [R['Balança antropométrica']!, R['Maca']!],
  },
  {
    id: id(7, 5),
    identificacao: 'Sala 05',
    caracteristicas: 'Tratamento acústico',
    situacao: 'DISPONIVEL' as const,
    recursos: [R['Cabine acústica']!, R['Espelho terapêutico']!],
  },
  {
    id: id(7, 6),
    identificacao: 'Sala 06',
    caracteristicas: 'Box odontológico',
    situacao: 'EM_MANUTENCAO' as const,
    recursos: [R['Cadeira odontológica']!],
  },
];

type Turno = 'MANHA' | 'TARDE' | 'NOITE';
type Dia = 'SEGUNDA' | 'TERCA' | 'QUARTA' | 'QUINTA' | 'SEXTA';
const turnos = (dias: Dia[], turno: Turno) => dias.map((diaSemana) => ({ diaSemana, turno }));

export const SUPERVISORES = [
  {
    id: id(8, 1),
    nome: 'Prof. Supervisor Fictício A',
    limite: 3,
    especialidades: [E['Fisioterapia']!],
    procedimentos: [P['Cinesioterapia']!],
    disponibilidade: turnos(['SEGUNDA', 'QUARTA', 'SEXTA'], 'MANHA'),
  },
  {
    id: id(8, 2),
    nome: 'Prof. Supervisor Fictício B',
    limite: 2,
    especialidades: [E['Psicologia']!],
    procedimentos: [P['Psicoterapia individual']!],
    disponibilidade: turnos(['TERCA', 'QUINTA'], 'TARDE'),
  },
  {
    id: id(8, 3),
    nome: 'Prof. Supervisor Fictício C',
    limite: 3,
    especialidades: [E['Odontologia']!],
    procedimentos: [P['Profilaxia']!, P['Restauração']!],
    disponibilidade: turnos(['SEGUNDA', 'TERCA', 'QUARTA', 'QUINTA', 'SEXTA'], 'MANHA'),
  },
  {
    id: id(8, 4),
    nome: 'Prof. Supervisor Fictício D',
    limite: 4,
    especialidades: [E['Fisioterapia']!, E['Odontologia']!],
    procedimentos: [],
    disponibilidade: turnos(['SEGUNDA', 'QUARTA'], 'TARDE'),
  },
];

export const ESTUDANTES = [
  {
    nome: 'Estudante Fictício 01',
    especialidade: 'Fisioterapia',
    nivel: '7º período',
    hab: ['Terapia manual'],
    proc: ['Cinesioterapia'],
    dias: turnos(['SEGUNDA', 'QUARTA'], 'MANHA'),
  },
  {
    nome: 'Estudante Fictício 02',
    especialidade: 'Fisioterapia',
    nivel: '9º período',
    hab: ['Terapia manual'],
    proc: ['Cinesioterapia'],
    dias: turnos(['SEXTA'], 'MANHA'),
  },
  {
    nome: 'Estudante Fictício 03',
    especialidade: 'Psicologia',
    nivel: '8º período',
    hab: ['Avaliação psicológica'],
    proc: ['Psicoterapia individual'],
    dias: turnos(['TERCA', 'QUINTA'], 'TARDE'),
  },
  {
    nome: 'Estudante Fictício 04',
    especialidade: 'Psicologia',
    nivel: '10º período',
    hab: ['Avaliação psicológica'],
    proc: ['Psicoterapia individual'],
    dias: turnos(['TERCA'], 'TARDE'),
  },
  {
    nome: 'Estudante Fictício 05',
    especialidade: 'Odontologia',
    nivel: '6º período',
    hab: ['Radiologia odontológica'],
    proc: ['Profilaxia'],
    dias: turnos(['SEGUNDA', 'TERCA'], 'MANHA'),
  },
  {
    nome: 'Estudante Fictício 06',
    especialidade: 'Odontologia',
    nivel: '8º período',
    hab: ['Radiologia odontológica'],
    proc: ['Profilaxia', 'Restauração'],
    dias: turnos(['QUARTA', 'QUINTA'], 'MANHA'),
  },
  {
    nome: 'Estudante Fictício 07',
    especialidade: 'Nutrição',
    nivel: '7º período',
    hab: ['Avaliação nutricional'],
    proc: ['Plano alimentar'],
    dias: turnos(['SEGUNDA', 'SEXTA'], 'TARDE'),
  },
  {
    nome: 'Estudante Fictício 08',
    especialidade: 'Fonoaudiologia',
    nivel: '8º período',
    hab: ['Audiometria'],
    proc: ['Terapia da fala'],
    dias: turnos(['QUARTA'], 'NOITE'),
  },
].map((e, i) => ({
  id: id(9, i + 1),
  nome: e.nome,
  especialidadeId: E[e.especialidade]!,
  nivelFormacao: e.nivel,
  habilitacoes: e.hab.map((nome) => H[nome]!),
  procedimentos: e.proc.map((nome) => P[nome]!),
  disponibilidade: e.dias,
}));

const VINCULOS = ['EXTERNO', 'ALUNO', 'SERVIDOR'] as const;
const NOMES = [
  'Ana',
  'Bruno',
  'Carla',
  'Diego',
  'Elisa',
  'Fábio',
  'Gabriela',
  'Heitor',
  'Iara',
  'João',
];
const SOBRENOMES = ['Fictícia Alves', 'Fictício Barros', 'Fictícia Costa', 'Fictício Duarte'];

/** 24 pacientes: o primeiro idoso (prioridade legal) e o segundo com restrição por reincidência. */
export const PACIENTES = Array.from({ length: 24 }, (_, i) => ({
  id: id(10, i + 1),
  nomeCompleto: `${NOMES[i % NOMES.length]} ${SOBRENOMES[i % SOBRENOMES.length]} ${i + 1}`,
  documento: String(i + 1).padStart(11, '0'),
  dataNascimento:
    i === 0 ? '1948-04-12' : `${1960 + ((i * 3) % 45)}-${String((i % 12) + 1).padStart(2, '0')}-15`,
  contatoTelefone: '(00) 0000-0000',
  contatoEmail: `paciente${i + 1}@clinica.invalid`,
  vinculo: VINCULOS[i % VINCULOS.length]!,
  restricaoAtiva: i === 1,
  restricaoAte: i === 1 ? '2099-12-31' : null,
}));
