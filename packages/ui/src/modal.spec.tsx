import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ModalConfirmacao, ModalJustificativa } from './modal.js';

function ComGatilho({ onConfirmar }: { onConfirmar: () => void }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setAberto(true)}>
        Excluir
      </button>
      <ModalConfirmacao
        aberto={aberto}
        onAbertoChange={setAberto}
        titulo="Excluir sala?"
        destrutiva
        rotuloConfirmar="Excluir sala"
        onConfirmar={onConfirmar}
      />
    </>
  );
}

describe('<ModalConfirmacao>', () => {
  it('prende o foco no modal e o devolve ao gatilho ao fechar', async () => {
    const usuario = userEvent.setup();
    render(<ComGatilho onConfirmar={vi.fn()} />);
    const gatilho = screen.getByRole('button', { name: 'Excluir' });

    await usuario.click(gatilho);
    const dialogo = screen.getByRole('dialog', { name: 'Excluir sala?' });
    expect(dialogo).toContainElement(document.activeElement as HTMLElement);

    await usuario.tab();
    await usuario.tab();
    await usuario.tab();
    expect(dialogo).toContainElement(document.activeElement as HTMLElement);

    await usuario.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(gatilho).toHaveFocus());
  });

  it('coloca a ação destrutiva à direita do cancelar', async () => {
    const usuario = userEvent.setup();
    render(<ComGatilho onConfirmar={vi.fn()} />);
    await usuario.click(screen.getByRole('button', { name: 'Excluir' }));

    const botoes = screen.getAllByRole('button').map((b) => b.textContent);
    expect(botoes.indexOf('Excluir sala')).toBeGreaterThan(botoes.indexOf('Cancelar'));
  });
});

describe('<ModalJustificativa>', () => {
  it('exige justificativa e envia o texto aparado', async () => {
    const usuario = userEvent.setup();
    const onConfirmar = vi.fn();
    render(
      <ModalJustificativa
        aberto
        onAbertoChange={vi.fn()}
        titulo="Reclassificar prioridade"
        onConfirmar={onConfirmar}
      />,
    );

    await usuario.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(onConfirmar).not.toHaveBeenCalled();
    expect(screen.getByText('Informe a justificativa para continuar.')).toBeInTheDocument();

    await usuario.type(screen.getByLabelText('Justificativa'), '  piora do quadro  ');
    await usuario.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(onConfirmar).toHaveBeenCalledWith('piora do quadro');
  });
});
