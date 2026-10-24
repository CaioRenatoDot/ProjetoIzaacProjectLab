import { PermissoesProvider, ToastProvider } from '@filas/ui';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { comSessaoAnterior, renderizarComSessao, usarServidorMock } from '@/test/servidor-mock';

import { TelaFila } from './tela-fila';

/** Socket falso: os testes disparam os eventos do servidor (`docs/04` §7). */
const socketFalso = vi.hoisted(() => {
  const ouvintes = new Map<string, ((...args: unknown[]) => void)[]>();
  return {
    ouvintes,
    on(evento: string, ouvinte: (...args: unknown[]) => void) {
      ouvintes.set(evento, [...(ouvintes.get(evento) ?? []), ouvinte]);
    },
    disconnect() {
      ouvintes.clear();
    },
    emitir(evento: string, ...args: unknown[]) {
      for (const ouvinte of ouvintes.get(evento) ?? []) ouvinte(...args);
    },
  };
});
vi.mock('socket.io-client', () => ({ io: vi.fn(() => socketFalso) }));

usarServidorMock();

const TODAS = [
  'fila:consultar',
  'fila:chamar',
  'senha:consultar',
  'senha:reclassificar',
  'alocacao:criar',
  'ausencia:criar',
];

function abrir(permissoes: string[] = TODAS) {
  comSessaoAnterior();
  renderizarComSessao(
    <PermissoesProvider permissoes={permissoes}>
      <ToastProvider>
        <TelaFila />
      </ToastProvider>
    </PermissoesProvider>,
  );
  return userEvent.setup();
}

const coluna = (nome: RegExp) => screen.getByRole('region', { name: nome });
const numerosEm = (regiao: HTMLElement) =>
  within(regiao)
    .queryAllByRole('button', { name: /^Detalhes da senha/ })
    .map((b) => b.getAttribute('aria-label')?.replace('Detalhes da senha ', ''));

async function escolherFila(usuario: ReturnType<typeof userEvent.setup>, especialidade: RegExp) {
  const seletor = await screen.findByLabelText('Especialidade');
  await usuario.selectOptions(
    seletor,
    within(seletor).getByRole('option', { name: especialidade }),
  );
}

const chamarProxima = () => screen.getByRole('button', { name: /^Chamar próxima|^Chamando/ });

