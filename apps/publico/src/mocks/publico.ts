import {
  aplicarChamada,
  ErroPublico,
  projetarChamada,
  projetarConsulta,
  projetarEstado,
  type ConsultaPublica,
  type EstadoPainel,
  type FontePublica,
} from '../lib/publico';

const CHAVE = 'publico-demonstracao-42';
const CANAL = 'publico-demonstracao-42-evento';
export type AcaoDemonstracao =
  'nova' | 'rechamar' | 'desconectar' | 'reconectar' | 'limpar' | 'reiniciar';

interface DadosDemo {
  painel: EstadoPainel;
  conectado: boolean;
}

function chamada(numero: string, local = 'Sala 03', sequencia = 1) {
  return { numero, especialidade: 'Fisioterapia', local, sequencia };
}
function inicial(): DadosDemo {
  return {
    conectado: true,
    painel: {
      atual: chamada('F014'),
      anteriores: [
        chamada('F013', 'Sala 02'),
        chamada('F012', 'Sala 01'),
        chamada('F011'),
        chamada('F010', 'Sala 02'),
      ],
    },
  };
}
function ler(): DadosDemo {
  try {
    const salvo = localStorage.getItem(CHAVE);
    if (salvo) {
      const dado = JSON.parse(salvo) as DadosDemo;
      return { conectado: dado.conectado === true, painel: projetarEstado(dado.painel) };
    }
  } catch {
    /* Estado fictício antigo pode ser reposto sem afetar dados reais. */
  }
  const dado = inicial();
  localStorage.setItem(CHAVE, JSON.stringify(dado));
  return dado;
}

/** Controle explícito da demonstração; não é endpoint nem regra do back-end. */
export function executarDemonstracao(acao: AcaoDemonstracao) {
  let dado = ler();
  if (acao === 'reiniciar') dado = inicial();
  if (acao === 'limpar') dado.painel = { atual: null, anteriores: [] };
  if (acao === 'desconectar') dado.conectado = false;
  if (acao === 'reconectar') dado.conectado = true;
  if (acao === 'nova') {
    const proximo = Number(dado.painel.atual?.numero.slice(1) ?? 14) + 1;
    dado.painel = aplicarChamada(dado.painel, chamada(`F${String(proximo).padStart(3, '0')}`));
  }
  if (acao === 'rechamar' && dado.painel.atual) {
    dado.painel.atual = { ...dado.painel.atual, sequencia: dado.painel.atual.sequencia + 1 };
  }
  localStorage.setItem(CHAVE, JSON.stringify(dado));
  window.dispatchEvent(new CustomEvent(CANAL, { detail: acao }));
  const canal = new BroadcastChannel(CANAL);
  canal.postMessage(acao);
  canal.close();
}

export function criarFonteSimulada(): FontePublica {
  return {
    estado() {
      const dado = ler();
      return dado.conectado
        ? Promise.resolve(projetarEstado(dado.painel))
        : Promise.reject(new ErroPublico(0));
    },
    consultar(numero) {
      const dado = ler();
      if (!dado.conectado) return Promise.reject(new ErroPublico(0));
      const base = {
        numero,
        especialidade: 'Fisioterapia',
        status: 'AGUARDANDO' as const,
        posicao: 4,
        tempoEstimadoMinutos: 22,
        local: null,
      };
      const cenarios: Record<string, ConsultaPublica> = {
        F015: base,
        F020: { ...base, tempoEstimadoMinutos: null },
        F021: { ...base, status: 'AUSENTE', posicao: null, tempoEstimadoMinutos: null },
        F022: { ...base, status: 'DESISTENCIA', posicao: null, tempoEstimadoMinutos: null },
      };
      const atual = dado.painel.atual;
      if (atual?.numero === numero)
        return Promise.resolve(
          projetarConsulta({
            ...base,
            status: 'CHAMADA',
            posicao: null,
            tempoEstimadoMinutos: null,
            local: atual.local,
          }),
        );
      const resultado = cenarios[numero];
      return resultado
        ? Promise.resolve(projetarConsulta(resultado))
        : Promise.reject(new ErroPublico(404));
    },
    conectar(eventos) {
      let ativo = true;
      const receber = (acao: string) => {
        if (!ativo) return;
        const dado = ler();
        eventos.conexao(dado.conectado);
        if (!dado.conectado) return;
        if ((acao === 'nova' || acao === 'rechamar') && dado.painel.atual)
          eventos.chamada(projetarChamada(dado.painel.atual));
        else eventos.estado(projetarEstado(dado.painel));
      };
      const local = (evento: Event) => receber((evento as CustomEvent<string>).detail);
      const canal = new BroadcastChannel(CANAL);
      canal.onmessage = (evento: MessageEvent<unknown>) => {
        if (typeof evento.data === 'string') receber(evento.data);
      };
      window.addEventListener(CANAL, local);
      queueMicrotask(() => receber('reiniciar'));
      return () => {
        ativo = false;
        canal.close();
        window.removeEventListener(CANAL, local);
      };
    },
  };
}
