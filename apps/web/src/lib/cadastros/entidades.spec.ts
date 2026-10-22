import { describe, expect, it } from 'vitest';

import { ESTADO_INICIAL, montarConsulta, temFiltroAtivo } from './consulta';
import {
  ENTIDADES_CADASTRO,
  entidadeCadastro,
  ocupacaoSupervisor,
  situacaoPaciente,
  SLUGS_CADASTRO,
  textoNenhum,
  textoTotal,
} from './entidades';
import { type Paciente, type Supervisor } from './tipos';

/** Colunas da T-03 (especificação de UI), na ordem da tela. */
const COLUNAS_T03 = {
  pacientes: ['Nome', 'Contato', 'Vínculo', 'Situação'],
  estudantes: ['Nome', 'Especialidade', 'Nível de formação', 'Disponibilidade'],
  supervisores: ['Nome', 'Especialidades habilitadas', 'Turnos', 'Ocupação atual'],
  salas: ['Identificação', 'Características', 'Equipamentos', 'Situação'],
  especialidades: ['Nome', 'Exige supervisão', 'Filas vinculadas', 'Situação'],
};

/** Parâmetros de filtro aceitos por `GET /<entidade>` no `openapi.yaml`. */
const PARAMETROS_DO_CONTRATO = {
  pacientes: ['vinculo', 'comRestricao'],
  estudantes: ['especialidadeId', 'turno', 'disponivel'],
  supervisores: ['especialidadeId', 'turno'],
  salas: ['recursoId', 'disponivel'],
  especialidades: ['ativa', 'exigeSupervisao'],
};

const supervisor = (s: Partial<Supervisor>): Supervisor => ({
  id: 's',
  nome: 'Prof. Teste',
  especialidades: [],
  procedimentos: [],
  disponibilidade: [],
  limiteEstudantesSimultaneos: 3,
  ocupacaoAtual: 2,
  ativo: true,
  ...s,
});

const paciente = (p: Partial<Paciente>): Paciente => ({
  id: 'p',
  nomeCompleto: 'Paciente Teste',
  iniciais: 'P. T.',
  documento: '0',
  dataNascimento: '1990-01-01',
  contatoTelefone: null,
  contatoEmail: null,
  vinculo: 'EXTERNO',
  restricaoAtiva: false,
  restricaoAte: null,
  ativo: true,
  ...p,
});

describe('configuração por entidade (T-03)', () => {
  it('existem as cinco entidades, na ordem dos wireframes', () => {
    expect(SLUGS_CADASTRO).toEqual([
      'pacientes',
      'estudantes',
      'supervisores',
      'salas',
      'especialidades',
    ]);
  });

  it.each(SLUGS_CADASTRO)('%s tem as colunas da T-03', (slug) => {
    expect(ENTIDADES_CADASTRO[slug].colunas.map((c) => c.rotulo)).toEqual(COLUNAS_T03[slug]);
  });

  it.each(SLUGS_CADASTRO)('%s só filtra por parâmetros que o contrato aceita', (slug) => {
    for (const filtro of ENTIDADES_CADASTRO[slug].filtros) {
      expect(PARAMETROS_DO_CONTRATO[slug]).toContain(filtro.parametro);
    }
  });

  it.each(SLUGS_CADASTRO)('%s mantém a primeira coluna (o nome) como essencial', (slug) => {
    expect(ENTIDADES_CADASTRO[slug].colunas[0]?.essencial).toBe(true);
  });

  it('slug desconhecido não tem configuração', () => {
    expect(entidadeCadastro('usuarios')).toBeNull();
  });
});

describe('valores das colunas', () => {
  it('RN-08: ocupação do supervisor aparece como "2 de 3"', () => {
    expect(
      ocupacaoSupervisor(supervisor({ ocupacaoAtual: 2, limiteEstudantesSimultaneos: 3 })),
    ).toBe('2 de 3');
    expect(ocupacaoSupervisor(supervisor({ ativo: false }))).toBe('Inativo');
  });

  it('RN-13: paciente com restrição mostra a data de fim', () => {
    expect(situacaoPaciente(paciente({ restricaoAtiva: true, restricaoAte: '2026-12-15' }))).toBe(
      'Restrição até 15/12/2026',
    );
    expect(situacaoPaciente(paciente({}))).toBe('Ativo');
    expect(situacaoPaciente(paciente({ ativo: false, restricaoAtiva: true }))).toBe('Inativo');
  });

  it('mensagens concordam com o gênero da entidade', () => {
    expect(textoNenhum(ENTIDADES_CADASTRO.pacientes, 'encontrad')).toBe(
      'Nenhum paciente encontrado',
    );
    expect(textoNenhum(ENTIDADES_CADASTRO.salas, 'cadastrad')).toBe('Nenhuma sala cadastrada');
    expect(textoTotal(ENTIDADES_CADASTRO.salas, 1)).toBe('1 sala encontrada');
    expect(textoTotal(ENTIDADES_CADASTRO.pacientes, 15)).toBe('15 pacientes encontrados');
  });
});

describe('montarConsulta', () => {
  it('pagina com 20 por página e omite filtros vazios', () => {
    expect(montarConsulta(ESTADO_INICIAL)).toBe('?pagina=1&tamanho=20');
    expect(
      montarConsulta({
        ...ESTADO_INICIAL,
        busca: '  silva ',
        filtros: { vinculo: 'ALUNO', comRestricao: '' },
        pagina: 2,
        ordenar: 'nome',
        direcao: 'desc',
      }),
    ).toBe('?pagina=2&tamanho=20&busca=silva&vinculo=ALUNO&ordenar=nome&direcao=desc');
  });

  it('ordenação sozinha não conta como filtro ativo', () => {
    expect(temFiltroAtivo({ ...ESTADO_INICIAL, ordenar: 'nome' })).toBe(false);
    expect(temFiltroAtivo({ ...ESTADO_INICIAL, filtros: { vinculo: 'ALUNO' } })).toBe(true);
  });
});
