import {
  EspecialidadeEntrada,
  EstudanteEntrada,
  PacienteEntrada,
  SalaEntrada,
  SituacaoSala,
  SupervisorEntrada,
  VinculoPaciente,
} from '@filas/contracts';
import { z } from 'zod';

import {
  ROTULO_SITUACAO_SALA,
  ROTULO_TURNO,
  ROTULO_VINCULO,
  type OpcaoFiltro,
  type SlugCadastro,
} from './entidades';
import {
  type Disponibilidade,
  type Especialidade,
  type Estudante,
  type Paciente,
  type Sala,
  type Supervisor,
  type Turno,
} from './tipos';

/**
 * Formulário genérico de cadastro (W-04 / T-04): campos e validação por entidade.
 * Os schemas são cópia local das entradas do `openapi.yaml` (`PacienteEntrada` etc.), com os
 * campos do Documento de Requisitos §5, Tabelas 1 a 5. Saem quando #13 e #14 criarem os oficiais
 * em `@filas/contracts` (`docs/07-pendencias-integracao.md`).
 */

export type Catalogo = 'especialidades' | 'habilitacoes' | 'procedimentos' | 'recursos';

export type TipoCampo =
  | 'texto'
  | 'area'
  | 'data'
  | 'telefone'
  | 'email'
  | 'selecao'
  | 'simnao'
  | 'inteiro'
  | 'multipla'
  | 'disponibilidade';

export interface CampoFormulario {
  nome: string;
  rotulo: string;
  tipo: TipoCampo;
  obrigatorio: boolean;
  dica?: string;
  opcoes?: readonly OpcaoFiltro[];
  /** Origem das opções de `selecao` e `multipla` (cadastros de apoio, Tabelas 2 a 5). */
  catalogo?: Catalogo;
  autoComplete?: string;
}

export interface SecaoFormulario {
  legenda: string;
  campos: readonly CampoFormulario[];
}

export type Valores = Record<string, unknown>;

export interface FormularioCadastro<R = never> {
  schema: z.ZodType<Valores, Valores>;
  secoes: readonly SecaoFormulario[];
  vazio: Valores;
  deRegistro: (registro: R) => Valores;
  paraEntrada: (valores: Valores) => Valores;
}

/** Situações da sala (Tabela 4, ID04), com os valores do contrato (`SituacaoSala`). */
export const SITUACOES_SALA = SituacaoSala.options;

/** Dias oferecidos na disponibilidade (`diaSemana` 1 a 6 do contrato). */
export const DIAS_SEMANA: readonly (readonly [number, string])[] = [
  [1, 'Segunda'],
  [2, 'Terça'],
  [3, 'Quarta'],
  [4, 'Quinta'],
  [5, 'Sexta'],
  [6, 'Sábado'],
];

export const TURNOS = Object.keys(ROTULO_TURNO) as Turno[];

/*
 * Schemas dos formulários a partir das entradas de `@filas/contracts` (fonte única: tamanhos,
 * enums, limites e datas). Só muda o que o formulário entrega diferente do corpo da API:
 * - IDs: basta ter escolhido; o formato (UUID) é conferido pela API, e a simulação usa IDs legíveis;
 * - campo vazio chega como '' (texto) ou NaN (número) e vira "sem valor" antes do contrato;
 * - telefone: o formulário pede o formato (00) 00000-0000, mais restrito que o contrato.
 */
const semValor = (valor: unknown) =>
  valor === '' || (typeof valor === 'number' && Number.isNaN(valor)) ? undefined : valor;
const idEscolhido = (mensagem: string) => z.string().min(1, mensagem);
const idsEscolhidos = (mensagem: string) => z.array(z.string()).min(1, mensagem);
const ids = z.array(z.string());
const inteiroPositivo = (vazio: string) =>
  z
    .number({ error: vazio })
    .int('Use um número inteiro, sem casas decimais.')
    .min(1, 'Use um número inteiro positivo (1 ou mais).');

const somenteSeTiver = (texto: string) => (texto === '' ? undefined : texto);

