import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { PainelLateral } from './painel-lateral.js';

function ComGatilho() {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setAberto(true)}>
        Detalhes
      </button>
      <PainelLateral aberto={aberto} onAbertoChange={setAberto} titulo="Detalhe do evento">
        <p>Conteúdo do painel</p>
      </PainelLateral>
    </>
  );
}

describe('<PainelLateral>', () => {
  it('abre como diálogo com título e fecha pelo botão "Fechar", devolvendo o foco', async () => {
    const usuario = userEvent.setup();
    render(<ComGatilho />);
    const gatilho = screen.getByRole('button', { name: 'Detalhes' });

    await usuario.click(gatilho);
    const painel = screen.getByRole('dialog', { name: 'Detalhe do evento' });
    expect(painel).toHaveTextContent('Conteúdo do painel');
    expect(painel).toContainElement(document.activeElement as HTMLElement);

    await usuario.click(screen.getByRole('button', { name: 'Fechar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(gatilho).toHaveFocus();
  });

  it('fecha com Esc', async () => {
    const usuario = userEvent.setup();
    render(<ComGatilho />);
    await usuario.click(screen.getByRole('button', { name: 'Detalhes' }));

    await usuario.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
