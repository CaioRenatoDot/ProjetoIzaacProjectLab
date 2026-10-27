'use client';

import Link from 'next/link';
import { useState } from 'react';

import { SIMULACAO_PUBLICA } from '../../lib/config';
import { executarDemonstracao, type AcaoDemonstracao } from '../../mocks/publico';

const ACOES: [AcaoDemonstracao, string][] = [
  ['nova', 'Nova chamada'],
  ['rechamar', 'Rechamar'],
  ['desconectar', 'Simular queda'],
  ['reconectar', 'Reconectar'],
  ['limpar', 'Limpar chamadas'],
  ['reiniciar', 'Reiniciar demonstração'],
];

export default function Demonstracao() {
  const [aviso, setAviso] = useState('');
  if (!SIMULACAO_PUBLICA)
    return (
      <main className="consulta">
        <h1>Demonstração indisponível</h1>
        <p>Este ambiente usa os serviços reais.</p>
      </main>
    );
  return (
    <main className="consulta">
      <h1>Demonstração das telas públicas</h1>
      <p>Dados fictícios. Abra o telão ou a consulta em outra aba para acompanhar os eventos.</p>
      <p>
        <Link href="/telao" target="_blank">
          Abrir telão em outra aba
        </Link>
      </p>
      <p>
        <Link href="/consulta" target="_blank">
          Abrir consulta em outra aba
        </Link>
      </p>
      <div className="acoes-demo">
        {ACOES.map(([acao, rotulo]) => (
          <button
            key={acao}
            onClick={() => {
              executarDemonstracao(acao);
              setAviso(`${rotulo}: enviado.`);
            }}
          >
            {rotulo}
          </button>
        ))}
      </div>
      <p role="status">{aviso}</p>
      <h2>Senhas para consultar</h2>
      <ul>
        <li>F015: aguardando, posição e estimativa.</li>
        <li>F020: aguardando, sem estimativa.</li>
        <li>F021: ausente.</li>
        <li>F022: desistência.</li>
        <li>F014: chamada inicial.</li>
        <li>F999: mensagem neutra.</li>
      </ul>
    </main>
  );
}