const PacienteSchema = PacienteEntrada.extend({
  contatoTelefone: z
    .string()
    .trim()
    .refine(
      (v) => v === '' || /^\(\d{2}\) \d{4,5}-\d{4}$/.test(v),
      'Use o formato (00) 00000-0000.',
    ),
  contatoEmail: z.preprocess(semValor, PacienteEntrada.shape.contatoEmail),
});

const EstudanteSchema = EstudanteEntrada.extend({
  especialidadeId: idEscolhido('Escolha a especialidade.'),
  habilitacoesIds: idsEscolhidos('Escolha ao menos uma habilitação.'),
  procedimentosIds: idsEscolhidos('Escolha ao menos um procedimento autorizado.'),
});

const SupervisorSchema = SupervisorEntrada.extend({
  especialidadesIds: idsEscolhidos('Escolha ao menos uma especialidade.'),
  procedimentosIds: ids,
  limiteEstudantesSimultaneos: z.preprocess(
    semValor,
    inteiroPositivo('Informe o limite de estudantes simultâneos.'),
  ),
});

const SalaSchema = SalaEntrada.extend({ recursosIds: ids });

const EspecialidadeSchema = EspecialidadeEntrada.extend({
  toleranciaMinutos: z.preprocess(semValor, EspecialidadeEntrada.shape.toleranciaMinutos),
  recursosExigidosIds: ids,
});

const idsDe = (itens: readonly { id: string }[]) => itens.map((i) => i.id);
const copiaDisponibilidade = (d: readonly Disponibilidade[]) =>
  d.map(({ diaSemana, turno }) => ({ diaSemana, turno }));

const pacientes: FormularioCadastro<Paciente> = {
  schema: PacienteSchema,
  secoes: [
    {
      legenda: 'Identificação',
      campos: [
        {
          nome: 'nomeCompleto',
          rotulo: 'Nome completo',
          tipo: 'texto',
          obrigatorio: true,
          autoComplete: 'off',
        },
        {
          nome: 'documento',
          rotulo: 'Documento',
          tipo: 'texto',
          obrigatorio: true,
          dica: 'Usado para verificar se o paciente já tem cadastro.',
        },
        { nome: 'dataNascimento', rotulo: 'Data de nascimento', tipo: 'data', obrigatorio: true },
      ],
    },
    {
      legenda: 'Contato',
      campos: [
        {
          nome: 'contatoTelefone',
          rotulo: 'Telefone',
          tipo: 'telefone',
          obrigatorio: false,
          dica: 'Formato (00) 00000-0000.',
        },
        { nome: 'contatoEmail', rotulo: 'E-mail', tipo: 'email', obrigatorio: false },
      ],
    },
    {
      legenda: 'Vínculo com a instituição',
      campos: [
        {
          nome: 'vinculo',
          rotulo: 'Vínculo',
          tipo: 'selecao',
          obrigatorio: true,
          opcoes: VinculoPaciente.options.map((v) => ({ valor: v, rotulo: ROTULO_VINCULO[v] })),
        },
      ],
    },
  ],
  vazio: {
    nomeCompleto: '',
    documento: '',
    dataNascimento: '',
    contatoTelefone: '',
    contatoEmail: '',
    vinculo: '',
  },
  deRegistro: (p) => ({
    nomeCompleto: p.nomeCompleto,
    documento: p.documento,
    dataNascimento: p.dataNascimento.slice(0, 10),
    contatoTelefone: p.contatoTelefone ?? '',
    contatoEmail: p.contatoEmail ?? '',
    vinculo: p.vinculo,
  }),
  paraEntrada: (v) => ({
    ...v,
    contatoTelefone: somenteSeTiver(v.contatoTelefone as string),
    contatoEmail: somenteSeTiver(v.contatoEmail as string),
  }),
};

