import { z } from 'zod';

/** O que faltou para alocar (ação "Manter aguardando" de W-11). */
export const RecursoFaltante = z.enum(['ESTUDANTE', 'SUPERVISOR', 'SALA'], {
  error: 'Escolha estudante, supervisor ou sala.',
});
export type RecursoFaltante = z.infer<typeof RecursoFaltante>;

const versao = z.number({ error: 'Informe a versão.' }).int({ error: 'Informe a versão.' });

/**
 * `POST /senhas/{id}/alocacao` e `PUT` (troca). Supervisor obrigatório só quando a
 * especialidade exige supervisão docente (RN-07); quando não exige, vai nulo.
 */
export const AlocacaoEntrada = z.object({
  estudanteId: z.uuid({ error: 'Escolha o estudante.' }),
  supervisorId: z.uuid({ error: 'Escolha o supervisor.' }).nullable().default(null),
  salaId: z.uuid({ error: 'Escolha a sala.' }),
  versao,
});
export type AlocacaoEntrada = z.infer<typeof AlocacaoEntrada>;

export const AguardandoRecursoEntrada = z.object({
  recursoFaltante: RecursoFaltante,
  observacao: z
    .string()
    .trim()
    .max(500, { error: 'No máximo 500 caracteres.' })
    .transform((valor) => valor || undefined)
    .optional(),
  versao,
});
export type AguardandoRecursoEntrada = z.infer<typeof AguardandoRecursoEntrada>;
