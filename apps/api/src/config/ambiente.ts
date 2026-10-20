import { z } from 'zod';

const ambienteSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3333),
  DATABASE_URL: z
    .string({ error: 'DATABASE_URL não definida. Copie o .env.example para .env na raiz.' })
    .min(1, 'DATABASE_URL não definida. Copie o .env.example para .env na raiz.'),
});

export type Ambiente = z.infer<typeof ambienteSchema>;

/** Valida as variáveis na subida da API; falha cedo e com mensagem legível. */
export function validarAmbiente(config: Record<string, unknown>): Ambiente {
  const resultado = ambienteSchema.safeParse(config);
  if (!resultado.success) {
    throw new Error(`Variáveis de ambiente inválidas:\n${z.prettifyError(resultado.error)}`);
  }
  return resultado.data;
}
