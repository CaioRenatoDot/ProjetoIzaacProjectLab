import { act, render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { ConexaoProvider } from '@filas/ui';

import { ErroApi } from '@/lib/api/cliente-http';
import {
  type AusenciasApi,
  type SenhaOcorrencia,
  type RegistroAusencia,
} from '@/lib/ausencias/api';
import { renderizar } from '@/test/renderizar';

import { AcoesAusenciaDesistencia } from './acoes-ausencia-desistencia';
import { NotificacaoAusencia } from './notificacao-ausencia';

const senha: SenhaOcorrencia = {
  id: 'senha-1',
  numero: 'F013',
  versao: 2,
  status: 'CHAMADA',
  toleranciaAte: new Date(Date.now() + 134_000).toISOString(),
};
const resultado: RegistroAusencia = {
  senha: { ...senha, status: 'AUSENTE', versao: 3 },
  recursosLiberados: true,
  automatica: false,
  restricaoAplicada: null,
};

function preparar(
  opcoes: {
    status?: SenhaOcorrencia['status'];
    prazo?: string | null;
    permissoes?: string[];
    conectado?: boolean;
  } = {},
) {
  const api: AusenciasApi = {
    registrarAusencia: vi.fn().mockResolvedValue(resultado),
    registrarDesistencia: vi.fn().mockResolvedValue({
      senha: { ...senha, status: 'DESISTENCIA', versao: 3 },
      recursosLiberados: true,
    }),
  };
  const onRegistrada = vi.fn();
  const onAtualizar = vi.fn();
  renderizar(
    <ConexaoProvider conectado={opcoes.conectado ?? true}>
      <AcoesAusenciaDesistencia
        api={api}
        senha={{
          ...senha,
          status: opcoes.status ?? 'CHAMADA',
          toleranciaAte: opcoes.prazo === undefined ? senha.toleranciaAte : opcoes.prazo,
        }}
        onRegistrada={onRegistrada}
        onAtualizar={onAtualizar}
      />
    </ConexaoProvider>,
    opcoes.permissoes ?? ['ausencia:criar'],
  );
  return { api, onRegistrada, onAtualizar, usuario: userEvent.setup() };
}

async function abrirAusencia(usuario: ReturnType<typeof userEvent.setup>) {
  await usuario.click(screen.getByRole('button', { name: 'Registrar ausência' }));
}

afterEach(() => vi.useRealTimers());

describe('W-15 e W-16 — ausência e desistência', () => {
  it('RN-12: exige confirmação explícita antes de enviar ausência antecipada, com tempo restante', async () => {
    const { api, usuario, onRegistrada } = preparar();
    await abrirAusencia(usuario);
    expect(screen.getByText(/A tolerância ainda não expirou. Restam/)).toBeVisible();
    const confirmar = screen.getByRole('button', { name: 'Confirmar' });
    expect(confirmar).toBeDisabled();
    await usuario.click(confirmar);
    expect(api.registrarAusencia).not.toHaveBeenCalled();
    await usuario.click(screen.getByRole('checkbox'));
    await usuario.type(screen.getByLabelText('Observação (opcional)'), '  Sem comparecimento  ');
    await usuario.click(confirmar);
    await waitFor(() => expect(onRegistrada).toHaveBeenCalledWith(resultado.senha));
    expect(api.registrarAusencia).toHaveBeenCalledWith('senha-1', {
      versao: 2,
      observacao: 'Sem comparecimento',
      confirmadoAntesDaTolerancia: true,
    });
    expect(screen.getByText(/Os recursos alocados foram liberados/)).toBeVisible();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('RN-12: atualiza a contagem e permite confirmar após expirar sem executar ausência automática no cliente', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    const { api } = preparar({ prazo: new Date(Date.now() + 2000).toISOString() });
    const usuario = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await abrirAusencia(usuario);
    expect(screen.getByText(/Restam 00:02/)).toBeVisible();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(screen.getByText(/Restam 00:01/)).toBeVisible();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(screen.getByText('A tolerância expirou.')).toBeVisible();
    expect(api.registrarAusencia).not.toHaveBeenCalled();
    await usuario.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(api.registrarAusencia).toHaveBeenCalledWith('senha-1', {
      versao: 2,
      confirmadoAntesDaTolerancia: false,
    });
  });

  it.each(['RESTRICAO_TEMPORARIA', 'CONFIRMACAO_PREVIA'] as const)(
    'RN-13: anuncia a restrição %s e sua implicação informada pela API',
    async (tipo) => {
      const { api, usuario } = preparar({ prazo: new Date(0).toISOString() });
      vi.mocked(api.registrarAusencia).mockResolvedValueOnce({
        ...resultado,
        restricaoAplicada: {
          tipo,
          ate: '2026-11-20',
          descricao: 'Procure a recepção antes de agendar.',
        },
      });
      await abrirAusencia(usuario);
      await usuario.click(screen.getByRole('button', { name: 'Confirmar' }));
      const aviso = await screen.findByText(/Restrição aplicada:/);
      expect(aviso.closest('[aria-live="polite"]')).toBeInTheDocument();
      expect(aviso).toHaveTextContent('Procure a recepção antes de agendar.');
      expect(aviso).toHaveTextContent('20/11/2026');
    },
  );

  it('RN-12: registro automático notifica no painel sem modal nem requisição de escrita', () => {
    const { rerender } = render(<NotificacaoAusencia registro={null} />);
    const regiao = screen.getByRole('status');
    rerender(<NotificacaoAusencia registro={{ ...resultado, automatica: true }} />);
    expect(regiao).toHaveTextContent('automaticamente por expiração da tolerância');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirmar' })).not.toBeInTheDocument();
  });

  it('não oferece desistência para senha Chamada', () => {
    preparar();
    expect(screen.queryByRole('button', { name: 'Registrar desistência' })).not.toBeInTheDocument();
  });

  it.each([
    'AGUARDANDO_RECURSO',
    'PAUSADO',
    'PENDENTE_VALIDACAO',
    'ENCERRADO',
    'AUSENTE',
    'DESISTENCIA',
  ] as const)('não oferece ações para status %s', (status) => {
    preparar({ status });
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it.each(['AGUARDANDO', 'EM_ATENDIMENTO'] as const)(
    'registra desistência em %s com origem equipe e motivo opcional',
    async (status) => {
      const { api, usuario } = preparar({ status });
      await usuario.click(screen.getByRole('button', { name: 'Registrar desistência' }));
      await usuario.click(screen.getByLabelText('Equipe'));
      await usuario.click(screen.getByRole('button', { name: 'Confirmar' }));
      expect(api.registrarDesistencia).toHaveBeenCalledWith('senha-1', {
        versao: 2,
        origem: 'EQUIPE',
      });
      expect(api.registrarAusencia).not.toHaveBeenCalled();
      expect(await screen.findByText(/A senha saiu da fila ativa/)).toBeVisible();
    },
  );

  it('envia origem paciente e motivo informado, sem registrar ausência', async () => {
    const { api, usuario } = preparar({ status: 'AGUARDANDO' });
    await usuario.click(screen.getByRole('button', { name: 'Registrar desistência' }));
    await usuario.type(
      screen.getByLabelText('Motivo da desistência (opcional)'),
      '  Precisa sair  ',
    );
    await usuario.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(api.registrarDesistencia).toHaveBeenCalledWith('senha-1', {
      versao: 2,
      origem: 'PACIENTE',
      motivo: 'Precisa sair',
    });
    expect(api.registrarAusencia).not.toHaveBeenCalled();
  });

  it('oculta ações sem permissão', () => {
    preparar({ permissoes: [] });
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('403 mostra estado neutro e impede novo envio', async () => {
    const { api, usuario } = preparar({ prazo: new Date(0).toISOString() });
    vi.mocked(api.registrarAusencia).mockRejectedValueOnce(
      new ErroApi(403, 'SEM_PERMISSAO', 'Detalhe privado'),
    );
    await abrirAusencia(usuario);
    await usuario.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(await screen.findByText('Acesso não permitido')).toBeVisible();
    expect(screen.queryByText('Detalhe privado')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirmar' })).not.toBeInTheDocument();
  });

  it('409 impede repetição com versão antiga e oferece atualização pelo painel', async () => {
    const { api, usuario, onAtualizar } = preparar({ prazo: new Date(0).toISOString() });
    vi.mocked(api.registrarAusencia).mockRejectedValueOnce(
      new ErroApi(409, 'VERSAO_DESATUALIZADA', 'Conflito'),
    );
    await abrirAusencia(usuario);
    await usuario.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Atualize a senha');
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeDisabled();
    await usuario.click(screen.getByRole('button', { name: 'Atualizar senha' }));
    expect(onAtualizar).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('erro de rede mantém o texto para tentar novamente', async () => {
    const { api, usuario } = preparar({ prazo: new Date(0).toISOString() });
    vi.mocked(api.registrarAusencia).mockRejectedValueOnce(new Error('Rede'));
    await abrirAusencia(usuario);
    await usuario.type(screen.getByLabelText('Observação (opcional)'), 'Não compareceu');
    await usuario.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Verifique a conexão');
    expect(screen.getByLabelText('Observação (opcional)')).toHaveValue('Não compareceu');
    await usuario.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(api.registrarAusencia).toHaveBeenCalledTimes(2);
  });

  it('impede envio e fechamento durante carregamento', async () => {
    const { api, usuario } = preparar({ prazo: new Date(0).toISOString() });
    let concluir!: (r: RegistroAusencia) => void;
    vi.mocked(api.registrarAusencia).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          concluir = resolve;
        }),
    );
    await abrirAusencia(usuario);
    await usuario.dblClick(screen.getByRole('button', { name: 'Confirmar' }));
    expect(api.registrarAusencia).toHaveBeenCalledOnce();
    expect(screen.getByText('Registrando…')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    await usuario.keyboard('{Escape}');
    expect(screen.getByRole('dialog')).toBeVisible();
    await act(async () => {
      concluir(resultado);
      await Promise.resolve();
    });
  });

  it('bloqueia escrita sem conexão', () => {
    preparar({ conectado: false });
    expect(screen.getByRole('button', { name: 'Registrar ausência' })).toBeDisabled();
  });

  it('RN-12: tolerância indisponível não permite assumir ausência vencida', async () => {
    const { usuario, api } = preparar({ prazo: null });
    await abrirAusencia(usuario);
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível consultar a tolerância');
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeDisabled();
    expect(api.registrarAusencia).not.toHaveBeenCalled();
  });

  it('prende o foco, devolve ao gatilho e mantém Confirmar destrutivo à direita', async () => {
    const { usuario, api } = preparar();
    const gatilho = screen.getByRole('button', { name: 'Registrar ausência' });
    await abrirAusencia(usuario);
    const dialogo = screen.getByRole('dialog');
    for (let i = 0; i < 8; i++) {
      await usuario.tab();
      expect(dialogo).toContainElement(document.activeElement as HTMLElement);
    }
    const botoes = within(dialogo).getAllByRole('button');
    expect(botoes.map((b) => b.textContent)).toEqual(['Cancelar', 'Confirmar']);
    expect(botoes[1]).toHaveAttribute('data-variante', 'destrutivo');
    await usuario.keyboard('{Escape}');
    await waitFor(() => expect(gatilho).toHaveFocus());
    expect(api.registrarAusencia).not.toHaveBeenCalled();
  });
});
