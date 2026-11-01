'use strict';

/**
 * Carregado com `node --require` só no processo da API dos testes reais.
 *
 * A alocação depende do dia e do turno atuais (RN-05, RN-07), e o seed só tem estudante de
 * Nutrição na segunda e na sexta à tarde. Para o teste não passar num horário e falhar em outro,
 * o relógio do processo é deslocado para a próxima segunda-feira às 14h em Brasília e segue
 * andando a partir dali. Fica no futuro de propósito: o navegador nunca vê um token já vencido.
 * Tudo dentro da API (Relogio, Date.now, JWT, tolerância) usa a mesma hora deslocada.
 *
 * E2E_AGORA (ISO 8601) troca o horário de partida.
 */
const DataReal = Date;

function proximaSegundaAs14h() {
  const hoje = new DataReal();
  // 14h em Brasília = 17h UTC (sem horário de verão desde 2019).
  const alvo = new DataReal(
    DataReal.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate(), 17),
  );
  alvo.setUTCDate(alvo.getUTCDate() + ((8 - alvo.getUTCDay()) % 7 || 7));
  return alvo.getTime();
}

const partida = process.env.E2E_AGORA
  ? DataReal.parse(process.env.E2E_AGORA)
  : proximaSegundaAs14h();
if (Number.isNaN(partida)) throw new Error(`E2E_AGORA inválido: ${process.env.E2E_AGORA}`);
const deslocamento = partida - DataReal.now();

class DataDeslocada extends DataReal {
  constructor(...args) {
    if (args.length === 0) super(DataReal.now() + deslocamento);
    else super(...args);
  }

  static now() {
    return DataReal.now() + deslocamento;
  }
}

globalThis.Date = DataDeslocada;
