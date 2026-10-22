import { PermissoesProvider, ToastProvider } from '@filas/ui';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { API_URL } from '@/lib/api/config';
import { type SlugCadastro } from '@/lib/cadastros/entidades';
import { renderizarComSessao, servidor, usarServidorMock } from '@/test/servidor-mock';

import { ListaCadastro } from './lista-cadastro';

usarServidorMock();

const TODAS = ['cadastros:consultar', 'cadastros:criar', 'cadastros:editar', 'cadastros:excluir'];

function abrir(slug: SlugCadastro = 'pacientes', permissoes: string[] = TODAS) {
  const resultado = renderizarComSessao(
    <PermissoesProvider permissoes={permissoes}>
      <ToastProvider>
        <ListaCadastro slug={slug} />
      </ToastProvider>
    </PermissoesProvider>,
  );
  return { ...resultado, usuario: userEvent.setup() };
}

/** Linhas de dados da tabela (sem o cabeçalho). */
const linhas = () => within(screen.getByRole('table')).getAllByRole('row').slice(1);
const anuncio = () => screen.getByRole('status', { name: 'Resultado da lista' });
/** Tabela e cartões existem no jsdom (o CSS que esconde um deles não se aplica): age na tabela. */
const naTabela = async () => within(await screen.findByRole('table'));

describe('<ListaCadastro> (W-03 / T-03)', () => {
  it('lista a primeira página com 20 registros e anuncia o total', async () => {
    abrir();
    await waitFor(() => expect(linhas()).toHaveLength(20));
    expect(anuncio()).toHaveTextContent('45 pacientes encontrados');
    expect(screen.getByText('Mostrando 1–20 de 45')).toBeInTheDocument();
  });

  it('filtrar por vínculo "Aluno" mostra só alunos e anuncia o resultado em aria-live', async () => {
    const { usuario } = abrir();
    await waitFor(() => expect(linhas()).toHaveLength(20));

    await usuario.selectOptions(screen.getByLabelText('Vínculo'), 'Aluno');

    await waitFor(() => expect(anuncio()).toHaveTextContent('15 pacientes encontrados'));
    for (const linha of linhas()) expect(linha).toHaveTextContent('Aluno');
  });

  it('filtro sem resultado oferece limpar os filtros', async () => {
    const { usuario } = abrir();
    await usuario.type(
      screen.getByLabelText('Buscar por nome ou documento'),
      'ninguém com esse nome',
    );
    await usuario.click(screen.getByRole('button', { name: 'Buscar' }));

    expect(
      await screen.findByText('Nenhum paciente encontrado com esses filtros'),
    ).toBeInTheDocument();
    await usuario.click(screen.getAllByRole('button', { name: 'Limpar filtros' })[0]!);
    await waitFor(() => expect(anuncio()).toHaveTextContent('45 pacientes encontrados'));
  });

  it('excluir registro com vínculo ativo explica o vínculo e oferece inativar', async () => {
    const { usuario } = abrir();
    // paciente-1 (Ana Alves Cardoso) tem vínculo ativo na simulação.
    await usuario.click(
      (await naTabela()).getByRole('button', { name: 'Excluir Ana Alves Cardoso' }),
    );
    const confirmacao = await screen.findByRole('dialog', { name: 'Excluir paciente' });
    await usuario.click(within(confirmacao).getByRole('button', { name: 'Excluir' }));

    const aviso = await screen.findByRole('dialog', { name: 'Não é possível excluir' });
    expect(aviso).toHaveTextContent(/vínculo ativo com fila, alocação ou atendimento/);
    await usuario.click(within(aviso).getByRole('button', { name: 'Inativar' }));

    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Não é possível excluir' }),
      ).not.toBeInTheDocument(),
    );
    expect(await screen.findByText('Ana Alves Cardoso foi inativado.')).toBeInTheDocument();
  });

  it('excluir registro sem vínculo remove da lista', async () => {
    const { usuario } = abrir();
    await usuario.click(
      (await naTabela()).getByRole('button', { name: 'Excluir Bruno Barros Duarte' }),
    );
    const confirmacao = await screen.findByRole('dialog', { name: 'Excluir paciente' });
    await usuario.click(within(confirmacao).getByRole('button', { name: 'Excluir' }));

    await waitFor(() => expect(anuncio()).toHaveTextContent('44 pacientes encontrados'));
    expect(screen.getByText('Bruno Barros Duarte foi excluído do cadastro.')).toBeInTheDocument();
  });

  it('só com cadastros:consultar, "Novo", "Editar" e "Excluir" não aparecem', async () => {
    abrir('pacientes', ['cadastros:consultar']);
    await waitFor(() => expect(linhas()).toHaveLength(20));
    expect(screen.queryByRole('link', { name: 'Novo paciente' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^Editar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Excluir/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Detalhes de/ }).length).toBeGreaterThan(0);
  });

  it('sem cadastros:consultar mostra o estado neutro de sem permissão', () => {
    abrir('pacientes', ['fila:consultar']);
    expect(screen.getByText('Acesso não permitido')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('ordenar por nome é anunciado e marca aria-sort no cabeçalho', async () => {
    const { usuario } = abrir();
    await waitFor(() => expect(linhas()).toHaveLength(20));
    const cabecalho = screen.getByRole('columnheader', { name: /Nome/ });
    expect(cabecalho).toHaveAttribute('aria-sort', 'none');

    await usuario.click(within(cabecalho).getByRole('button'));
    await waitFor(() => expect(cabecalho).toHaveAttribute('aria-sort', 'ascending'));
    expect(anuncio()).toHaveTextContent('Ordenado por Nome, ordem crescente.');

    await usuario.click(within(cabecalho).getByRole('button'));
    await waitFor(() => expect(cabecalho).toHaveAttribute('aria-sort', 'descending'));
  });

  it('paginação vai para a próxima página', async () => {
    const { usuario } = abrir();
    await waitFor(() => expect(linhas()).toHaveLength(20));
    await usuario.click(screen.getByRole('button', { name: 'Próxima' }));
    await waitFor(() => expect(screen.getByText('Mostrando 21–40 de 45')).toBeInTheDocument());
    expect(screen.getByText('Página 2 de 3')).toBeInTheDocument();
  });

  it('filtros persistem na sessão ao voltar para a lista', async () => {
    const { usuario, unmount } = abrir();
    await waitFor(() => expect(linhas()).toHaveLength(20));
    await usuario.selectOptions(screen.getByLabelText('Vínculo'), 'Servidor');
    await waitFor(() => expect(anuncio()).toHaveTextContent('15 pacientes encontrados'));
    unmount();

    abrir();
    expect(screen.getByLabelText('Vínculo')).toHaveValue('SERVIDOR');
    await waitFor(() => expect(anuncio()).toHaveTextContent('15 pacientes encontrados'));
  });

  it('RN-08: supervisores mostram a ocupação no formato "2 de 3"', async () => {
    abrir('supervisores');
    await waitFor(() => expect(linhas().length).toBeGreaterThan(0));
    expect(within(screen.getByRole('table')).getAllByText(/^\d de 3$/).length).toBeGreaterThan(0);
  });

  it('falha ao carregar mostra erro com "Tentar novamente"', async () => {
    servidor.use(http.get(`${API_URL}/salas`, () => HttpResponse.error()));
    abrir('salas');
    expect(await screen.findByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument();
  });
});
