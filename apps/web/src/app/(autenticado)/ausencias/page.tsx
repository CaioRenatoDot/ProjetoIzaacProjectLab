'use client';

import { useEffect, useState } from 'react';

import { TelaAusencias, type SimulacaoAusencias } from '@/components/ausencias/tela-ausencias';
import { USAR_MOCK } from '@/lib/api/config';
import { useSessao } from '@/lib/sessao/sessao';

export default function PaginaAusencias() {
  const { cliente } = useSessao();
  const [simulacao, setSimulacao] = useState<SimulacaoAusencias>();

  useEffect(() => {
    if (!USAR_MOCK) return;
    let cancelado = false;
    void import('@/mocks/ausencias').then((mock) => {
      if (!cancelado)
        setSimulacao({
          reiniciar: mock.reiniciarMockAusencias,
          assinar: mock.assinarAusenciasAutomaticas,
        });
    });
    return () => {
      cancelado = true;
    };
  }, []);

  return <TelaAusencias cliente={cliente} simulacao={simulacao} />;
}
