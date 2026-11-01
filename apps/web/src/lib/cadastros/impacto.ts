import { type ErroApi } from '@/lib/api/cliente-http';

/**
 * Texto da confirmação do 409 IMPACTO_EM_USO (#79, T-04): o uso descrito pela API ("Sala em uso
 * nas senhas N001") seguido do `detail`. Quem decide o que está em uso é o servidor.
 */
export function descricaoDoImpacto(erro: ErroApi): string {
  const impacto = erro.extras.impacto as { emUso?: unknown } | undefined;
  const emUso = typeof impacto?.emUso === 'string' ? impacto.emUso.replace(/\.?$/, '.') : '';
  return [emUso, erro.detail].filter(Boolean).join(' ');
}
