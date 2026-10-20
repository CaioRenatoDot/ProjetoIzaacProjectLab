import nextPlugin from '@next/eslint-plugin-next';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

import { base } from './base.js';

/** Variante para as aplicações Next.js (web e publico). */
export const next = tseslint.config(...base, {
  languageOptions: {
    globals: { ...globals.browser, ...globals.node },
  },
  plugins: {
    '@next/next': nextPlugin,
    'react-hooks': reactHooks,
  },
  rules: {
    ...nextPlugin.configs.recommended.rules,
    ...nextPlugin.configs['core-web-vitals'].rules,
    ...reactHooks.configs.recommended.rules,
  },
});

export default next;
