import { io } from 'socket.io-client';

import { CONFIG_PUBLICA } from './config';
import {
  ErroPublico,
  projetarChamada,
  projetarConsulta,
  projetarEstado,
  type EventosPainel,
  type FontePublica,
} from './publico';

export function criarFonteHttp(config = CONFIG_PUBLICA): FontePublica {
  async function ler(caminho: string, signal?: AbortSignal): Promise<unknown> {
    let resposta: Response;
    try {
      resposta = await fetch(`${config.apiUrl.replace(/\/$/, '')}${caminho}`, {
        signal,
        credentials: 'omit',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
    } catch {
      throw new ErroPublico(0);
    }
    if (!resposta.ok)
      throw new ErroPublico(
        resposta.status,
        Math.max(1, Number(resposta.headers.get('Retry-After')) || 30),
      );
    try {
      return (await resposta.json()) as unknown;
    } catch {
      throw new ErroPublico(502);
    }
  }
  return {
    async estado(signal) {
      if (!config.unidadeId) throw new ErroPublico(503);
      return projetarEstado(
        await ler(`/publico/painel/${encodeURIComponent(config.unidadeId)}`, signal),
      );
    },
    async consultar(numero, signal) {
      return projetarConsulta(await ler(`/publico/senhas/${encodeURIComponent(numero)}`, signal));
    },
    conectar(eventos: EventosPainel) {
      if (!config.unidadeId) {
        eventos.conexao(false);
        return () => {};
      }
      const socket = io(`${config.socketUrl.replace(/\/$/, '')}/painel`, {
        autoConnect: false,
        withCredentials: false,
        query: { unidadeId: config.unidadeId },
      });
      socket.on('connect', () => eventos.conexao(true));
      socket.on('disconnect', () => eventos.conexao(false));
      socket.on('connect_error', () => eventos.conexao(false));
      socket.on('chamada.exibir', (valor: unknown) => {
        try {
          eventos.chamada(projetarChamada(valor));
        } catch {
          eventos.conexao(false);
        }
      });
      socket.on('painel.estado', (valor: unknown) => {
        try {
          eventos.estado(projetarEstado(valor));
        } catch {
          eventos.conexao(false);
        }
      });
      socket.connect();
      return () => {
        socket.removeAllListeners();
        socket.disconnect();
      };
    },
  };
}
