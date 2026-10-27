import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function acessivel(page: Page) {
  const resultado = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag2aaa'])
    .analyze();
  expect(
    resultado.violations.map(
      (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
    ),
  ).toEqual([]);
}

async function contrasteMinimo(page: Page, seletor: string) {
  const razao = await page.locator(seletor).evaluate((elemento) => {
    const valores = (cor: string) => (cor.match(/[\d.]+/g) ?? []).map(Number);
    const luminancia = (cor: number[]) => {
      const linear = cor.slice(0, 3).map((canal) => {
        const c = canal / 255;
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return linear[0]! * 0.2126 + linear[1]! * 0.7152 + linear[2]! * 0.0722;
    };
    const frente = valores(getComputedStyle(elemento).color);
    let ancestral: Element | null = elemento;
    let fundo: number[] = [255, 255, 255];
    while (ancestral) {
      const atual = valores(getComputedStyle(ancestral).backgroundColor);
      if (atual.length === 3 || (atual[3] ?? 0) > 0) {
        fundo = atual;
        break;
      }
      ancestral = ancestral.parentElement;
    }
    const a = luminancia(frente),
      b = luminancia(fundo);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  });
  expect(razao).toBeGreaterThanOrEqual(7);
}

async function controlador(page: Page) {
  const controle = await page.context().newPage();
  await controle.goto('/demonstracao');
  return controle;
}
async function consultar(page: Page, numero: string) {
  await page.goto('/consulta');
  await page.getByLabel('Número da senha').fill(numero);
  await page.getByRole('button', { name: 'Consultar', exact: true }).click();
}

test('P-03: telão 1920×1080, número mínimo 96 px e só dados públicos', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'publico-demonstracao-42',
      JSON.stringify({
        conectado: true,
        painel: {
          atual: {
            numero: 'F014',
            especialidade: 'Fisioterapia',
            local: 'Sala 03',
            sequencia: 1,
            nomeCompleto: 'DADO_PROIBIDO',
            prioridade: 'URGENTE',
            motivo: 'SAUDE_PRIVADA',
            posicao: 4,
          },
          anteriores: [],
        },
      }),
    );
  });
  await page.goto('/telao');
  const numero = page.getByRole('heading', { name: 'F014', exact: true });
  await expect(numero).toBeVisible();
  expect(
    await numero.evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
  ).toBeGreaterThanOrEqual(96);
  await expect(page.getByText('DADO_PROIBIDO')).toHaveCount(0);
  await expect(page.getByText('URGENTE')).toHaveCount(0);
  await expect(page.getByText('SAUDE_PRIVADA')).toHaveCount(0);
  await expect(page.getByText('Sua posição')).toHaveCount(0);
  await acessivel(page);
  await contrasteMinimo(page, '.numero-atual');
  await contrasteMinimo(page, '.conexao-publica');
  await page.screenshot({ path: 'test-results/telao-1920.png' });
});

test('nova chamada move a anterior e mantém quatro; rechamada destaca e anuncia novamente', async ({
  page,
}) => {
  await page.goto('/telao');
  await expect(page.getByRole('heading', { name: 'F014', exact: true })).toBeVisible();
  const controle = await controlador(page);
  await controle.getByRole('button', { name: 'Nova chamada', exact: true }).click();
  const atual = page.getByRole('region', { name: 'Chamada atual', exact: true });
  await expect(atual.getByRole('heading', { name: 'F015', exact: true })).toBeVisible();
  const anteriores = page.getByRole('region', { name: 'Chamadas anteriores', exact: true });
  await expect(anteriores.getByRole('listitem')).toHaveCount(4);
  await expect(anteriores.getByRole('listitem').first()).toContainText('F014');
  await page.clock.install();
  await page.clock.fastForward(4100);
  await expect(atual).toHaveAttribute('data-destaque', 'false');
  await controle.getByRole('button', { name: 'Rechamar', exact: true }).click();
  await expect(atual).toHaveAttribute('data-destaque', 'true');
  await expect(page.getByRole('main').locator('[aria-live="assertive"]')).toContainText(
    'Chamada 2.',
  );
  await expect(anteriores.getByText('F015', { exact: true })).toHaveCount(0);
  await page.screenshot({ path: 'test-results/telao-chamada.png' });
});

