import { hash, verify } from '@node-rs/argon2';

/** argon2id com os parâmetros padrão da biblioteca (m=19456, t=2, p=1: mínimo da OWASP). */
export function gerarHashSenha(senha: string): Promise<string> {
  return hash(senha);
}

/** Hash inválido ou corrompido conta como senha errada, nunca como erro 500. */
export async function senhaConfere(hashSalvo: string, senha: string): Promise<boolean> {
  try {
    return await verify(hashSalvo, senha);
  } catch {
    return false;
  }
}
