import { describe, expect, it } from 'vitest';

import { SLUGS_CADASTRO } from './entidades';
import { camposObrigatorios, formularioCadastro, vazio } from './formularios';

const mensagens = (
  slug: Parameters<typeof formularioCadastro>[0],
  valores: Record<string, unknown>,
) => {
  const resultado = formularioCadastro(slug).schema.safeParse(valores);
  if (resultado.success) return {};
  return Object.fromEntries(resultado.error.issues.map((i) => [String(i.path[0]), i.message]));
};

const PACIENTE_VALIDO = {
  nomeCompleto: 'Paciente de Teste',
  documento: '123.456.789-00',
  dataNascimento: '1990-05-10',
  contatoTelefone: '',
  contatoEmail: '',
  vinculo: 'EXTERNO',
};

const SUPERVISOR_VALIDO = {
  nome: 'Prof. Teste',
  especialidadesIds: ['especialidade-1'],
  procedimentosIds: [],
  disponibilidade: [],
  limiteEstudantesSimultaneos: 3,
};

describe('formulário por entidade (T-04)', () => {
  it.each(SLUGS_CADASTRO)('%s vazio é recusado com mensagem em cada obrigatório', (slug) => {
    const formulario = formularioCadastro(slug);
    const erros = mensagens(slug, formulario.vazio);
    for (const nome of camposObrigatorios(formulario)) {
      if (slug === 'salas' && nome === 'situacao') continue; // já começa como "Disponível"
      expect(erros[nome], nome).toBeTruthy();
    }
  });

  it.each(SLUGS_CADASTRO)(
    '%s: todo campo obrigatório do formulário existe nos valores iniciais',
    (slug) => {
      const formulario = formularioCadastro(slug);
      for (const nome of camposObrigatorios(formulario))
        expect(formulario.vazio).toHaveProperty(nome);
    },
  );

  it('paciente válido passa, com telefone e e-mail opcionais', () => {
    expect(mensagens('pacientes', PACIENTE_VALIDO)).toEqual({});
  });

  it('paciente: telefone, e-mail, documento e data inválidos explicam o formato', () => {
    const erros = mensagens('pacientes', {
      ...PACIENTE_VALIDO,
      documento: 'abc',
      dataNascimento: '2999-01-01',
      contatoTelefone: '9999',
      contatoEmail: 'sem-arroba',
    });
    expect(erros.documento).toMatch(/números/);
    expect(erros.dataNascimento).toMatch(/futuro/);
    expect(erros.contatoTelefone).toMatch(/\(00\) 00000-0000/);
    expect(erros.contatoEmail).toMatch(/e-mail válido/);
  });

  it.each([
    [0, /inteiro positivo/],
    [-2, /inteiro positivo/],
    [1.5, /inteiro/],
    [Number.NaN, /Informe o limite/],
  ])('RN-08: limite de estudantes %s é recusado', (limite, mensagem) => {
    expect(
      mensagens('supervisores', { ...SUPERVISOR_VALIDO, limiteEstudantesSimultaneos: limite })
        .limiteEstudantesSimultaneos,
    ).toMatch(mensagem);
  });

  it('RN-08: limite inteiro positivo é aceito', () => {
    expect(mensagens('supervisores', SUPERVISOR_VALIDO)).toEqual({});
  });

  it('especialidade aceita tolerância em branco (vale a padrão da unidade)', () => {
    expect(
      mensagens('especialidades', {
        nome: 'Nova',
        descricao: '',
        exigeSupervisaoDocente: true,
        exigeValidacaoEncerramento: false,
        toleranciaMinutos: Number.NaN,
        recursosExigidosIds: [],
      }),
    ).toEqual({});
  });

  it('paraEntrada omite contato vazio do paciente', () => {
    expect(formularioCadastro('pacientes').paraEntrada(PACIENTE_VALIDO)).not.toHaveProperty(
      'contatoEmail',
      '',
    );
  });
});

describe('vazio', () => {
  it.each([[''], ['   '], [[]], [Number.NaN], [undefined], [null]])('%j é vazio', (valor) => {
    expect(vazio(valor)).toBe(true);
  });

  it.each([['a'], [['x']], [0], [false]])('%j não é vazio', (valor) => {
    expect(vazio(valor)).toBe(false);
  });
});

describe('situação da sala (Tabela 4, ID04)', () => {
  const sala = (situacao: string) => ({
    id: 'sala-6',
    identificacao: 'Sala 06',
    caracteristicas: 'Box odontológico',
    recursos: [],
    situacao,
    ocupada: false,
    ativo: true,
  });

  it('usa os valores do contrato e mostra o rótulo', () => {
    const campo = formularioCadastro('salas')
      .secoes.flatMap((secao) => secao.campos)
      .find((c) => c.nome === 'situacao');
    expect(campo?.opcoes).toEqual([
      { valor: 'DISPONIVEL', rotulo: 'Disponível' },
      { valor: 'EM_MANUTENCAO', rotulo: 'Em manutenção' },
      { valor: 'INDISPONIVEL', rotulo: 'Indisponível' },
    ]);
  });

  it('sala em manutenção abre como em manutenção, e o envio passa no schema', () => {
    const formulario = formularioCadastro('salas');
    const valores = formulario.deRegistro(sala('EM_MANUTENCAO'));
    expect(valores.situacao).toBe('EM_MANUTENCAO');
    expect(formulario.schema.safeParse(valores).success).toBe(true);
    expect(formulario.schema.safeParse({ ...valores, situacao: 'Em manutenção' }).success).toBe(
      false,
    );
  });
});
