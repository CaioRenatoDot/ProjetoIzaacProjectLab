const ouvintes = new Map<string, ((...args: unknown[]) => void)[]>();

/** Socket falso: os testes disparam os eventos do servidor (`docs/04` §7). */
export const socketFalso = {
  active: true,
  connect() {},
  disconnect() {
    ouvintes.clear();
  },
  on(evento: string, ouvinte: (...args: unknown[]) => void) {
    ouvintes.set(evento, [...(ouvintes.get(evento) ?? []), ouvinte]);
  },
  /** A conexão só abre quando a tela sabe a sala: os testes esperam por ela. */
  ouvindo: (evento: string) => ouvintes.has(evento),
  emitir(evento: string, ...args: unknown[]) {
    for (const ouvinte of ouvintes.get(evento) ?? []) ouvinte(...args);
  },
};

export const moduloSocketFalso = { io: () => socketFalso };