const estudantes: FormularioCadastro<Estudante> = {
  schema: EstudanteSchema,
  secoes: [
    {
      legenda: 'Identificação',
      campos: [
        {
          nome: 'nome',
          rotulo: 'Nome completo',
          tipo: 'texto',
          obrigatorio: true,
          autoComplete: 'off',
        },
        {
          nome: 'especialidadeId',
          rotulo: 'Especialidade',
          tipo: 'selecao',
          obrigatorio: true,
          catalogo: 'especialidades',
        },
        {
          nome: 'nivelFormacao',
          rotulo: 'Nível de formação',
          tipo: 'texto',
          obrigatorio: true,
          dica: 'Por exemplo: 8º período.',
        },
      ],
    },
    {
      legenda: 'Habilitações e procedimentos (RN-06)',
      campos: [
        {
          nome: 'habilitacoesIds',
          rotulo: 'Habilitações',
          tipo: 'multipla',
          obrigatorio: true,
          catalogo: 'habilitacoes',
        },
        {
          nome: 'procedimentosIds',
          rotulo: 'Procedimentos autorizados',
          tipo: 'multipla',
          obrigatorio: true,
          catalogo: 'procedimentos',
        },
      ],
    },
    {
      legenda: 'Disponibilidade',
      campos: [
        {
          nome: 'disponibilidade',
          rotulo: 'Dias e turnos',
          tipo: 'disponibilidade',
          obrigatorio: true,
        },
      ],
    },
  ],
  vazio: {
    nome: '',
    especialidadeId: '',
    nivelFormacao: '',
    habilitacoesIds: [],
    procedimentosIds: [],
    disponibilidade: [],
  },
  deRegistro: (e) => ({
    nome: e.nome,
    especialidadeId: e.especialidadeId,
    nivelFormacao: e.nivelFormacao,
    habilitacoesIds: idsDe(e.habilitacoes),
    procedimentosIds: idsDe(e.procedimentosAutorizados),
    disponibilidade: copiaDisponibilidade(e.disponibilidade),
  }),
  paraEntrada: (v) => v,
};

const supervisores: FormularioCadastro<Supervisor> = {
  schema: SupervisorSchema,
  secoes: [
    {
      legenda: 'Identificação',
      campos: [
        {
          nome: 'nome',
          rotulo: 'Nome completo',
          tipo: 'texto',
          obrigatorio: true,
          autoComplete: 'off',
        },
      ],
    },
    {
      legenda: 'Habilitação (RN-07)',
      campos: [
        {
          nome: 'especialidadesIds',
          rotulo: 'Especialidades habilitadas',
          tipo: 'multipla',
          obrigatorio: true,
          catalogo: 'especialidades',
        },
        {
          nome: 'procedimentosIds',
          rotulo: 'Procedimentos habilitados',
          tipo: 'multipla',
          obrigatorio: false,
          catalogo: 'procedimentos',
        },
      ],
    },
    {
      legenda: 'Disponibilidade e limite (RN-08)',
      campos: [
        {
          nome: 'disponibilidade',
          rotulo: 'Dias e turnos',
          tipo: 'disponibilidade',
          obrigatorio: false,
        },
        {
          nome: 'limiteEstudantesSimultaneos',
          rotulo: 'Limite de estudantes simultâneos',
          tipo: 'inteiro',
          obrigatorio: true,
          dica: 'Quantos estudantes o supervisor acompanha ao mesmo tempo. Número inteiro positivo.',
        },
      ],
    },
  ],
  vazio: {
    nome: '',
    especialidadesIds: [],
    procedimentosIds: [],
    disponibilidade: [],
    limiteEstudantesSimultaneos: Number.NaN,
  },
  deRegistro: (s) => ({
    nome: s.nome,
    especialidadesIds: idsDe(s.especialidades),
    procedimentosIds: idsDe(s.procedimentos),
    disponibilidade: copiaDisponibilidade(s.disponibilidade),
    limiteEstudantesSimultaneos: s.limiteEstudantesSimultaneos,
  }),
  paraEntrada: (v) => v,
};

