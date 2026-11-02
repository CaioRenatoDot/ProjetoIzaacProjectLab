import { expect, type Page, test } from '@playwright/test';

import {
  abrirFilaDaNutricao,
  chamarComRecursos,
  detalhes,
  emitirSenhaPelaApi,
  entrar,
} from './apoio';

/**
 * Aviso de impacto da W-04 pelo 409 IMPACTO_EM_USO da API (#79, #140). Aloca uma senha da
 * Nutrição, o que ocupa a Sala 04, e edita a sala. No fim, libera a sala com uma ausência, para o
 * fluxo da demonstração (que roda depois e usa a mesma sala) começar do zero.
 */
async function mudarSituacaoDaSala04(page: Page, situacao: string) {
  await page.goto('/cadastros/salas');
  await page.getByRole('table').getByRole('link', { name: 'Editar Sala 04' }).click();
  await page.getByLabel(/^Situação/).selectOption(situacao);
  await page.getByRole('button', { name: 'Salvar' }).click();
}

test('T-04: editar sala alocada pede a confirmação da API; sem uso, grava direto', async ({
  page,
  request,
}) => {
  const numero = await emitirSenhaPelaApi(request, 7);
  await entrar(page);
  await abrirFilaDaNutricao(page);
  await chamarComRecursos(page, numero);

  // Em uso: a API recusa sem `?confirmar=true` e a tela mostra o uso que ela descreveu.
  await mudarSituacaoDaSala04(page, 'Indisponível');
  const confirmacao = page.getByRole('dialog', { name: 'A alteração afeta alocações em curso' });
  await expect(confirmacao).toContainText(`Sala em uso nas senhas ${numero}`);
  await confirmacao.getByRole('button', { name: 'Salvar mesmo assim' }).click();
  await expect(page.getByText('Sala atualizada.').first()).toBeVisible();

  // A ausência libera os recursos alocados (UC-16).
  await abrirFilaDaNutricao(page);
  await (await detalhes(page, numero)).getByRole('button', { name: 'Registrar ausência' }).click();
  const ausencia = page.getByRole('dialog', { name: `Registrar ausência — senha ${numero}` });
  await ausencia.getByRole('checkbox').check();
  await ausencia.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // Sem uso: grava direto, sem confirmação.
  await mudarSituacaoDaSala04(page, 'Disponível');
  await expect(page.getByText('Sala atualizada.').first()).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
