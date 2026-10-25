import { Logger } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { EventosDominio } from './eventos-dominio';

const carga = { senhaId: 's1', prioridade: 'URGENTE' as const, novaPosicao: 1 };

describe('EventosDominio', () => {
  it('entrega aos assinantes e para de entregar depois de cancelar', () => {
    const eventos = new EventosDominio();
    const ouvinte = vi.fn();
    const cancelar = eventos.assinar('senha.reclassificada', ouvinte);

    eventos.emitir('senha.reclassificada', carga);
    cancelar();
    eventos.emitir('senha.reclassificada', carga);

    expect(ouvinte).toHaveBeenCalledTimes(1);
    expect(ouvinte).toHaveBeenCalledWith(carga);
  });

  it('assinante que falha não impede os outros nem derruba quem emitiu', () => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const eventos = new EventosDominio();
    const segundo = vi.fn();
    eventos.assinar('senha.reclassificada', () => {
      throw new Error('gateway fora');
    });
    eventos.assinar('senha.reclassificada', segundo);

    expect(() => eventos.emitir('senha.reclassificada', carga)).not.toThrow();
    expect(segundo).toHaveBeenCalled();
  });
});
