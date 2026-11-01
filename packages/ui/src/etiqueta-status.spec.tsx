import { StatusSenha } from '@filas/contracts';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { APRESENTACAO_STATUS, EtiquetaStatus } from './etiqueta-status.js';

describe('<EtiquetaStatus>', () => {
  it('P-01: todo status do enum tem rótulo textual', () => {
    expect(Object.keys(APRESENTACAO_STATUS).sort()).toEqual([...StatusSenha.options].sort());
    for (const status of StatusSenha.options) {
      expect(APRESENTACAO_STATUS[status].rotulo.trim()).not.toBe('');
    }
  });

  it.each(StatusSenha.options)('P-01: %s renderiza o rótulo e o data-status', (status) => {
    render(<EtiquetaStatus status={status} />);
    const etiqueta = screen.getByText(APRESENTACAO_STATUS[status].rotulo);
    expect(etiqueta).toHaveAttribute('data-status', status);
  });

  it('PENDENTE_VALIDACAO mostra "Pendente de validação"', () => {
    const { container } = render(<EtiquetaStatus status="PENDENTE_VALIDACAO" />);
    expect(container.innerHTML).toContain('Pendente de validação');
    expect(container.innerHTML).toContain('data-status="PENDENTE_VALIDACAO"');
  });

  it('acrescenta a className recebida sem perder a cor de apoio', () => {
    render(<EtiquetaStatus status="AUSENTE" className="ml-2" />);
    const etiqueta = screen.getByText('Ausente');
    expect(etiqueta).toHaveClass('ml-2', 'bg-red-100');
  });
});
