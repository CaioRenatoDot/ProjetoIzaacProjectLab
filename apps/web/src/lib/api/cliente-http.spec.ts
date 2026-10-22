import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { servidor, usarServidorMock } from '@/test/servidor-mock';

import { criarClienteHttp, ErroApi } from './cliente-http';

const BASE = 'http://api.teste/api/v1';

usarServidorMock();

function criar(renovar: () => Promise<boolean> = () => Promise.resolve(false)) {
  let token: string | null = 'velho';
  const renovarToken = vi.fn(async () => {
    const ok = await renovar();
    if (ok) token = 'novo';
    return ok;
  });
  const aoPerderSessao = vi.fn();
  const cliente = criarClienteHttp({
    baseUrl: BASE,
    obterToken: () => token,
    renovarToken,
    aoPerderSessao,
  });
  return { cliente, renovarToken, aoPerderSessao };
}

/** Responde 200 só com o token renovado. */
function exigirTokenNovo(caminho: string) {
  servidor.use(
    http.get(`${BASE}${caminho}`, ({ request }) =>
      request.headers.get('Authorization') === 'Bearer novo'
        ? HttpResponse.json({ ok: true })
        : HttpResponse.json({ status: 401, codigo: 'NAO_AUTENTICADO' }, { status: 401 }),
    ),
  );
}

describe('criarClienteHttp', () => {
  it('envia o access token e devolve o JSON', async () => {
    servidor.use(
      http.get(`${BASE}/eco`, ({ request }) =>
        HttpResponse.json({ autorizacao: request.headers.get('Authorization') }),
      ),
    );
    const { cliente } = criar();
    await expect(cliente.requisitar('/eco')).resolves.toEqual({ autorizacao: 'Bearer velho' });
  });

  it('converte o erro da API em { status, codigo, detail, campos }', async () => {
    servidor.use(
      http.post(`${BASE}/triagens`, () =>
        HttpResponse.json(
          {
            title: 'Dados inválidos',
            status: 422,
            codigo: 'VALIDACAO',
            detail: 'Revise os campos.',
            campos: [{ campo: 'motivo', mensagem: 'Informe o motivo.' }],
          },
          { status: 422 },
        ),
      ),
    );
    const { cliente } = criar();
    const erro = await cliente
      .requisitar('/triagens', { metodo: 'POST', corpo: {} })
      .catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroApi);
    expect(erro).toMatchObject({
      status: 422,
      codigo: 'VALIDACAO',
      detail: 'Revise os campos.',
      campos: [{ campo: 'motivo', mensagem: 'Informe o motivo.' }],
    });
  });

  it('falha de rede vira ErroApi com codigo REDE', async () => {
    servidor.use(http.get(`${BASE}/eco`, () => HttpResponse.error()));
    const { cliente } = criar();
    await expect(cliente.requisitar('/eco')).rejects.toMatchObject({ status: 0, codigo: 'REDE' });
  });

  it('num 401, renova o token uma vez e repete a requisição', async () => {
    exigirTokenNovo('/protegido');
    const { cliente, renovarToken, aoPerderSessao } = criar(() => Promise.resolve(true));
    await expect(cliente.requisitar('/protegido')).resolves.toEqual({ ok: true });
    expect(renovarToken).toHaveBeenCalledTimes(1);
    expect(aoPerderSessao).not.toHaveBeenCalled();
  });

  it('vários 401 ao mesmo tempo disparam um refresh só', async () => {
    exigirTokenNovo('/protegido');
    const { cliente, renovarToken } = criar(
      () => new Promise((resolver) => setTimeout(() => resolver(true), 20)),
    );
    await Promise.all([1, 2, 3].map(() => cliente.requisitar('/protegido')));
    expect(renovarToken).toHaveBeenCalledTimes(1);
  });

  it('se o refresh falhar, avisa que a sessão caiu e propaga o 401', async () => {
    exigirTokenNovo('/protegido');
    const { cliente, aoPerderSessao } = criar(() => Promise.resolve(false));
    await expect(cliente.requisitar('/protegido')).rejects.toMatchObject({ status: 401 });
    expect(aoPerderSessao).toHaveBeenCalledTimes(1);
  });

  it('semRenovar não tenta refresh (login, refresh, logout)', async () => {
    exigirTokenNovo('/protegido');
    const { cliente, renovarToken, aoPerderSessao } = criar(() => Promise.resolve(true));
    await expect(cliente.requisitar('/protegido', { semRenovar: true })).rejects.toMatchObject({
      status: 401,
    });
    expect(renovarToken).not.toHaveBeenCalled();
    expect(aoPerderSessao).not.toHaveBeenCalled();
  });
});
