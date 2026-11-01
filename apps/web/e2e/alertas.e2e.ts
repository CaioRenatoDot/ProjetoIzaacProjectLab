import { expect, type Page } from '@playwright/test';

import { entrarComPermissoes, semViolacoesDeAcessibilidade, test } from './apoio';

const emAberto = (page: Page) => page.getByRole('list', { name: 'Alertas em aberto' });
const cartao = (page: Page, especialidade: string) =>
  emAberto(page)
    .getByRole('listitem')
    .filter({ has: page.getByRole('heading', { name: especialidade, exact: true }) });

async function abrirAlertas(page: Page) {
  await page.goto('/indicadores/alertas');
  await expect(page.getByRole('heading', { name: 'Alertas de SLA', level: 1 })).toBeVisible();
  await expect(cartao(page, 'Fisioterapia')).toBeVisible();
}

test.describe('alertas de SLA (#49)', () => {
  test('o cartão "Alertas de SLA" da home abre a tela, sem violações de acessibilidade', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /^Alertas de SLA/ }).click();
    await expect(page).toHaveURL('/indicadores/alertas');
    await expect(cartao(page, 'Fonoaudiologia')).toContainText('Fila bloqueada');
    await semViolacoesDeAcessibilidade(page);
  });

  test('reconhecer muda a aparência e o alerta continua na lista', async ({ page }) => {
    await abrirAlertas(page);
    await page.getByRole('button', { name: 'Reconhecer alerta de Fisioterapia' }).click();

    await expect(cartao(page, 'Fisioterapia')).toHaveAttribute('data-status', 'RECONHECIDO');
    await expect(cartao(page, 'Fisioterapia')).toContainText('Reconhecido por');
    await expect(page.getByRole('heading', { name: 'Fisioterapia', exact: true })).toBeFocused();
  });

  test('escalonamento registra autor e horário no alerta', async ({ page }) => {
    await abrirAlertas(page);
    await page.getByRole('button', { name: 'Reforçar atendentes em Fisioterapia' }).click();
    const modal = page.getByRole('dialog', { name: 'Reforçar atendentes em Fisioterapia' });
    await semViolacoesDeAcessibilidade(page);
    await modal.getByRole('button', { name: 'Confirmar' }).click();

    await expect(modal).toHaveCount(0);
    await expect(cartao(page, 'Fisioterapia')).toContainText(
      /Reforço de atendentes, por Usuário de desenvolvimento em/,
    );
  });

  test('supervisor em modo consulta não vê as ações', async ({ page, context }) => {
    await entrarComPermissoes(context, ['alertas:consultar']);
    await abrirAlertas(page);
    await expect(
      page.getByRole('button', { name: /^Reconhecer|^Reforçar|^Abrir vaga/ }),
    ).toHaveCount(0);
  });

  test('abaixo de 768 px as medidas ficam no menu "Escalonar"', async ({ page }) => {
    await page.setViewportSize({ width: 600, height: 900 });
    await abrirAlertas(page);
    const reforco = page.getByRole('button', { name: 'Reforçar atendentes em Fisioterapia' });
    await expect(reforco).toBeHidden();
    await cartao(page, 'Fisioterapia').getByRole('button', { name: 'Escalonar' }).click();
    await expect(reforco).toBeVisible();
  });
});
