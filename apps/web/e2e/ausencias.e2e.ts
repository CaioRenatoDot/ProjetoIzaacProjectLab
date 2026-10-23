import { expect, type Page } from '@playwright/test';

import { entrarComPermissoes, semViolacoesDeAcessibilidade, test } from './apoio';

async function abrirDetalhes(page: Page, numero: string) {
  await page.getByRole('button', { name: `Detalhes da senha ${numero}`, exact: true }).click();
  return page.getByRole('dialog', { name: `Detalhes da senha ${numero}`, exact: true });
}

async function abrirAusencia(page: Page, numero: string) {
  const painel = await abrirDetalhes(page, numero);
  await expect(painel.getByRole('button', { name: 'Registrar desistência' })).toHaveCount(0);
  await painel.getByRole('button', { name: 'Registrar ausência' }).click();
  return page.getByRole('dialog', { name: `Registrar ausência — senha ${numero}`, exact: true });
}

test.beforeEach(async ({ page }) => {
  await page.goto('/ausencias');
  await page.getByRole('button', { name: 'Reiniciar demonstração' }).click();
  await expect(page.getByRole('article', { name: 'Senha F013', exact: true })).toBeVisible();
});

test('RN-12 e RN-13: ausência antecipada pelo painel, restrição e acessibilidade', async ({
  page,
}) => {
  const senha = page.getByRole('article', { name: 'Senha F014', exact: true });
  const modal = await abrirAusencia(page, 'F014');
  await expect(modal.getByText(/Restam/)).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Confirmar', exact: true })).toBeDisabled();
  await semViolacoesDeAcessibilidade(page);
  await page.screenshot({ path: 'test-results/ausencia-desktop.png', fullPage: false });
  await modal.getByRole('checkbox').check();
  await modal.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(senha.getByText('Ausente', { exact: true })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Restrição aplicada:' })).toContainText(
    'Novos agendamentos',
  );
  await page.screenshot({ path: 'test-results/ausencia-restricao.png', fullPage: false });
});

test('desistência pelo painel, com origem e motivo', async ({ page }) => {
  const senha = page.getByRole('article', { name: 'Senha F016', exact: true });
  const painel = await abrirDetalhes(page, 'F016');
  await painel.getByRole('button', { name: 'Registrar desistência' }).click();
  const modal = page.getByRole('dialog', {
    name: 'Registrar desistência — senha F016',
    exact: true,
  });
  await modal.getByLabel('Equipe').check();
  await modal.getByLabel('Motivo da desistência (opcional)').fill('Paciente precisou sair.');
  await semViolacoesDeAcessibilidade(page);
  await page.screenshot({ path: 'test-results/desistencia-desktop.png', fullPage: false });
  await modal.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await expect(senha.getByText('Desistência', { exact: true })).toBeVisible();
  await expect(
    page
      .getByRole('region', { name: 'Notificações (F8)', exact: true })
      .getByText(/A senha saiu da fila ativa/),
  ).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('painel lateral prende foco e retorna ao botão Detalhes', async ({ page }) => {
  const painel = await abrirDetalhes(page, 'F013');
  await expect(painel.getByRole('button', { name: 'Registrar desistência' })).toHaveCount(0);
  const caixa = await painel.boundingBox();
  expect(caixa?.x).toBeGreaterThan(0);
  expect((caixa?.x ?? 0) + (caixa?.width ?? 0)).toBe(1440);
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Tab');
    await expect(painel.locator(':focus')).toHaveCount(1);
  }
  await semViolacoesDeAcessibilidade(page);
  await page.screenshot({ path: 'test-results/painel-lateral.png', fullPage: false });
  await page.keyboard.press('Escape');
  await expect(painel).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Detalhes da senha F013', exact: true }),
  ).toBeFocused();
});

test('modal ocupa tela inteira abaixo de 768 px e devolve foco ao painel', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const modal = await abrirAusencia(page, 'F013');
  const caixa = await modal.boundingBox();
  expect(caixa).toMatchObject({ x: 0, y: 0, width: 390, height: 844 });
  await semViolacoesDeAcessibilidade(page);
  await page.screenshot({ path: 'test-results/ausencia-celular.png', fullPage: false });
  await page.keyboard.press('Escape');
  await expect(modal).toHaveCount(0);
  const painel = page.getByRole('dialog', { name: 'Detalhes da senha F013', exact: true });
  await expect(painel.getByRole('button', { name: 'Registrar ausência' })).toBeFocused();
  await painel.getByRole('button', { name: 'Fechar detalhes' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('RN-12: expiração recebida da simulação notifica sem abrir modal', async ({ page }) => {
  await page.clock.install();
  await page.clock.fastForward(31_000);
  await page.getByRole('button', { name: 'Atualizar', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'automaticamente por expiração' }),
  ).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('consulta permitida sem escrita oculta ações no painel lateral', async ({ page, context }) => {
  await entrarComPermissoes(context, ['ausencia:consultar', 'fila:consultar']);
  await page.reload();
  const painel = await abrirDetalhes(page, 'F013');
  await expect(painel.getByRole('button', { name: 'Registrar ausência', exact: true })).toHaveCount(
    0,
  );
  await expect(
    painel.getByRole('button', { name: 'Registrar desistência', exact: true }),
  ).toHaveCount(0);
});
