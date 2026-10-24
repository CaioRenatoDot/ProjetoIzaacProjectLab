import { expect, type Page } from '@playwright/test';

import { entrarComPermissoes, semViolacoesDeAcessibilidade, test } from './apoio';

async function abrirFila(page: Page, especialidade: string) {
  await page.goto('/fila');
  const seletor = page.getByLabel('Especialidade');
  await expect(seletor).toBeVisible();
  const opcao = seletor.locator('option', { hasText: especialidade });
  await seletor.selectOption({ value: (await opcao.getAttribute('value')) ?? '' });
}

const coluna = (page: Page, nome: RegExp) => page.getByRole('region', { name: nome });
const chamar = (page: Page) => page.getByRole('button', { name: 'Chamar próxima' });

test.describe('painel de fila (#41)', () => {
  test('"Fila" no menu abre o painel; RN-04 ordena a coluna Aguardando', async ({ page }) => {
    await page.goto('/');
    await page
      .getByRole('navigation', { name: 'Módulos' })
      .getByRole('link', { name: 'Fila' })
      .click();
    await expect(page).toHaveURL('/fila');
    await expect(page.getByRole('heading', { name: 'Painel de fila' })).toBeVisible();

    await abrirFila(page, 'Nutrição');
    await expect(coluna(page, /^Aguardando/).getByRole('article')).toHaveText([
      /N103/,
      /N102/,
      /N104/,
      /N101/,
    ]);
  });

  test('RN-10: fila bloqueada mostra banner e botão desabilitado; as outras chamam', async ({
    page,
  }) => {
    await abrirFila(page, 'Fonoaudiologia');
    await expect(page.getByRole('list', { name: 'Avisos' })).toContainText(
      'Fonoaudiologia sem supervisor habilitado disponível: chamadas bloqueadas (RN-10)',
    );
    await expect(chamar(page)).toBeDisabled();
    await expect(page.getByText(/Chamadas bloqueadas: Fonoaudiologia/)).toBeVisible();

    await abrirFila(page, 'Nutrição');
    await expect(chamar(page)).toBeEnabled();
  });

  test('RN-03: chamada urgente pede confirmação e a senha vai para "Chamada"', async ({ page }) => {
    await abrirFila(page, 'Nutrição');
    await chamar(page).click();
    const dialogo = page.getByRole('dialog', { name: 'Chamar senha urgente' });
    await dialogo.getByRole('button', { name: 'Chamar mesmo assim' }).click();

    await expect(
      coluna(page, /^Chamada/).getByRole('article', { name: 'Senha N103' }),
    ).toBeVisible();
    await expect(page.getByRole('status', { name: 'Atualizações da fila' })).toHaveText(
      'Nova chamada: senha N103.',
    );
  });

  test('duplo clique chama uma senha só', async ({ page }) => {
    await abrirFila(page, 'Fisioterapia');
    await expect(coluna(page, /^Aguardando/).getByRole('article')).toHaveCount(1);
    await chamar(page).dblclick();
    await expect(coluna(page, /^Aguardando/).getByText('Nenhuma senha aguardando')).toBeVisible();
    await expect(page.getByText(/Não há senha aguardando/)).toHaveCount(0);
  });

  test('"Detalhes" abre o painel lateral com as ações do status', async ({ page }) => {
    await abrirFila(page, 'Nutrição');
    await page.getByRole('button', { name: 'Detalhes da senha N105' }).click();
    const painel = page.getByRole('dialog', { name: 'Detalhes da senha N105' });
    await expect(painel.getByRole('button', { name: 'Rechamar' })).toBeVisible();
    await expect(painel.getByRole('button', { name: 'Registrar ausência' })).toBeVisible();
    await painel.getByRole('button', { name: 'Rechamar' }).click();
    await expect(page.getByText('Senha N105 rechamada no telão.', { exact: true })).toBeVisible();
  });

  test('sem fila:chamar, "Chamar próxima" não aparece', async ({ page, context }) => {
    await entrarComPermissoes(context, ['fila:consultar']);
    await abrirFila(page, 'Nutrição');
    await expect(coluna(page, /^Aguardando/)).toBeVisible();
    await expect(chamar(page)).toHaveCount(0);
  });

  test('painel e painel lateral sem violações de acessibilidade', async ({ page }) => {
    await abrirFila(page, 'Nutrição');
    await expect(coluna(page, /^Aguardando/).getByRole('article')).toHaveCount(4);
    await semViolacoesDeAcessibilidade(page);
    await page.getByRole('button', { name: 'Detalhes da senha N101' }).click();
    await expect(page.getByRole('dialog', { name: 'Detalhes da senha N101' })).toBeVisible();
    await semViolacoesDeAcessibilidade(page);
  });

  test('abaixo de 768 px: só consulta, sem "Chamar próxima" e sem rolagem horizontal', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await abrirFila(page, 'Nutrição');
    await expect(coluna(page, /^Aguardando/)).toBeVisible();
    await expect(chamar(page)).toBeHidden();
    const rolagem = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(rolagem).toBeLessThanOrEqual(0);
  });
});
