import { expect, type Page } from '@playwright/test';

import { semViolacoesDeAcessibilidade, test } from './apoio';

async function preencherPaciente(page: Page, documento: string) {
  await page.getByLabel('Nome completo (obrigatório)').fill('Paciente de Teste');
  await page.getByLabel('Documento (obrigatório)').fill(documento);
  await page.getByLabel('Data de nascimento (obrigatório)').fill('1990-05-10');
  await page.getByLabel('Vínculo (obrigatório)').selectOption({ label: 'Aluno' });
}

test.describe('formulário genérico de cadastros (#38)', () => {
  test('"Novo paciente" na lista cadastra e volta para a lista', async ({ page }) => {
    await page.goto('/cadastros/pacientes');
    await page.getByRole('link', { name: 'Novo paciente' }).click();
    await expect(page.getByRole('heading', { name: 'Novo paciente' })).toBeVisible();

    await preencherPaciente(page, '111.222.333-44');
    await page.getByRole('button', { name: 'Salvar' }).click();

    await expect(page).toHaveURL('/cadastros/pacientes');
    await expect(page.getByText('Paciente cadastrado.', { exact: true })).toBeVisible();
    await expect(page.getByRole('table').getByText('Paciente de Teste')).toBeVisible();
  });

  test('documento repetido mostra a duplicidade com link para o existente', async ({ page }) => {
    await page.goto('/cadastros/pacientes/novo');
    await preencherPaciente(page, '000.000.100-00');
    await page.getByRole('button', { name: 'Salvar' }).click();

    await page.getByRole('link', { name: 'Abrir o cadastro existente' }).click();
    await expect(page).toHaveURL('/cadastros/pacientes/paciente-1');
    await expect(page.getByLabel('Nome completo (obrigatório)')).toHaveValue('Ana Alves Cardoso');
  });

  test('"Editar" na lista abre o formulário preenchido', async ({ page }) => {
    await page.goto('/cadastros/salas');
    await page.getByRole('table').getByRole('link', { name: 'Editar Sala 02' }).click();
    await expect(page.getByRole('heading', { name: 'Editar sala' })).toBeVisible();
    await expect(page.getByLabel('Identificação (obrigatório)')).toHaveValue('Sala 02');
  });

  test('"Cancelar" com alterações pede confirmação de descarte', async ({ page }) => {
    await page.goto('/cadastros/especialidades/novo');
    await page.getByLabel('Nome (obrigatório)').fill('Terapia ocupacional');
    await page.getByRole('button', { name: 'Cancelar' }).click();
    const dialogo = page.getByRole('dialog', { name: 'Descartar alterações?' });
    await dialogo.getByRole('button', { name: 'Descartar' }).click();
    await expect(page).toHaveURL('/cadastros/especialidades');
  });

  test('triagem sem resultado leva ao cadastro e volta para a triagem', async ({ page }) => {
    await page.goto('/triagem');
    await page.getByLabel('Nome ou documento').fill('ninguém com esse nome');
    await page.getByRole('button', { name: 'Buscar' }).click();
    await page.getByRole('link', { name: 'Cadastrar novo paciente' }).click();
    await expect(page).toHaveURL('/cadastros/pacientes/novo?voltar=/triagem');

    await preencherPaciente(page, '555.666.777-88');
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(page).toHaveURL('/triagem');
  });

  test('seleção múltipla filtra e marca por teclado', async ({ page }) => {
    await page.goto('/cadastros/estudantes/novo');
    const grupo = page.getByRole('group', { name: 'Habilitações (obrigatório)' });
    await grupo.getByRole('searchbox').fill('infantil');
    await expect(grupo.getByRole('checkbox')).toHaveCount(1);
    await page.keyboard.press('Tab');
    await page.keyboard.press('Space');
    await expect(grupo.getByRole('checkbox', { name: 'Atendimento infantil' })).toBeChecked();
  });

  test('formulários sem violações de acessibilidade', async ({ page }) => {
    for (const rota of ['/cadastros/pacientes/novo', '/cadastros/estudantes/novo']) {
      await page.goto(rota);
      await expect(page.getByRole('button', { name: 'Salvar' })).toBeVisible();
      await semViolacoesDeAcessibilidade(page);
    }
  });

  test('em 375 px o formulário fica em coluna única, sem rolagem horizontal', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto('/cadastros/supervisores/novo');
    await expect(page.getByRole('button', { name: 'Salvar' })).toBeVisible();
    const rolagem = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(rolagem).toBeLessThanOrEqual(0);
  });
});
