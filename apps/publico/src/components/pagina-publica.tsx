'use client';

import { CONFIG_PUBLICA } from '../lib/config';
import { useFontePublica } from '../lib/use-fonte-publica';
import { Consulta } from './consulta';
import { Telao } from './telao';

export function PaginaPublica({ tela }: { tela: 'telao' | 'consulta' }) {
  const { fonte, erro } = useFontePublica();
  if (erro)
    return (
      <main className="consulta" role="alert">
        <h1>Não foi possível preparar a tela</h1>
        <p>Atualize a página para tentar novamente.</p>
      </main>
    );
  if (!fonte)
    return (
      <main className="consulta">
        <p role="status">Preparando a tela…</p>
      </main>
    );
  return tela === 'telao' ? (
    <Telao fonte={fonte} unidade={CONFIG_PUBLICA.unidadeNome} />
  ) : (
    <Consulta fonte={fonte} unidade={CONFIG_PUBLICA.unidadeNome} />
  );
}
