import { expect, type Page, test } from '@playwright/test';

import { semViolacoesDeAcessibilidade } from './apoio';

// Sem a sessão automática de `apoio.ts`: aqui a pessoa entra pela tela.
const SENHA = 'senha-dev';

async function preencher(page: Page, identificacao: string, senha: string) {
  await page.getByLabel('Matrícula ou e-mail institucional').fill(identificacao);
  await page.getByRole('textbox', { name: 'Senha', exact: true }).fill(senha);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

test.describe('login e sessão (#33)', () => {
  test('rota interna sem sessão vai ao login e volta para ela depois de entrar', async ({
    page,
  }) => {
    await page.goto('/triagem');
    await expect(page).toHaveURL('/login?redirect=%2Ftriagem');
    await expect(page.getByLabel('Matrícula ou e-mail institucional')).toBeFocused();

    await preencher(page, 'admin@clinica.edu.br', SENHA);
    await expect(page).toHaveURL('/triagem');
    await expect(page.getByRole('navigation', { name: 'Módulos' })).toBeVisible();
  });

  test('credencial inválida mostra a mesma mensagem genérica nos dois casos', async ({ page }) => {
    await page.goto('/login');
    const mensagem = 'Identificação ou senha incorreta. Verifique os dados e tente novamente.';

    await preencher(page, 'ninguem@clinica.edu.br', SENHA);
    await expect(page.getByText(mensagem)).toBeVisible();

    await preencher(page, 'admin@clinica.edu.br', 'errada');
    await expect(page.getByText(mensagem)).toBeVisible();
  });

  test('ao recarregar, a sessão continua e nenhum token fica no storage', async ({ page }) => {
    await page.goto('/login');
    await preencher(page, 'admin@clinica.edu.br', SENHA);
    await expect(page.getByRole('heading', { name: /Olá/ })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('heading', { name: /Olá/ })).toBeVisible();
    const guardado = await page.evaluate(() =>
      JSON.stringify({ ...window.localStorage, ...window.sessionStorage }),
    );
    expect(guardado).not.toMatch(/mock\./);
  });

  test('"Sair" encerra a sessão; voltar à home exige entrar de novo', async ({ page }) => {
    await page.goto('/login');
    await preencher(page, 'admin@clinica.edu.br', SENHA);
    await page.getByRole('button', { name: 'Sair' }).click();
    await expect(page).toHaveURL('/login');

    await page.goto('/');
    await expect(page).toHaveURL('/login');
  });

  test('?expirada=1 mostra o aviso de sessão expirada', async ({ page }) => {
    await page.goto('/login?redirect=%2Ftriagem&expirada=1');
    await expect(page.getByRole('status')).toHaveText(/Sua sessão expirou/);
  });

  test('W-01 sem violações de acessibilidade', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
    await semViolacoesDeAcessibilidade(page);
  });
});
