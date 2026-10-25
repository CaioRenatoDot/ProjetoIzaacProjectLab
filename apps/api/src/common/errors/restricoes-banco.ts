import { type CampoInvalido } from '@filas/contracts';

/**
 * CHECKs do banco que repetem uma regra já validada no service (docs/03 §4). Se o service deixar
 * passar, a violação vira 422 com o campo, e não 500. CHECK fora desta lista continua 500.
 */
const CAMPO_POR_RESTRICAO: Record<string, CampoInvalido> = {
  reclassificacao_justificativa_check: {
    campo: 'justificativa',
    mensagem: 'Informe a justificativa da reclassificação.',
  },
  triagem_urgente_justificativa_check: {
    campo: 'justificativaClinica',
    mensagem: 'Informe a justificativa clínica para a prioridade urgente.',
  },
};

const CHECK_VIOLADO = /violates check constraint \\?"(\w+)\\?"/;

export function campoDaRestricao(mensagemDoBanco: string): CampoInvalido | undefined {
  const nome = CHECK_VIOLADO.exec(mensagemDoBanco)?.[1];
  return nome ? CAMPO_POR_RESTRICAO[nome] : undefined;
}
