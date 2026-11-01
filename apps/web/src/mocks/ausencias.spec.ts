import { afterEach, describe, expect, it, vi } from 'vitest';

import { API_URL } from '@/lib/api/config';
import { criarClienteHttp } from '@/lib/api/cliente-http';
import { criarAusenciasApi, type RegistroAusencia } from '@/lib/ausencias/api';
import { criarConsultaAusencias } from '@/lib/ausencias/consulta';
import { usarServidorMock } from '@/test/servidor-mock';

import { assinarAusenciasAutomaticas, reiniciarMockAusencias } from './ausencias';

usarServidorMock();
afterEach(() => vi.useRealTimers());

function cliente(usuario = 'usuario-admin') {
  return criarClienteHttp({
    baseUrl: API_URL,
    obterToken: () => `mock.${usuario}.${Date.now() + 60_000}`,
    renovarToken: () => Promise.resolve(false),
    aoPerderSessao: vi.fn(),
  });
}
const entrada = { versao: 1, confirmadoAntesDaTolerancia: true };

describe('simulação HTTP da #47 sobre os endpoints do contrato', () => {
  it('lista filas e senhas sem conteúdo clínico, com paginação', async () => {
    const consulta = criarConsultaAusencias(cliente());
    const filas = await consulta.listarFilas();
    const quadro = await consulta.quadro(filas.dados[0]!.id, 1);
    expect(quadro.meta.total).toBe(6);
    expect(quadro.dados[0]).toMatchObject({ numero: 'F013', status: 'CHAMADA' });
    for (const senha of quadro.dados) {
      expect(senha).not.toHaveProperty('nomeCompleto');
      expect(senha).not.toHaveProperty('motivo');
      expect(senha).not.toHaveProperty('observacoes');
    }
  });

  it('RN-12: recusa ausência antecipada sem confirmação explícita', async () => {
    const api = criarAusenciasApi(cliente());
    await expect(
      api.registrarAusencia('senha-f013', {
        versao: 1,
        confirmadoAntesDaTolerancia: false,
      }),
    ).rejects.toMatchObject({ status: 409, codigo: 'TOLERANCIA_EM_CURSO' });
  });

  it('RN-12: registra ausência manual e mantém versão e status consistentes na consulta', async () => {
    const http = cliente();
    const registro = await criarAusenciasApi(http).registrarAusencia('senha-f013', entrada);
    expect(registro).toMatchObject({
      automatica: false,
      recursosLiberados: true,
      senha: { status: 'AUSENTE', versao: 2 },
    });
    const quadro = await criarConsultaAusencias(http).quadro('fila-ausencias-dev', 1);
    expect(quadro.dados.find((s) => s.id === 'senha-f013')).toMatchObject({
      status: 'AUSENTE',
      versao: 2,
    });
  });

  it.each(['senha-f014', 'senha-f018'])(
    'RN-13: devolve política de restrição no cenário %s',
    async (id) => {
      const registro = await criarAusenciasApi(cliente()).registrarAusencia(id, entrada);
      expect(registro.restricaoAplicada?.descricao).toBeTruthy();
      expect(['RESTRICAO_TEMPORARIA', 'CONFIRMACAO_PREVIA']).toContain(
        registro.restricaoAplicada?.tipo,
      );
    },
  );

  it('RN-12: expiração automática chega pela consulta e é notificada uma única vez', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    reiniciarMockAusencias();
    const ouvir = vi.fn<(registro: RegistroAusencia) => void>();
    const cancelar = assinarAusenciasAutomaticas(ouvir);
    try {
      vi.setSystemTime(Date.now() + 31_000);
      const consulta = criarConsultaAusencias(cliente());
      const quadro = await consulta.quadro('fila-ausencias-dev', 1);
      expect(quadro.dados.find((s) => s.id === 'senha-f017')?.status).toBe('AUSENTE');
      expect(ouvir).toHaveBeenCalledOnce();
      expect(ouvir.mock.calls[0]?.[0]).toMatchObject({
        automatica: true,
        senha: { numero: 'F017' },
      });
      await consulta.quadro('fila-ausencias-dev', 1);
      expect(ouvir).toHaveBeenCalledOnce();
    } finally {
      cancelar();
    }
  });

  it.each(['senha-f015', 'senha-f016'])(
    'registra desistência em %s sem confundir com ausência',
    async (id) => {
      const r = await criarAusenciasApi(cliente()).registrarDesistencia(id, {
        versao: 1,
        origem: 'PACIENTE',
      });
      expect(r.senha.status).toBe('DESISTENCIA');
      expect(r).not.toHaveProperty('automatica');
    },
  );

  it('recusa desistência de senha chamada', async () => {
    await expect(
      criarAusenciasApi(cliente()).registrarDesistencia('senha-f013', {
        versao: 1,
        origem: 'EQUIPE',
      }),
    ).rejects.toMatchObject({ status: 409, codigo: 'TRANSICAO_INVALIDA' });
  });

  it('recusa versão antiga após uma escrita', async () => {
    const api = criarAusenciasApi(cliente());
    await api.registrarAusencia('senha-f013', entrada);
    await expect(api.registrarAusencia('senha-f013', entrada)).rejects.toMatchObject({
      status: 409,
      codigo: 'VERSAO_DESATUALIZADA',
    });
  });

  it('recusa escrita sem permissão mesmo conhecendo o id', async () => {
    await expect(
      criarAusenciasApi(cliente('usuario-recepcao')).registrarAusencia('senha-f013', entrada),
    ).rejects.toMatchObject({ status: 403, codigo: 'SEM_PERMISSAO' });
  });
});
