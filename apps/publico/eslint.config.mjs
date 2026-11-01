import { next } from '@filas/eslint-config/next';

/**
 * A aplicação pública não tem autenticação e não pode carregar código da aplicação operacional
 * (docs/01-arquitetura.md §1; P-03, RNF-02).
 */
export default [
  ...next,
  { ignores: ['next-env.d.ts'] },
  {
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['web', 'web/*', '**/apps/web/**'],
              message: 'O publico não importa nada do web.',
            },
            { group: ['**/auth/**', '**/sessao/**'], message: 'O publico não tem autenticação.' },
          ],
        },
      ],
    },
  },
];
