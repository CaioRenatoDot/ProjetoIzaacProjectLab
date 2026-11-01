import { describe, expect, it, vi } from 'vitest';

import { TempoRealRepository } from '../tempo-real/tempo-real.repository';
import { PublicoRepository } from './publico.repository';
import { PublicoService } from './publico.service';

function cenario() {
  const repository = { consultar: vi.fn() };
  const relogio = { agora: vi.fn(() => new Date('2026-10-28T02:30:00Z')) };
  const service = new PublicoService(
    repository as unknown as PublicoRepository,
    {} as TempoRealRepository,
    relogio,
  );
  return { service, repository, relogio };
}

describe('consulta pública (UC-08, decisão da #20)', () => {
  it.each([
    [9, null],
    [10, 13],
  ])('com %i primeiras chamadas, estima %s minutos', async (amostra, esperado) => {
    const { service, repository } = cenario();
    repository.consultar.mockResolvedValue([
      {
        numero: 'F015',
        especialidade: 'Fisioterapia',
        status: 'AGUARDANDO',
        posicao: 4,
        local: null,
        amostra,
        media: 12.6,
        pacienteNome: 'Não pode sair',
      },
    ]);
    expect(await service.consultar('F015')).toEqual({
      numero: 'F015',
      especialidade: 'Fisioterapia',
      status: 'AGUARDANDO',
      posicao: 4,
      local: null,
      tempoEstimadoMinutos: esperado,
    });
  });

  it('não publica estimativa quando a senha já foi chamada', async () => {
    const { service, repository } = cenario();
    repository.consultar.mockResolvedValue([
      {
        numero: 'F015',
        especialidade: 'Fisioterapia',
        status: 'CHAMADA',
        posicao: null,
        local: 'Sala 03',
        amostra: 20,
        media: 15,
      },
    ]);
    expect(await service.consultar('F015')).toMatchObject({
      posicao: null,
      tempoEstimadoMinutos: null,
    });
  });

  it('RNF-02 limite móvel isola IPs e libera a consulta ao vencer a janela', () => {
    const { service, relogio } = cenario();
    for (let i = 0; i < 30; i++) expect(service.verificarLimite('origem-a')).toBeNull();
    expect(service.verificarLimite('origem-a')).toBe(60);
    expect(service.verificarLimite('origem-b')).toBeNull();
    relogio.agora.mockReturnValue(new Date('2026-10-28T02:30:30Z'));
    expect(service.verificarLimite('origem-a')).toBe(30);
    relogio.agora.mockReturnValue(new Date('2026-10-28T02:31:00Z'));
    expect(service.verificarLimite('origem-a')).toBeNull();
  });
});
