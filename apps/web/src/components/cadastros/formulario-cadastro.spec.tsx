import { PermissoesProvider, ToastProvider } from '@filas/ui';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { type SlugCadastro } from '@/lib/cadastros/entidades';
import { renderizarComSessao, usarServidorMock } from '@/test/servidor-mock';

import { TelaFormularioCadastro } from './formulario-cadastro';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));

usarServidorMock();
beforeEach(() => push.mockClear());

const TODAS = ['cadastros:consultar', 'cadastros:criar', 'cadastros:editar'];

function abrir(
  slug: SlugCadastro,
  { id, voltar, permissoes = TODAS }: { id?: string; voltar?: string; permissoes?: string[] } = {},
) {
  renderizarComSessao(
    <PermissoesProvider permissoes={permissoes}>
      <ToastProvider>
        <TelaFormularioCadastro slug={slug} id={id} voltar={voltar} />
      </ToastProvider>
    </PermissoesProvider>,
  );
  return userEvent.setup();
}

const salvar = () => screen.getByRole('button', { name: 'Salvar' });

async function preencherPaciente(
  usuario: ReturnType<typeof userEvent.setup>,
  { documento = '111.222.333-44' } = {},
) {
  await usuario.type(screen.getByLabelText(/^Nome completo/), 'Paciente de Teste');
  await usuario.type(screen.getByLabelText(/^Documento/), documento);
  await usuario.type(screen.getByLabelText(/^Data de nascimento/), '1990-05-10');
  await usuario.selectOptions(screen.getByLabelText(/^Vínculo/), 'Aluno');
}

describe('<TelaFormularioCadastro> (W-04 / T-04)', () => {
  it('obrigatório marcado em texto, e "Salvar" indisponível com obrigatório vazio', () => {
    abrir('pacientes');
    expect(screen.getByLabelText('Nome completo (obrigatório)')).toBeInTheDocument();
    expect(screen.getByLabelText('Telefone')).toBeInTheDocument();
    expect(salvar()).toHaveAttribute('aria-disabled', 'true');
  });

  it('tentar salvar com obrigatório vazio bloqueia o envio, mostra a mensagem e foca o campo', async () => {
    const usuario = abrir('pacientes');
    await usuario.click(salvar());

    const nome = screen.getByLabelText(/^Nome completo/);
    await waitFor(() => expect(nome).toHaveFocus());
    expect(nome).toHaveAttribute('aria-invalid', 'true');
    expect(nome).toHaveAccessibleDescription(/Informe o nome completo/);
    expect(push).not.toHaveBeenCalled();
  });

  it('documento já cadastrado mostra a duplicidade com link para o registro existente', async () => {
    const usuario = abrir('pacientes');
    // paciente-1 da simulação tem o documento 000.000.100-00.
    await preencherPaciente(usuario, { documento: '000.000.100-00' });
    await usuario.click(salvar());

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent(/Já existe um cadastro de paciente/);
    expect(
      within(alerta).getByRole('link', { name: 'Abrir o cadastro existente' }),
    ).toHaveAttribute('href', '/cadastros/pacientes/paciente-1');
    expect(push).not.toHaveBeenCalled();
  });

  it('salvar paciente válido volta para a lista com aviso de sucesso', async () => {
    const usuario = abrir('pacientes');
    await preencherPaciente(usuario);
    expect(salvar()).toHaveAttribute('aria-disabled', 'false');
    await usuario.click(salvar());

    await waitFor(() => expect(push).toHaveBeenCalledWith('/cadastros/pacientes'));
    expect(screen.getByText('Paciente cadastrado.')).toBeInTheDocument();
  });

  it('aberto pela triagem (?voltar=/triagem), volta para ela depois de salvar', async () => {
    const usuario = abrir('pacientes', { voltar: '/triagem' });
    await preencherPaciente(usuario);
    await usuario.click(salvar());
    await waitFor(() => expect(push).toHaveBeenCalledWith('/triagem'));
  });

  it('"Cancelar" sem alterações volta direto; com alterações pede confirmação de descarte', async () => {
    const usuario = abrir('pacientes');
    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(push).toHaveBeenCalledWith('/cadastros/pacientes');
    push.mockClear();

    await usuario.type(screen.getByLabelText(/^Nome completo/), 'Alguém');
    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Descartar alterações?' });
    expect(push).not.toHaveBeenCalled();
    await usuario.click(within(dialogo).getByRole('button', { name: 'Descartar' }));
    expect(push).toHaveBeenCalledWith('/cadastros/pacientes');
  });

  it('estudante: a busca filtra as habilitações e a seleção funciona por teclado', async () => {
    const usuario = abrir('estudantes');
    const grupo = screen.getByRole('group', { name: 'Habilitações (obrigatório)' });
    await within(grupo).findByRole('checkbox', { name: 'Avaliação' });

    await usuario.type(within(grupo).getByRole('searchbox'), 'reab');
    expect(within(grupo).getAllByRole('checkbox')).toHaveLength(1);
    expect(within(grupo).getByRole('status')).toHaveTextContent('1 de 5 opções');

    await usuario.tab();
    const opcao = within(grupo).getByRole('checkbox', { name: 'Reabilitação' });
    expect(opcao).toHaveFocus();
    await usuario.keyboard(' ');
    expect(opcao).toBeChecked();
    expect(grupo).toHaveTextContent('Selecionadas: Reabilitação.');
  });

  it('RN-08: limite de estudantes do supervisor só aceita inteiro positivo', async () => {
    const usuario = abrir('supervisores');
    const limite = screen.getByLabelText(/^Limite de estudantes simultâneos/);
    await usuario.type(limite, '0');
    await usuario.tab();
    expect(limite).toHaveAccessibleDescription(/inteiro positivo/);
  });

  it('edição de supervisor em uso avisa o impacto antes de salvar', async () => {
    // supervisor-2 acompanha 1 estudante na simulação.
    const usuario = abrir('supervisores', { id: 'supervisor-2' });
    const limite = await screen.findByLabelText(/^Limite de estudantes simultâneos/);
    expect(screen.getByRole('heading', { name: 'Editar supervisor' })).toBeInTheDocument();

    await usuario.clear(limite);
    await usuario.type(limite, '4');
    await usuario.click(salvar());

    const dialogo = await screen.findByRole('dialog', {
      name: 'A alteração afeta alocações em curso',
    });
    expect(push).not.toHaveBeenCalled();
    await usuario.click(within(dialogo).getByRole('button', { name: 'Salvar mesmo assim' }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/cadastros/supervisores'));
  });

  it('edição sem campo de impacto alterado salva direto', async () => {
    const usuario = abrir('supervisores', { id: 'supervisor-2' });
    const nome = await screen.findByLabelText(/^Nome completo/);
    await usuario.type(nome, ' Jr.');
    await usuario.click(salvar());
    await waitFor(() => expect(push).toHaveBeenCalledWith('/cadastros/supervisores'));
  });

  it('sem a permissão da operação mostra o estado neutro de sem permissão', () => {
    abrir('pacientes', { permissoes: ['cadastros:consultar'] });
    expect(screen.getByText('Acesso não permitido')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Salvar' })).not.toBeInTheDocument();
  });

  it('registro inexistente na edição mostra sem permissão (403 neutro)', async () => {
    abrir('salas', { id: 'sala-inexistente' });
    expect(await screen.findByText('Acesso não permitido')).toBeInTheDocument();
  });
});
