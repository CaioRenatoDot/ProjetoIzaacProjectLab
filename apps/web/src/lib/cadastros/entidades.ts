import { type VinculoPaciente } from '@filas/contracts';

import {
  type Especialidade,
  type Estudante,
  type Paciente,
  type Sala,
  type Supervisor,
  type Turno,
} from './tipos';

/**
 * Configuração da lista genérica de cadastros (W-03 / T-03): colunas e filtros por entidade.
 * Os filtros usam só os parâmetros que o contrato aceita; os que a T-03 pede e o contrato não tem
 * estão em `docs/07-pendencias-integracao.md`.
 */

export interface ColunaCadastro<T> {
  id: string;
  rotulo: string;
  valor: (registro: T) => string;
  /** Abaixo de 1280 px só as colunas essenciais aparecem (T-03). */
  essencial: boolean;
  /** Valor de `ordenar` (`docs/04` §5) quando a coluna é ordenável. */
  ordenar?: string;
}

export interface OpcaoFiltro {
  valor: string;
  rotulo: string;
}

export interface FiltroCadastro {
  /** Nome do parâmetro de consulta no contrato. */
  parametro: string;
  rotulo: string;
  /** `especialidades` carrega as opções de `GET /especialidades`. */
  opcoes: readonly OpcaoFiltro[] | 'especialidades';
}

export interface EntidadeCadastro<T> {
  slug: SlugCadastro;
  titulo: string;
  /** Usados em mensagens: "Nenhum paciente encontrado", "3 salas encontradas". */
  singular: string;
  plural: string;
  feminino: boolean;
  /** Campo de situação, usado para inativar (`ativa` só em especialidade). */
  campoAtivo: 'ativo' | 'ativa';
  rotuloNovo: string;
  endpoint: string;
  rotuloBusca: string;
  colunas: readonly ColunaCadastro<T>[];
  filtros: readonly FiltroCadastro[];
  /** Nome do registro em confirmações e mensagens (especificação de UI §3.3). */
  nomeRegistro: (registro: T) => string;
  /** Campos exibidos em "Detalhes". */
  detalhes: (registro: T) => readonly (readonly [string, string])[];
}

export type SlugCadastro = 'pacientes' | 'estudantes' | 'supervisores' | 'salas' | 'especialidades';

export const ROTULO_VINCULO: Record<VinculoPaciente, string> = {
  EXTERNO: 'Externo',
  ALUNO: 'Aluno',
  SERVIDOR: 'Servidor',
};

export const ROTULO_TURNO: Record<Turno, string> = {
  MANHA: 'Manhã',
  TARDE: 'Tarde',
  NOITE: 'Noite',
};

const SIM_NAO: readonly OpcaoFiltro[] = [
  { valor: 'true', rotulo: 'Sim' },
  { valor: 'false', rotulo: 'Não' },
];

const OPCOES_TURNO = (Object.keys(ROTULO_TURNO) as Turno[]).map((t) => ({
  valor: t,
  rotulo: ROTULO_TURNO[t],
}));

const simNao = (valor: boolean) => (valor ? 'Sim' : 'Não');
const nomes = (itens: readonly { nome: string }[]) => itens.map((i) => i.nome).join(', ') || '—';

