import { type APIRequestContext, expect, type Page } from '@playwright/test';

import { SENHA_DO_SEED } from './ambiente';

/** Apoio dos testes com API e banco reais. IDs fixos do seed (apps/api/prisma/seed/dados.ts). */
export const API = 'http://localhost:3333/api/v1';
export const ADMIN = 'admin@clinica.invalid';
export const NUTRICAO = '01900000-0000-7000-8000-000600000003';
export const pacienteDoSeed = (n: number) =>
  `01900000-0000-7000-8000-0010${String(n).padStart(8, '0')}`;

export async function entrar(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Matrícula ou e-mail institucional').fill(ADMIN);
  await page.getByRole('textbox', { name: 'Senha', exact: true }).fill(SENHA_DO_SEED);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('heading', { name: /Olá/ })).toBeVisible();
}

export async function abrirFilaDaNutricao(page: Page) {
  await page.goto('/fila');
  await page.getByLabel('Especialidade').selectOption({ label: 'Nutrição' });
}

export async function detalhes(page: Page, numero: string) {
  await page.getByRole('button', { name: `Detalhes da senha ${numero}`, exact: true }).click();
  return page.getByRole('dialog', { name: `Detalhes da senha ${numero}`, exact: true });
}

/** Triagem e emissão direto pela API, para o teste começar da fila. */
export async function emitirSenhaPelaApi(request: APIRequestContext, paciente: number) {
  const login = await request.post(`${API}/auth/login`, {
    data: { identificacao: ADMIN, senha: SENHA_DO_SEED },
  });
  expect(login.ok()).toBeTruthy();
  const { accessToken } = (await login.json()) as { accessToken: string };
  const headers = { Authorization: `Bearer ${accessToken}` };

  const triagem = await request.post(`${API}/triagens`, {
    headers,
    data: {
      pacienteId: pacienteDoSeed(paciente),
      especialidadeDestinoId: NUTRICAO,
      tipoAtendimento: 'PRIMEIRA_CONSULTA',
      prioridade: 'NORMAL',
      motivo: 'Acompanhamento nutricional (dado fictício)',
    },
  });
  expect(triagem.status()).toBe(201);
  const { id: triagemId } = (await triagem.json()) as { id: string };

  const senha = await request.post(`${API}/senhas`, { headers, data: { triagemId } });
  expect(senha.status()).toBe(201);
  return ((await senha.json()) as { numero: string }).numero;
}
