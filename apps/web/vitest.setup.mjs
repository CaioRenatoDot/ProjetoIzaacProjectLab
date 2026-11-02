import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

/** Sem servidor nos testes: o socket fica inerte, e quem testa o tempo real usa um socket falso. */
vi.mock('socket.io-client', () => ({
  io: () => ({ active: true, connect() {}, disconnect() {}, on() {} }),
}));

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
});
