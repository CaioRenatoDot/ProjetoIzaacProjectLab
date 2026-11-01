import { PermissoesProvider, ToastProvider } from '@filas/ui';
import { screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { API_URL } from '@/lib/api/config';
import {
  comSessaoAnterior,
  renderizarComSessao,
  servidor,
  usarServidorMock,
} from '@/test/servidor-mock';
import * as arquivo from '@/lib/arquivo';
import { TelaIndicadores } from './tela-indicadores';

usarServidorMock();
afterEach(() => vi.restoreAllMocks());
function abrir(permissoes = ['indicadores:consultar', 'indicadores:exportar']) {
  comSessaoAnterior();
  renderizarComSessao(
    <PermissoesProvider permissoes={permissoes}>
      <ToastProvider>
        <TelaIndicadores />
      </ToastProvider>
    </PermissoesProvider>,
  );
  return userEvent.setup();
}
const resumo = () => screen.getByRole('region', { name: 'Resumo dos seis indicadores' });
const aplicar = () => fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }));
const periodo = (de: string, ate: string) => {
  fireEvent.change(screen.getByLabelText('De'), { target: { value: de } });
  fireEvent.change(screen.getByLabelText('Até'), { target: { value: ate } });
};
describe('UC-18 / RF-10: painel de indicadores', () => {
  it('mostra seis cartões, gráfico e tabela equivalente com os mesmos números', async () => {
    const usuario = abrir();
    await screen.findByRole('region', { name: 'Resumo dos seis indicadores' });
    expect(resumo().querySelectorAll('dt')).toHaveLength(6);
    expect(within(resumo()).getByText('142')).toBeInTheDocument();
    const tabela = screen.getByRole('table', { name: /tabela equivalente/ });
    expect(within(tabela).getByRole('row', { name: 'Fisioterapia 68 6 4' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Volume de atendimentos/ })).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Tabela' }));
    expect(screen.queryByRole('img', { name: /Volume de atendimentos/ })).not.toBeInTheDocument();
    expect(within(tabela).getAllByRole('row')).toHaveLength(4);
  });
  it('aplica período, especialidade e turno somente ao confirmar', async () => {
    const usuario = abrir();
    await screen.findByRole('region', { name: 'Resumo dos seis indicadores' });
    periodo('2026-09-01', '2026-09-30');
    await usuario.selectOptions(
      screen.getByLabelText('Especialidade'),
      '00000000-0000-4000-8000-000000000001',
    );
    await usuario.selectOptions(screen.getByLabelText('Turno'), 'NOITE');
    expect(within(resumo()).getByText('142')).toBeInTheDocument();
    aplicar();
    await waitFor(() => expect(within(resumo()).getAllByText('2')).toHaveLength(2));
    expect(screen.getByText(/média pode não ser representativa/)).toBeInTheDocument();
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(2);
    expect(screen.getByText(/01\/09\/2026 a 30\/09\/2026/)).toBeInTheDocument();
  });
  it('período vazio preserva os filtros e limpar retorna ao mês atual', async () => {
    const usuario = abrir();
    await screen.findByRole('region', { name: 'Resumo dos seis indicadores' });
    periodo('2019-01-01', '2019-01-31');
    aplicar();
    expect(await screen.findByText('Sem dados disponíveis')).toBeInTheDocument();
    expect(screen.getByLabelText('De')).toHaveValue('2019-01-01');
    expect(screen.getByLabelText('Até')).toHaveValue('2019-01-31');
    await usuario.click(screen.getByRole('button', { name: 'Limpar filtros' }));
    expect(
      await screen.findByRole('region', { name: 'Resumo dos seis indicadores' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Especialidade')).toHaveValue('');
  });
  it('data inválida recebe foco e não consulta um período invertido', async () => {
    abrir();
    await screen.findByRole('region', { name: 'Resumo dos seis indicadores' });
    periodo('2026-09-30', '2026-09-01');
    aplicar();
    expect(screen.getByLabelText('Até')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Até')).toHaveFocus();
    expect(within(resumo()).getByText('142')).toBeInTheDocument();
  });
  it('exporta os filtros aplicados, mesmo com alterações ainda no formulário', async () => {
    const baixar = vi.spyOn(arquivo, 'baixarArquivo').mockImplementation(() => {});
    let requisicao = '';
    servidor.use(
      http.get(API_URL + '/indicadores/exportacao', ({ request }) => {
        requisicao = request.url;
        return new HttpResponse('especialidade,atendimentos\nFisioterapia,68');
      }),
    );
    const usuario = abrir();
    await screen.findByRole('region', { name: 'Resumo dos seis indicadores' });
    periodo('2026-09-01', '2026-09-30');
    aplicar();
    await screen.findByText(/01\/09\/2026 a 30\/09\/2026/);
    periodo('2019-01-01', '2019-01-31');
    await usuario.click(screen.getByRole('button', { name: 'Exportar resultado' }));
    await waitFor(() => expect(baixar).toHaveBeenCalledOnce());
    expect(requisicao).toContain('de=2026-09-01&ate=2026-09-30');
    expect(requisicao).toContain('formato=csv');
  });
  it('não renderiza exportar sem permissão e não mostra painel sem consultar', async () => {
    abrir(['indicadores:consultar']);
    await screen.findByRole('region', { name: 'Resumo dos seis indicadores' });
    expect(screen.queryByRole('button', { name: 'Exportar resultado' })).not.toBeInTheDocument();
  });
  it('sem permissão apresenta mensagem neutra', () => {
    abrir([]);
    expect(screen.getByText('Acesso não permitido')).toBeInTheDocument();
    expect(screen.queryByRole('search')).not.toBeInTheDocument();
  });
  it('falha de rede oferece nova tentativa mantendo filtros', async () => {
    servidor.use(http.get(API_URL + '/indicadores/resumo', () => HttpResponse.error()));
    abrir();
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar');
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument();
    expect(screen.getByLabelText('De')).not.toHaveValue('');
  });
  it('403 da API oculta resultados e não revela volumes', async () => {
    servidor.use(
      http.get(API_URL + '/indicadores/resumo', () =>
        HttpResponse.json({ codigo: 'SEM_PERMISSAO' }, { status: 403 }),
      ),
    );
    abrir();
    expect(await screen.findByText('Acesso não permitido')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
