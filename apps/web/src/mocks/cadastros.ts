import { type VinculoPaciente } from '@filas/contracts';
import { http, HttpResponse } from 'msw';

import { API_URL } from '@/lib/api/config';
import { type SlugCadastro } from '@/lib/cadastros/entidades';
import {
  type Especialidade,
  type Estudante,
  type ItemReferencia,
  type Paciente,
  type Sala,
  type Supervisor,
  type Turno,
} from '@/lib/cadastros/tipos';

/**
 * Simulação dos cadastros base (listar, consultar, criar, editar, excluir e a inativação
 * proposta) e dos cadastros de apoio, até a API (#13, #14). Dados fictícios (RNF-07).
 * Registros em `COM_VINCULO_ATIVO` recusam exclusão com 409 VINCULO_ATIVO.
 */

const NOMES = ['Ana', 'Bruno', 'Carla', 'Diego', 'Elisa', 'Fábio', 'Gabriela', 'Heitor', 'Isabela'];
const SOBRENOMES = ['Alves', 'Barros', 'Cardoso', 'Duarte', 'Esteves'];
const VINCULOS: VinculoPaciente[] = ['EXTERNO', 'ALUNO', 'SERVIDOR'];

const ESPECIALIDADES_BASE: readonly [string, boolean, number][] = [
  ['Fisioterapia', true, 2],
  ['Fonoaudiologia', true, 1],
  ['Nutrição', false, 1],
  ['Psicologia', true, 1],
  ['Odontologia', true, 0],
];

const RECURSOS: ItemReferencia[] = [
  { id: 'recurso-maca', nome: 'Maca' },
  { id: 'recurso-espelho', nome: 'Espelho terapêutico' },
  { id: 'recurso-cadeira', nome: 'Cadeira odontológica' },
  { id: 'recurso-computador', nome: 'Computador' },
];

/** Cadastros de apoio: só identificador e nome (Documento de Requisitos §5, seção 1). */
const HABILITACOES: ItemReferencia[] = [
  { id: 'hab-0', nome: 'Avaliação' },
  { id: 'hab-1', nome: 'Reabilitação' },
  { id: 'hab-2', nome: 'Orientação' },
  { id: 'hab-3', nome: 'Triagem auditiva' },
  { id: 'hab-4', nome: 'Atendimento infantil' },
];

const PROCEDIMENTOS: ItemReferencia[] = [
  { id: 'proc-0', nome: 'Avaliação inicial' },
  { id: 'proc-1', nome: 'Sessão de reabilitação' },
  { id: 'proc-2', nome: 'Orientação nutricional' },
  { id: 'proc-3', nome: 'Audiometria' },
  { id: 'proc-4', nome: 'Profilaxia' },
];

const CATALOGOS = { habilitacoes: HABILITACOES, procedimentos: PROCEDIMENTOS, recursos: RECURSOS };

const iniciais = (nome: string) =>
  nome
    .split(' ')
    .map((p) => `${p[0]}.`)
    .join(' ');