describe('<TelaFila> (W-08 / T-09)', () => {
  it('cada coluna é uma região rotulada, com o estado vazio próprio', async () => {
    const usuario = abrir();
    await escolherFila(usuario, /^Psicologia/);
    await waitFor(() =>
      expect(within(coluna(/^Aguardando/)).getByText('Nenhuma senha aguardando')).toBeVisible(),
    );
    for (const rotulo of [/^Chamada/, /^Em atendimento/, /^Pausado/, /^Pendente de validação/]) {
      expect(coluna(rotulo)).toBeInTheDocument();
    }
  });

  it('RN-04: a preferencial mais nova aparece antes da normal mais antiga', async () => {
    const usuario = abrir();
    await escolherFila(usuario, /^Nutrição/);
    await waitFor(() =>
      expect(numerosEm(coluna(/^Aguardando/))).toEqual(['N103', 'N102', 'N104', 'N101']),
    );
  });

  it('cartão mostra prioridade, iniciais, tipo, cronômetro e status, sem conteúdo clínico', async () => {
    const usuario = abrir();
    await escolherFila(usuario, /^Nutrição/);
    const cartao = await screen.findByRole('article', { name: 'Senha N103' });
    expect(cartao).toHaveTextContent(/Urgente\s*Senha N103/);
    expect(cartao).toHaveTextContent('K. L. D.');
    expect(cartao).toHaveTextContent(/Encaixe · Espera: \d+ min/);
    expect(within(cartao).getByText('Aguardando')).toHaveAttribute('data-status', 'AGUARDANDO');
    expect(screen.getByRole('article', { name: 'Senha N104' })).toHaveTextContent(/SLA excedido/);
  });

  it('RN-10: fila bloqueada mostra o banner e o botão desabilitado com a causa; as outras operam', async () => {
    const usuario = abrir();
    await escolherFila(usuario, /^Fonoaudiologia/);

    const avisos = await screen.findByRole('list', { name: 'Avisos' });
    expect(avisos).toHaveTextContent(
      /Fonoaudiologia sem supervisor habilitado disponível: chamadas bloqueadas \(RN-10\)/,
    );
    await waitFor(() => expect(chamarProxima()).toBeDisabled());
    expect(chamarProxima()).toHaveAccessibleDescription(/Chamadas bloqueadas: Fonoaudiologia/);

    await escolherFila(usuario, /^Nutrição/);
    await waitFor(() => expect(chamarProxima()).toBeEnabled());
    expect(screen.getByRole('list', { name: 'Avisos' })).toHaveTextContent('Fonoaudiologia');
  });

  it('duplo clique em "Chamar próxima" chama uma senha só', async () => {
    const usuario = abrir();
    // Fisioterapia tem uma só senha aguardando (F015): uma segunda chamada daria FILA_VAZIA.
    await waitFor(() => expect(numerosEm(coluna(/^Aguardando/))).toEqual(['F015']));
    await usuario.dblClick(chamarProxima());

    expect(await screen.findByText('Senha F015 chamada.', { selector: 'div' })).toBeInTheDocument();
    await waitFor(() => expect(numerosEm(coluna(/^Aguardando/))).toEqual([]));
    expect(screen.queryByText(/Não há senha aguardando/)).not.toBeInTheDocument();
  });

  it('RN-03: chamar urgente que fura a fila pede confirmação', async () => {
    const usuario = abrir();
    await escolherFila(usuario, /^Nutrição/);
    await waitFor(() => expect(chamarProxima()).toBeEnabled());
    await usuario.click(chamarProxima());

    const dialogo = await screen.findByRole('dialog', { name: 'Chamar senha urgente' });
    expect(dialogo).toHaveTextContent(/N103, é urgente e passa à frente/);
    await usuario.click(within(dialogo).getByRole('button', { name: 'Chamar mesmo assim' }));
    await waitFor(() => expect(numerosEm(coluna(/^Chamada/))).toContain('N103'));
    expect(screen.getByRole('status', { name: 'Atualizações da fila' })).toHaveTextContent(
      'Nova chamada: senha N103.',
    );
  });

  it('sem fila:chamar o botão não aparece; sem fila:consultar, estado de sem permissão', async () => {
    abrir(['fila:consultar']);
    await screen.findByRole('region', { name: /^Aguardando/ });
    expect(screen.queryByRole('button', { name: 'Chamar próxima' })).not.toBeInTheDocument();
  });

  it('sem fila:consultar mostra o estado neutro de sem permissão', () => {
    abrir(['cadastros:consultar']);
    expect(screen.getByText('Acesso não permitido')).toBeInTheDocument();
  });

  it('"Detalhes" abre o painel lateral com as ações do status', async () => {
    const usuario = abrir();
    await escolherFila(usuario, /^Nutrição/);

    await usuario.click(await screen.findByRole('button', { name: 'Detalhes da senha N101' }));
    let painel = await screen.findByRole('dialog', { name: 'Detalhes da senha N101' });
    expect(
      within(painel).getByRole('button', { name: 'Reclassificar prioridade' }),
    ).toBeInTheDocument();
    expect(
      within(painel).getByRole('button', { name: 'Registrar desistência' }),
    ).toBeInTheDocument();
    expect(within(painel).queryByRole('button', { name: 'Rechamar' })).not.toBeInTheDocument();
    await usuario.click(within(painel).getByRole('button', { name: 'Fechar' }));

    await usuario.click(screen.getByRole('button', { name: 'Detalhes da senha N105' }));
    painel = await screen.findByRole('dialog', { name: 'Detalhes da senha N105' });
    expect(within(painel).getByRole('button', { name: 'Rechamar' })).toBeInTheDocument();
    expect(within(painel).getByRole('link', { name: 'Alocar recursos' })).toHaveAttribute(
      'href',
      '/alocacao?senha=senha-n105',
    );
    expect(within(painel).getByRole('button', { name: 'Registrar ausência' })).toBeInTheDocument();
    expect(
      within(painel).queryByRole('button', { name: 'Reclassificar prioridade' }),
    ).not.toBeInTheDocument();
  });

  it('reclassificar pelo painel anuncia a nova posição', async () => {
    const usuario = abrir();
    await escolherFila(usuario, /^Nutrição/);
    await usuario.click(await screen.findByRole('button', { name: 'Detalhes da senha N101' }));
    const painel = await screen.findByRole('dialog', { name: 'Detalhes da senha N101' });
    await usuario.click(within(painel).getByRole('button', { name: 'Reclassificar prioridade' }));

    const modal = await screen.findByRole('dialog', {
      name: 'Reclassificar prioridade da senha N101',
    });
    await usuario.selectOptions(within(modal).getByLabelText('Nova prioridade'), 'Preferencial');
    await usuario.type(
      within(modal).getByLabelText('Justificativa'),
      'Gestante identificada depois da triagem inicial',
    );
    await usuario.click(within(modal).getByRole('button', { name: 'Confirmar' }));

    await waitFor(() =>
      expect(screen.getByRole('status', { name: 'Atualizações da fila' })).toHaveTextContent(
        /Senha N101 reclassificada para Preferencial\. Nova posição: 2ª\./,
      ),
    );
  });

  it('perda da conexão em tempo real mostra o banner e congela "Chamar próxima"', async () => {
    abrir();
    await waitFor(() => expect(chamarProxima()).toBeEnabled());
    act(() => socketFalso.emitir('connect_error', new Error('sem rede')));

    expect(await screen.findByRole('alert')).toHaveTextContent(/Conexão perdida/);
    expect(chamarProxima()).toBeDisabled();
    expect(chamarProxima()).toHaveAccessibleDescription(/Conexão perdida/);

    act(() => socketFalso.emitir('connect'));
    await waitFor(() => expect(chamarProxima()).toBeEnabled());
  });
});