function dataCurta(iso: string) {
  const [ano, mes, dia] = iso.slice(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
}

function turnos(disponibilidade: Estudante['disponibilidade']) {
  const unicos = [...new Set(disponibilidade.map((d) => d.turno))];
  return unicos.map((t) => ROTULO_TURNO[t]).join(', ') || '—';
}

export function situacaoPaciente(p: Paciente) {
  if (!p.ativo) return 'Inativo';
  if (p.restricaoAtiva)
    return p.restricaoAte ? `Restrição até ${dataCurta(p.restricaoAte)}` : 'Restrição';
  return 'Ativo';
}

function contatoPaciente(p: Paciente) {
  return [p.contatoTelefone, p.contatoEmail].filter(Boolean).join(' · ') || '—';
}

export function disponibilidadeEstudante(e: Estudante) {
  if (!e.ativo) return 'Inativo';
  return e.ocupado ? 'Em atendimento' : 'Disponível';
}

/** Ocupação sobre o limite configurado, "2 de 3" (RN-08, T-03). */
export function ocupacaoSupervisor(s: Supervisor) {
  if (!s.ativo) return 'Inativo';
  return `${s.ocupacaoAtual} de ${s.limiteEstudantesSimultaneos}`;
}

export function situacaoSala(s: Sala) {
  if (!s.ativo) return 'Inativa';
  if (s.ocupada) return 'Ocupada';
  return s.situacao || 'Disponível';
}

const pacientes: EntidadeCadastro<Paciente> = {
  slug: 'pacientes',
  titulo: 'Pacientes',
  singular: 'paciente',
  plural: 'pacientes',
  feminino: false,
  campoAtivo: 'ativo',
  rotuloNovo: 'Novo paciente',
  endpoint: '/pacientes',
  rotuloBusca: 'Buscar por nome ou documento',
  colunas: [
    { id: 'nome', rotulo: 'Nome', valor: (p) => p.nomeCompleto, essencial: true, ordenar: 'nome' },
    { id: 'contato', rotulo: 'Contato', valor: contatoPaciente, essencial: false },
    { id: 'vinculo', rotulo: 'Vínculo', valor: (p) => ROTULO_VINCULO[p.vinculo], essencial: true },
    { id: 'situacao', rotulo: 'Situação', valor: situacaoPaciente, essencial: true },
  ],
  filtros: [
    {
      parametro: 'vinculo',
      rotulo: 'Vínculo',
      opcoes: (Object.keys(ROTULO_VINCULO) as VinculoPaciente[]).map((v) => ({
        valor: v,
        rotulo: ROTULO_VINCULO[v],
      })),
    },
    {
      parametro: 'comRestricao',
      rotulo: 'Restrição por ausências',
      opcoes: [
        { valor: 'true', rotulo: 'Com restrição' },
        { valor: 'false', rotulo: 'Sem restrição' },
      ],
    },
  ],
  nomeRegistro: (p) => p.nomeCompleto,
  detalhes: (p) => [
    ['Nome', p.nomeCompleto],
    ['Documento', p.documento],
    ['Data de nascimento', dataCurta(p.dataNascimento)],
    ['Telefone', p.contatoTelefone ?? '—'],
    ['E-mail', p.contatoEmail ?? '—'],
    ['Vínculo', ROTULO_VINCULO[p.vinculo]],
    ['Situação', situacaoPaciente(p)],
  ],
};

const estudantes: EntidadeCadastro<Estudante> = {
  slug: 'estudantes',
  titulo: 'Estudantes e atendentes',
  singular: 'estudante',
  plural: 'estudantes',
  feminino: false,
  campoAtivo: 'ativo',
  rotuloNovo: 'Novo estudante',
  endpoint: '/estudantes',
  rotuloBusca: 'Buscar por nome',
  colunas: [
    { id: 'nome', rotulo: 'Nome', valor: (e) => e.nome, essencial: true, ordenar: 'nome' },
    {
      id: 'especialidade',
      rotulo: 'Especialidade',
      valor: (e) => e.especialidade,
      essencial: true,
    },
    { id: 'nivel', rotulo: 'Nível de formação', valor: (e) => e.nivelFormacao, essencial: false },
    {
      id: 'disponibilidade',
      rotulo: 'Disponibilidade',
      valor: disponibilidadeEstudante,
      essencial: true,
    },
  ],
  filtros: [
    { parametro: 'especialidadeId', rotulo: 'Especialidade', opcoes: 'especialidades' },
    { parametro: 'turno', rotulo: 'Turno', opcoes: OPCOES_TURNO },
    {
      parametro: 'disponivel',
      rotulo: 'Disponibilidade',
      opcoes: [
        { valor: 'true', rotulo: 'Disponível' },
        { valor: 'false', rotulo: 'Em atendimento' },
      ],
    },
  ],
  nomeRegistro: (e) => e.nome,
  detalhes: (e) => [
    ['Nome', e.nome],
    ['Especialidade', e.especialidade],
    ['Nível de formação', e.nivelFormacao],
    ['Habilitações', nomes(e.habilitacoes)],
    ['Procedimentos autorizados', nomes(e.procedimentosAutorizados)],
    ['Turnos', turnos(e.disponibilidade)],
    ['Disponibilidade', disponibilidadeEstudante(e)],
  ],
};

const supervisores: EntidadeCadastro<Supervisor> = {
  slug: 'supervisores',
  titulo: 'Supervisores',
  singular: 'supervisor',
  plural: 'supervisores',
  feminino: false,
  campoAtivo: 'ativo',
  rotuloNovo: 'Novo supervisor',
  endpoint: '/supervisores',
  rotuloBusca: 'Buscar por nome',
  colunas: [
    { id: 'nome', rotulo: 'Nome', valor: (s) => s.nome, essencial: true, ordenar: 'nome' },
    {
      id: 'especialidades',
      rotulo: 'Especialidades habilitadas',
      valor: (s) => nomes(s.especialidades),
      essencial: true,
    },
    { id: 'turnos', rotulo: 'Turnos', valor: (s) => turnos(s.disponibilidade), essencial: false },
    { id: 'ocupacao', rotulo: 'Ocupação atual', valor: ocupacaoSupervisor, essencial: true },
  ],
  filtros: [
    { parametro: 'especialidadeId', rotulo: 'Especialidade', opcoes: 'especialidades' },
    { parametro: 'turno', rotulo: 'Turno', opcoes: OPCOES_TURNO },
  ],
  nomeRegistro: (s) => s.nome,
  detalhes: (s) => [
    ['Nome', s.nome],
    ['Especialidades habilitadas', nomes(s.especialidades)],
    ['Procedimentos habilitados', nomes(s.procedimentos)],
    ['Turnos', turnos(s.disponibilidade)],
    ['Limite de estudantes simultâneos', String(s.limiteEstudantesSimultaneos)],
    ['Ocupação atual', ocupacaoSupervisor(s)],
  ],
};

const salas: EntidadeCadastro<Sala> = {
  slug: 'salas',
  titulo: 'Salas',
  singular: 'sala',
  plural: 'salas',
  feminino: true,
  campoAtivo: 'ativo',
  rotuloNovo: 'Nova sala',
  endpoint: '/salas',
  rotuloBusca: 'Buscar por identificação',
  colunas: [
    {
      id: 'identificacao',
      rotulo: 'Identificação',
      valor: (s) => s.identificacao,
      essencial: true,
      ordenar: 'identificacao',
    },
    {
      id: 'caracteristicas',
      rotulo: 'Características',
      valor: (s) => s.caracteristicas || '—',
      essencial: false,
    },
    { id: 'recursos', rotulo: 'Equipamentos', valor: (s) => nomes(s.recursos), essencial: false },
    { id: 'situacao', rotulo: 'Situação', valor: situacaoSala, essencial: true },
  ],
  filtros: [
    {
      parametro: 'disponivel',
      rotulo: 'Situação',
      opcoes: [
        { valor: 'true', rotulo: 'Livre' },
        { valor: 'false', rotulo: 'Ocupada' },
      ],
    },
  ],
  nomeRegistro: (s) => s.identificacao,
  detalhes: (s) => [
    ['Identificação', s.identificacao],
    ['Características', s.caracteristicas || '—'],
    ['Equipamentos e recursos', nomes(s.recursos)],
    ['Situação', situacaoSala(s)],
  ],
};

const especialidades: EntidadeCadastro<Especialidade> = {
  slug: 'especialidades',
  titulo: 'Especialidades e serviços',
  singular: 'especialidade',
  plural: 'especialidades',
  feminino: true,
  campoAtivo: 'ativa',
  rotuloNovo: 'Nova especialidade',
  endpoint: '/especialidades',
  rotuloBusca: 'Buscar por nome',
  colunas: [
    { id: 'nome', rotulo: 'Nome', valor: (e) => e.nome, essencial: true, ordenar: 'nome' },
    {
      id: 'supervisao',
      rotulo: 'Exige supervisão',
      valor: (e) => simNao(e.exigeSupervisaoDocente),
      essencial: true,
    },
    {
      id: 'filas',
      rotulo: 'Filas vinculadas',
      valor: (e) => String(e.filasVinculadas),
      essencial: false,
    },
    {
      id: 'situacao',
      rotulo: 'Situação',
      valor: (e) => (e.ativa ? 'Ativa' : 'Inativa'),
      essencial: true,
    },
  ],
  filtros: [
    {
      parametro: 'ativa',
      rotulo: 'Situação',
      opcoes: [
        { valor: 'true', rotulo: 'Ativa' },
        { valor: 'false', rotulo: 'Inativa' },
      ],
    },
    { parametro: 'exigeSupervisao', rotulo: 'Exige supervisão', opcoes: SIM_NAO },
  ],
  nomeRegistro: (e) => e.nome,
  detalhes: (e) => [
    ['Nome', e.nome],
    ['Descrição', e.descricao || '—'],
    ['Exige supervisão docente', simNao(e.exigeSupervisaoDocente)],
    ['Exige validação de encerramento', simNao(e.exigeValidacaoEncerramento)],
    ['Tolerância (minutos)', String(e.toleranciaMinutos)],
    ['Recursos exigidos', nomes(e.recursosExigidos)],
    ['Filas vinculadas', String(e.filasVinculadas)],
    ['Situação', e.ativa ? 'Ativa' : 'Inativa'],
  ],
};

/** "Nenhum paciente cadastrado" / "Nenhuma sala encontrada com esses filtros". */
export function textoNenhum(
  entidade: EntidadeCadastro<never>,
  participio: 'cadastrad' | 'encontrad',
  complemento = '',
) {
  const nenhum = entidade.feminino ? 'Nenhuma' : 'Nenhum';
  return `${nenhum} ${entidade.singular} ${participio}${entidade.feminino ? 'a' : 'o'}${complemento}`;
}

/** "1 paciente encontrado" / "3 salas encontradas". */
export function textoTotal(entidade: EntidadeCadastro<never>, total: number) {
  const nome = total === 1 ? entidade.singular : entidade.plural;
  const encontrado = `encontrad${entidade.feminino ? 'a' : 'o'}${total === 1 ? '' : 's'}`;
  return `${total} ${nome} ${encontrado}`;
}

/** Registro qualquer de cadastro: todos têm `id`. */
export interface RegistroCadastro {
  id: string;
}

/** As cinco entidades, na ordem do menu e dos wireframes. */
export const ENTIDADES_CADASTRO = {
  pacientes,
  estudantes,
  supervisores,
  salas,
  especialidades,
} as const satisfies Record<SlugCadastro, EntidadeCadastro<never>>;

export const SLUGS_CADASTRO = Object.keys(ENTIDADES_CADASTRO) as SlugCadastro[];

export function entidadeCadastro(slug: string): EntidadeCadastro<RegistroCadastro> | null {
  if (!(SLUGS_CADASTRO as string[]).includes(slug)) return null;
  return ENTIDADES_CADASTRO[slug as SlugCadastro] as unknown as EntidadeCadastro<RegistroCadastro>;
}
