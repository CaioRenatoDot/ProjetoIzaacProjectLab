import { expect, type APIRequestContext, type Page, test } from '@playwright/test';

import { semViolacoesDeAcessibilidade } from '../e2e/apoio';
import { SENHA_DO_SEED } from './ambiente';

/**
 * Fluxo da demonstração do MVP (docs/06-etapas.md) com API e banco reais (#52). Nutrição não exige
 * supervisor nem validação do encerramento, e a API roda numa segunda às 14h, quando o seed tem
 * estudante de Nutrição no turno (relogio-deslocado.cjs).
 */
const API = 'http://localhost:3333/api/v1';
const TELAO = 'http://localhost:3001/telao';
const ADMIN = 'admin@clinica.invalid';
// IDs fixos do seed (apps/api/prisma/seed/dados.ts).
const NUTRICAO = '01900000-0000-7000-8000-000600000003';
const pacienteDoSeed = (n: number) => `01900000-0000-7000-8000-0010${String(n).padStart(8, '0')}`;

test.describe.configure({ mode: 'serial' });

async function entrar(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Matrícula ou e-mail institucional').fill(ADMIN);
  await page.getByRole('textbox', { name: 'Senha', exact: true }).fill(SENHA_DO_SEED);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('heading', { name: /Olá/ })).toBeVisible();
}

async function abrirFilaDaNutricao(page: Page) {
  await page.goto('/fila');
  await page.getByLabel('Especialidade').selectOption({ label: 'Nutrição' });
}

async function detalhes(page: Page, numero: string) {
  await page.getByRole('button', { name: `Detalhes da senha ${numero}`, exact: true }).click();
  return page.getByRole('dialog', { name: `Detalhes da senha ${numero}`, exact: true });
}

/** Triagem e emissão direto pela API, para os fluxos alternativos começarem da fila. */
async function emitirSenhaPelaApi(request: APIRequestContext, paciente: number) {
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

test('MVP: cadastro → triagem → senha → chamada no telão → alocação → atendimento encerrado', async ({
  page,
  context,
}) => {
  await entrar(page);

  // Cadastro do paciente (UC-01)
  const documento = `9${Date.now()}`.slice(0, 11);
  await page.goto('/cadastros/pacientes/novo');
  await page.getByLabel('Nome completo (obrigatório)').fill('Paciente Fluxo Real');
  await page.getByLabel('Documento (obrigatório)').fill(documento);
  await page.getByLabel('Data de nascimento (obrigatório)').fill('1990-05-10');
  await page.getByLabel('Vínculo (obrigatório)').selectOption({ label: 'Aluno' });
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByText('Paciente cadastrado.', { exact: true })).toBeVisible();

  // Triagem e emissão da senha (UC-05, UC-06)
  await page.goto('/triagem');
  await page.getByLabel('Nome ou documento').fill(documento);
  await page.getByRole('button', { name: 'Buscar' }).click();
  await page.getByRole('button', { name: /Selecionar paciente P\. F\. R\./ }).click();
  await page.getByLabel(/Especialidade de destino/).selectOption({ label: 'Nutrição' });
  await page.getByLabel(/Motivo do atendimento/).fill('Reeducação alimentar (dado fictício)');
  await page.getByRole('button', { name: 'Concluir triagem' }).click();
  await page.getByRole('button', { name: 'Confirmar emissão' }).click();
  const senhaEmitida = page.getByLabel(/^Senha N\d{3}$/);
  await expect(senhaEmitida).toBeVisible();
  const numero = (await senhaEmitida.getAttribute('aria-label'))!.replace('Senha ', '');

  // Telão aberto antes da chamada, como na sala de espera
  const telao = await context.newPage();
  await telao.goto(TELAO);

  // Chamada (UC-09): a senha aparece no telão sem recarregar
  await abrirFilaDaNutricao(page);
  await page.getByRole('button', { name: 'Chamar próxima' }).click();
  await expect(
    page
      .getByRole('region', { name: /^Chamada/ })
      .getByRole('article', { name: `Senha ${numero}` }),
  ).toBeVisible();
  await expect(telao.getByText(numero).first()).toBeVisible();
  await expect(telao.getByText('Paciente Fluxo Real')).toHaveCount(0);

  // Alocação (UC-10) com as sugestões do sistema
  await (await detalhes(page, numero)).getByRole('link', { name: 'Alocar recursos' }).click();
  await expect(
    page.getByRole('heading', { name: `Alocação de recursos: senha ${numero}` }),
  ).toBeVisible();
  await semViolacoesDeAcessibilidade(page);
  await page.getByRole('button', { name: 'Confirmar alocação' }).click();
  await expect(page.getByText(`Recursos alocados à senha ${numero}:`).first()).toBeVisible();

  // Atendimento (UC-11) e encerramento com desfecho (UC-13)
  await abrirFilaDaNutricao(page);
  await (await detalhes(page, numero)).getByRole('link', { name: 'Iniciar atendimento' }).click();
  await page.getByRole('button', { name: 'Iniciar atendimento' }).click();
  await expect(
    page.getByRole('heading', { name: new RegExp(`Atendimento: senha ${numero}`) }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Encerrar atendimento' }).click();
  const encerrar = page.getByRole('dialog', { name: /Encerrar atendimento/ });
  await encerrar.getByRole('radio', { name: 'Alta' }).check();
  await encerrar.getByRole('button', { name: 'Encerrar' }).click();
  await expect(page.getByText('Encerrado', { exact: true }).first()).toBeVisible();
});

test('ausência manual (UC-16): senha chamada sai da fila como ausente', async ({
  page,
  request,
}) => {
  const numero = await emitirSenhaPelaApi(request, 5);
  await entrar(page);
  await abrirFilaDaNutricao(page);
  await page.getByRole('button', { name: 'Chamar próxima' }).click();

  await (await detalhes(page, numero)).getByRole('button', { name: 'Registrar ausência' }).click();
  const modal = page.getByRole('dialog', { name: `Registrar ausência — senha ${numero}` });
  await expect(modal.getByText(/Restam/)).toBeVisible();
  await modal.getByRole('checkbox').check();
  await modal.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    page.getByText(new RegExp(`${numero}.*ausente|ausência.*${numero}`, 'i')).first(),
  ).toBeVisible();
});

test('desistência (UC-17): senha aguardando sai da fila ativa', async ({ page, request }) => {
  const numero = await emitirSenhaPelaApi(request, 6);
  await entrar(page);
  await abrirFilaDaNutricao(page);

  await (
    await detalhes(page, numero)
  )
    .getByRole('button', { name: 'Registrar desistência' })
    .click();
  const modal = page.getByRole('dialog', { name: `Registrar desistência — senha ${numero}` });
  await modal.getByLabel('Paciente').check();
  await modal.getByLabel('Motivo da desistência (opcional)').fill('Precisou sair (dado fictício).');
  await modal.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await expect(page.getByText(/A senha saiu da fila ativa/).first()).toBeVisible();
  await expect(
    page
      .getByRole('region', { name: /^Aguardando/ })
      .getByRole('article', { name: `Senha ${numero}` }),
  ).toHaveCount(0);
});