function criarDados() {
  const especialidades: Especialidade[] = ESPECIALIDADES_BASE.map(
    ([nome, supervisao, filas], i) => ({
      id: `especialidade-${i + 1}`,
      nome,
      descricao: `Atendimento de ${nome.toLocaleLowerCase('pt-BR')}.`,
      exigeSupervisaoDocente: supervisao,
      exigeValidacaoEncerramento: supervisao,
      toleranciaMinutos: 5,
      recursosExigidos: i === 4 ? [RECURSOS[2]!] : [],
      filasVinculadas: filas,
      ativa: filas > 0,
    }),
  );
  const ref = (e: Especialidade) => ({ id: e.id, nome: e.nome });

  const pacientes: Paciente[] = Array.from({ length: 45 }, (_, i) => {
    const nomeCompleto = `${NOMES[i % NOMES.length]} ${SOBRENOMES[i % SOBRENOMES.length]} ${SOBRENOMES[(i + 2) % SOBRENOMES.length]}`;
    const restricao = i % 11 === 3;
    return {
      id: `paciente-${i + 1}`,
      nomeCompleto,
      iniciais: iniciais(nomeCompleto),
      documento: `000.000.${String(100 + i).padStart(3, '0')}-00`,
      dataNascimento: `19${70 + (i % 30)}-0${(i % 9) + 1}-1${i % 10}`,
      contatoTelefone: i % 4 === 0 ? null : `(00) 90000-${String(1000 + i)}`,
      contatoEmail: i % 3 === 0 ? `paciente${i + 1}@exemplo.test` : null,
      vinculo: VINCULOS[i % VINCULOS.length]!,
      restricaoAtiva: restricao,
      restricaoAte: restricao ? '2026-12-15' : null,
      ativo: i % 17 !== 5,
    };
  });

  const turnos: Turno[] = ['MANHA', 'TARDE', 'NOITE'];
  const estudantes: Estudante[] = Array.from({ length: 12 }, (_, i) => {
    const especialidade = especialidades[i % 4]!;
    return {
      id: `estudante-${i + 1}`,
      nome: `${NOMES[(i + 3) % NOMES.length]} ${SOBRENOMES[(i + 1) % SOBRENOMES.length]}`,
      especialidadeId: especialidade.id,
      especialidade: especialidade.nome,
      nivelFormacao: `${(i % 4) + 6}º período`,
      habilitacoes: [HABILITACOES[i % 3]!],
      procedimentosAutorizados: [PROCEDIMENTOS[i % PROCEDIMENTOS.length]!],
      disponibilidade: [{ diaSemana: (i % 5) + 1, turno: turnos[i % 3]! }],
      ocupado: i % 4 === 1,
      ativo: true,
    };
  });

  const supervisores: Supervisor[] = Array.from({ length: 6 }, (_, i) => ({
    id: `supervisor-${i + 1}`,
    nome: `Prof. ${NOMES[(i + 5) % NOMES.length]} ${SOBRENOMES[(i + 3) % SOBRENOMES.length]}`,
    especialidades: [ref(especialidades[i % 4]!), ...(i === 0 ? [ref(especialidades[2]!)] : [])],
    procedimentos: [],
    disponibilidade: [
      { diaSemana: 1, turno: turnos[i % 3]! },
      { diaSemana: 3, turno: turnos[(i + 1) % 3]! },
    ],
    limiteEstudantesSimultaneos: 3,
    ocupacaoAtual: i % 4,
    ativo: true,
  }));

  const salas: Sala[] = Array.from({ length: 8 }, (_, i) => ({
    id: `sala-${i + 1}`,
    identificacao: `Sala ${String(i + 1).padStart(2, '0')}`,
    caracteristicas: i % 2 === 0 ? 'Térreo, acessível' : '1º andar',
    recursos: [RECURSOS[i % RECURSOS.length]!],
    situacao: i === 5 ? 'Em manutenção' : 'Disponível',
    ocupada: i % 3 === 1,
    ativo: i !== 7,
  }));

  return { pacientes, estudantes, supervisores, salas, especialidades };
}

let dados = criarDados();

/** Registros com fila, alocação ou atendimento ativo: exclusão recusada (T-03). */
export const COM_VINCULO_ATIVO = new Set([
  'paciente-1',
  'estudante-2',
  'supervisor-1',
  'sala-1',
  'especialidade-1',
]);

let sequencia = 0;

export function reiniciarMockCadastros() {
  dados = criarDados();
  sequencia = 0;
}

type Registro = { id: string } & Record<string, unknown>;

interface RegrasEntidade {
  registros: () => Registro[];
  /** Campos comparados pela busca textual. */
  busca: readonly string[];
  /** Campo usado para cada valor de `ordenar`. */
  ordenar: Record<string, string>;
  filtrar: (registro: Registro, parametros: URLSearchParams) => boolean;
  campoAtivo: 'ativo' | 'ativa';
  rotulo: string;
  /** Monta o registro a partir da entrada (`PacienteEntrada` etc.), mantendo o que é do servidor. */
  montar: (entrada: Entrada, anterior: Registro | null, id: string) => Registro;
  /** Registro que torna a entrada duplicada (T-04: paciente, estudante e especialidade). */
  duplicata?: (entrada: Entrada, ignorarId: string | null) => Registro | undefined;
}

