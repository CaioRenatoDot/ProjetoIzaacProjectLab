import { Injectable } from '@nestjs/common';
import {
  type ExportarIndicadoresQuery,
  type IndicadoresQuery,
  type IndicadoresResumo,
  type VolumePorEspecialidade,
  type VolumeQuery,
} from '@filas/contracts';

import { linhaCsv } from '../auditoria/csv';
import { type UsuarioAutenticado } from '../auth/usuario-autenticado';
import { AuditoriaService } from '../common/auditoria/auditoria.service';
import { IndicadoresRepository, type LinhaIndicadores } from './indicadores.repository';

/** Abaixo disso, a média pode não ser representativa (T-16). Valor provisório. */
export const AMOSTRA_MINIMA = 10;

const COLUNAS = [
  'especialidade',
  'senhas',
  'tempoMedioEsperaMinutos',
  'tempoMedioAtendimentoMinutos',
  'pacientesAtendidos',
  'taxaAusencia',
  'ausencias',
  'desistencias',
];

/** Percentual de ausências sobre senhas chamadas, com uma casa decimal. */
export function taxaAusencia(linha: Pick<LinhaIndicadores, 'ausencias' | 'chamadas'>): number {
  return linha.chamadas ? Math.round((linha.ausencias / linha.chamadas) * 1000) / 10 : 0;
}

const VAZIA: LinhaIndicadores = {
  especialidade_id: null,
  especialidade: null,
  geral: true,
  senhas: 0,
  espera: null,
  duracao: null,
  atendidos: 0,
  chamadas: 0,
  ausencias: 0,
  desistencias: 0,
};

/** Indicadores agregados por especialidade e período (UC-18, RF-10); nada individual (RNF-02). */
@Injectable()
export class IndicadoresService {
  constructor(
    private readonly repositorio: IndicadoresRepository,
    private readonly auditoria: AuditoriaService,
  ) {}

  async resumo(query: IndicadoresQuery, unidadeId: string): Promise<IndicadoresResumo> {
    const linhas = await this.repositorio.agregar({ unidadeId, ...query });
    const total = linhas.find((linha) => linha.geral) ?? VAZIA;
    return {
      periodo: { de: query.de, ate: query.ate },
      tempoMedioEsperaMinutos: total.espera,
      tempoMedioAtendimentoMinutos: total.duracao,
      pacientesAtendidos: total.atendidos,
      taxaAusencia: taxaAusencia(total),
      desistencias: total.desistencias,
      atendimentosPorEspecialidade: linhas
        .filter((linha) => !linha.geral)
        .map((linha) => ({
          especialidadeId: linha.especialidade_id!,
          especialidade: linha.especialidade!,
          total: linha.atendidos,
        })),
      semDados: total.senhas === 0,
      amostraPequena: total.atendidos < AMOSTRA_MINIMA,
    };
  }

  async volume(query: VolumeQuery, unidadeId: string): Promise<VolumePorEspecialidade> {
    const linhas = (await this.repositorio.agregar({ unidadeId, ...query })).filter(
      (linha) => !linha.geral,
    );
    return {
      series: linhas.map((linha) => ({
        especialidadeId: linha.especialidade_id!,
        especialidade: linha.especialidade!,
        atendimentos: linha.atendidos,
        ausencias: linha.ausencias,
        desistencias: linha.desistencias,
      })),
      semDados: linhas.length === 0,
    };
  }

  /** CSV por especialidade com a linha de total; grava `EXPORTAR` com os filtros (T-18). */
  async exportar(
    query: ExportarIndicadoresQuery,
    autor: UsuarioAutenticado,
    contexto: { origemIp?: string; userAgent?: string; requestId?: string },
  ): Promise<string> {
    const linhas = await this.repositorio.agregar({ unidadeId: autor.unidadeId, ...query });
    const conteudo = [...linhas.filter((l) => !l.geral), ...linhas.filter((l) => l.geral)].map(
      (linha) =>
        linhaCsv([
          linha.geral ? 'Total' : linha.especialidade,
          linha.senhas,
          linha.espera,
          linha.duracao,
          linha.atendidos,
          taxaAusencia(linha),
          linha.ausencias,
          linha.desistencias,
        ]),
    );
    const filtros = Object.entries(query)
      .filter(([, valor]) => valor !== undefined)
      .map(([chave, valor]) => `${chave}=${String(valor)}`)
      .join(', ');
    await this.auditoria.registrar({
      usuarioId: autor.id,
      perfilNomeNoMomento: autor.perfilNome,
      operacao: 'EXPORTAR',
      modulo: 'indicadores',
      entidade: 'indicadores',
      justificativa: `Filtros: ${filtros}`,
      ...contexto,
    });
    return [linhaCsv(COLUNAS), ...conteudo].join('\n');
  }
}
