import { expect, type Page } from '@playwright/test';

import { entrarComPermissoes, semViolacoesDeAcessibilidade, test } from './apoio';

const tabela = (page: Page) => page.getByRole('table', { name: 'Pacientes' });

async function abrirPacientes(page: Page) {
  await page.goto('/cadastros/pacientes');
  await expect(page.getByRole('heading', { name: 'Pacientes' })).toBeVisible();
}

test.describe('lista genérica de cadastros (#37)', () => {
  test('"Cadastros" no menu abre a lista de pacientes', async ({ page }) => {
    await page.goto('/');
    await page
      .getByRole('navigation', { name: 'Módulos' })
      .getByRole('link', { name: 'Cadastros' })
      .click();
    await expect(page).toHaveURL('/cadastros/pacientes');
    await expect(tabela(page).getByRole('row')).toHaveCount(21);
  });

  test('filtrar por vínculo "Aluno" mostra só alunos', async ({ page }) => {
    await abrirPacientes(page);
    await page.getByLabel('Vínculo').selectOption({ label: 'Aluno' });
    await expect(page.getByRole('status', { name: 'Resultado da lista' })).toHaveText(
      /15 pacientes encontrados/,
    );
    const vinculos = await tabela(page)
      .getByRole('row')
      .locator('td:nth-child(3)')
      .allTextContents();
    expect(new Set(vinculos)).toEqual(new Set(['Aluno']));
  });

  test('as cinco entidades usam a mesma tela, com colunas próprias', async ({ page }) => {
    await abrirPacientes(page);
    const entidades = page.getByRole('navigation', { name: 'Entidades de cadastro' });
    await entidades.getByRole('link', { name: 'Supervisores' }).click();
    await expect(page).toHaveURL('/cadastros/supervisores');
    await expect(page.getByRole('columnheader', { name: 'Ocupação atual' })).toBeVisible();
    await expect(
      page
        .getByRole('table')
        .getByText(/^\d de 3$/)
        .first(),
    ).toBeVisible();
  });

  test('só com cadastros:consultar, não há "Novo", "Editar" nem "Excluir"', async ({
    page,
    context,
  }) => {
    await entrarComPermissoes(context, ['cadastros:consultar']);
    await abrirPacientes(page);
    await expect(tabela(page).getByRole('row')).toHaveCount(21);
    await expect(page.getByRole('link', { name: 'Novo paciente' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /^Editar/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Excluir/ })).toHaveCount(0);
  });

  test('abaixo de 1280 px só as colunas essenciais aparecem', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 800 });
    await abrirPacientes(page);
    await expect(page.getByRole('columnheader', { name: 'Vínculo' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Contato' })).toBeHidden();
  });

  test('em 375 px os registros viram cartões, sem rolagem horizontal', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await abrirPacientes(page);
    await expect(page.getByRole('list', { name: 'Pacientes' })).toBeVisible();
    await expect(page.getByRole('table')).toBeHidden();
    const rolagem = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(rolagem).toBeLessThanOrEqual(0);
  });

  test('lista e modal de vínculo sem violações de acessibilidade', async ({ page }) => {
    await abrirPacientes(page);
    await expect(tabela(page).getByRole('row')).toHaveCount(21);
    await semViolacoesDeAcessibilidade(page);

    await tabela(page).getByRole('button', { name: 'Excluir Ana Alves Cardoso' }).click();
    await page
      .getByRole('dialog', { name: 'Excluir paciente' })
      .getByRole('button', { name: 'Excluir' })
      .click();
    await expect(page.getByRole('dialog', { name: 'Não é possível excluir' })).toBeVisible();
    await semViolacoesDeAcessibilidade(page);
  });
});
