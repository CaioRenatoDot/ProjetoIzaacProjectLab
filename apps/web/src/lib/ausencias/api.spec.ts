import { describe, expect, it, vi } from 'vitest';

import { criarAusenciasApi } from './api';

describe('cliente HTTP de ausência e desistência', () => {
  it('RN-12: envia observação, versão e confirmação antecipada ao endpoint de ausência', async () => {
    const requisitar = vi.fn().mockResolvedValue({ recursosLiberados: true });
    const api = criarAusenciasApi({ requisitar });
    const corpo = {
      versao: 4,
      observacao: 'Sem comparecimento',
      confirmadoAntesDaTolerancia: true,
    };
    await api.registrarAusencia('senha/1', corpo);
    expect(requisitar).toHaveBeenCalledWith('/senhas/senha%2F1/ausencia', {
      metodo: 'POST',
      corpo,
    });
  });

  it('envia desistência ao endpoint separado sem acrescentar motivo obrigatório', async () => {
    const requisitar = vi.fn().mockResolvedValue({ recursosLiberados: true });
    const api = criarAusenciasApi({ requisitar });
    const corpo = { versao: 4, origem: 'PACIENTE' as const };
    await api.registrarDesistencia('senha-1', corpo);
    expect(requisitar).toHaveBeenCalledWith('/senhas/senha-1/desistencia', {
      metodo: 'POST',
      corpo,
    });
  });
});
