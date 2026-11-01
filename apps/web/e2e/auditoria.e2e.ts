import { expect, type Page } from '@playwright/test';

import { entrarComPermissoes, semViolacoesDeAcessibilidade, test } from './apoio';

const tabela = (page: Page) => page.getByRole('table', { name: /Trilha de auditoria/ });
const resultado = (page: Page) => page.getByRole('status', { name: 'Resultado da trilha' });

async function abrirTrilha(page: Page) {
  await page.goto('/auditoria');
  await expect(page.getByRole('heading', { name: 'Trilha de auditoria' })).toBeVisible();
  await expect(tabela(page).getByRole('row')).toHaveCount(21);
}

test.describe('trilha de auditoria (#50)', () => {
  test('"Auditoria" no menu abre a trilha, sem violações de acessibilidade', async ({ page }) => {
    await page.goto('/');
    await page
      .getByRole('navigation', { name: 'Módulos' })
      .getByRole('link', { name: 'Auditoria' })
      .click();
    await expect(page).toHaveURL('/auditoria');
    await expect(tabela(page).getByRole('row')).toHaveCount(21);
    await semViolacoesDeAcessibilidade(page);
  });

  test('filtrar por "Consultar informação sensível" mostra só linhas marcadas', async ({
    page,
  }) => {
    await abrirTrilha(page);
    await page
      .getByLabel('Tipo de operação')
      .selectOption({ label: 'Consultar informação sensível' });
    await page.getByRole('button', { name: 'Aplicar filtros' }).click();

    await expect(resultado(page)).toHaveText(/10 registros encontrados/);
    const linhas = tabela(page)
      .getByRole('row')
      .filter({ hasNot: page.getByRole('columnheader') });
    await expect(linhas).toHaveCount(10);
    await expect(linhas.filter({ hasText: 'Consulta sensível' })).toHaveCount(10);
  });

  test('o detalhe da reclassificação mostra a justificativa', async ({ page }) => {
    await abrirTrilha(page);
    await tabela(page)
      .getByRole('row')
      .filter({ hasText: 'Reclassificou prioridade' })
      .first()
      .getByRole('button', { name: /^Detalhes/ })
      .click();

    const painel = page.getByRole('dialog', { name: 'Detalhe do evento' });
    await expect(painel.getByText('Justificativa informada')).toBeVisible();
    await expect(painel).toContainText('Paciente relatou piora da dor');
    await semViolacoesDeAcessibilidade(page);

    await page.keyboard.press('Escape');
    await expect(painel).toHaveCount(0);
  });

  test('exportar baixa o CSV e registra a exportação na trilha', async ({ page }) => {
    await abrirTrilha(page);
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exportar resultado' }).click();

    expect((await download).suggestedFilename()).toMatch(
      /^trilha-auditoria-\d{4}-\d{2}-\d{2}\.csv$/,
    );
    await expect(resultado(page)).toHaveText(/46 registros encontrados/);
    await expect(tabela(page).getByRole('row').nth(1)).toContainText(
      'Exportou a trilha de auditoria',
    );
  });

  test('sem auditoria:consultar, a rota mostra o estado neutro', async ({ page, context }) => {
    await entrarComPermissoes(context, ['fila:consultar', 'auditoria:exportar']);
    await page.goto('/auditoria');
    await expect(page.getByText('Acesso não permitido')).toBeVisible();
    await expect(page.getByRole('table')).toHaveCount(0);
  });

  test('abaixo de 768 px a trilha não é oferecida', async ({ page }) => {
    await page.setViewportSize({ width: 600, height: 900 });
    await page.goto('/auditoria');
    await expect(page.getByText('Trilha de auditoria indisponível nesta tela')).toBeVisible();
    await expect(page.getByRole('table')).toBeHidden();
  });
});
