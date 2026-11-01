import { describe, expect, it, vi } from 'vitest';

import { candidatosDoBloco, criarAlocacaoApi, escolhaInicial, temApto } from '@/lib/alocacao/api';
import { API_URL } from '@/lib/api/config';
import { criarClienteHttp } from '@/lib/api/cliente-http';
import { usarServidorMock } from '@/test/servidor-mock';

usarServidorMock();

function api() {
  return criarAlocacaoApi(
    criarClienteHttp({
      baseUrl: API_URL,
      obterToken: () => `mock.usuario-admin.${Date.now() + 60_000}`,
      renovarToken: () => Promise.resolve(false),
      aoPerderSessao: vi.fn(),
    }),
  );
}

const entrada = {
  estudanteId: 'est-fisio-bruno',
  supervisorId: 'sup-elisa',
  salaId: 'sala-03',
  versao: 1,
};

describe('simulação da alocação (UC-10)', () => {
  it('RN-05: estudante com atendimento ativo vem inapto, com o motivo em texto', async () => {
    const { estudante } = await api().sugestoes('senha-f013');
    const carla = candidatosDoBloco(estudante).find((c) => c.nome === 'Carla Souza');
    expect(carla).toMatchObject({
      apto: false,
      motivoInaptidao: 'ATENDIMENTO_ATIVO',
      motivoTexto: 'Já possui atendimento ativo',
    });
    expect(escolhaInicial(estudante)).toBe('est-fisio-bruno');
  });

  it('RN-07: especialidade sem supervisão devolve o bloco de supervisor não aplicável', async () => {
    const { supervisor } = await api().sugestoes('senha-n105');
    expect(supervisor.aplicavel).toBe(false);
  });

  it('RN-09: sem sala compatível, o bloco de sala não tem nenhum apto', async () => {
    const { sala } = await api().sugestoes('senha-n106');
    expect(temApto(sala)).toBe(false);
    expect(escolhaInicial(sala)).toBeNull();
  });

  it('recurso que ficou indisponível recusa com RECURSO_INDISPONIVEL e passa a vir inapto', async () => {
    const alocacao = api();
    await expect(
      alocacao.confirmar('senha-f013', { ...entrada, estudanteId: 'est-fisio-ana' }, 'k1'),
    ).rejects.toMatchObject({ status: 409, codigo: 'RECURSO_INDISPONIVEL' });
    const { estudante } = await alocacao.sugestoes('senha-f013');
    expect(candidatosDoBloco(estudante).find((c) => c.id === 'est-fisio-ana')?.apto).toBe(false);
  });

  it('a mesma Idempotency-Key confirma uma vez só', async () => {
    const alocacao = api();
    const [a, b] = await Promise.all([
      alocacao.confirmar('senha-f013', entrada, 'mesma'),
      alocacao.confirmar('senha-f013', entrada, 'mesma'),
    ]);
    expect(b.id).toBe(a.id);
  });

  it('senha que não está chamada nem aguardando recurso não pode ser alocada', async () => {
    await expect(api().sugestoes('senha-f015')).rejects.toMatchObject({
      status: 409,
      codigo: 'TRANSICAO_INVALIDA',
    });
  });

  it('"Manter aguardando recurso" leva a senha para AGUARDANDO_RECURSO', async () => {
    await expect(
      api().manterAguardando('senha-n106', { recursoFaltante: 'SALA', versao: 1 }),
    ).resolves.toMatchObject({ status: 'AGUARDANDO_RECURSO', versao: 2 });
  });
});