const salas: FormularioCadastro<Sala> = {
  schema: SalaSchema,
  secoes: [
    {
      legenda: 'Identificação',
      campos: [
        {
          nome: 'identificacao',
          rotulo: 'Identificação',
          tipo: 'texto',
          obrigatorio: true,
          dica: 'Aparece na chamada e na tela pública, por exemplo "Sala 03".',
        },
        { nome: 'caracteristicas', rotulo: 'Características', tipo: 'area', obrigatorio: false },
      ],
    },
    {
      legenda: 'Equipamentos e situação (RN-09)',
      campos: [
        {
          nome: 'recursosIds',
          rotulo: 'Equipamentos e recursos',
          tipo: 'multipla',
          obrigatorio: false,
          catalogo: 'recursos',
        },
        {
          nome: 'situacao',
          rotulo: 'Situação',
          tipo: 'selecao',
          obrigatorio: true,
          opcoes: SITUACOES_SALA.map((s) => ({ valor: s, rotulo: ROTULO_SITUACAO_SALA[s] })),
        },
      ],
    },
  ],
  vazio: { identificacao: '', caracteristicas: '', recursosIds: [], situacao: 'DISPONIVEL' },
  deRegistro: (s) => ({
    identificacao: s.identificacao,
    caracteristicas: s.caracteristicas,
    recursosIds: idsDe(s.recursos),
    situacao: (SITUACOES_SALA as readonly string[]).includes(s.situacao)
      ? s.situacao
      : 'DISPONIVEL',
  }),
  paraEntrada: (v) => v,
};

const especialidades: FormularioCadastro<Especialidade> = {
  schema: EspecialidadeSchema,
  secoes: [
    {
      legenda: 'Identificação',
      campos: [
        {
          nome: 'nome',
          rotulo: 'Nome',
          tipo: 'texto',
          obrigatorio: true,
          dica: 'Aparece também na tela pública da sala de espera.',
        },
        { nome: 'descricao', rotulo: 'Descrição', tipo: 'area', obrigatorio: false },
      ],
    },
    {
      legenda: 'Regras do atendimento',
      campos: [
        {
          nome: 'exigeSupervisaoDocente',
          rotulo: 'Exige supervisão docente? (RN-07)',
          tipo: 'simnao',
          obrigatorio: true,
        },
        {
          nome: 'exigeValidacaoEncerramento',
          rotulo: 'Exige validação do encerramento pelo supervisor? (RN-11)',
          tipo: 'simnao',
          obrigatorio: true,
        },
        {
          nome: 'toleranciaMinutos',
          rotulo: 'Tolerância de ausência, em minutos (RN-12)',
          tipo: 'inteiro',
          obrigatorio: false,
          dica: 'Em branco, vale a tolerância padrão da unidade.',
        },
        {
          nome: 'recursosExigidosIds',
          rotulo: 'Recursos que a sala precisa ter (RN-09)',
          tipo: 'multipla',
          obrigatorio: false,
          catalogo: 'recursos',
        },
      ],
    },
  ],
  vazio: {
    nome: '',
    descricao: '',
    exigeSupervisaoDocente: undefined,
    exigeValidacaoEncerramento: undefined,
    toleranciaMinutos: Number.NaN,
    recursosExigidosIds: [],
  },
  deRegistro: (e) => ({
    nome: e.nome,
    descricao: e.descricao,
    exigeSupervisaoDocente: e.exigeSupervisaoDocente,
    exigeValidacaoEncerramento: e.exigeValidacaoEncerramento,
    toleranciaMinutos: e.toleranciaMinutos ?? Number.NaN,
    recursosExigidosIds: idsDe(e.recursosExigidos),
  }),
  paraEntrada: (v) => v,
};

const FORMULARIOS = { pacientes, estudantes, supervisores, salas, especialidades } as const;

export function formularioCadastro(slug: SlugCadastro): FormularioCadastro<{ id: string }> {
  return FORMULARIOS[slug] as unknown as FormularioCadastro<{ id: string }>;
}

/** Campo obrigatório sem valor: mantém "Salvar" indisponível (T-04). */
export function vazio(valor: unknown) {
  if (valor === undefined || valor === null) return true;
  if (typeof valor === 'string') return valor.trim() === '';
  if (typeof valor === 'number') return Number.isNaN(valor);
  if (Array.isArray(valor)) return valor.length === 0;
  return false;
}

export function camposObrigatorios(formulario: FormularioCadastro<never>) {
  return formulario.secoes.flatMap((s) => s.campos.filter((c) => c.obrigatorio).map((c) => c.nome));
}

/** Rótulo de um par dia e turno, como "Segunda, manhã". */
export function rotuloDiaTurno(dia: string, turno: Turno) {
  return `${dia}, ${ROTULO_TURNO[turno].toLocaleLowerCase('pt-BR')}`;
}
