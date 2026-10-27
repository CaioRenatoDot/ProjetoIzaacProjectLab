'use client';

import { useEffect, useRef, useState } from 'react';

import { aplicarChamada, type EstadoPainel, type FontePublica } from '../lib/publico';

const VAZIO: EstadoPainel = { atual: null, anteriores: [] };

export function Telao({ fonte, unidade }: { fonte: FontePublica; unidade: string }) {
  const [estado, setEstado] = useState<EstadoPainel | null>(null);
  const [conectado, setConectado] = useState(false);
  const [erro, setErro] = useState(false);
  const [anuncio, setAnuncio] = useState('');
  const [destaque, setDestaque] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const [agora, setAgora] = useState<Date | null>(null);
  const estadoAtual = useRef<EstadoPainel>(VAZIO);

  useEffect(() => {
    const timer = window.setInterval(() => setAgora(new Date()), 1000);
    setAgora(new Date());
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let ativo = true;
    let revisao = 0;
    let emVoo = false;
    let brilho: ReturnType<typeof setTimeout> | undefined;
    const controlador = new AbortController();
    async function atualizar() {
      if (emVoo) return;
      emVoo = true;
      const iniciada = revisao;
      try {
        const proximo = await fonte.estado(controlador.signal);
        if (ativo && revisao === iniciada) {
          const anterior = estadoAtual.current.atual;
          if (
            proximo.atual &&
            proximo.atual.sequencia === 0 &&
            anterior &&
            proximo.atual.numero === anterior.numero &&
            proximo.atual.local === anterior.local &&
            proximo.atual.especialidade === anterior.especialidade
          ) {
            proximo.atual.sequencia = anterior.sequencia;
          }
          estadoAtual.current = proximo;
          setEstado(proximo);
          setErro(false);
        }
      } catch {
        if (ativo) setErro(true);
      } finally {
        emVoo = false;
      }
    }
    const cancelar = fonte.conectar({
      chamada(chamada) {
        const proximo = aplicarChamada(estadoAtual.current, chamada);
        if (!ativo || proximo === estadoAtual.current) return;
        revisao += 1;
        estadoAtual.current = proximo;
        setEstado(proximo);
        setErro(false);
        setAnuncio(
          `Senha ${chamada.numero}. ${chamada.especialidade}. ${chamada.local}. Chamada ${chamada.sequencia}.`,
        );
        setDestaque(true);
        clearTimeout(brilho);
        brilho = setTimeout(() => {
          if (ativo) setDestaque(false);
        }, 4000);
      },
      estado(proximo) {
        if (!ativo) return;
        revisao += 1;
        estadoAtual.current = proximo;
        setEstado(proximo);
        setErro(false);
      },
      conexao(online) {
        if (!ativo) return;
        setConectado(online);
        if (online) void atualizar();
      },
    });
    void atualizar();
    const polling = window.setInterval(() => {
      void atualizar();
    }, 30_000);
    return () => {
      ativo = false;
      controlador.abort();
      cancelar();
      clearTimeout(brilho);
      window.clearInterval(polling);
    };
  }, [fonte, tentativa]);

  return (
    <main className="telao" aria-labelledby="titulo-telao">
      <header className="telao-cabecalho">
        <div>
          <p className="sobretitulo">Clínica-Escola</p>
          <h1 id="titulo-telao">Sala de espera</h1>
        </div>
        <p className="telao-boas-vindas">Aguarde sua senha ser chamada</p>
      </header>
      <span className="somente-leitor" aria-live="assertive" aria-atomic="true">
        {anuncio}
      </span>
      <div className="telao-corpo">
        <section className="chamada-atual" aria-label="Chamada atual" data-destaque={destaque}>
          {!estado && !erro ? (
            <p role="status">Carregando chamadas…</p>
          ) : !estado && erro ? (
            <div className="estado-publico" role="alert">
              <h2>Não foi possível carregar as chamadas</h2>
              <p>Verifique a conexão e tente novamente.</p>
              <button onClick={() => setTentativa((t) => t + 1)}>Tentar novamente</button>
            </div>
          ) : estado?.atual ? (
            <>
              <p className="chamada-legenda">Chamando</p>
              <h2 className="numero-atual">{estado.atual.numero}</h2>
              <p className="especialidade-atual">{estado.atual.especialidade}</p>
              <p className="local-atual">{estado.atual.local}</p>
            </>
          ) : (
            <div className="estado-publico">
              <h2>Aguardando próximas chamadas</h2>
              <p>Acompanhe este painel.</p>
            </div>
          )}
        </section>
        <section className="chamadas-anteriores" aria-labelledby="titulo-anteriores">
          <h2 id="titulo-anteriores">Chamadas anteriores</h2>
          {estado?.anteriores.length ? (
            <ol>
              {estado.anteriores.map((item) => (
                <li key={`${item.numero}-${item.especialidade}`}>
                  <strong>{item.numero}</strong>
                  <span>{item.especialidade}</span>
                  <span>{item.local}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p>Nenhuma chamada anterior.</p>
          )}
        </section>
      </div>
      <footer className="telao-rodape">
        <div>
          <p className="unidade">{unidade}</p>
          <p className="conexao-publica" role="status">
            {!conectado
              ? 'Conexão interrompida. A última chamada permanece visível.'
              : erro
                ? 'Atualização indisponível. A última chamada permanece visível.'
                : 'Acompanhe sua senha neste painel.'}
          </p>
        </div>
        <time className="relogio" dateTime={agora?.toISOString()} aria-label="Horário atual">
          {agora
            ? agora.toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })
            : '--:--:--'}
        </time>
      </footer>
    </main>
  );
}
