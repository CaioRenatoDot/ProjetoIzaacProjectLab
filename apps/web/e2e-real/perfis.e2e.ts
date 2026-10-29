import { expect, type Page, test } from '@playwright/test';

import { SENHA_DO_SEED } from './ambiente';

/** Tela de perfis (W-05, #133) com API e banco reais: o perfil grava e vale no login. */
const API = 'http://localhost:3333/api/v1';
const ADMIN = 'admin@clinica.invalid';
const NOVO_PERFIL = 'Consulta de cadastros do teste real';

test.describe.configure({ mode: 'serial' });

async function entrar(page: Page, identificacao: string, senha: string) {
  await page.goto('/login');
  await page.getByLabel('Matrícula ou e-mail institucional').fill(identificacao);
  await page.getByRole('textbox', { name: 'Senha', exact: true }).fill(senha);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('heading', { name: /Olá/ })).toBeVisible();
}

async function abrirPerfil(page: Page, nome: string) {
  await page.goto('/acesso/perfis');
  await page.getByRole('button', { name: new RegExp(`^${nome}`) }).click();
}

test('UC-04: perfil criado na tela fica gravado e define o menu de quem o usa', async ({
  page,
  browser,
  request,
}) => {
  await entrar(page, ADMIN, SENHA_DO_SEED);
  await page.goto('/acesso/perfis');
  await page.getByRole('button', { name: 'Novo perfil' }).click();
  await page.getByLabel('Nome').fill(NOVO_PERFIL);
  await page.getByRole('checkbox', { name: 'Cadastros — Consultar' }).check();
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByText(`Perfil "${NOVO_PERFIL}" salvo.`).first()).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: new RegExp(`^${NOVO_PERFIL}`) })).toBeVisible();

  // Usuário com o perfil novo (não há tela de usuários no MVP): criado pela API.
  const login = await request.post(`${API}/auth/login`, {
    data: { identificacao: ADMIN, senha: SENHA_DO_SEED },
  });
  const { accessToken } = (await login.json()) as { accessToken: string };
  const headers = { Authorization: `Bearer ${accessToken}` };
  const perfis = (await (await request.get(`${API}/perfis?tamanho=100`, { headers })).json()) as {
    dados: { id: string; nome: string }[];
  };
  const perfilId = perfis.dados.find((p) => p.nome === NOVO_PERFIL)!.id;
  const usuario = await request.post(`${API}/usuarios`, {
    headers,
    data: {
      nome: 'Usuário de teste real (fictício)',
      identificacao: 'consulta-cadastros@clinica.invalid',
      senhaInicial: 'senha-do-teste-real',
      perfilId,
    },
  });
  expect(usuario.status()).toBe(201);

  const outra = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const paginaDoUsuario = await outra.newPage();
  await entrar(paginaDoUsuario, 'consulta-cadastros@clinica.invalid', 'senha-do-teste-real');
  await expect(
    paginaDoUsuario.getByRole('navigation', { name: 'Módulos' }).getByRole('link'),
  ).toHaveText(['Cadastros']);
  await outra.close();
});

test('perfil em uso: avisa os usuários afetados e não pode ser excluído', async ({ page }) => {
  await entrar(page, ADMIN, SENHA_DO_SEED);

  // O seed tem 2 usuários com o perfil Recepção.
  await abrirPerfil(page, 'Recepção');
  await page.getByRole('checkbox', { name: 'Fila — Excluir' }).check();
  await page.getByRole('button', { name: 'Salvar' }).click();
  const confirmacao = page.getByRole('dialog', { name: 'Confirmar alteração do perfil' });
  await expect(confirmacao).toContainText('muda as permissões de 2 usuários');
  await page.keyboard.press('Escape');

  await abrirPerfil(page, 'Recepção');
  await page.getByRole('button', { name: 'Excluir perfil' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Excluir perfil' }).click();
  await expect(
    page.getByRole('region', { name: /Notificações/ }).getByText(/vinculado a 2 usuário/),
  ).toBeVisible();
});
