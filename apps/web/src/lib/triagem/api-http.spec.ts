import { describe, expect, it, vi } from 'vitest';

import { ErroApi } from '@/lib/api/cliente-http';

import { criarTriagemHttp } from './api-http';
import { ErroTriagem } from './tipos';

const paciente = (id: string, ativo = true) => ({
  id,
  nomeCompleto: 'Nome Completo Fictício',
  iniciais: 'N. C. F.',
  documento: '00000000001',
  dataNascimento: '1990-05-10',
  contatoTelefone: null,
  contatoEmail: null,
  vinculo: 'ALUNO',
  restricaoAtiva: false,
  restricaoAte: null,
  ativo,
});

describe('cliente HTTP da triagem (W-06, W-07)', () => {
  it('P-03: a busca não repassa o nome completo para a tela e ignora inativos', async () => {
    const requisitar = vi
      .fn()
      .mockResolvedValue({ dados: [paciente('p1'), paciente('p2', false)] });
    const pacientes = await criarTriagemHttp({ requisitar }).buscarPacientes(' 000.000 ');

    expect(requisitar).toHaveBeenCalledWith('/pacientes?busca=000.000&tamanho=20');
    expect(pacientes).toEqual([
      {
        id: 'p1',
        iniciais: 'N. C. F.',
        documento: '00000000001',
        vinculo: 'ALUNO',
        restricaoAtiva: false,
        restricaoAte: null,
      },
    ]);
  });

  it('busca vazia não chama a API', async () => {
    const requisitar = vi.fn();
    expect(await criarTriagemHttp({ requisitar }).buscarPacientes('   ')).toEqual([]);
    expect(requisitar).not.toHaveBeenCalled();
  });

  it('pede só especialidades ativas com fila (Tabela 9, ID03)', async () => {
    const requisitar = vi.fn().mockResolvedValue({ dados: [] });
    await criarTriagemHttp({ requisitar }).listarEspecialidades();
    expect(requisitar).toHaveBeenCalledWith('/especialidades?ativa=true&comFila=true&tamanho=100');
  });

  it('UC-06: SEM_FILA_CONFIGURADA vira ErroTriagem com a mensagem do servidor', async () => {
    const requisitar = vi
      .fn()
      .mockRejectedValue(
        new ErroApi(409, 'SEM_FILA_CONFIGURADA', 'Peça à administração para configurar a fila.'),
      );
    const emissao = criarTriagemHttp({ requisitar }).emitirSenha({
      triagemId: 't1',
      tipoAtendimento: 'RETORNO',
    });

    await expect(emissao).rejects.toEqual(
      new ErroTriagem('SEM_FILA_CONFIGURADA', 'Peça à administração para configurar a fila.'),
    );
    expect(requisitar).toHaveBeenCalledWith('/senhas', {
      metodo: 'POST',
      corpo: { triagemId: 't1', tipoAtendimento: 'RETORNO' },
    });
  });

  it('RN-10: o aviso de fila bloqueada chega à tela junto com a senha', async () => {
    const requisitar = vi.fn().mockResolvedValue({
      id: 's1',
      numero: 'N001',
      especialidade: 'Nutrição',
      pacienteIniciais: 'N. C. F.',
      prioridade: 'NORMAL',
      tipoAtendimento: 'PRIMEIRA_CONSULTA',
      posicaoEstimada: 3,
      versao: 1,
      avisos: [{ codigo: 'FILA_BLOQUEADA', mensagem: 'A chamada está suspensa.' }],
    });
    const senha = await criarTriagemHttp({ requisitar }).emitirSenha({
      triagemId: 't1',
      tipoAtendimento: 'PRIMEIRA_CONSULTA',
    });

    expect(senha).toMatchObject({ numero: 'N001', posicaoEstimada: 3, versao: 1 });
    expect(senha.avisos).toEqual([
      { codigo: 'FILA_BLOQUEADA', mensagem: 'A chamada está suspensa.' },
    ]);
  });

  it('outros erros seguem como ErroApi', async () => {
    const erro = new ErroApi(0, 'REDE', 'Sem conexão.');
    const requisitar = vi.fn().mockRejectedValue(erro);
    await expect(
      criarTriagemHttp({ requisitar }).registrarTriagem({
        pacienteId: 'p1',
        especialidadeDestinoId: 'e1',
        tipoAtendimento: 'PRIMEIRA_CONSULTA',
        prioridade: 'NORMAL',
        motivo: 'Dado fictício',
      }),
    ).rejects.toBe(erro);
  });
});
