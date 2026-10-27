import { describe, expect, it } from 'vitest';
import type { ClienteHttp } from '@/lib/api/cliente-http';
import { consultarIndicadores, consultaIndicadores, validarFiltros } from './consulta';

const filtros = {
  de: '2026-09-01',
  ate: '2026-09-30',
  turno: 'MANHA',
  especialidadeId: '00000000-0000-4000-8000-000000000001',
};
describe('RF-10 / RNF-02: consulta agregada de indicadores', () => {
  it('encaminha filtros e remove campos individuais extras das respostas', async () => {
    const caminhos: string[] = [];
    const serie = {
      especialidadeId: filtros.especialidadeId,
      especialidade: 'Fisioterapia',
      atendimentos: 4,
      ausencias: 1,
      desistencias: 0,
      pacienteId: 'nao-deve-ser-propagado',
    };
    const cliente: ClienteHttp = {
      requisitar<T>(caminho: string) {
        caminhos.push(caminho);
        const payload = caminho.includes('/resumo')
          ? {
              periodo: { de: filtros.de, ate: filtros.ate },
              tempoMedioEsperaMinutos: null,
              tempoMedioAtendimentoMinutos: 14,
              pacientesAtendidos: 4,
              taxaAusencia: 20,
              desistencias: 0,
              atendimentosPorEspecialidade: [{ ...serie, total: 4 }],
              semDados: false,
              amostraPequena: true,
              nomePaciente: 'Dado fictício proibido',
            }
          : { series: [serie], semDados: false, nomePaciente: 'Dado fictício proibido' };
        return Promise.resolve(payload as T);
      },
    };
    const dados = await consultarIndicadores(cliente, filtros);
    expect(caminhos[0]).toContain('especialidadeId=' + filtros.especialidadeId);
    expect(caminhos[1]).not.toContain('especialidadeId=');
    expect(caminhos.every((c) => c.includes('turno=MANHA'))).toBe(true);
    expect(JSON.stringify(dados)).not.toMatch(/nomePaciente|pacienteId|Dado fictício proibido/);
    expect(dados.resumo.tempoMedioEsperaMinutos).toBeNull();
  });
  it('valida datas obrigatórias e período e mantém turno na exportação', () => {
    expect(validarFiltros({ ...filtros, de: '' }).success).toBe(false);
    expect(validarFiltros({ ...filtros, ate: '2026-08-31' }).success).toBe(false);
    expect(consultaIndicadores(filtros)).toContain('turno=MANHA');
  });
});
