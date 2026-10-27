import { IndicadoresResumo, VolumePorEspecialidade, IndicadoresQuery } from '@filas/contracts';
import type { ClienteHttp } from '@/lib/api/cliente-http';

export interface FiltrosIndicadores {
  de: string;
  ate: string;
  especialidadeId: string;
  turno: string;
}
export function filtrosIniciais(): FiltrosIndicadores {
  const hoje = new Date();
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const base = String(hoje.getFullYear()) + '-' + mes + '-';
  return {
    de: base + '01',
    ate: base + String(hoje.getDate()).padStart(2, '0'),
    especialidadeId: '',
    turno: '',
  };
}
export function validarFiltros(f: FiltrosIndicadores) {
  return IndicadoresQuery.safeParse({
    de: f.de,
    ate: f.ate,
    especialidadeId: f.especialidadeId || undefined,
    turno: f.turno || undefined,
  });
}
export function consultaIndicadores(f: FiltrosIndicadores, volume = false) {
  const q = new URLSearchParams({ de: f.de, ate: f.ate });
  if (f.turno) q.set('turno', f.turno);
  if (f.especialidadeId && !volume) q.set('especialidadeId', f.especialidadeId);
  return '?' + q.toString();
}
export async function consultarIndicadores(cliente: ClienteHttp, filtros: FiltrosIndicadores) {
  const [resumo, volume] = await Promise.all([
    cliente.requisitar<unknown>('/indicadores/resumo' + consultaIndicadores(filtros)),
    cliente.requisitar<unknown>(
      '/indicadores/volume-por-especialidade' + consultaIndicadores(filtros, true),
    ),
  ]);
  return { resumo: IndicadoresResumo.parse(resumo), volume: VolumePorEspecialidade.parse(volume) };
}
