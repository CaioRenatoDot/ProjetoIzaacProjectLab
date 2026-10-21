import AxeBuilder from '@axe-core/playwright';
import { type BrowserContext, expect, type Page } from '@playwright/test';

import { COOKIE_PERMISSOES_DEV } from '../src/lib/sessao';

/** Simula um perfil pelas permissões até a sessão real existir (#33). */
export async function entrarComPermissoes(context: BrowserContext, permissoes: string[]) {
  await context.addCookies([
    { name: COOKIE_PERMISSOES_DEV, value: permissoes.join(','), url: 'http://localhost:3000' },
  ]);
}

/** Verificação automática WCAG 2.1 AA (RNF-06). */
export async function semViolacoesDeAcessibilidade(page: Page) {
  const resultado = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(
    resultado.violations.map(
      (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
    ),
  ).toEqual([]);
}
