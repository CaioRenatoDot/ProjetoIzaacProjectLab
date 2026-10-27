'use client';

import type { VolumePorEspecialidade } from '@filas/contracts';
import { Button } from '@filas/ui';
import { useId } from 'react';

const SERIES = [
  { campo: 'atendimentos', rotulo: 'Atendimentos', padrao: 'Sólido' },
  { campo: 'ausencias', rotulo: 'Ausências', padrao: 'Listrado' },
  { campo: 'desistencias', rotulo: 'Desistências', padrao: 'Pontilhado' },
] as const;

export function VolumeIndicadores({
  series,
  tabela,
  onTabela,
}: Pick<VolumePorEspecialidade, 'series'> & {
  tabela: boolean;
  onTabela: (tabela: boolean) => void;
}) {
  const id = useId();
  const maximo = Math.max(1, ...series.flatMap((s) => SERIES.map(({ campo }) => s[campo])));
  return (
    <section
      aria-labelledby={id + '-titulo'}
      className="rounded-lg border border-borda-suave bg-superficie p-4"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 id={id + '-titulo'} className="text-secao font-semibold">
          Volume por especialidade
        </h2>
        <div role="group" aria-label="Visualização do volume" className="flex gap-2">
          <Button variante="secundario" aria-pressed={!tabela} onClick={() => onTabela(false)}>
            Gráfico
          </Button>
          <Button variante="secundario" aria-pressed={tabela} onClick={() => onTabela(true)}>
            Tabela
          </Button>
        </div>
      </div>
      {!tabela && (
        <>
          <p className="mb-3 text-secundario text-texto-secundario">
            Atendimentos: sólido. Ausências: listrado. Desistências: pontilhado. Os mesmos valores
            estão na tabela equivalente.
          </p>
          <svg
            role="img"
            aria-labelledby={id + '-grafico'}
            viewBox={'0 0 800 ' + Math.max(130, series.length * 140)}
            className="w-full"
          >
            <title id={id + '-grafico'}>
              Volume de atendimentos, ausências e desistências por especialidade. Tabela equivalente
              disponível a seguir.
            </title>
            <defs>
              <pattern
                id={id + '-listras'}
                width="8"
                height="8"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)"
              >
                <rect width="8" height="8" fill="#e2e8f0" />
                <path d="M 0 0 L 0 8" stroke="#334155" strokeWidth="4" />
              </pattern>
              <pattern id={id + '-pontos'} width="8" height="8" patternUnits="userSpaceOnUse">
                <rect width="8" height="8" fill="#f1f5f9" />
                <circle cx="4" cy="4" r="2" fill="#0f172a" />
              </pattern>
            </defs>
            {series.map((serie, i) => (
              <g key={serie.especialidadeId} transform={'translate(0,' + i * 140 + ')'}>
                <text x="0" y="20" fill="#0f172a" fontSize="18" fontWeight="600">
                  {serie.especialidade}
                </text>
                {SERIES.map(({ campo, rotulo }, j) => (
                  <g key={campo}>
                    <text x="0" y={48 + j * 28} fill="#334155" fontSize="16">
                      {rotulo}
                    </text>
                    <rect
                      x="150"
                      y={32 + j * 28}
                      width={(serie[campo] / maximo) * 570}
                      height="20"
                      fill={
                        j === 0 ? '#0f172a' : 'url(#' + id + (j === 1 ? '-listras)' : '-pontos)')
                      }
                      stroke="#334155"
                    />
                    <text
                      x={160 + (serie[campo] / maximo) * 570}
                      y={48 + j * 28}
                      fill="#0f172a"
                      fontSize="16"
                    >
                      {serie[campo]}
                    </text>
                  </g>
                ))}
              </g>
            ))}
          </svg>
        </>
      )}
      <div className={tabela ? 'overflow-x-auto' : 'sr-only'}>
        <table className="w-full border-collapse">
          <caption className="pb-3 text-left text-texto-secundario">
            Volume por especialidade — tabela equivalente ao gráfico
          </caption>
          <thead>
            <tr className="border-b border-borda">
              <th scope="col" className="px-3 py-2 text-left">
                Especialidade
              </th>
              {SERIES.map(({ campo, rotulo }) => (
                <th key={campo} scope="col" className="px-3 py-2 text-right">
                  {rotulo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {series.map((serie) => (
              <tr key={serie.especialidadeId} className="border-b border-borda-suave">
                <th scope="row" className="px-3 py-3 text-left font-medium">
                  {serie.especialidade}
                </th>
                {SERIES.map(({ campo }) => (
                  <td key={campo} className="px-3 py-3 text-right tabular-nums">
                    {serie[campo]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
