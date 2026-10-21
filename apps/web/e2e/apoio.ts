import AxeBuilder from '@axe-core/playwright';
import { test as base, type BrowserContext, expect, type Page } from '@playwright/test';

import { COOKIE_PERMISSOES_DEV, COOKIE_REFRESH_MOCK } from '../src/mocks/cookies';

const URL_WEB = 'http://localhost:3000';

/**
 * `test` com sessão: o cookie de refresh da simulação (`src/mocks`) restaura a sessão do
 * administrador ao abrir qualquer página. Testes do próprio login usam o `test` do Playwright.
 */
export const test = base.extend<{ sessaoSimulada: void }>({
  sessaoSimulada: [
    async ({ context }, use) => {
      await context.addCookies([
        { name: COOKIE_REFRESH_MOCK, value: 'usuario-admin', url: URL_WEB },
      ]);
      await use();
    },
    { auto: true },
  ],
});

/** Simula um perfil pelas permissões. Até a API real (#10), troca as permissões na simulação. */
export async function entrarComPermissoes(context: BrowserContext, permissoes: string[]) {
  await context.addCookies([
    { name: COOKIE_PERMISSOES_DEV, value: permissoes.join(','), url: URL_WEB },
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
