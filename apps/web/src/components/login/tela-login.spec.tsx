import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { API_URL } from '@/lib/api/config';
import { MENSAGEM_CREDENCIAL_INVALIDA, MENSAGEM_SEM_PERFIL } from '@/lib/sessao/login';
import { SENHA_MOCK } from '@/mocks/usuarios';
import { renderizarComSessao, servidor, usarServidorMock } from '@/test/servidor-mock';

import { TelaLogin, type TelaLoginProps } from './tela-login';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));

usarServidorMock();
beforeEach(() => replace.mockClear());

function abrir(props: TelaLoginProps = {}) {
  renderizarComSessao(<TelaLogin {...props} />);
  return userEvent.setup();
}

async function tentar(usuario: ReturnType<typeof userEvent.setup>, id: string, senha: string) {
  const identificacao = screen.getByLabelText(/Matrícula ou e-mail institucional/);
  const campoSenha = screen.getByLabelText(/^Senha/);
  await usuario.clear(identificacao);
  await usuario.type(identificacao, id);
  await usuario.clear(campoSenha);
  await usuario.type(campoSenha, senha);
  await usuario.click(screen.getByRole('button', { name: 'Entrar' }));
}

/** A área de erro é uma região `aria-live`: o leitor de tela anuncia o que entrar nela. */
const areaDeErro = () => document.querySelector('[aria-live="assertive"]');

describe('<TelaLogin> (W-01 / T-01)', () => {
  it('foco inicial no primeiro campo, com rótulo visível', () => {
    abrir();
    expect(screen.getByLabelText(/Matrícula ou e-mail institucional/)).toHaveFocus();
  });

  it('"Entrar" fica desabilitado até os dois campos estarem preenchidos', async () => {
    const usuario = abrir();
    const entrar = screen.getByRole('button', { name: 'Entrar' });
    expect(entrar).toBeDisabled();
    await usuario.type(screen.getByLabelText(/Matrícula ou e-mail institucional/), 'admin');
    expect(entrar).toBeDisabled();
    await usuario.type(screen.getByLabelText(/^Senha/), 'x');
    expect(entrar).toBeEnabled();
  });

  it('T-01: usuário inexistente e senha errada mostram a mesma mensagem genérica, em aria-live', async () => {
    const usuario = abrir();

    await tentar(usuario, 'ninguem@clinica.edu.br', SENHA_MOCK);
    await waitFor(() => expect(areaDeErro()).toHaveTextContent(MENSAGEM_CREDENCIAL_INVALIDA));
    const inexistente = areaDeErro()?.textContent;

    await tentar(usuario, 'admin@clinica.edu.br', 'senha-errada');
    await waitFor(() => expect(areaDeErro()).toHaveTextContent(MENSAGEM_CREDENCIAL_INVALIDA));
    expect(areaDeErro()?.textContent).toBe(inexistente);
  });

  it('T-01: depois da quinta tentativa, o bloqueio mostra o tempo restante', async () => {
    const usuario = abrir();
    for (let i = 0; i < 5; i += 1) await tentar(usuario, 'admin@clinica.edu.br', 'errada');
    await waitFor(() => expect(areaDeErro()).toHaveTextContent(/Tente novamente em 15 minutos/));
  });

  it('T-01: conta sem perfil avisa que a administração precisa liberar o acesso', async () => {
    const usuario = abrir();
    await tentar(usuario, 'semperfil@clinica.edu.br', SENHA_MOCK);
    await waitFor(() => expect(areaDeErro()).toHaveTextContent(MENSAGEM_SEM_PERFIL));
  });

  it('falha de rede descreve a causa e o próximo passo', async () => {
    servidor.use(http.post(`${API_URL}/auth/login`, () => HttpResponse.error()));
    const usuario = abrir();
    await tentar(usuario, 'admin@clinica.edu.br', SENHA_MOCK);
    await waitFor(() =>
      expect(areaDeErro()).toHaveTextContent(/Não foi possível conectar ao servidor/),
    );
  });

  it('ao entrar, volta para a rota que tinha aberto', async () => {
    const usuario = abrir({ redirect: '/triagem?etapa=2' });
    await tentar(usuario, 'admin@clinica.edu.br', SENHA_MOCK);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/triagem?etapa=2'));
  });

  it('redirect externo é ignorado: entra e vai para a home', async () => {
    const usuario = abrir({ redirect: '//exemplo.com' });
    await tentar(usuario, 'admin@clinica.edu.br', SENHA_MOCK);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'));
  });

  it('?expirada=1 mostra o aviso de sessão expirada', () => {
    abrir({ expirada: true });
    expect(screen.getByRole('status')).toHaveTextContent('Sua sessão expirou');
  });

  it('em terminal compartilhado, "Manter conectado" fica desabilitado e explicado', () => {
    abrir({ terminalCompartilhado: true });
    const manter = screen.getByRole('checkbox', { name: 'Manter conectado' });
    expect(manter).toBeDisabled();
    expect(manter).toHaveAccessibleDescription('Indisponível em terminal compartilhado.');
  });

  it('o alternador mostra e esconde a senha', async () => {
    const usuario = abrir();
    const senha = screen.getByLabelText(/^Senha/);
    const alternador = screen.getByRole('button', { name: 'Mostrar senha' });
    expect(senha).toHaveAttribute('type', 'password');
    await usuario.click(alternador);
    expect(senha).toHaveAttribute('type', 'text');
    expect(alternador).toHaveAttribute('aria-pressed', 'true');
  });
});
