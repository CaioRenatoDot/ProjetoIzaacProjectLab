import { expect } from '@playwright/test';
import { entrarComPermissoes, semViolacoesDeAcessibilidade, test } from './apoio';

test('RF-10: cartões, filtros, gráfico e tabela acessível', async ({ page }) => {
  await page.goto('/indicadores');
  await expect(page.getByRole('region', { name: 'Resumo dos seis indicadores' })).toBeVisible();
  await expect(page.getByRole('img', { name: /Volume de atendimentos/ })).toBeVisible();
  await expect(
    page.getByRole('table', { name: /tabela equivalente/ }).getByRole('row'),
  ).toHaveCount(4);
  await semViolacoesDeAcessibilidade(page);
  await page.screenshot({ path: 'test-results/indicadores-grafico.png', fullPage: true });
  await page.getByRole('button', { name: 'Tabela', exact: true }).click();
  await expect(page.getByRole('table')).toBeVisible();
  await page.getByLabel('Especialidade', { exact: true }).selectOption({ label: 'Fisioterapia' });
  await page.getByLabel('Turno').selectOption('NOITE');
  await page.getByRole('button', { name: 'Aplicar filtros' }).click();
  await expect(page.getByText(/média pode não ser representativa/)).toBeVisible();
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(2);
  await semViolacoesDeAcessibilidade(page);
  await page.screenshot({ path: 'test-results/indicadores-tabela.png', fullPage: true });
});

test('UC-18: período sem dados mantém filtros e permite limpar', async ({ page }) => {
  await page.goto('/indicadores');
  await expect(page.getByRole('region', { name: 'Resumo dos seis indicadores' })).toBeVisible();
  await page.getByLabel('De', { exact: true }).fill('2019-01-01');
  await page.getByLabel('Até', { exact: true }).fill('2019-01-31');
  await page.getByRole('button', { name: 'Aplicar filtros' }).click();
  await expect(page.getByText('Sem dados disponíveis', { exact: true })).toBeVisible();
  await expect(page.getByLabel('De', { exact: true })).toHaveValue('2019-01-01');
  await semViolacoesDeAcessibilidade(page);
  await page.screenshot({ path: 'test-results/indicadores-vazio.png', fullPage: true });
  await page.getByRole('button', { name: 'Limpar filtros' }).click();
  await expect(page.getByRole('region', { name: 'Resumo dos seis indicadores' })).toBeVisible();
});

test('exportação baixa CSV do período aplicado', async ({ page }) => {
  await page.goto('/indicadores');
  await expect(page.getByRole('region', { name: 'Resumo dos seis indicadores' })).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar resultado' }).click();
  expect((await download).suggestedFilename()).toMatch(
    /^indicadores-\d{4}-\d{2}-\d{2}-a-\d{4}-\d{2}-\d{2}\.csv$/,
  );
});

test('permissões e limite de 768 px', async ({ page, context }) => {
  await entrarComPermissoes(context, ['indicadores:consultar']);
  await page.goto('/indicadores');
  await expect(page.getByRole('region', { name: 'Resumo dos seis indicadores' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Exportar resultado' })).toHaveCount(0);
  await page.setViewportSize({ width: 767, height: 900 });
  await expect(page.getByText('Indicadores indisponíveis nesta tela')).toBeVisible();
  await expect(page.getByRole('search', { name: 'Filtrar indicadores' })).toBeHidden();
  await page.setViewportSize({ width: 768, height: 1024 });
  await expect(page.getByRole('search', { name: 'Filtrar indicadores' })).toBeVisible();
});
