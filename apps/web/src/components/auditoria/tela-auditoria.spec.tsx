import { PermissoesProvider, ToastProvider } from '@filas/ui';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { API_URL } from '@/lib/api/config';
import { renderizarComSessao, servidor, usarServidorMock } from '@/test/servidor-mock';

import { TelaAuditoria } from './tela-auditoria';

usarServidorMock();

const TODAS = ['auditoria:consultar', 'auditoria:exportar'];

function abrir(permissoes: string[] = TODAS) {
  const resultado = renderizarComSessao(
    <PermissoesProvider permissoes={permissoes}>
      <ToastProvider>
        <TelaAuditoria />
      </ToastProvider>
    </PermissoesProvider>,
  );
  return { ...resultado, usuario: userEvent.setup() };
}

const linhas = () => within(screen.getByRole('table')).getAllByRole('row').slice(1);
const anuncio = () => screen.getByRole('status', { name: 'Resultado da trilha' });
const aplicar = (usuario: ReturnType<typeof userEvent.setup>) =>
  usuario.click(screen.getByRole('button', { name: 'Aplicar filtros' }));

describe('<TelaAuditoria> (W-18 / T-18)', () => {
  it('lista a trilha paginada, mais recente primeiro, e anuncia o total e a ordenação', async () => {
    abrir();
    await waitFor(() => expect(linhas()).toHaveLength(20));
    expect(anuncio()).toHaveTextContent('45 registros encontrados');
    expect(anuncio()).toHaveTextContent('do mais recente para o mais antigo');
    expect(screen.getByRole('columnheader', { name: /Data e hora/ })).toHaveAttribute(
      'aria-sort',
      'descending',
    );
    expect(screen.getByText('Mostrando 1–20 de 45')).toBeInTheDocument();
  });

  it('filtro "Consultar informação sensível" mostra só essas linhas, com a marcação em texto', async () => {
    const { usuario } = abrir();
    await waitFor(() => expect(linhas()).toHaveLength(20));

    await usuario.selectOptions(
      screen.getByLabelText('Tipo de operação'),
      'Consultar informação sensível',
    );
    await aplicar(usuario);

    await waitFor(() => expect(anuncio()).toHaveTextContent('10 registros encontrados'));
    for (const linha of linhas()) {
      expect(linha).toHaveTextContent('Consultar informação sensível');
      expect(within(linha).getByText('Consulta sensível')).toBeInTheDocument();
    }
  });

  it('linhas não sensíveis não recebem a marcação', async () => {
    const { usuario } = abrir();
    await waitFor(() => expect(linhas()).toHaveLength(20));
    await usuario.selectOptions(screen.getByLabelText('Tipo de operação'), 'Criar');
    await aplicar(usuario);

    await waitFor(() => expect(anuncio()).toHaveTextContent('5 registros encontrados'));
    for (const linha of linhas()) {
      expect(within(linha).queryByText('Consulta sensível')).not.toBeInTheDocument();
    }
  });

  it('o detalhe de uma reclassificação mostra a justificativa informada e a origem', async () => {
    const { usuario } = abrir();
    await waitFor(() => expect(linhas()).toHaveLength(20));
    const reclassificacao = linhas().find((l) => l.textContent?.includes('Reclassificou'));

    await usuario.click(within(reclassificacao!).getByRole('button', { name: /^Detalhes/ }));

    const painel = await screen.findByRole('dialog', { name: 'Detalhe do evento' });
    expect(await within(painel).findByText('Justificativa informada')).toBeInTheDocument();
    expect(painel).toHaveTextContent('Paciente relatou piora da dor');
    expect(painel).toHaveTextContent('Perfil no momento da ação');
    expect(painel).toHaveTextContent('Triagem');
    expect(within(painel).getByText('Origem do acesso')).toBeInTheDocument();
  });

  it('"Filtrar por este registro" aplica o filtro do registro afetado e fecha o painel', async () => {
    const { usuario } = abrir();
    await waitFor(() => expect(linhas()).toHaveLength(20));

    await usuario.click(within(linhas()[0]!).getByRole('button', { name: /^Detalhes/ }));
    const painel = await screen.findByRole('dialog');
    await usuario.click(
      await within(painel).findByRole('button', { name: 'Filtrar por este registro' }),
    );

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByLabelText('Registro afetado')).not.toHaveValue('');
    await waitFor(() => expect(anuncio()).toHaveTextContent(/^[1-9] registros? encontrados?/));
  });

  it('período invertido mostra o erro abaixo de "Até", com foco nele, e não consulta', async () => {
    const { usuario } = abrir();
    await waitFor(() => expect(linhas()).toHaveLength(20));

    await usuario.type(screen.getByLabelText('De'), '2026-10-21');
    await usuario.type(screen.getByLabelText('Até'), '2026-10-01');
    await aplicar(usuario);

    const ate = screen.getByLabelText('Até');
    expect(ate).toHaveAttribute('aria-invalid', 'true');
    expect(ate).toHaveAccessibleDescription(/data final precisa ser igual ou posterior/);
    expect(ate).toHaveFocus();
    expect(anuncio()).toHaveTextContent('45 registros encontrados');
  });

  it('filtro sem resultado mostra a mensagem e oferece limpar', async () => {
    const { usuario } = abrir();
    await waitFor(() => expect(linhas()).toHaveLength(20));

    await usuario.type(screen.getByLabelText('De'), '2020-01-01');
    await usuario.type(screen.getByLabelText('Até'), '2020-01-31');
    await aplicar(usuario);

    expect(
      await screen.findByText('Nenhum registro encontrado com esses filtros'),
    ).toBeInTheDocument();
    await usuario.click(screen.getAllByRole('button', { name: 'Limpar filtros' })[0]!);
    await waitFor(() => expect(anuncio()).toHaveTextContent('45 registros encontrados'));
    expect(screen.getByLabelText('De')).toHaveValue('');
  });

  it('não oferece nenhuma ação de edição ou exclusão', async () => {
    abrir();
    await waitFor(() => expect(linhas()).toHaveLength(20));
    expect(screen.queryByRole('button', { name: /editar|excluir/i })).not.toBeInTheDocument();
  });

  it('sem auditoria:consultar, mostra o estado sem permissão neutro e não consulta', async () => {
    const pedidos: string[] = [];
    servidor.events.on('request:start', ({ request }) => pedidos.push(request.url));
    abrir(['auditoria:exportar']);

    expect(screen.getByText('Acesso não permitido')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 50));
    expect(pedidos.filter((url) => url.includes('/auditoria'))).toEqual([]);
    servidor.events.removeAllListeners();
  });

  it('403 da API vira o mesmo estado neutro', async () => {
    servidor.use(
      http.get(`${API_URL}/auditoria`, () =>
        HttpResponse.json({ status: 403, codigo: 'SEM_PERMISSAO' }, { status: 403 }),
      ),
    );
    abrir();
    expect(await screen.findByText('Acesso não permitido')).toBeInTheDocument();
  });

  it('erro de carga oferece "Tentar novamente"', async () => {
    servidor.use(
      http.get(`${API_URL}/auditoria`, () => HttpResponse.json({}, { status: 500 }), {
        once: true,
      }),
    );
    const { usuario } = abrir();
    await usuario.click(await screen.findByRole('button', { name: 'Tentar novamente' }));
    await waitFor(() => expect(linhas()).toHaveLength(20));
  });

  it('sem auditoria:exportar, "Exportar resultado" não é renderizado', async () => {
    abrir(['auditoria:consultar']);
    await waitFor(() => expect(linhas()).toHaveLength(20));
    expect(screen.queryByRole('button', { name: 'Exportar resultado' })).not.toBeInTheDocument();
  });

  describe('exportação', () => {
    let clique: ReturnType<typeof vi.spyOn>;
    beforeEach(() => {
      URL.createObjectURL = vi.fn(() => 'blob:exportacao');
      URL.revokeObjectURL = vi.fn();
      clique = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    });
    afterEach(() => vi.restoreAllMocks());

    it('exporta com os filtros aplicados e a exportação entra na trilha', async () => {
      let consultaExportada = '';
      servidor.events.on('request:start', ({ request }) => {
        if (request.url.includes('/exportacao')) consultaExportada = new URL(request.url).search;
      });
      const { usuario } = abrir();
      await waitFor(() => expect(linhas()).toHaveLength(20));
      await usuario.selectOptions(screen.getByLabelText('Módulo'), 'Triagem');
      await aplicar(usuario);
      await waitFor(() => expect(anuncio()).toHaveTextContent('5 registros encontrados'));

      await usuario.click(screen.getByRole('button', { name: 'Exportar resultado' }));

      expect(await screen.findByText(/Exportação concluída/)).toBeInTheDocument();
      expect(consultaExportada).toBe('?modulo=triagem');
      expect(clique).toHaveBeenCalledTimes(1);

      await usuario.click(screen.getAllByRole('button', { name: 'Limpar filtros' })[0]!);
      await waitFor(() => expect(anuncio()).toHaveTextContent('46 registros encontrados'));
      expect(linhas()[0]).toHaveTextContent('Exportou a trilha de auditoria');
      servidor.events.removeAllListeners();
    });
  });
});