type Entrada = Record<string, unknown>;

const referencias = (valor: unknown, catalogo: readonly ItemReferencia[]) =>
  ((valor as string[] | undefined) ?? [])
    .map((id) => catalogo.find((c) => c.id === id))
    .filter((c): c is ItemReferencia => c !== undefined);

const especialidadesRef = () => dados.especialidades.map(({ id, nome }) => ({ id, nome }));

const mesmoTexto = (a: unknown, b: unknown) => normalizar(String(a)) === normalizar(String(b));
const digitos = (texto: unknown) => String(texto).replace(/\D/g, '');

function procurarDuplicata(
  registros: Registro[],
  ignorarId: string | null,
  igual: (registro: Registro) => boolean,
) {
  return registros.find((r) => r.id !== ignorarId && igual(r));
}

const bool = (parametros: URLSearchParams, nome: string) => {
  const valor = parametros.get(nome);
  return valor === null ? null : valor === 'true';
};

const turnoEm = (registro: Registro, turno: string | null) =>
  !turno || (registro.disponibilidade as { turno: string }[]).some((d) => d.turno === turno);

const REGRAS: Record<SlugCadastro, RegrasEntidade> = {
  pacientes: {
    registros: () => dados.pacientes as unknown as Registro[],
    busca: ['nomeCompleto', 'documento'],
    ordenar: { nome: 'nomeCompleto' },
    filtrar(p, q) {
      const vinculo = q.get('vinculo');
      const restricao = bool(q, 'comRestricao');
      return (
        (!vinculo || p.vinculo === vinculo) &&
        (restricao === null || p.restricaoAtiva === restricao)
      );
    },
    campoAtivo: 'ativo',
    rotulo: 'paciente',
    montar: (e, anterior, id) => ({
      restricaoAtiva: false,
      restricaoAte: null,
      ativo: true,
      ...anterior,
      id,
      nomeCompleto: e.nomeCompleto,
      iniciais: iniciais(String(e.nomeCompleto)),
      documento: e.documento,
      dataNascimento: e.dataNascimento,
      contatoTelefone: e.contatoTelefone ?? null,
      contatoEmail: e.contatoEmail ?? null,
      vinculo: e.vinculo,
    }),
    // Duplicidade por documento, ou por nome completo e data de nascimento (docs/03 §3.2).
    duplicata: (e, ignorarId) =>
      procurarDuplicata(
        dados.pacientes as unknown as Registro[],
        ignorarId,
        (p) =>
          digitos(p.documento) === digitos(e.documento) ||
          (mesmoTexto(p.nomeCompleto, e.nomeCompleto) && p.dataNascimento === e.dataNascimento),
      ),
  },
  estudantes: {
    registros: () => dados.estudantes as unknown as Registro[],
    busca: ['nome'],
    ordenar: { nome: 'nome' },
    filtrar(e, q) {
      const especialidade = q.get('especialidadeId');
      const disponivel = bool(q, 'disponivel');
      return (
        (!especialidade || e.especialidadeId === especialidade) &&
        turnoEm(e, q.get('turno')) &&
        (disponivel === null || (e.ativo === true && e.ocupado === false) === disponivel)
      );
    },
    campoAtivo: 'ativo',
    rotulo: 'estudante',
    montar: (e, anterior, id) => ({
      ocupado: false,
      ativo: true,
      ...anterior,
      id,
      nome: e.nome,
      especialidadeId: e.especialidadeId,
      especialidade: dados.especialidades.find((x) => x.id === e.especialidadeId)?.nome ?? '',
      nivelFormacao: e.nivelFormacao,
      habilitacoes: referencias(e.habilitacoesIds, HABILITACOES),
      procedimentosAutorizados: referencias(e.procedimentosIds, PROCEDIMENTOS),
      disponibilidade: e.disponibilidade ?? [],
    }),
    duplicata: (e, ignorarId) =>
      procurarDuplicata(dados.estudantes as unknown as Registro[], ignorarId, (x) =>
        mesmoTexto(x.nome, e.nome),
      ),
  },
  supervisores: {
    registros: () => dados.supervisores as unknown as Registro[],
    busca: ['nome'],
    ordenar: { nome: 'nome' },
    filtrar(s, q) {
      const especialidade = q.get('especialidadeId');
      return (
        (!especialidade ||
          (s.especialidades as ItemReferencia[]).some((e) => e.id === especialidade)) &&
        turnoEm(s, q.get('turno'))
      );
    },
    campoAtivo: 'ativo',
    rotulo: 'supervisor',
    montar: (e, anterior, id) => ({
      ocupacaoAtual: 0,
      ativo: true,
      ...anterior,
      id,
      nome: e.nome,
      especialidades: referencias(e.especialidadesIds, especialidadesRef()),
      procedimentos: referencias(e.procedimentosIds, PROCEDIMENTOS),
      disponibilidade: e.disponibilidade ?? [],
      limiteEstudantesSimultaneos: e.limiteEstudantesSimultaneos,
    }),
  },
  salas: {
    registros: () => dados.salas as unknown as Registro[],
    busca: ['identificacao'],
    ordenar: { identificacao: 'identificacao' },
    filtrar(s, q) {
      const disponivel = bool(q, 'disponivel');
      return disponivel === null || (s.ativo === true && s.ocupada === false) === disponivel;
    },
    campoAtivo: 'ativo',
    rotulo: 'sala',
    montar: (e, anterior, id) => ({
      ocupada: false,
      ativo: true,
      ...anterior,
      id,
      identificacao: e.identificacao,
      caracteristicas: e.caracteristicas ?? '',
      recursos: referencias(e.recursosIds, RECURSOS),
      situacao: e.situacao ?? 'Disponível',
    }),
  },
  especialidades: {
    registros: () => dados.especialidades as unknown as Registro[],
    busca: ['nome'],
    ordenar: { nome: 'nome' },
    filtrar(e, q) {
      const ativa = bool(q, 'ativa');
      const supervisao = bool(q, 'exigeSupervisao');
      return (
        (ativa === null || e.ativa === ativa) &&
        (supervisao === null || e.exigeSupervisaoDocente === supervisao)
      );
    },
    campoAtivo: 'ativa',
    rotulo: 'especialidade',
    montar: (e, anterior, id) => ({
      filasVinculadas: 0,
      ativa: true,
      ...anterior,
      id,
      nome: e.nome,
      descricao: e.descricao ?? '',
      exigeSupervisaoDocente: e.exigeSupervisaoDocente,
      exigeValidacaoEncerramento: e.exigeValidacaoEncerramento,
      toleranciaMinutos: e.toleranciaMinutos ?? 5,
      recursosExigidos: referencias(e.recursosExigidosIds, RECURSOS),
    }),
    duplicata: (e, ignorarId) =>
      procurarDuplicata(dados.especialidades as unknown as Registro[], ignorarId, (x) =>
        mesmoTexto(x.nome, e.nome),
      ),
  },
};

