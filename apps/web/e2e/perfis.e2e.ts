import { expect, type Page, test } from '@playwright/test';

import { entrarComPermissoes, semViolacoesDeAcessibilidade } from './apoio';

async function abrirPerfil(page: Page, nome: string) {
  await page.goto('/acesso/perfis');
  await page.getByRole('button', { name: new RegExp(`^${nome}`) }).click();
}

test.describe('perfis e matriz de permissões (#36)', () => {
  test('perfil do sistema aparece só para leitura', async ({ page }) => {
    await abrirPerfil(page, 'Administrador');
    await expect(
      page.getByText('Perfil do sistema: as permissões aparecem só para leitura'),
    ).toBeVisible();
    await expect(page.getByRole('checkbox', { name: 'Cadastros — Consultar' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Salvar' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Excluir perfil' })).toHaveCount(0);
  });

  test('salvar perfil em uso avisa quantos usuários serão afetados', async ({ page }) => {
    await abrirPerfil(page, 'Recepção');
    await page.getByRole('checkbox', { name: 'Fila — Excluir' }).check();
    const salvar = page.getByRole('button', { name: 'Salvar' });
    await salvar.click();
    const dialogo = page.getByRole('dialog', { name: 'Confirmar alteração do perfil' });
    await expect(dialogo).toContainText('muda as permissões de 3 usuários');
    await page.keyboard.press('Escape');
    await expect(dialogo).toBeHidden();
    await expect(salvar).toBeFocused();
  });

  test('exclusão com usuários vinculados é recusada com a explicação', async ({ page }) => {
    await abrirPerfil(page, 'Recepção');
    await page.getByRole('button', { name: 'Excluir perfil' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Excluir perfil' }).click();
    await expect(
      page
        .getByRole('region', { name: /Notificações/ })
        .getByText(/não pode ser excluído porque 3 usuário/),
    ).toBeVisible();
  });

  test('nome repetido mostra erro no campo e leva o foco até ele', async ({ page }) => {
    await page.goto('/acesso/perfis');
    await page.getByRole('button', { name: 'Novo perfil' }).click();
    const nome = page.getByLabel('Nome');
    await nome.fill('triagem');
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByText('Já existe um perfil com este nome. Escolha outro.')).toBeVisible();
    await expect(nome).toBeFocused();
    await expect(nome).toHaveAttribute('aria-invalid', 'true');
  });

  test('perfil novo só com cadastros:consultar gera menu só com "Cadastros"', async ({
    page,
    context,
  }) => {
    await page.goto('/acesso/perfis');
    await page.getByRole('button', { name: 'Novo perfil' }).click();
    await page.getByLabel('Nome').fill('Consulta de cadastros');
    await page.getByRole('checkbox', { name: 'Cadastros — Consultar' }).check();
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByRole('button', { name: /^Consulta de cadastros/ })).toBeVisible();

    // A API em memória não autentica (#12, #33): entra com as permissões que a matriz salvou.
    const salvas = await page
      .getByRole('checkbox', { checked: true })
      .evaluateAll((caixas) => caixas.map((c) => c.getAttribute('aria-label')));
    expect(salvas).toEqual(['Cadastros — Consultar']);
    await entrarComPermissoes(context, ['cadastros:consultar']);
    await page.goto('/');
    await expect(page.getByRole('navigation', { name: 'Módulos' }).getByRole('link')).toHaveText([
      'Cadastros',
    ]);
  });

  test('sem perfis:consultar mostra o estado neutro de sem permissão', async ({
    page,
    context,
  }) => {
    await entrarComPermissoes(context, ['fila:consultar']);
    await page.goto('/acesso/perfis');
    await expect(page.getByText('Acesso não permitido')).toBeVisible();
  });

  test('tela não é oferecida abaixo de 768 px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto('/acesso/perfis');
    await expect(page.getByText('disponível em telas a partir de 768 px')).toBeVisible();
    await expect(page.getByRole('table')).toBeHidden();
  });

  test('tela de perfis e modal sem violações de acessibilidade', async ({ page }) => {
    await abrirPerfil(page, 'Recepção');
    await semViolacoesDeAcessibilidade(page);
    await page.getByRole('button', { name: 'Excluir perfil' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await semViolacoesDeAcessibilidade(page);
  });
});
