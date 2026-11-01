import { type DiaSemana, type Turno } from '@prisma/client';

const FUSO = 'America/Sao_Paulo';

/** Hora inicial (inclusiva) e final (exclusiva) de cada turno provisório, no fuso da unidade. */
export const HORAS_DO_TURNO: Record<Turno, [number, number]> = {
  MANHA: [7, 12],
  TARDE: [12, 18],
  NOITE: [18, 22],
};
const DIAS: DiaSemana[] = ['DOMINGO', 'SEGUNDA', 'TERCA', 'QUARTA', 'QUINTA', 'SEXTA', 'SABADO'];

/**
 * Turnos provisórios no fuso da unidade (docs/03 §3.2): MANHA 07h00-11h59, TARDE 12h00-17h59,
 * NOITE 18h00-21h59. Fora deles, ninguém está no turno (RN-05, RN-07).
 */
export function turnoAtual(agora: Date): { diaSemana: DiaSemana; turno: Turno } | null {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: FUSO,
    weekday: 'short',
    hour: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(agora);
  const hora = Number(partes.find((parte) => parte.type === 'hour')!.value);
  const dia = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(
    partes.find((parte) => parte.type === 'weekday')!.value,
  );
  const turno: Turno | null =
    hora >= 7 && hora < 12
      ? 'MANHA'
      : hora >= 12 && hora < 18
        ? 'TARDE'
        : hora >= 18 && hora < 22
          ? 'NOITE'
          : null;
  return turno ? { diaSemana: DIAS[dia]!, turno } : null;
}
