import { PermissoesProvider, ToastProvider } from '@filas/ui';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { senhasDaSimulacao } from '@/mocks/filas';
import { comSessaoAnterior, renderizarComSessao, usarServidorMock } from '@/test/servidor-mock';

import { ListaAtendimentos } from './lista-atendimentos';
import { TelaAtendimento } from './tela-atendimento';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));

usarServidorMock();
beforeEach(() => push.mockClear());

const ESTUDANTE = [
  'atendimento:consultar',
  'atendimento:criar',
  'atendimento:editar',
  'atendimento:consultar_sensivel',
  'alocacao:criar',
];
const SUPERVISOR = [
  'atendimento:consultar',
  'atendimento:validar',
  'atendimento:consultar_sensivel',
];

function abrir(senhaId: string, permissoes = ESTUDANTE) {
  comSessaoAnterior();
  renderizarComSessao(
    <PermissoesProvider permissoes={permissoes}>
      <ToastProvider>
        <TelaAtendimento senhaId={senhaId} />
      </ToastProvider>
    </PermissoesProvider>,
  );
  return userEvent.setup();
}

const titulo = (numero: string) =>
  screen.findByRole('heading', { name: new RegExp(`^Atendimento: senha ${numero}`) });
const botao = (nome: string) => screen.getByRole('button', { name: nome });
const status = (texto: string) =>
  waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(texto));

