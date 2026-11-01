import { expect } from '@playwright/test';

import { semViolacoesDeAcessibilidade, test } from './apoio';

test.describe('atendimento e encerramento (#44)', () => {
  test('"Iniciar atendimento" no painel da fila abre a senha alocada e inicia', async ({
    page,
  }) => {
    await page.goto('/fila');
    const seletor = page.getByLabel('Especialidade');
    await expect(seletor).toBeVisible();
    await seletor.selectOption({ label: 'Nutrição' });
    await page.getByRole('button', { name: 'Detalhes da senha N105' }).click();
    await page
      .getByRole('dialog', { name: 'Detalhes da senha N105' })
      .getByRole('link', { name: 'Iniciar atendimento' })
      .click();

    await expect(page).toHaveURL('/atendimento?senha=senha-n105');
    await page.getByRole('button', { name: 'Iniciar atendimento' }).click();
    await expect(
      page.getByRole('heading', { name: /Atendimento: senha N105 · Sala 02/ }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Encerrar atendimento' })).toBeVisible();
  });

  test('RN-11: encerrar com validação exigida deixa a senha pendente de validação', async ({
    page,
  }) => {
    await page.goto('/atendimento?senha=senha-f016');
    await expect(page.getByRole('region', { name: 'Dados da triagem' })).toContainText(
      'registrada na trilha de auditoria',
    );
    await page.getByRole('button', { name: 'Encerrar atendimento' }).click();
    const modal = page.getByRole('dialog', { name: /Encerrar atendimento/ });
    await modal.getByRole('button', { name: 'Encerrar' }).click();
    await expect(modal.getByText('Escolha o desfecho para encerrar o atendimento.')).toBeVisible();

    await modal.getByRole('radio', { name: 'Alta' }).check();
    await modal.getByRole('button', { name: 'Encerrar' }).click();
    await expect(page.getByRole('region', { name: 'Validação do supervisor' })).toBeVisible();
    await expect(page.getByText('Pendente de validação').first()).toBeVisible();
  });

  test('RN-11: recusa do supervisor mantém o status e registra o parecer', async ({ page }) => {
    await page.goto('/atendimento?senha=senha-n109');
    const painel = page.getByRole('region', { name: 'Validação do supervisor' });
    await painel.getByLabel('Parecer do supervisor').fill('Completar as observações do desfecho.');
    await painel.getByRole('button', { name: 'Recusar validação' }).click();
    await expect(page.getByText('Completar as observações do desfecho.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Corrigir encerramento' })).toBeVisible();
  });

  test('atendimento e encerramento sem violações de acessibilidade', async ({ page }) => {
    await page.goto('/atendimento?senha=senha-f016');
    await expect(page.getByRole('button', { name: 'Pausar' })).toBeVisible();
    await semViolacoesDeAcessibilidade(page);
    await page.getByRole('button', { name: 'Encerrar atendimento' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await semViolacoesDeAcessibilidade(page);
  });

  test('"Atendimento" no menu lista os atendimentos em curso', async ({ page }) => {
    await page.goto('/');
    await page
      .getByRole('navigation', { name: 'Módulos' })
      .getByRole('link', { name: 'Atendimento' })
      .click();
    await expect(page).toHaveURL('/atendimento');
    await expect(page.getByRole('link', { name: 'F016' })).toBeVisible();
    await semViolacoesDeAcessibilidade(page);
  });
});
