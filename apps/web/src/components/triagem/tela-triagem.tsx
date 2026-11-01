'use client';

import { EstadoSemPermissao, usePermissoes } from '@filas/ui';
import { useState } from 'react';

import { EtapaBusca } from './etapa-busca';
import { EtapaFicha } from './etapa-ficha';
import { EtapaSenha } from './etapa-senha';
import { type PacienteBusca, type TriagemApi, type TriagemRegistrada } from '@/lib/triagem/tipos';

type Etapa =
  | { passo: 'busca' }
  | { passo: 'ficha'; paciente: PacienteBusca }
  | { passo: 'senha'; triagem: TriagemRegistrada };

/** W-06 e W-07: busca de paciente → ficha de triagem → emissão da senha (UC-05, UC-06). */
export function TelaTriagem({ api }: { api: TriagemApi }) {
  const { tem } = usePermissoes();
  const [etapa, setEtapa] = useState<Etapa>({ passo: 'busca' });

  if (!tem('triagem:criar')) return <EstadoSemPermissao />;

  if (etapa.passo === 'busca') {
    return (
      <EtapaBusca api={api} onSelecionar={(paciente) => setEtapa({ passo: 'ficha', paciente })} />
    );
  }
  if (etapa.passo === 'ficha') {
    return (
      <EtapaFicha
        api={api}
        paciente={etapa.paciente}
        onTrocarPaciente={() => setEtapa({ passo: 'busca' })}
        onConcluir={(triagem) => setEtapa({ passo: 'senha', triagem })}
      />
    );
  }
  return (
    <EtapaSenha
      api={api}
      triagem={etapa.triagem}
      onNovaTriagem={() => setEtapa({ passo: 'busca' })}
    />
  );
}
