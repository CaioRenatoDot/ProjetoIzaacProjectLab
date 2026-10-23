import { describe, expect, it } from 'vitest';

import {
  ESTADO_INICIAL,
  FILTROS_VAZIOS,
  lerEstadoSalvo,
  montarConsulta,
  montarConsultaExportacao,
  nomeArquivoExportacao,
  rotuloModulo,
  salvarEstado,
  temFiltroAtivo,
  validarFiltros,
} from './consulta';

const REGISTRO = '6f1c2a4e-8b3d-4c5a-9e7f-0a1b2c3d4e5f';

describe('montarConsulta', () => {
  it('sem filtro, pede só a página com 20 itens', () => {
    expect(montarConsulta(ESTADO_INICIAL)).toBe('?pagina=1&tamanho=20');
  });

  it('envia os filtros do contrato e o período do início ao fim do dia', () => {
    const consulta = new URLSearchParams(
      montarConsulta({
        pagina: 2,
        filtros: {
          usuarioId: 'usuario-1',
          de: '2026-10-01',
          ate: '2026-10-21',
          operacao: 'CONSULTAR_SENSIVEL',
          modulo: 'triagem',
          entidadeId: ` ${REGISTRO} `,
        },
      }).slice(1),
    );
    expect(Object.fromEntries(consulta)).toEqual({
      usuarioId: 'usuario-1',
      modulo: 'triagem',
      operacao: 'CONSULTAR_SENSIVEL',
      entidadeId: REGISTRO,
      de: new Date('2026-10-01T00:00:00').toISOString(),
      ate: new Date('2026-10-21T23:59:59.999').toISOString(),
      pagina: '2',
      tamanho: '20',
    });
  });

  it('a exportação leva os mesmos filtros, sem paginação', () => {
    const filtros = { ...FILTROS_VAZIOS, operacao: 'EXPORTAR' as const };
    expect(montarConsultaExportacao(filtros)).toBe('?operacao=EXPORTAR');
    expect(montarConsultaExportacao(FILTROS_VAZIOS)).toBe('');
  });
});

describe('validarFiltros', () => {
  it('aceita filtros vazios e período de um dia só', () => {
    expect(validarFiltros(FILTROS_VAZIOS)).toEqual({});
    expect(validarFiltros({ ...FILTROS_VAZIOS, de: '2026-10-21', ate: '2026-10-21' })).toEqual({});
  });

  it('recusa data final anterior à inicial, com a mensagem no campo "até"', () => {
    expect(validarFiltros({ ...FILTROS_VAZIOS, de: '2026-10-21', ate: '2026-10-01' })).toEqual({
      ate: 'A data final precisa ser igual ou posterior à data inicial.',
    });
  });

  it('recusa registro que não é um identificador completo', () => {
    expect(validarFiltros({ ...FILTROS_VAZIOS, entidadeId: 'F014' }).entidadeId).toMatch(
      /identificador completo/,
    );
    expect(validarFiltros({ ...FILTROS_VAZIOS, entidadeId: REGISTRO })).toEqual({});
  });
});

describe('apoio', () => {
  it('temFiltroAtivo ignora espaços', () => {
    expect(temFiltroAtivo(FILTROS_VAZIOS)).toBe(false);
    expect(temFiltroAtivo({ ...FILTROS_VAZIOS, entidadeId: '  ' })).toBe(false);
    expect(temFiltroAtivo({ ...FILTROS_VAZIOS, modulo: 'fila' })).toBe(true);
  });

  it('módulo desconhecido aparece como veio da API', () => {
    expect(rotuloModulo('ausencia')).toBe('Ausências');
    expect(rotuloModulo('modulo-novo')).toBe('modulo-novo');
  });

  it('nome do arquivo exportado leva a data local', () => {
    expect(nomeArquivoExportacao(new Date(2026, 9, 2, 23, 0))).toBe(
      'trilha-auditoria-2026-10-02.csv',
    );
  });

  it('filtros salvos voltam na mesma sessão', () => {
    salvarEstado({ pagina: 3, filtros: { ...FILTROS_VAZIOS, modulo: 'fila' } });
    expect(lerEstadoSalvo()).toEqual({
      pagina: 3,
      filtros: { ...FILTROS_VAZIOS, modulo: 'fila' },
    });
  });
});
