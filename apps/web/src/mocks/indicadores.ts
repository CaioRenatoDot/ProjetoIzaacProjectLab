import { type IndicadoresResumo, type VolumePorEspecialidade } from '@filas/contracts';
import { http, HttpResponse } from 'msw';
import { API_URL } from '@/lib/api/config';
import { usuarioMockDaRequisicao } from './handlers';

const BASE = [
  {
    especialidadeId: '00000000-0000-4000-8000-000000000001',
    especialidade: 'Fisioterapia',
    atendimentos: 68,
    ausencias: 6,
    desistencias: 4,
  },
  {
    especialidadeId: '00000000-0000-4000-8000-000000000002',
    especialidade: 'Nutrição',
    atendimentos: 44,
    ausencias: 3,
    desistencias: 2,
  },
  {
    especialidadeId: '00000000-0000-4000-8000-000000000003',
    especialidade: 'Psicologia',
    atendimentos: 30,
    ausencias: 2,
    desistencias: 5,
  },
];
function seriesPara(url: URL) {
  const de = url.searchParams.get('de') ?? '';
  if (de < '2020-01-01') return [];
  return BASE.map((s) =>
    url.searchParams.get('turno') === 'NOITE'
      ? { ...s, atendimentos: 2, ausencias: 0, desistencias: 0 }
      : s,
  );
}
function resumoPara(url: URL): IndicadoresResumo {
  const id = url.searchParams.get('especialidadeId');
  const series = seriesPara(url).filter((s) => !id || s.especialidadeId === id);
  return {
    periodo: { de: url.searchParams.get('de') ?? '', ate: url.searchParams.get('ate') ?? '' },
    tempoMedioEsperaMinutos: series.length ? 21 : null,
    tempoMedioAtendimentoMinutos: series.length ? 14 : null,
    pacientesAtendidos: series.reduce((n, s) => n + s.atendimentos, 0),
    taxaAusencia: series.length ? 8 : 0,
    desistencias: series.reduce((n, s) => n + s.desistencias, 0),
    atendimentosPorEspecialidade: series.map((s) => ({ ...s, total: s.atendimentos })),
    semDados: !series.length,
    amostraPequena: url.searchParams.get('turno') === 'NOITE',
  };
}
export const handlersIndicadores = ['resumo', 'volume-por-especialidade', 'exportacao'].map(
  (rota) =>
    http.get(API_URL + '/indicadores/' + rota, ({ request, cookies }) => {
      const permissao = rota === 'exportacao' ? 'indicadores:exportar' : 'indicadores:consultar';
      const usuario = usuarioMockDaRequisicao(request, cookies);
      if (!usuario) return HttpResponse.json({ codigo: 'NAO_AUTENTICADO' }, { status: 401 });
      if (!usuario.permissoes.includes(permissao))
        return HttpResponse.json(
          { status: 403, codigo: 'SEM_PERMISSAO', detail: 'Acesso não permitido.' },
          { status: 403 },
        );
      const url = new URL(request.url);
      if (rota === 'resumo') return HttpResponse.json(resumoPara(url));
      if (rota === 'volume-por-especialidade') {
        const series = seriesPara(url);
        return HttpResponse.json({
          series,
          semDados: !series.length,
        } satisfies VolumePorEspecialidade);
      }
      const resumo = resumoPara(url);
      const linhas = [
        [
          'especialidade',
          'tempoMedioEsperaMinutos',
          'tempoMedioAtendimentoMinutos',
          'pacientesAtendidos',
          'taxaAusencia',
          'desistencias',
        ],
        ...resumo.atendimentosPorEspecialidade.map((s) => [
          s.especialidade,
          resumo.tempoMedioEsperaMinutos,
          resumo.tempoMedioAtendimentoMinutos,
          s.total,
          resumo.taxaAusencia,
          seriesPara(url).find((serie) => serie.especialidadeId === s.especialidadeId)
            ?.desistencias ?? 0,
        ]),
        [
          'Total',
          resumo.tempoMedioEsperaMinutos,
          resumo.tempoMedioAtendimentoMinutos,
          resumo.pacientesAtendidos,
          resumo.taxaAusencia,
          resumo.desistencias,
        ],
      ];
      return new HttpResponse(linhas.map((l) => l.join(',')).join('\n'), {
        headers: { 'Content-Type': 'text/csv; charset=utf-8' },
      });
    }),
);
