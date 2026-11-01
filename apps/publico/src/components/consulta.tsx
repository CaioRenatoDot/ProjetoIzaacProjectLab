'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';

import {
  ErroPublico,
  orientacaoConsulta,
  ROTULOS_STATUS,
  type ConsultaPublica,
  type FontePublica,
} from '../lib/publico';

export function Consulta({ fonte, unidade }: { fonte: FontePublica; unidade: string }) {
  const [numero, setNumero] = useState('');
  const [consultada, setConsultada] = useState('');
  const [tentativa, setTentativa] = useState(0);
  const [resultado, setResultado] = useState<ConsultaPublica | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [erroCampo, setErroCampo] = useState('');
  const [atualizado, setAtualizado] = useState<Date | null>(null);
  const campo = useRef<HTMLInputElement>(null);
  const bloqueioAte = useRef(0);

  useEffect(() => {
    if (!consultada) return;
    let ativo = true;
    let emVoo = false;
    const controlador = new AbortController();
    async function atualizar() {
      if (emVoo || Date.now() < bloqueioAte.current) return;
      emVoo = true;
      setCarregando(true);
      try {
        const proximo = await fonte.consultar(consultada, controlador.signal);
        if (ativo) {
          setResultado(proximo);
          setErro('');
          setAtualizado(new Date());
        }
      } catch (e) {
        if (!ativo) return;
        const falha = e instanceof ErroPublico ? e : new ErroPublico(0);
        if (falha.status === 404) setResultado(null);
        if (falha.status === 429) bloqueioAte.current = Date.now() + falha.esperaSegundos * 1000;
        setErro(falha.message);
      } finally {
        emVoo = false;
        if (ativo) setCarregando(false);
      }
    }
    void atualizar();
    const polling = window.setInterval(() => {
      if (document.visibilityState !== 'hidden') void atualizar();
    }, 30_000);
    return () => {
      ativo = false;
      controlador.abort();
      window.clearInterval(polling);
    };
  }, [consultada, fonte, tentativa]);

  function consultar(evento: FormEvent) {
    evento.preventDefault();
    const valor = numero.trim().toUpperCase();
    if (!valor) {
      setErroCampo('Informe o número da senha.');
      campo.current?.focus();
      return;
    }
    if (Date.now() < bloqueioAte.current) {
      setErro(new ErroPublico(429).message);
      return;
    }
    setErroCampo('');
    setResultado(null);
    setErro('');
    setAtualizado(null);
    setConsultada(valor);
    setTentativa((t) => t + 1);
  }

  const aguardando = resultado?.status === 'AGUARDANDO';
  return (
    <main className="consulta" aria-labelledby="titulo-consulta">
      <header className="consulta-cabecalho">
        <p className="sobretitulo">{unidade}</p>
        <h1 id="titulo-consulta">Consultar minha senha</h1>
        <p>Acompanhe seu atendimento pelo número da senha.</p>
      </header>
      <form className="formulario-consulta" onSubmit={consultar} noValidate>
        <label htmlFor="numero-senha">Número da senha</label>
        <p id="ajuda-senha">Exemplo: F015. Não informe seu nome ou documento.</p>
        <input
          ref={campo}
          id="numero-senha"
          value={numero}
          onChange={(e) => setNumero(e.target.value)}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          required
          aria-invalid={!!erroCampo}
          aria-describedby={erroCampo ? 'ajuda-senha erro-numero' : 'ajuda-senha'}
        />
        {erroCampo && (
          <p id="erro-numero" role="alert">
            {erroCampo}
          </p>
        )}
        <button type="submit" disabled={carregando}>
          Consultar
        </button>
      </form>
      {carregando && <p role="status">Atualizando sua senha…</p>}
      {erro && (
        <div className="aviso-consulta" role="alert">
          <p>{erro}</p>
          {resultado && <p>As informações abaixo são da última atualização disponível.</p>}
          <button onClick={() => setTentativa((t) => t + 1)} disabled={carregando}>
            Tentar novamente
          </button>
        </div>
      )}
      <div aria-live="polite" aria-atomic="true">
        {resultado && (
          <section className="resultado-consulta" aria-labelledby="titulo-resultado">
            <div className="resultado-topo">
              <p>Sua senha</p>
              <h2 id="titulo-resultado">{resultado.numero}</h2>
              <p>{resultado.especialidade}</p>
              <p className="status-senha">{ROTULOS_STATUS[resultado.status]}</p>
            </div>
            {aguardando && (
              <dl className="metricas-consulta">
                {resultado.posicao !== null && (
                  <div>
                    <dt>Sua posição</dt>
                    <dd>{resultado.posicao}ª</dd>
                  </div>
                )}
                {resultado.tempoEstimadoMinutos !== null && (
                  <div>
                    <dt>Tempo estimado</dt>
                    <dd>~{resultado.tempoEstimadoMinutos} min</dd>
                  </div>
                )}
              </dl>
            )}
            {aguardando && resultado.tempoEstimadoMinutos === null && (
              <p>Estimativa indisponível no momento. Acompanhe sua posição.</p>
            )}
            <p className="orientacao-consulta">{orientacaoConsulta(resultado)}</p>
          </section>
        )}
      </div>
      {consultada && (
        <button
          className="botao-secundario"
          onClick={() => setTentativa((t) => t + 1)}
          disabled={carregando}
        >
          Atualizar
        </button>
      )}
      <footer className="consulta-rodape">
        {atualizado && <p>Última atualização: {atualizado.toLocaleTimeString('pt-BR')}</p>}
        <p>A atualização é automática a cada 30 segundos.</p>
      </footer>
    </main>
  );
}
