import { expect, type Page, test } from '@playwright/test';

import { entrar } from './apoio';

/**
 * Os cinco cadastros base (W-03, W-04) contra a API real (#142): criar e editar pela tela, com os
 * itens de apoio do seed (Fisioterapia, Terapia manual, Cinesioterapia, Maca).
 */
test.describe.configure({ mode: 'serial' });

async function salvarEVoltar(page: Page, mensagem: string) {
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByText(mensagem, { exact: true }).first()).toBeVisible();
}

/** A lista é paginada (20 por página): busca pelo nome, como a pessoa faria. */
async function editar(page: Page, slug: string, nome: string) {
  await page.goto(`/cadastros/${slug}`);
  const busca = page.getByRole('search');
  await busca.getByRole('searchbox').fill(nome);
  await busca.getByRole('button', { name: 'Buscar' }).click();
  await page
    .getByRole('table')
    .getByRole('link', { name: `Editar ${nome}` })
    .click();
}

const grupo = (page: Page, rotulo: string) =>
  page.getByRole('group', { name: new RegExp(`^${rotulo}`) });

test.beforeEach(async ({ page }) => {
  await entrar(page);
});

test('UC-01, UC-02: paciente', async ({ page }) => {
  await page.goto('/cadastros/pacientes/novo');
  await page.getByLabel('Nome completo (obrigatório)').fill('Paciente Cadastro Real');
  await page.getByLabel('Documento (obrigatório)').fill('123.456.789-01');
  await page.getByLabel('Data de nascimento (obrigatório)').fill('1985-03-20');
  await page.getByLabel('Telefone').fill('(81) 99999-0000');
  await page.getByLabel('Vínculo (obrigatório)').selectOption({ label: 'Servidor' });
  await salvarEVoltar(page, 'Paciente cadastrado.');

  await editar(page, 'pacientes', 'Paciente Cadastro Real');
  await page.getByLabel('E-mail').fill('paciente.real@clinica.invalid');
  await salvarEVoltar(page, 'Paciente atualizado.');
});

test('UC-01, UC-02: estudante (RN-06)', async ({ page }) => {
  await page.goto('/cadastros/estudantes/novo');
  await page.getByLabel('Nome completo (obrigatório)').fill('Estudante Cadastro Real');
  await page.getByLabel('Especialidade (obrigatório)').selectOption({ label: 'Fisioterapia' });
  await page.getByLabel('Nível de formação (obrigatório)').fill('8º período');
  await grupo(page, 'Habilitações').getByRole('checkbox', { name: 'Terapia manual' }).check();
  await grupo(page, 'Procedimentos autorizados')
    .getByRole('checkbox', { name: 'Cinesioterapia' })
    .check();
  await page.getByRole('checkbox', { name: 'Segunda, tarde' }).check();
  await salvarEVoltar(page, 'Estudante cadastrado.');

  await editar(page, 'estudantes', 'Estudante Cadastro Real');
  await page.getByLabel('Nome completo (obrigatório)').fill('Estudante Cadastro Real Editado');
  await salvarEVoltar(page, 'Estudante atualizado.');
});

test('UC-01, UC-02: supervisor (RN-08)', async ({ page }) => {
  await page.goto('/cadastros/supervisores/novo');
  await page.getByLabel('Nome completo (obrigatório)').fill('Supervisor Cadastro Real');
  await grupo(page, 'Especialidades habilitadas')
    .getByRole('checkbox', { name: 'Fisioterapia' })
    .check();
  await page.getByRole('checkbox', { name: 'Terça, manhã' }).check();
  await page.getByLabel(/^Limite de estudantes simultâneos/).fill('2');
  await salvarEVoltar(page, 'Supervisor cadastrado.');

  await editar(page, 'supervisores', 'Supervisor Cadastro Real');
  await page.getByLabel('Nome completo (obrigatório)').fill('Supervisor Cadastro Real Editado');
  await salvarEVoltar(page, 'Supervisor atualizado.');
});

