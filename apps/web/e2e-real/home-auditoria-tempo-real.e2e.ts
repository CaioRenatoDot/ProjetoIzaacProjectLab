import { expect, type Page, test } from '@playwright/test';

import { SENHA_DO_SEED } from './ambiente';
import { abrirFilaDaNutricao, ADMIN, API, detalhes, emitirSenhaPelaApi, entrar } from './apoio';

/**
 * Pontos que seguiam fixos com a API real (#146): números da home, filtro e exportação da trilha
 * com um perfil sem permissão de perfis, e os canais de tempo real dos alertas e do atendimento.
 */
const GESTAO = 'gestao@clinica.invalid';

async function entrarComo(page: Page, identificacao: string) {
  await page.goto('/login');
  await page.getByLabel('Matrícula ou e-mail institucional').fill(identificacao);
  await page.getByRole('textbox', { name: 'Senha', exact: true }).fill(SENHA_DO_SEED);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('heading', { name: /Olá/ })).toBeVisible();
}

const dia = (deslocamento: number) =>
  new Date(Date.now() + deslocamento * 86_400_000).toISOString().slice(0, 10);

test('W-02: a home mostra as senhas aguardando e o bloco da fila', async ({ page, request }) => {
  const numero = await emitirSenhaPelaApi(request, 8);
  await entrar(page);

  await expect(
    page.getByRole('link', { name: /^Aguardando na fila: [1-9]\d* senhas?$/ }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: /^Triagens hoje: \d+ triagens?$/ })).toBeVisible();
  await expect(
    page.getByRole('link', { name: /^Em atendimento: \d+ atendimentos?$/ }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: /^Alertas de SLA: \d+ alertas?$/ })).toBeVisible();
  await expect(
    page.getByRole('list', { name: 'Fila resumida' }).getByRole('link', { name: /Nutrição/ }),
  ).toContainText(/[1-9]\d* aguardando/);

  // Tira a senha da fila, para os testes seguintes começarem sem ela.
  await abrirFilaDaNutricao(page);
  await page.getByRole('button', { name: 'Chamar próxima' }).click();
  const painel = await detalhes(page, numero);
  await painel.getByRole('button', { name: 'Registrar ausência' }).click();
  const modal = page.getByRole('dialog', { name: /Registrar ausência/ });
  await modal.getByRole('checkbox').check();
  await modal.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    page.getByText(new RegExp(`${numero}.*ausente|ausência.*${numero}`, 'i')).first(),
  ).toBeVisible();
});

test('T-18: perfil sem permissão de perfis filtra por usuário e exporta com período', async ({
  page,
}) => {
  await entrarComo(page, GESTAO);
  await page.goto('/auditoria');

  await expect(page.getByLabel('Usuário').getByRole('option', { name: /Gestão/ })).toHaveCount(1);
  await expect(page.getByText(/filtro por usuário/i)).toHaveCount(0);

  await page.getByRole('button', { name: 'Exportar resultado' }).click();
  await expect(page.getByText(/informe a data inicial e a final/).first()).toBeVisible();

  // A API roda com o relógio deslocado (relogio-deslocado.cjs): a janela cobre os dois relógios.
  await page.getByLabel('De', { exact: true }).fill(dia(-30));
  await page.getByLabel('Até', { exact: true }).fill(dia(30));
  await page.getByRole('button', { name: 'Aplicar filtros' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar resultado' }).click();
  expect((await download).suggestedFilename()).toMatch(/^trilha-auditoria-.+\.csv$/);
});

test('T-17: a tela de alertas conecta ao canal /alertas', async ({ page }) => {
  await entrarComo(page, GESTAO);
  const conexao = page.waitForEvent('websocket', (ws) => ws.url().includes('/socket.io/'));
  await page.goto('/indicadores/alertas');
  await conexao;

  await expect(page.getByRole('heading', { name: 'Alertas em aberto' })).toBeVisible();
  // Handshake recusado apareceria aqui: o canal exige `alertas:consultar` e token válido.
  await page.waitForTimeout(3_000);
  await expect(page.getByText(/Conexão perdida/)).toHaveCount(0);
});

test('T-13: pausa feita por outra pessoa aparece no atendimento aberto, sem recarregar', async ({
  page,
  request,
}) => {
  const numero = await emitirSenhaPelaApi(request, 9);
  await entrar(page);
  await abrirFilaDaNutricao(page);
  await page.getByRole('button', { name: 'Chamar próxima' }).click();
  await (await detalhes(page, numero)).getByRole('link', { name: 'Alocar recursos' }).click();
  await page.getByRole('button', { name: 'Confirmar alocação' }).click();
  await expect(page.getByText(`Recursos alocados à senha ${numero}:`).first()).toBeVisible();
  await abrirFilaDaNutricao(page);
  await (await detalhes(page, numero)).getByRole('link', { name: 'Iniciar atendimento' }).click();
  await page.getByRole('button', { name: 'Iniciar atendimento' }).click();
  await expect(page.getByRole('button', { name: 'Pausar' })).toBeVisible();

  const login = await request.post(`${API}/auth/login`, {
    data: { identificacao: ADMIN, senha: SENHA_DO_SEED },
  });
  const { accessToken } = (await login.json()) as { accessToken: string };
  const headers = { Authorization: `Bearer ${accessToken}` };
  const lista = await request.get(`${API}/atendimentos?status=EM_ATENDIMENTO&tamanho=100`, {
    headers,
  });
  const { dados } = (await lista.json()) as {
    dados: { id: string; numero: string; versao: number }[];
  };
  const atendimento = dados.find((a) => a.numero === numero)!;
  await page.waitForTimeout(1_000);
  const pausa = await request.post(`${API}/atendimentos/${atendimento.id}/pausa`, {
    headers,
    data: { versao: atendimento.versao, motivo: 'Pausa de outra pessoa (dado fictício)' },
  });
  expect(pausa.ok()).toBeTruthy();

  // A revalidação por HTTP é de 30 s: em menos de 10 s, só o evento explica a mudança.
  await expect(page.getByRole('button', { name: 'Retomar' })).toBeVisible({ timeout: 10_000 });

  await page.getByRole('button', { name: 'Retomar' }).click();
  await page.getByRole('button', { name: 'Encerrar atendimento' }).click();
  const encerrar = page.getByRole('dialog', { name: /Encerrar atendimento/ });
  await encerrar.getByRole('radio', { name: 'Alta' }).check();
  await encerrar.getByRole('button', { name: 'Encerrar' }).click();
  await expect(page.getByText('Encerrado', { exact: true }).first()).toBeVisible();
});
