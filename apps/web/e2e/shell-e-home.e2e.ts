import { expect, type Page } from '@playwright/test';

import { entrarComPermissoes, semViolacoesDeAcessibilidade, test } from './apoio';

const menu = (page: Page) => page.getByRole('navigation', { name: 'Módulos' }).getByRole('link');

test.describe('shell e menu (#34)', () => {
  test('perfil só com cadastros vê só "Cadastros" no menu', async ({ page, context }) => {
    await entrarComPermissoes(context, ['cadastros:consultar', 'cadastros:criar']);
    await page.goto('/');
    await expect(menu(page)).toHaveText(['Cadastros']);
  });

  test('sem auditoria:consultar, "Auditoria" não aparece, nem desabilitado', async ({
    page,
    context,
  }) => {
    await entrarComPermissoes(context, ['fila:consultar', 'auditoria:exportar']);
    await page.goto('/');
    await expect(menu(page)).toHaveText(['Fila']);
    await expect(page.getByText('Auditoria')).toHaveCount(0);
  });

  test('primeiro Tab leva ao atalho "Pular para o conteúdo"', async ({ page }) => {
    await page.goto('/');
    // A sessão é verificada no cliente; o shell aparece depois dela.
    await expect(page.getByRole('navigation', { name: 'Módulos' })).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Pular para o conteúdo' })).toBeFocused();
  });

  test('menu recolhe e expande pelo botão "Menu"', async ({ page }) => {
    await page.goto('/');
    const botao = page.getByRole('button', { name: 'Menu' });
    await expect(botao).toHaveAttribute('aria-expanded', 'true');
    await botao.click();
    await expect(botao).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('navigation', { name: 'Módulos' })).toBeHidden();
  });

  test('alvos interativos do shell têm ao menos 44 x 44 px', async ({ page }) => {
    await page.goto('/');
    for (const alvo of [
      page.getByRole('button', { name: 'Menu' }),
      page.getByRole('button', { name: 'Sair' }),
      menu(page).first(),
    ]) {
      const caixa = await alvo.boundingBox();
      expect(caixa?.height).toBeGreaterThanOrEqual(44);
      expect(caixa?.width).toBeGreaterThanOrEqual(44);
    }
  });
});

test.describe('home por perfil (#35)', () => {
  test('permissões de triagem mostram o bloco de triagem e nenhum de gestão', async ({
    page,
    context,
  }) => {
    await entrarComPermissoes(context, ['triagem:consultar', 'triagem:criar']);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Triagens do dia' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Nova triagem' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Filas e alertas de SLA' })).toHaveCount(0);
  });

  test('cartão de indicador anuncia rótulo completo', async ({ page }) => {
    await page.goto('/');
    await expect(
      page.getByRole('link', { name: 'Aguardando na fila: sem dados no momento' }),
    ).toBeVisible();
  });

  test('home sem violações de acessibilidade', async ({ page }) => {
    await page.goto('/');
    await semViolacoesDeAcessibilidade(page);
  });
});
