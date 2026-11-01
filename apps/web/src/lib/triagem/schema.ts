import { EnquadramentoLegal, Prioridade, TipoAtendimento } from '@filas/contracts';
import { z } from 'zod';

/**
 * Validação da ficha de triagem (W-06 / T-06), no mesmo formato de `TriagemEntrada` do contrato.
 * Provisório: o schema oficial nasce na #15 (parte 5.1) em `packages/contracts`; ao entrar,
 * apagar este arquivo e importar de lá (ver `docs/07-pendencias-integracao.md`).
 */
export const FichaTriagemSchema = z
  .object({
    especialidadeDestinoId: z.string().min(1, 'Escolha a especialidade de destino.'),
    tipoAtendimento: TipoAtendimento,
    prioridade: Prioridade,
    motivo: z.string().trim().min(1, 'Informe o motivo do atendimento.'),
    enquadramentoLegal: EnquadramentoLegal.optional(),
    justificativaClinica: z.string().trim().optional(),
    observacoes: z.string().trim().optional(),
  })
  .superRefine((ficha, ctx) => {
    // RN-03: urgência clínica exige o critério que motivou a priorização.
    if (ficha.prioridade === 'URGENTE' && !ficha.justificativaClinica) {
      ctx.addIssue({
        code: 'custom',
        path: ['justificativaClinica'],
        message: 'Justificativa é obrigatória para prioridade Urgente.',
      });
    }
  });

export type FichaTriagem = z.infer<typeof FichaTriagemSchema>;

const ORDEM: Record<Prioridade, number> = { NORMAL: 0, PREFERENCIAL: 1, URGENTE: 2 };

/**
 * RN-02: enquadramento legal preenchido sinaliza prioridade preferencial automaticamente.
 * Nunca rebaixa: quem escolheu Urgente continua Urgente.
 */
export function prioridadeEfetiva(
  escolhida: Prioridade,
  enquadramento: EnquadramentoLegal | undefined,
): Prioridade {
  if (!enquadramento) return escolhida;
  return ORDEM[escolhida] >= ORDEM.PREFERENCIAL ? escolhida : 'PREFERENCIAL';
}

export type ErrosFicha = Partial<Record<keyof FichaTriagem, string>>;

/** Primeira mensagem de cada campo, para exibir abaixo do campo. */
export function errosPorCampo(erro: z.ZodError): ErrosFicha {
  const erros: ErrosFicha = {};
  for (const issue of erro.issues) {
    const campo = issue.path[0] as keyof FichaTriagem | undefined;
    if (campo && !erros[campo]) erros[campo] = issue.message;
  }
  return erros;
}

export const ROTULO_PRIORIDADE: Record<Prioridade, string> = {
  NORMAL: 'Normal',
  PREFERENCIAL: 'Preferencial',
  URGENTE: 'Urgente',
};

export const ROTULO_TIPO_ATENDIMENTO: Record<TipoAtendimento, string> = {
  PRIMEIRA_CONSULTA: 'Primeira consulta',
  RETORNO: 'Retorno',
  ENCAIXE: 'Encaixe',
};

export const ROTULO_ENQUADRAMENTO: Record<EnquadramentoLegal, string> = {
  IDOSO: 'Idoso',
  GESTANTE: 'Gestante',
  LACTANTE: 'Lactante',
  PCD: 'Pessoa com deficiência',
  OUTRO_PREVISTO_EM_NORMA: 'Outro previsto em norma',
};

/** Mostra só os 3 últimos caracteres do documento (nome e documento completos ficam no cadastro). */
export function mascararDocumento(documento: string) {
  return documento.length <= 3
    ? documento
    : `${'•'.repeat(documento.length - 3)}${documento.slice(-3)}`;
}