describe('<TelaAtendimento> (W-12 / W-13 / T-13)', () => {
  it('em atendimento: cabeçalho com recursos e duração, triagem com aviso de acesso registrado', async () => {
    abrir('senha-f016');
    expect(await titulo('F016')).toHaveTextContent('Sala 01');
    expect(
      screen.getByText(/Estudante: Carla Souza · Supervisor: Prof\. Elisa Nunes · Início/),
    ).toBeInTheDocument();
    expect(screen.getByText('Duração:').parentElement).toHaveTextContent(/Duração: \d+ min/);
    const triagem = screen.getByRole('region', { name: 'Dados da triagem' });
    expect(triagem).toHaveTextContent('registrada na trilha de auditoria');
    expect(triagem).toHaveTextContent(/Dor lombar/);
    expect(botao('Pausar')).toBeInTheDocument();
    expect(botao('Encerrar atendimento')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Validar' })).not.toBeInTheDocument();
  });

  it('desfecho obrigatório: encerrar sem desfecho é bloqueado com a mensagem abaixo do campo', async () => {
    const usuario = abrir('senha-n107');
    await titulo('N107');
    await usuario.click(botao('Encerrar atendimento'));
    const modal = await screen.findByRole('dialog', { name: /Encerrar atendimento: senha N107/ });
    await usuario.click(within(modal).getByRole('button', { name: 'Encerrar' }));

    const grupo = within(modal).getByRole('group', { name: 'Desfecho (obrigatório)' });
    expect(grupo).toHaveAccessibleDescription('Escolha o desfecho para encerrar o atendimento.');
    expect(within(grupo).getByRole('radio', { name: 'Alta' })).toHaveFocus();
    expect(senhasDaSimulacao().find((s) => s.id === 'senha-n107')?.status).toBe('EM_ATENDIMENTO');
  });

  it('RN-11: sem validação exigida, o encerramento é imediato', async () => {
    const usuario = abrir('senha-n107');
    await titulo('N107');
    await usuario.click(botao('Encerrar atendimento'));
    const modal = await screen.findByRole('dialog');
    await usuario.click(within(modal).getByRole('radio', { name: 'Retorno agendado' }));
    await usuario.click(within(modal).getByRole('button', { name: 'Encerrar' }));

    await status('Encerramento registrado. Status: Encerrado.');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText(/Retorno agendado · encerrado às/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Encerrar/ })).not.toBeInTheDocument();
  });

  it('RN-11: especialidade que exige validação leva a "Pendente de validação", sem validar para o estudante', async () => {
    const usuario = abrir('senha-f016');
    await titulo('F016');
    await usuario.click(botao('Encerrar atendimento'));
    const modal = await screen.findByRole('dialog');
    await usuario.click(within(modal).getByRole('radio', { name: 'Alta' }));
    await usuario.click(within(modal).getByRole('button', { name: 'Encerrar' }));

    await status('Status: Pendente de validação.');
    expect(screen.getAllByText('Pendente de validação').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Validar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Recusar validação' })).not.toBeInTheDocument();
  });

  it('RN-11: o supervisor vê "Validar" e "Recusar validação"; validar encerra', async () => {
    const usuario = abrir('senha-n109', SUPERVISOR);
    await titulo('N109');
    const painel = screen.getByRole('region', { name: 'Validação do supervisor' });
    expect(painel).toHaveTextContent('Senha N109 · desfecho: Alta');
    expect(painel).toHaveTextContent('Responsável: Marcos Vieira');
    expect(screen.queryByRole('button', { name: 'Encerrar atendimento' })).not.toBeInTheDocument();

    await usuario.click(within(painel).getByRole('button', { name: 'Validar' }));
    await status('Encerramento validado. Status: Encerrado.');
    expect(screen.getByText(/^Usuário de desenvolvimento às/)).toBeInTheDocument();
  });

  it('RN-11: recusa sem parecer é bloqueada; com parecer, o status continua pendente e o parecer fica registrado', async () => {
    const usuario = abrir('senha-n109', SUPERVISOR);
    await titulo('N109');
    const painel = screen.getByRole('region', { name: 'Validação do supervisor' });
    await usuario.click(within(painel).getByRole('button', { name: 'Recusar validação' }));
    const parecer = within(painel).getByLabelText('Parecer do supervisor');
    expect(parecer).toHaveFocus();
    expect(parecer).toHaveAccessibleDescription(/Informe o parecer da recusa\./);

    await usuario.type(parecer, 'Registrar a orientação entregue ao paciente.');
    await usuario.click(within(painel).getByRole('button', { name: 'Recusar validação' }));
    await status('Validação recusada. O parecer foi registrado');
    expect(screen.getByText('Registrar a orientação entregue ao paciente.')).toBeInTheDocument();
    expect(screen.getAllByText('Pendente de validação').length).toBeGreaterThan(0);
    expect(senhasDaSimulacao().find((s) => s.id === 'senha-n109')?.status).toBe(
      'PENDENTE_VALIDACAO',
    );
  });

  it('pausar com motivo e retomar, com a mudança de status anunciada', async () => {
    const usuario = abrir('senha-n107');
    await titulo('N107');
    await usuario.click(botao('Pausar'));
    const modal = await screen.findByRole('dialog', { name: /Pausar o atendimento/ });
    await usuario.type(within(modal).getByLabelText('Motivo da pausa'), 'Paciente foi ao banheiro');
    await usuario.click(within(modal).getByRole('button', { name: 'Pausar' }));

    await status('Atendimento pausado. Status: Pausado.');
    expect(screen.getByText(/Paciente foi ao banheiro/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Encerrar atendimento' })).not.toBeInTheDocument();

    await usuario.click(botao('Retomar'));
    await status('Atendimento retomado. Status: Em atendimento.');
    expect(botao('Encerrar atendimento')).toBeInTheDocument();
  });

  it('senha alocada: "Iniciar atendimento" registra o início e mostra os recursos', async () => {
    const usuario = abrir('senha-n105');
    await titulo('N105');
    expect(screen.getByText(/Atendimento ainda não iniciado/)).toBeInTheDocument();
    await usuario.click(botao('Iniciar atendimento'));

    await status('Atendimento iniciado. Status: Em atendimento.');
    expect(await titulo('N105')).toHaveTextContent('Sala 02');
    expect(screen.getByText(/Estudante: Heitor Prado/)).toBeInTheDocument();
  });

  it('recurso indisponível ao iniciar devolve para a alocação', async () => {
    const usuario = abrir('senha-f018');
    await titulo('F018');
    await usuario.click(botao('Iniciar atendimento'));

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent(/Sala 05 entrou em manutenção.*É preciso refazer a alocação/);
    expect(within(alerta).getByRole('link', { name: 'Ir para a alocação' })).toHaveAttribute(
      'href',
      '/fila/senhas/senha-f018/alocacao',
    );
  });

  it('senha sem alocação explica a causa e leva à alocação', async () => {
    const usuario = abrir('senha-f013');
    await titulo('F013');
    await usuario.click(botao('Iniciar atendimento'));
    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('Aloque estudante e sala antes de iniciar o atendimento.');
    expect(within(alerta).getByRole('link', { name: 'Ir para a alocação' })).toBeInTheDocument();
  });

  it('versão desatualizada recarrega a tela e diz o que mudou', async () => {
    const usuario = abrir('senha-n107');
    await titulo('N107');
    // Outra pessoa pausa o atendimento enquanto a tela está aberta.
    const senha = senhasDaSimulacao().find((s) => s.id === 'senha-n107')!;
    senha.status = 'PAUSADO';
    senha.versao += 1;

    await usuario.click(botao('Pausar'));
    const modal = await screen.findByRole('dialog');
    await usuario.click(within(modal).getByRole('button', { name: 'Pausar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Outra pessoa alterou este atendimento: o status passou de Em atendimento para Pausado.',
    );
    expect(botao('Retomar')).toBeInTheDocument();
  });

  it('desfecho de encaminhamento segue para a tela de encaminhamento', async () => {
    const usuario = abrir('senha-n107');
    await titulo('N107');
    await usuario.click(botao('Encerrar atendimento'));
    const modal = await screen.findByRole('dialog');
    await usuario.click(within(modal).getByRole('radio', { name: 'Encaminhamento externo' }));
    await usuario.click(within(modal).getByRole('button', { name: 'Encerrar' }));
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(expect.stringMatching(/^\/encaminhamento\?atendimento=/)),
    );
  });

  it('sem atendimento:consultar mostra o estado neutro de sem permissão', () => {
    abrir('senha-f016', ['fila:consultar']);
    expect(screen.getByText('Acesso não permitido')).toBeInTheDocument();
  });

  it('sem atendimento:consultar_sensivel não busca nem mostra a triagem', async () => {
    abrir('senha-f016', ['atendimento:consultar', 'atendimento:editar']);
    await titulo('F016');
    expect(screen.queryByRole('region', { name: 'Dados da triagem' })).not.toBeInTheDocument();
    expect(screen.getByText(/Paciente P\. R\. A\./)).toBeInTheDocument();
  });
});

describe('<ListaAtendimentos>', () => {
  function abrirLista() {
    comSessaoAnterior();
    renderizarComSessao(
      <PermissoesProvider permissoes={['atendimento:consultar']}>
        <ListaAtendimentos filtroInicial="ativos" />
      </PermissoesProvider>,
    );
    return userEvent.setup();
  }

  it('lista os atendimentos em curso, sem dado clínico, com link para cada um', async () => {
    abrirLista();
    const tabela = await screen.findByRole('table');
    for (const numero of ['F016', 'N107', 'N108', 'N109']) {
      expect(within(tabela).getByRole('link', { name: numero })).toBeInTheDocument();
    }
    expect(within(tabela).getByRole('link', { name: 'F016' })).toHaveAttribute(
      'href',
      '/atendimento?senha=senha-f016',
    );
    expect(tabela).not.toHaveTextContent(/Dor lombar|Pedro Rocha Alves/);
  });

  it('filtrar por situação sem resultado mostra o estado vazio', async () => {
    const usuario = abrirLista();
    await screen.findByRole('table');
    await usuario.selectOptions(screen.getByLabelText('Situação'), 'encerrado');
    expect(await screen.findByText('Nenhum atendimento nesta situação')).toBeInTheDocument();
  });
});
