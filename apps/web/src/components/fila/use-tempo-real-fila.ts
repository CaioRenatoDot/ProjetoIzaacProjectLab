'use client';

import { useQueryClient } from '@tanstack/react-query';

import { type SenhaResumo } from '@/lib/fila/tipos';
import { useCanalTempoReal } from '@/lib/tempo-real/use-canal';

/** Eventos do namespace `/filas` (`docs/04` §7). Todos mudam o quadro: invalidam o cache. */
export const EVENTOS_FILA = [
  'senha.criada',
  'senha.chamada',
  'senha.status_alterado',
  'senha.reclassificada',
  'fila.bloqueada',
  'fila.desbloqueada',
  'fila.metricas',
] as const;

/** Tempo real do painel de fila: entra na sala da especialidade e anuncia `senha.chamada`. */
export function useTempoRealFila(
  especialidadeId: string | undefined,
  aoChamar: (senha: SenhaResumo) => void,
) {
  const queryClient = useQueryClient();
  const invalidar = () => void queryClient.invalidateQueries({ queryKey: ['fila'] });

  return useCanalTempoReal({
    namespace: '/filas',
    ativo: Boolean(especialidadeId),
    query: especialidadeId ? { especialidadeId } : undefined,
    aoConectar: invalidar,
    eventos: {
      ...Object.fromEntries(EVENTOS_FILA.map((evento) => [evento, invalidar])),
      'senha.chamada': (corpo: { senha: SenhaResumo }) => {
        invalidar();
        aoChamar(corpo.senha);
      },
    },
  });
}
