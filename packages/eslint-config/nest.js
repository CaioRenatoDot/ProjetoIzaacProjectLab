import globals from 'globals';
import tseslint from 'typescript-eslint';

import { base } from './base.js';

/**
 * Variante para o NestJS. Imports usados só em decorators precisam ficar como valor
 * (emitDecoratorMetadata), por isso consistent-type-imports fica desligada.
 */
export const nest = tseslint.config(...base, {
  languageOptions: {
    globals: globals.node,
  },
  rules: {
    '@typescript-eslint/consistent-type-imports': 'off',
  },
});

export default nest;
