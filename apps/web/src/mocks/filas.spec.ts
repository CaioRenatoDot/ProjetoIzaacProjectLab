import { describe, expect, it, vi } from 'vitest';

import { API_URL } from '@/lib/api/config';
import { criarClienteHttp } from '@/lib/api/cliente-http';
import { criarFilaApi } from '@/lib/fila/api';
import { criarReclassificacaoHttp } from '@/lib/fila/reclassificacao-http';
import { usarServidorMock } from '@/test/servidor-mock';

usarServidorMock();

function cliente() {
  return criarClienteHttp({
    baseUrl: API_URL,
    obterToken: () => `mock.usuario-admin.${Date.now() + 60_000}`,
    renovarToken: () => Promise.resolve(false),
    aoPerderSessao: vi.fn(),
  });
}

const aguardando = async (filaId: string) =>
  (await criarFilaApi(cliente()).quadro(filaId, '')).dados.filter((s) => s.status === 'AGUARDANDO');

describe('simulação da fila (contrato de /filas)', () => {
  it('RN-04: prioridade, depois chegada; preferencial mais nova vem antes de normal mais antiga', async () => {
    const lista = await aguardando('fila-nutricao');
    expect(lista.map((s) => [s.numero, s.prioridade])).toEqual([
      ['N103', 'URGENTE'],
      ['N102', 'PREFERENCIAL'],
      ['N104', 'NORMAL'],
      ['N101', 'NORMAL'],
    ]);
    expect(lista.map((s) => s.posicao)).toEqual([1, 2, 3, 4]);
  });

  it('RN-10: fila bloqueada recusa a chamada com FILA_BLOQUEADA; as outras chamam', async () => {
    const api = criarFilaApi(cliente());
    await expect(api.chamarProxima('fila-fonoaudiologia', 'chave-1')).rejects.toMatchObject({
      status: 409,
      codigo: 'FILA_BLOQUEADA',
    });
    await expect(api.chamarProxima('fila-nutricao', 'chave-2')).resolves.toMatchObject({
      senha: { numero: 'N103', status: 'CHAMADA' },
    });
  });

  it('a mesma Idempotency-Key chama uma senha só', async () => {
    const api = criarFilaApi(cliente());
    const [primeira, segunda] = await Promise.all([
      api.chamarProxima('fila-nutricao', 'mesma-chave'),
      api.chamarProxima('fila-nutricao', 'mesma-chave'),
    ]);
    expect(segunda.senha.id).toBe(primeira.senha.id);
    expect((await aguardando('fila-nutricao')).map((s) => s.numero)).toEqual([
      'N102',
      'N104',
      'N101',
    ]);
  });

  it('chaves diferentes chamam senhas diferentes, na ordem da RN-04', async () => {
    const api = criarFilaApi(cliente());
    const a = await api.chamarProxima('fila-nutricao', 'chave-a');
    const b = await api.chamarProxima('fila-nutricao', 'chave-b');
    expect([a.senha.numero, b.senha.numero]).toEqual(['N103', 'N102']);
    expect(a.furouFilaPorUrgencia).toBe(true);
    expect(b.furouFilaPorUrgencia).toBe(false);
  });

  it('fila sem senha aguardando devolve FILA_VAZIA', async () => {
    await expect(
      criarFilaApi(cliente()).chamarProxima('fila-psicologia', 'chave-vazia'),
    ).rejects.toMatchObject({ status: 409, codigo: 'FILA_VAZIA' });
  });

  it('ADR-003: a justificativa da reclassificação não sai no quadro', async () => {
    const reclassificacao = criarReclassificacaoHttp(cliente());
    const justificativa = 'Dor torácica relatada na chegada, avaliar com prioridade';
    await reclassificacao.reclassificar({
      senhaId: 'senha-n101',
      prioridade: 'URGENTE',
      justificativa,
      versao: 1,
    });
    const quadro = await criarFilaApi(cliente()).quadro('fila-nutricao', '');
    expect(JSON.stringify(quadro)).not.toContain(justificativa);
    expect(quadro.dados[0]).not.toHaveProperty('reclassificacoes');
    expect(await reclassificacao.historicoReclassificacoes('senha-n101')).toHaveLength(1);
  });

  it('rechamada incrementa a sequência da chamada', async () => {
    const api = criarFilaApi(cliente());
    const { chamada } = await api.chamarProxima('fila-nutricao', 'chave-r');
    await expect(api.rechamar(chamada.id)).resolves.toMatchObject({ sequencia: 2 });
  });
});
