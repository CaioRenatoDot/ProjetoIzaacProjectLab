import { http, HttpResponse } from 'msw';

import { API_URL } from '@/lib/api/config';
import { type UsuarioSessao } from '@/lib/sessao/tipos';

import { COOKIE_PERMISSOES_DEV, COOKIE_REFRESH_MOCK } from './cookies';
import { buscarUsuarioMock, SENHA_MOCK, usuarioMockPorId } from './usuarios';

const MAXIMO_TENTATIVAS = 5;
const BLOQUEIO_MINUTOS = 15;
const EXPIRA_EM_SEGUNDOS = 15 * 60;

const tentativas = new Map<string, number>();
const bloqueios = new Map<string, number>();

/** Zera tentativas e bloqueios (entre testes). */
export function reiniciarMockAuth() {
  tentativas.clear();
  bloqueios.clear();
}

function problema(status: number, codigo: string, title: string, detail: string) {
  return HttpResponse.json(
    { title, status, codigo, detail },
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  );
}

const naoAutenticado = () =>
  problema(401, 'NAO_AUTENTICADO', 'Não autenticado', 'Sua sessão expirou. Entre novamente.');

function comPermissoesDev(usuario: UsuarioSessao, cookies: Record<string, string>) {
  const permissoes = cookies[COOKIE_PERMISSOES_DEV];
  if (permissoes === undefined) return usuario;
  return {
    ...usuario,
    perfilNome: 'Perfil de teste',
    permissoes: permissoes.split(',').filter(Boolean),
  };
}

const tokenPara = (id: string) => `mock.${id}.${Date.now() + EXPIRA_EM_SEGUNDOS * 1000}`;

function usuarioDoToken(autorizacao: string | null) {
  const [, id, expira] = autorizacao?.replace(/^Bearer /, '').split('.') ?? [];
  if (!id || Number(expira) < Date.now()) return null;
  return usuarioMockPorId(id);
}

/** Simulação de `/auth/*` conforme `docs/api/openapi.yaml`, até a API real (#10). */
export const handlers = [
  http.post(`${API_URL}/auth/login`, async ({ request, cookies }) => {
    const { identificacao = '', senha = '' } = (await request.json()) as {
      identificacao?: string;
      senha?: string;
    };
    const chave = identificacao.trim().toLocaleLowerCase('pt-BR');

    const bloqueadoAte = bloqueios.get(chave) ?? 0;
    if (bloqueadoAte > Date.now()) {
      const minutos = Math.ceil((bloqueadoAte - Date.now()) / 60_000);
      return problema(
        401,
        'BLOQUEIO_TEMPORARIO',
        'Acesso bloqueado temporariamente',
        `Excesso de tentativas. Tente novamente em ${minutos} minutos.`,
      );
    }

    const usuario = buscarUsuarioMock(chave);
    if (!usuario || senha !== SENHA_MOCK) {
      const falhas = (tentativas.get(chave) ?? 0) + 1;
      tentativas.set(chave, falhas);
      if (falhas >= MAXIMO_TENTATIVAS) {
        tentativas.delete(chave);
        bloqueios.set(chave, Date.now() + BLOQUEIO_MINUTOS * 60_000);
        return problema(
          401,
          'BLOQUEIO_TEMPORARIO',
          'Acesso bloqueado temporariamente',
          `Excesso de tentativas. Tente novamente em ${BLOQUEIO_MINUTOS} minutos.`,
        );
      }
      return problema(
        401,
        'CREDENCIAL_INVALIDA',
        'Não foi possível entrar',
        'Identificação ou senha incorreta. Verifique os dados e tente novamente.',
      );
    }

    tentativas.delete(chave);
    if (!usuario.sessao) {
      return problema(
        403,
        'SEM_PERFIL',
        'Conta sem perfil',
        'Sua conta ainda não tem perfil de acesso. Procure a administração da unidade.',
      );
    }
    return HttpResponse.json(
      {
        accessToken: tokenPara(usuario.sessao.id),
        expiraEm: EXPIRA_EM_SEGUNDOS,
        usuario: comPermissoesDev(usuario.sessao, cookies),
      },
      { headers: { 'Set-Cookie': `${COOKIE_REFRESH_MOCK}=${usuario.sessao.id}; Path=/` } },
    );
  }),

  http.post(`${API_URL}/auth/refresh`, ({ cookies }) => {
    const usuario = usuarioMockPorId(cookies[COOKIE_REFRESH_MOCK] ?? '');
    if (!usuario) return naoAutenticado();
    return HttpResponse.json({ accessToken: tokenPara(usuario.id), expiraEm: EXPIRA_EM_SEGUNDOS });
  }),

  http.post(
    `${API_URL}/auth/logout`,
    () =>
      new HttpResponse(null, {
        status: 204,
        headers: { 'Set-Cookie': `${COOKIE_REFRESH_MOCK}=; Path=/; Max-Age=0` },
      }),
  ),

  http.get(`${API_URL}/auth/me`, ({ request, cookies }) => {
    const usuario = usuarioDoToken(request.headers.get('Authorization'));
    if (!usuario) return naoAutenticado();
    return HttpResponse.json(comPermissoesDev(usuario, cookies));
  }),
];