const normalizar = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('pt-BR');

function listar(regras: RegrasEntidade, url: URL) {
  const q = url.searchParams;
  const pagina = Math.max(1, Number(q.get('pagina') ?? 1));
  const tamanho = Math.min(100, Math.max(1, Number(q.get('tamanho') ?? 20)));
  const busca = normalizar(q.get('busca') ?? '');

  let lista = regras
    .registros()
    .filter((r) => !busca || regras.busca.some((c) => normalizar(String(r[c])).includes(busca)))
    .filter((r) => regras.filtrar(r, q));

  const campo = regras.ordenar[q.get('ordenar') ?? ''];
  if (campo) {
    const sinal = q.get('direcao') === 'desc' ? -1 : 1;
    lista = [...lista].sort(
      (a, b) => sinal * String(a[campo]).localeCompare(String(b[campo]), 'pt-BR'),
    );
  }

  const total = lista.length;
  return {
    dados: lista.slice((pagina - 1) * tamanho, pagina * tamanho),
    meta: { pagina, tamanho, total, totalPaginas: Math.max(1, Math.ceil(total / tamanho)) },
  };
}

const problema = (
  status: number,
  codigo: string,
  title: string,
  detail: string,
  extras: Record<string, unknown> = {},
) =>
  HttpResponse.json(
    { title, status, codigo, detail, ...extras },
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  );

