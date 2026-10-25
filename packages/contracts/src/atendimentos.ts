import { z } from 'zod';

import { Desfecho, StatusSenha } from './enums';
import { ParametrosPaginacao } from './paginacao';
import { TriagemDetalhe } from './triagem';

/** A versão é a da senha: é nela que o status do atendimento mora (docs/03 §5). */
const versao = z.number({ error: 'Informe a versão.' }).int({ error: 'Informe a versão.' });
const textoOpcional = (maximo: number) =>
  z
    .string()
    .trim()
    .max(maximo, { error: `No máximo ${maximo} caracteres.` })
    .transform((valor) => valor || undefined)
    .optional();

/** Projeção de lista e das respostas de ação, sem observações nem triagem (P-03). */
export const AtendimentoResumo = z.object({
  id: z.string(),
  senhaId: z.string(),
  numero: z.string(),
  pacienteIniciais: z.string(),
  especialidade: z.string(),
  estudante: z.string(),
  supervisor: z.string().nullable(),
  sala: z.string(),
  status: StatusSenha,
  iniciadoEm: z.string().nullable(),
  /** Do início ao encerramento (ou até agora), já descontadas as pausas (RF-10). */
  duracaoMinutos: z.number().int(),
  encerradoEm: z.string().nullable(),
  desfecho: Desfecho.nullable(),
  /** Copiado da especialidade no início (RN-11). */
  exigeValidacao: z.boolean(),
  versao: z.number().int(),
});
export type AtendimentoResumo = z.infer<typeof AtendimentoResumo>;

export const PausaAtendimento = z.object({
  motivo: z.string().nullable(),
  pausadoEm: z.string(),
  retomadoEm: z.string().nullable(),
});
export type PausaAtendimento = z.infer<typeof PausaAtendimento>;

/** `GET /atendimentos/{id}`: sensível, gera CONSULTAR_SENSIVEL (RNF-07). */
export const AtendimentoDetalhe = AtendimentoResumo.extend({
  pacienteNome: z.string(),
  triagem: TriagemDetalhe,
  observacoes: z.string().nullable(),
  parecerSupervisor: z.string().nullable(),
  validadoPor: z.string().nullable(),
  validadoEm: z.string().nullable(),
  pausas: z.array(PausaAtendimento),
});
export type AtendimentoDetalhe = z.infer<typeof AtendimentoDetalhe>;

export const ListarAtendimentosQuery = ParametrosPaginacao.extend({
  estudanteId: z.uuid({ error: 'estudanteId inválido.' }).optional(),
  supervisorId: z.uuid({ error: 'supervisorId inválido.' }).optional(),
  status: z
    .union([z.string(), z.array(z.string())])
    .transform((valor) => (Array.isArray(valor) ? valor : valor.split(',')).filter(Boolean))
    .pipe(z.array(StatusSenha))
    .optional(),
});
export type ListarAtendimentosQuery = z.infer<typeof ListarAtendimentosQuery>;

export const VersaoEntrada = z.object({ versao });
export type VersaoEntrada = z.infer<typeof VersaoEntrada>;

export const PausarEntrada = z.object({ motivo: textoOpcional(500), versao });
export type PausarEntrada = z.infer<typeof PausarEntrada>;

/** Desfecho ausente volta 422 DESFECHO_OBRIGATORIO, validado no servidor. */
export const EncerrarEntrada = z.object({
  desfecho: Desfecho.nullable().default(null),
  observacoes: textoOpcional(4000),
  versao,
});
export type EncerrarEntrada = z.infer<typeof EncerrarEntrada>;

export const EncerramentoResposta = z.object({
  atendimento: AtendimentoResumo,
  exigeValidacao: z.boolean(),
  /** Desfecho de encaminhamento: o front segue para o registro (T-14). */
  exigeEncaminhamento: z.boolean(),
});
export type EncerramentoResposta = z.infer<typeof EncerramentoResposta>;

export const ValidarEntrada = z
  .object({
    aprovado: z.boolean({ error: 'Informe se aprova o encerramento.' }),
    parecer: textoOpcional(2000),
    versao,
  })
  .superRefine((entrada, ctx) => {
    // RN-11: a recusa registra o motivo para o estudante corrigir.
    if (!entrada.aprovado && !entrada.parecer) {
      ctx.addIssue({
        code: 'custom',
        path: ['parecer'],
        message: 'Informe o parecer da recusa.',
      });
    }
  });
export type ValidarEntrada = z.infer<typeof ValidarEntrada>;
