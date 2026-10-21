import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PermissoesProvider, Permitido } from './permissao.js';

function renderizar(permissoes: string[]) {
  return render(
    <PermissoesProvider permissoes={permissoes}>
      <Permitido permissao="auditoria:consultar">
        <button type="button">Auditoria</button>
      </Permitido>
    </PermissoesProvider>,
  );
}

describe('<Permitido>', () => {
  it('renderiza o conteúdo quando a sessão tem a permissão', () => {
    renderizar(['auditoria:consultar']);
    expect(screen.getByRole('button', { name: 'Auditoria' })).toBeInTheDocument();
  });

  it('não renderiza nada, nem desabilitado, sem a permissão', () => {
    const { container } = renderizar(['fila:consultar']);
    expect(container).toBeEmptyDOMElement();
  });

  it('não renderiza nada fora de um PermissoesProvider', () => {
    const { container } = render(
      <Permitido permissao="fila:consultar">
        <span>Fila</span>
      </Permitido>,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