test('UC-01, UC-02: sala (RN-09)', async ({ page }) => {
  await page.goto('/cadastros/salas/novo');
  await page.getByLabel('Identificação (obrigatório)').fill('Sala Cadastro Real');
  await grupo(page, 'Equipamentos e recursos').getByRole('checkbox', { name: 'Maca' }).check();
  await page.getByLabel(/^Situação/).selectOption({ label: 'Em manutenção' });
  await salvarEVoltar(page, 'Sala cadastrada.');
  await expect(
    page.getByRole('row', { name: /Sala Cadastro Real/ }).getByText('Em manutenção'),
  ).toBeVisible();

  await editar(page, 'salas', 'Sala Cadastro Real');
  await expect(page.getByLabel(/^Situação/)).toHaveValue('EM_MANUTENCAO');
  await page.getByLabel('Características').fill('Consultório de teste (dado fictício)');
  await salvarEVoltar(page, 'Sala atualizada.');
});

test('UC-01, UC-02: especialidade, sem tolerância própria', async ({ page }) => {
  await page.goto('/cadastros/especialidades/novo');
  await page.getByLabel('Nome (obrigatório)').fill('Terapia Ocupacional Real');
  await grupo(page, 'Exige supervisão docente').getByRole('radio', { name: 'Não' }).check();
  await grupo(page, 'Exige validação do encerramento').getByRole('radio', { name: 'Não' }).check();
  await salvarEVoltar(page, 'Especialidade cadastrada.');

  await editar(page, 'especialidades', 'Terapia Ocupacional Real');
  await page.getByLabel('Descrição').fill('Especialidade de teste (dado fictício)');
  await salvarEVoltar(page, 'Especialidade atualizada.');
});

test('UC-03: filtro, exclusão sem vínculo e inativação de registro com vínculo (T-03)', async ({
  page,
}) => {
  // Filtro: no seed, só o Estudante Fictício 07 é de Nutrição.
  await page.goto('/cadastros/estudantes');
  await page.getByLabel('Especialidade', { exact: true }).selectOption({ label: 'Nutrição' });
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(2);
  await expect(page.getByRole('table')).toContainText('Estudante Fictício 07');

  // Filtros novos (#142): nível de formação (valor exato) e recurso da sala.
  // Os filtros persistem na sessão (T-03): tira a especialidade do passo anterior.
  await page.goto('/cadastros/estudantes');
  await page.getByLabel('Especialidade', { exact: true }).selectOption({ label: 'Todos' });
  await page.getByLabel('Nível de formação', { exact: true }).selectOption('6º período');
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(2);
  await expect(page.getByRole('table')).toContainText('Estudante Fictício 05');
  await page.goto('/cadastros/salas');
  await page
    .getByLabel('Recurso', { exact: true })
    .selectOption({ label: 'Balança antropométrica' });
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(2);
  await expect(page.getByRole('table')).toContainText('Sala 04');

  // Exclusão: a especialidade criada no teste anterior não tem vínculo.
  await page.goto('/cadastros/especialidades');
  await page
    .getByRole('table')
    .getByRole('button', { name: 'Excluir Terapia Ocupacional Real' })
    .click();
  await page
    .getByRole('dialog', { name: 'Excluir especialidade' })
    .getByRole('button', { name: 'Excluir' })
    .click();
  await expect(
    page.getByText('Terapia Ocupacional Real foi excluída do cadastro.').first(),
  ).toBeVisible();

  // Inativação: Fonoaudiologia tem fila, então a exclusão é recusada e a tela oferece inativar.
  await page.getByRole('table').getByRole('button', { name: 'Excluir Fonoaudiologia' }).click();
  await page
    .getByRole('dialog', { name: 'Excluir especialidade' })
    .getByRole('button', { name: 'Excluir' })
    .click();
  const vinculo = page.getByRole('dialog', { name: 'Não é possível excluir' });
  await expect(vinculo).toContainText('fila');
  await vinculo.getByRole('button', { name: 'Inativar' }).click();
  await expect(page.getByText('Fonoaudiologia foi inativada.').first()).toBeVisible();
});