test('queda mantém última chamada e reconexão aplica snapshot recebido', async ({ page }) => {
  await page.goto('/telao');
  await expect(page.getByRole('heading', { name: 'F014', exact: true })).toBeVisible();
  const controle = await controlador(page);
  await controle.getByRole('button', { name: 'Simular queda', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Conexão interrompida');
  await controle.getByRole('button', { name: 'Nova chamada', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'F014', exact: true })).toBeVisible();
  await page.clock.install();
  await page.clock.fastForward(60_000);
  await expect(page.getByRole('heading', { name: 'F014', exact: true })).toBeVisible();
  await controle.getByRole('button', { name: 'Reconectar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'F015', exact: true })).toBeVisible();
});

test('sem chamadas exibe mensagem neutra e relógio', async ({ page }) => {
  await page.goto('/telao');
  const controle = await controlador(page);
  await controle.getByRole('button', { name: 'Limpar chamadas', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Aguardando próximas chamadas' })).toBeVisible();
  await expect(page.getByLabel('Horário atual')).toBeVisible();
  await page.screenshot({ path: 'test-results/telao-vazio.png' });
});

test('consulta em 375 px com texto ampliado 200% não quebra e é acessível', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await consultar(page, 'F015');
  await expect(page.getByRole('heading', { name: 'F015', exact: true })).toBeVisible();
  await expect(page.getByText('4ª', { exact: true })).toBeVisible();
  await expect(page.getByText('~22 min', { exact: true })).toBeVisible();
  await acessivel(page);
  await contrasteMinimo(page, '.orientacao-consulta');
  await contrasteMinimo(page, '.formulario-consulta button');
  await page.screenshot({ path: 'test-results/consulta-375.png', fullPage: true });
  await page.addStyleTag({ content: 'html { font-size: 32px !important; }' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await page.getByRole('button', { name: 'Atualizar', exact: true }).focus();
  await expect(page.getByRole('button', { name: 'Atualizar', exact: true })).toBeFocused();
  await acessivel(page);
  await page.screenshot({ path: 'test-results/consulta-200.png', fullPage: true });
});

test('senha inexistente usa mensagem neutra', async ({ page }) => {
  await consultar(page, 'F999');
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'Não localizamos essa senha para o dia de hoje. Procure a recepção.',
  );
  await expect(page.getByRole('heading', { name: 'F999', exact: true })).toHaveCount(0);
});

test('sem estimativa só mostra posição; ausente e desistente orientam recepção', async ({
  page,
}) => {
  await consultar(page, 'F020');
  await expect(page.getByText('4ª', { exact: true })).toBeVisible();
  await expect(page.getByText('Tempo estimado', { exact: true })).toHaveCount(0);
  await expect(page.getByText(/Estimativa indisponível/)).toBeVisible();
  for (const numero of ['F021', 'F022']) {
    await page.getByLabel('Número da senha').fill(numero);
    await page.getByRole('button', { name: 'Consultar', exact: true }).click();
    await expect(page.getByRole('heading', { name: numero, exact: true })).toBeVisible();
    await expect(
      page.getByText('Procure a recepção para orientação.', { exact: true }),
    ).toBeVisible();
  }
});

test('consulta atualiza automaticamente quando a senha é chamada', async ({ page }) => {
  await page.clock.install();
  await consultar(page, 'F015');
  await expect(page.getByText('4ª', { exact: true })).toBeVisible();
  const controle = await controlador(page);
  await controle.getByRole('button', { name: 'Nova chamada', exact: true }).click();
  await page.bringToFront();
  await page.clock.runFor(30_000);
  await expect(page.getByText('Dirija-se a Sala 03.', { exact: true })).toBeVisible();
  await expect(page.getByText('Chamada', { exact: true })).toBeVisible();
});

test('rodapé fica abaixo das chamadas e dentro da tela em janelas de alturas diferentes', async ({
  page,
}) => {
  await page.goto('/telao');
  await expect(page.getByRole('heading', { name: 'F014', exact: true })).toBeVisible();
  for (const viewport of [
    { width: 1920, height: 1080 },
    { width: 1734, height: 976 },
    { width: 1366, height: 768 },
  ]) {
    await page.setViewportSize(viewport);
    const chamada = await page
      .getByRole('region', { name: 'Chamada atual', exact: true })
      .boundingBox();
    const historico = await page
      .getByRole('region', { name: 'Chamadas anteriores', exact: true })
      .boundingBox();
    const rodape = await page.locator('.telao-rodape').boundingBox();
    expect(rodape!.y).toBeGreaterThanOrEqual(
      Math.max(chamada!.y + chamada!.height, historico!.y + historico!.height) + 12,
    );
    expect(rodape!.y + rodape!.height).toBeLessThanOrEqual(viewport.height);
  }
});
