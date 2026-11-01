'use client';

import { useEffect, useState } from 'react';

import { SIMULACAO_PUBLICA } from './config';
import { criarFonteHttp } from './fonte-http';
import { type FontePublica } from './publico';

export function useFontePublica() {
  const [fonte, setFonte] = useState<FontePublica | null>(null);
  const [erro, setErro] = useState(false);
  useEffect(() => {
    let cancelado = false;
    if (SIMULACAO_PUBLICA) {
      void import('../mocks/publico')
        .then((mock) => {
          if (!cancelado) setFonte(mock.criarFonteSimulada());
        })
        .catch(() => {
          if (!cancelado) setErro(true);
        });
    } else setFonte(criarFonteHttp());
    return () => {
      cancelado = true;
    };
  }, []);
  return { fonte, erro };
}
