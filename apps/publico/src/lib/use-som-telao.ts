'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { configurarSom, SomTelao, type EstadoSom } from './som-telao';

export function useSomTelao() {
  const controle = useRef<SomTelao | null>(null);
  const [estado, setEstado] = useState<EstadoSom | 'desligado' | 'carregando'>('carregando');
  useEffect(() => {
    const config = configurarSom(new URLSearchParams(window.location.search), {
      ligado: process.env.NEXT_PUBLIC_TELAO_SOM_ATIVO,
      volume: process.env.NEXT_PUBLIC_TELAO_SOM_VOLUME,
      arquivo: process.env.NEXT_PUBLIC_TELAO_SOM_ARQUIVO,
    });
    if (!config.ligado || config.volume === 0) {
      setEstado('desligado');
      return;
    }
    const som = new SomTelao(config, setEstado);
    controle.current = som;
    setEstado('inativo');
    return () => {
      controle.current = null;
      som.encerrar();
    };
  }, []);
  const tocar = useCallback(() => controle.current?.chamada(), []);
  return {
    estado,
    tocar,
    ativar: () => controle.current?.ativar(),
    desativar: () => controle.current?.desativar(),
  };
}
