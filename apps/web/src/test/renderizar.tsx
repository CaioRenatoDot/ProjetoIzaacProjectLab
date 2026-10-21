import { PermissoesProvider, ToastProvider } from '@filas/ui';
import { render } from '@testing-library/react';
import { type ReactElement } from 'react';

/** Renderiza com os providers que o shell fornece (permissões e toast). */
export function renderizar(ui: ReactElement, permissoes: string[] = []) {
  return render(
    <PermissoesProvider permissoes={permissoes}>
      <ToastProvider>{ui}</ToastProvider>
    </PermissoesProvider>,
  );
}
