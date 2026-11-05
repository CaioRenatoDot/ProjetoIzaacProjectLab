import { expect, test } from '@playwright/test';

test('RNF-06: arquivo real toca ao ativar, chamar e rechamar, sem sobreposição', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'play')!.value as (
      this: HTMLMediaElement,
    ) => Promise<void>;
    const contagem = { iniciados: 0, encerrados: 0, sobrepostos: 0 };
    Object.assign(window, { somTeste: contagem });
    HTMLMediaElement.prototype.play = function () {
      if (!this.paused && !this.ended) contagem.sobrepostos++;
      contagem.iniciados++;
      this.addEventListener(
        'ended',
        () => {
          contagem.encerrados++;
        },
        { once: true },
      );
      return original.call(this);
    };
  });
  const dados = () =>
    page.evaluate(
      () =>
        (
          window as unknown as {
            somTeste: { iniciados: number; encerrados: number; sobrepostos: number };
          }
        ).somTeste,
    );
  await page.goto('/telao?volume=0.2&voz=0');
  const som = page.getByRole('button', { name: 'Ativar som', exact: true });
  await som.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Som ativado.', { exact: true })).toBeVisible();
  await expect.poll(async () => (await dados()).encerrados).toBe(1);
  const controle = await page.context().newPage();
  await controle.goto('/demonstracao');
  await controle.getByRole('button', { name: 'Nova chamada', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'F015' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Chamada atual' })).toHaveAttribute(
    'data-destaque',
    'true',
  );
  await controle.getByRole('button', { name: 'Rechamar', exact: true }).click();
  await expect.poll(async () => (await dados()).encerrados).toBe(3);
  expect((await dados()).sobrepostos).toBe(0);
  await page.screenshot({ path: 'test-results/telao-som-ativo.png' });
});

test('#157: depois do sinal, a chamada e a rechamada são faladas duas vezes', async ({ page }) => {
  await page.addInitScript(() => {
    const falas: string[] = [];
    Object.assign(window, { falas });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      value: class {
        onend: (() => void) | null = null;
        constructor(readonly text: string) {}
      },
    });
    Object.defineProperty(window, 'speechSynthesis', {
      value: {
        getVoices: () => [{ lang: 'pt-BR', localService: true }],
        cancel: () => {},
        speak(frase: { text: string; onend: () => void }) {
          falas.push(frase.text);
          setTimeout(() => frase.onend(), 10);
        },
      },
    });
  });
  const falas = () => page.evaluate(() => (window as unknown as { falas: string[] }).falas);
  await page.goto('/telao?volume=0.2');
  await page.getByRole('button', { name: 'Ativar som', exact: true }).click();
  await expect.poll(falas).toEqual(['Som ativado.', 'Som ativado.']);

  const controle = await page.context().newPage();
  await controle.goto('/demonstracao');
  await controle.getByRole('button', { name: 'Nova chamada', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'F015' })).toBeVisible();
  const frase = 'Senha efe, zero, um, cinco. Fisioterapia. Sala 3.';
  await expect
    .poll(falas, { timeout: 10_000 })
    .toEqual(['Som ativado.', 'Som ativado.', frase, frase]);

  await controle.getByRole('button', { name: 'Rechamar', exact: true }).click();
  await expect.poll(async () => (await falas()).length, { timeout: 10_000 }).toBe(6);
  expect((await falas()).slice(4)).toEqual([frase, frase]);
});

test('RNF-06: som desligado não reproduz arquivo e preserva o telão', async ({ page }) => {
  const arquivos: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/sons/')) arquivos.push(request.url());
  });
  await page.goto('/telao?som=0');
  await expect(page.getByText('Som desativado na configuração.')).toBeVisible();
  const controle = await page.context().newPage();
  await controle.goto('/demonstracao');
  await controle.getByRole('button', { name: 'Nova chamada', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'F015' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ativar som', exact: true })).toHaveCount(0);
  expect(arquivos).toEqual([]);
});

test('RNF-06: erro de áudio oferece nova tentativa sem interromper chamadas', async ({ page }) => {
  await page.goto('/telao?somArquivo=/sons/inexistente.wav');
  await page.getByRole('button', { name: 'Ativar som', exact: true }).click();
  await expect(
    page.getByText('Não foi possível tocar o som. Verifique o áudio e tente ativar novamente.'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ativar som', exact: true })).toBeEnabled();
  const controle = await page.context().newPage();
  await controle.goto('/demonstracao');
  await controle.getByRole('button', { name: 'Nova chamada', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'F015' })).toBeVisible();
});
