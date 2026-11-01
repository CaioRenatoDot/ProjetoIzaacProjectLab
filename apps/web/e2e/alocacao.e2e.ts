import { expect } from '@playwright/test';

import { semViolacoesDeAcessibilidade, test } from './apoio';

const confirmar = 'Confirmar alocação';

test.describe('alocação de recursos (#43)', () => {
  test('"Alocar recursos" no painel da fila abre a alocação e confirmar volta para a fila', async ({
    page,
  }) => {
    await page.goto('/fila');
    await page.getByRole('button', { name: 'Detalhes da senha F013' }).click();
    await page
      .getByRole('dialog', { name: 'Detalhes da senha F013' })
      .getByRole('link', { name: 'Alocar recursos' })
      .click();

    await expect(page).toHaveURL('/fila/senhas/senha-f013/alocacao');
    await expect(
      page.getByRole('heading', { name: 'Alocação de recursos: senha F013' }),
    ).toBeVisible();
    await page.getByRole('button', { name: confirmar }).click();

    await expect(page).toHaveURL('/fila');
    await expect(
      page.getByText('Recursos alocados à senha F013: Bruno Lima, Prof. Elisa Nunes, Sala 03.', {
        exact: true,
      }),
    ).toBeVisible();
  });

  test('inapto aparece com o motivo escrito no item', async ({ page }) => {
    await page.goto('/fila/senhas/senha-f013/alocacao');
    const carla = page.getByRole('radio', { name: /Carla Souza/ });
    await expect(carla).toBeDisabled();
    await expect(page.getByText('Inapto: Já possui atendimento ativo')).toBeVisible();
  });

  test('especialidade sem supervisão não mostra o bloco de supervisor', async ({ page }) => {
    await page.goto('/fila/senhas/senha-n105/alocacao');
    await expect(
      page.getByRole('heading', { name: 'Alocação de recursos: senha N105' }),
    ).toBeVisible();
    await expect(page.getByRole('group', { name: /Supervisor/ })).toHaveCount(0);
    await expect(page.getByText(/a etapa de supervisor não se aplica/)).toBeVisible();
  });

  test('recurso indisponível na confirmação recarrega as alternativas sem confirmar', async ({
    page,
  }) => {
    await page.goto('/fila/senhas/senha-f013/alocacao');
    await page.getByRole('radio', { name: /Ana Ribeiro/ }).check();
    await page.getByRole('button', { name: confirmar }).click();

    // O Next.js tem o próprio role="alert" (anunciador de rota): filtra pelo texto.
    await expect(
      page
        .getByRole('alert')
        .filter({ hasText: 'Ana Ribeiro acabou de iniciar outro atendimento' }),
    ).toBeVisible();
    await expect(page.getByRole('radio', { name: /Ana Ribeiro/ })).toBeDisabled();
    await expect(page).toHaveURL('/fila/senhas/senha-f013/alocacao');
  });

  test('sugestão do sistema vem marcada e pode ser trocada pelo teclado (#45)', async ({
    page,
  }) => {
    await page.goto('/fila/senhas/senha-f013/alocacao');
    const sala = page.getByRole('group', { name: /Sala/ });
    await expect(sala.getByRole('radio', { name: /Sala 03/ })).toBeChecked();
    await expect(sala.getByText('Sugestão do sistema')).toBeVisible();

    await sala.getByRole('radio', { name: /Sala 03/ }).focus();
    await page.keyboard.press('ArrowDown');
    await expect(sala.getByRole('radio', { name: /Sala 07/ })).toBeChecked();
    await page.getByRole('button', { name: confirmar }).click();
    await expect(
      page.getByText('Recursos alocados à senha F013: Bruno Lima, Prof. Elisa Nunes, Sala 07.', {
        exact: true,
      }),
    ).toBeVisible();
  });

  test('bloco sem recurso apto mostra o motivo e oferece manter aguardando (#45)', async ({
    page,
  }) => {
    await page.goto('/fila/senhas/senha-n106/alocacao');
    const sala = page.getByRole('group', { name: /Sala/ });
    await expect(sala.getByText(/por isso não há sugestão/)).toBeVisible();
    await sala.getByRole('button', { name: 'Manter aguardando recurso' }).click();
    await expect(
      page.getByRole('dialog', { name: /Manter a senha N106 aguardando recurso/ }),
    ).toBeVisible();
    await semViolacoesDeAcessibilidade(page);
  });

  test('"Alocação" no menu leva para a fila', async ({ page }) => {
    await page.goto('/');
    await page
      .getByRole('navigation', { name: 'Módulos' })
      .getByRole('link', { name: 'Alocação' })
      .click();
    await expect(page).toHaveURL('/fila');
  });

  test('alocação sem violações de acessibilidade', async ({ page }) => {
    await page.goto('/fila/senhas/senha-f013/alocacao');
    await expect(page.getByRole('button', { name: confirmar })).toBeEnabled();
    await semViolacoesDeAcessibilidade(page);
  });

  test('não é oferecida abaixo de 768 px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto('/fila/senhas/senha-f013/alocacao');
    await expect(page.getByText(/disponível em telas a partir de 768 px/)).toBeVisible();
    await expect(page.getByRole('button', { name: confirmar })).toBeHidden();
  });
});
