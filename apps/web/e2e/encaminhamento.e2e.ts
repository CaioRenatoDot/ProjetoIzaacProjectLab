import { expect, type Page } from '@playwright/test';

import { semViolacoesDeAcessibilidade, test } from './apoio';

/** Encerra o atendimento da N107 com o desfecho e segue para o encaminhamento (T-13 → T-14). */
async function encerrarCom(page: Page, desfecho: string) {
  await page.goto('/atendimento?senha=senha-n107');
  await page.getByRole('button', { name: 'Encerrar atendimento' }).click();
  const modal = page.getByRole('dialog', { name: /Encerrar atendimento/ });
  await modal.getByRole('radio', { name: desfecho }).check();
  await modal.getByRole('button', { name: 'Encerrar' }).click();
  await expect(page).toHaveURL(/\/encaminhamento\?atendimento=/);
}

test.describe('encaminhamento interno e externo (#46)', () => {
  test('desfecho interno encadeia para o encaminhamento e mostra a nova senha', async ({
    page,
  }) => {
    await encerrarCom(page, 'Encaminhamento interno');
    await expect(page.getByRole('heading', { name: 'Encaminhamento interno' })).toBeVisible();
    await page
      .getByLabel('Especialidade de destino (obrigatório)')
      .selectOption({ label: 'Fisioterapia' });
    await page.getByRole('button', { name: 'Confirmar encaminhamento' }).click();
    await expect(
      page.getByText('Encaminhamento registrado. Nova senha F019 na fila de Fisioterapia.'),
    ).toBeVisible();
  });

  test('externo sem instituição é bloqueado com a mensagem abaixo do campo', async ({ page }) => {
    await encerrarCom(page, 'Encaminhamento externo');
    await page.getByRole('button', { name: 'Confirmar encaminhamento' }).click();
    await expect(page.getByText('Informe a instituição ou o serviço.')).toBeVisible();
    await expect(page.getByLabel('Instituição ou serviço de destino (obrigatório)')).toBeFocused();
    await semViolacoesDeAcessibilidade(page);
  });

  test('interno com destino de chamadas suspensas, sem violações de acessibilidade', async ({
    page,
  }) => {
    await encerrarCom(page, 'Encaminhamento interno');
    await page
      .getByLabel('Especialidade de destino (obrigatório)')
      .selectOption({ label: 'Fonoaudiologia (chamadas suspensas)' });
    await expect(page.getByText(/O encaminhamento continua permitido/)).toBeVisible();
    await semViolacoesDeAcessibilidade(page);
  });

  test('"Encaminhamento" no menu explica de onde o registro parte', async ({ page }) => {
    await page.goto('/');
    await page
      .getByRole('navigation', { name: 'Módulos' })
      .getByRole('link', { name: 'Encaminhamento' })
      .click();
    await expect(page.getByText('Nenhum encaminhamento em registro')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Ver atendimentos' })).toHaveAttribute(
      'href',
      '/atendimento',
    );
  });
});
