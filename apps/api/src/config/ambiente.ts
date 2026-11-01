import { z } from 'zod';

const ambienteSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3333),
  DATABASE_URL: z
    .string({ error: 'DATABASE_URL não definida. Copie o .env.example para .env na raiz.' })
    .min(1, 'DATABASE_URL não definida. Copie o .env.example para .env na raiz.'),
  /** Assina o access token (HS256). Nunca versionado; gere com `openssl rand -base64 48`. */
  JWT_SEGREDO: z
    .string({ error: 'JWT_SEGREDO não definido. Copie o .env.example para .env na raiz.' })
    .min(32, 'JWT_SEGREDO precisa ter pelo menos 32 caracteres.'),
  /** Origens do web (3000) e do publico (3001), separadas por vírgula. */
  CORS_ORIGENS: z
    .string()
    .default('http://localhost:3000,http://localhost:3001')
    .transform((valor) =>
      valor
        .split(',')
        .map((origem) => origem.trim())
        .filter(Boolean),
    ),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
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