/** 403 neutro também para registro inexistente (`docs/04` §3). */
const semPermissao = () =>
  problema(403, 'SEM_PERMISSAO', 'Sem permissão', 'Seu perfil não tem acesso a este conteúdo.');

function duplicidade(regras: RegrasEntidade, existente: Registro) {
  return problema(
    409,
    'DUPLICIDADE',
    'Registro já cadastrado',
    `Já existe um cadastro de ${regras.rotulo} com estes dados. Abra o cadastro existente em vez de criar outro.`,
    { recursoExistenteId: existente.id },
  );
}

export const handlersCadastros = (Object.keys(REGRAS) as SlugCadastro[]).flatMap((slug) => {
  const regras = REGRAS[slug];
  const base = `${API_URL}/${slug}`;
  return [
    http.get(base, ({ request }) => HttpResponse.json(listar(regras, new URL(request.url)))),

    http.get(`${base}/:id`, ({ params }) => {
      const registro = regras.registros().find((r) => r.id === String(params.id));
      return registro ? HttpResponse.json(registro) : semPermissao();
    }),

    http.post(base, async ({ request }) => {
      const entrada = (await request.json()) as Entrada;
      const existente = regras.duplicata?.(entrada, null);
      if (existente) return duplicidade(regras, existente);
      sequencia += 1;
      const novo = regras.montar(entrada, null, `${slug}-novo-${sequencia}`);
      regras.registros().unshift(novo);
      return HttpResponse.json(novo, { status: 201 });
    }),

    http.put(`${base}/:id`, async ({ params, request }) => {
      const id = String(params.id);
      const lista = regras.registros();
      const indice = lista.findIndex((r) => r.id === id);
      if (indice < 0) return semPermissao();
      const entrada = (await request.json()) as Entrada;
      const existente = regras.duplicata?.(entrada, id);
      if (existente) return duplicidade(regras, existente);
      lista[indice] = regras.montar(entrada, lista[indice]!, id);
      return HttpResponse.json(lista[indice]);
    }),

    http.delete(`${base}/:id`, ({ params }) => {
      const id = String(params.id);
      if (COM_VINCULO_ATIVO.has(id)) {
        return problema(
          409,
          'VINCULO_ATIVO',
          'Registro com vínculo ativo',
          `Este ${regras.rotulo} tem vínculo ativo com fila, alocação ou atendimento e não pode ser excluído. Você pode inativá-lo: ele deixa de aparecer para novas operações e o histórico é mantido.`,
        );
      }
      const lista = regras.registros();
      const indice = lista.findIndex((r) => r.id === id);
      if (indice >= 0) lista.splice(indice, 1);
      return new HttpResponse(null, { status: 204 });
    }),

    // Proposta: o contrato ainda não tem como inativar (docs/07-pendencias-integracao.md).
    http.patch(`${base}/:id`, async ({ params, request }) => {
      const corpo = (await request.json()) as Record<string, unknown>;
      const registro = regras.registros().find((r) => r.id === String(params.id));
      if (!registro) return semPermissao();
      if (typeof corpo[regras.campoAtivo] === 'boolean') {
        registro[regras.campoAtivo] = corpo[regras.campoAtivo];
      }
      return HttpResponse.json(registro);
    }),
  ];
});

/** Proposta: o contrato não lista os cadastros de apoio (`docs/07-pendencias-integracao.md`). */
export const handlersCatalogos = (Object.keys(CATALOGOS) as (keyof typeof CATALOGOS)[]).map(
  (nome) =>
    http.get(`${API_URL}/${nome}`, () => {
      const itens = CATALOGOS[nome];
      return HttpResponse.json({
        dados: itens,
        meta: { pagina: 1, tamanho: 100, total: itens.length, totalPaginas: 1 },
      });
    }),
);
