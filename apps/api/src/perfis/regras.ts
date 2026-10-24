import { type Aviso } from '@filas/contracts';

/** T-05: perfil sem nenhuma permissão de consulta é aceito, mas a tela pede confirmação. */
export function avisosDoPerfil(permissoes: readonly string[]): Aviso[] {
  return permissoes.some((permissao) => permissao.endsWith(':consultar'))
    ? []
    : [
        {
          codigo: 'PERFIL_SEM_CONSULTA',
          mensagem:
            'O perfil não tem nenhuma permissão de consulta: quem usar este perfil não verá nenhum módulo.',
        },
      ];
}

export function mesmoConjunto(a: readonly string[], b: readonly string[]): boolean {
  const conjunto = new Set(a);
  return conjunto.size === new Set(b).size && b.every((item) => conjunto.has(item));
}
