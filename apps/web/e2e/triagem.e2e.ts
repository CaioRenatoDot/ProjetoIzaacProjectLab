import { expect, type Page } from '@playwright/test';

import { entrarComPermissoes, semViolacoesDeAcessibilidade, test } from './apoio';

async function buscarEAbrirFicha(page: Page, termo = 'maria') {
  await page.goto('/triagem');
  await page.getByLabel('Nome ou documento').fill(termo);
  await page.getByRole('button', { name: 'Buscar' }).click();
  await page.getByRole('button', { name: /Selecionar paciente M\. A\. S\./ }).click();
  await expect(page.getByRole('heading', { name: /Triagem: ficha de M\. A\. S\./ })).toBeFocused();
}

async function preencherFicha(page: Page) {
  await page.getByLabel(/Especialidade de destino/).selectOption({ label: 'Fisioterapia' });
  await page.getByLabel(/Motivo do atendimento/).fill('Dor lombar há duas semanas');
}

test.describe('triagem e emissão de senha (#39, #40)', () => {
  test('fluxo completo: busca, ficha, emissão e senha em destaque', async ({ page }) => {
    await buscarEAbrirFicha(page);
    await preencherFicha(page);
    await page.getByRole('button', { name: 'Concluir triagem' }).click();

    await expect(page.getByRole('heading', { name: 'Triagem: emitir senha' })).toBeFocused();
    await expect(page.getByText('Dor lombar')).toHaveCount(0);
    await page.getByRole('button', { name: 'Confirmar emissão' }).click();

    await expect(page.getByRole('heading', { name: 'Senha emitida' })).toBeVisible();
    await expect(page.getByLabel(/^Senha [A-Z]\d{3}$/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Imprimir senha' })).toBeVisible();
    await page.getByRole('button', { name: 'Nova triagem' }).click();
    await expect(page.getByRole('heading', { name: 'Triagem: buscar paciente' })).toBeFocused();
  });

  test('RN-03: urgente sem justificativa clínica bloqueia e leva o foco ao campo', async ({
    page,
  }) => {
    await buscarEAbrirFicha(page);
    await preencherFicha(page);
    await page.getByLabel(/^Prioridade/).selectOption('URGENTE');
    await page.getByRole('button', { name: 'Concluir triagem' }).click();

    const campo = page.getByLabel(/Justificativa clínica/);
    await expect(
      page.getByText('Justificativa é obrigatória para prioridade Urgente.'),
    ).toBeVisible();
    await expect(campo).toBeFocused();
    await expect(campo).toHaveAttribute('aria-invalid', 'true');
  });

  test('RN-02: enquadramento legal marca Preferencial', async ({ page }) => {
    await buscarEAbrirFicha(page);
    await page.getByLabel('Enquadramento legal').selectOption('IDOSO');
    await expect(page.getByLabel(/^Prioridade/)).toHaveValue('PREFERENCIAL');
    await expect(page.getByRole('status').filter({ hasText: 'Preferencial' })).toBeVisible();
  });

  test('RN-13: paciente com restrição mostra o banner e a triagem continua permitida', async ({
    page,
  }) => {
    await page.goto('/triagem');
    await page.getByLabel('Nome ou documento').fill('joão');
    await page.getByRole('button', { name: 'Buscar' }).click();
    await page.getByRole('button', { name: /Selecionar paciente J\. P\. O\./ }).click();
    await expect(page.getByText('Paciente com restrição por ausências repetidas.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Concluir triagem' })).toBeEnabled();
  });

  test('busca sem resultado oferece cadastrar novo paciente', async ({ page }) => {
    await page.goto('/triagem');
    await page.getByLabel('Nome ou documento').fill('zzz');
    await page.getByRole('button', { name: 'Buscar' }).click();
    await expect(page.getByRole('link', { name: 'Cadastrar novo paciente' })).toBeVisible();
  });

  test('RN-10: especialidade bloqueada emite e avisa que a chamada está suspensa', async ({
    page,
  }) => {
    await buscarEAbrirFicha(page);
    await page.getByLabel(/Especialidade de destino/).selectOption({ label: 'Psicologia' });
    await page.getByLabel(/Motivo do atendimento/).fill('Ansiedade');
    await page.getByRole('button', { name: 'Concluir triagem' }).click();
    await page.getByRole('button', { name: 'Confirmar emissão' }).click();
    await expect(page.getByText(/chamada desta especialidade está suspensa/)).toBeVisible();
  });

  test('RN-01: reclassificar exige justificativa e informa a nova posição', async ({ page }) => {
    await buscarEAbrirFicha(page);
    await preencherFicha(page);
    await page.getByRole('button', { name: 'Concluir triagem' }).click();
    await page.getByRole('button', { name: 'Confirmar emissão' }).click();

    const abrir = page.getByRole('button', { name: 'Reclassificar prioridade' });
    await abrir.click();
    const dialogo = page.getByRole('dialog');
    await expect(dialogo.getByText('Nenhuma reclassificação anterior.')).toBeVisible();
    const confirmar = dialogo.getByRole('button', { name: 'Confirmar' });
    await expect(confirmar).toBeDisabled();

    await dialogo.getByLabel('Nova prioridade').selectOption('URGENTE');
    await dialogo.getByLabel('Justificativa').fill('Agravamento identificado após a triagem');
    await confirmar.click();
    await expect(dialogo).toBeHidden();
    await expect(
      page.getByRole('region', { name: /Notificações/ }).getByText(/Nova posição: 1\./),
    ).toBeVisible();
    await expect(abrir).toBeFocused();
  });

  test('sem triagem:criar mostra o estado neutro de sem permissão', async ({ page, context }) => {
    await entrarComPermissoes(context, ['fila:consultar']);
    await page.goto('/triagem');
    await expect(page.getByText('Acesso não permitido')).toBeVisible();
  });

  test('cada etapa e o modal não têm violações de acessibilidade', async ({ page }) => {
    await page.goto('/triagem');
    await semViolacoesDeAcessibilidade(page);

    await page.getByLabel('Nome ou documento').fill('maria');
    await page.getByRole('button', { name: 'Buscar' }).click();
    await page.getByRole('button', { name: /Selecionar paciente M\. A\. S\./ }).click();
    await semViolacoesDeAcessibilidade(page);

    await page.getByLabel(/^Prioridade/).selectOption('URGENTE');
    await semViolacoesDeAcessibilidade(page);
    await page.getByLabel(/^Prioridade/).selectOption('NORMAL');

    await preencherFicha(page);
    await page.getByRole('button', { name: 'Concluir triagem' }).click();
    await semViolacoesDeAcessibilidade(page);
    await page.getByRole('button', { name: 'Confirmar emissão' }).click();
    await semViolacoesDeAcessibilidade(page);

    await page.getByRole('button', { name: 'Reclassificar prioridade' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await semViolacoesDeAcessibilidade(page);
  });
});
