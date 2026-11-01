import { describe, expect, it, vi } from 'vitest';

import { ErroApi } from '@/lib/api/cliente-http';

import { criarPerfisHttp } from './api-http';
import { ErroPerfil } from './tipos';

const perfilDaApi = {
  id: 'p1',
  nome: 'Recepção',
  descricao: 'Cadastros e fila.',
  sistema: false,
  permissoes: ['cadastros:consultar'],
  usuariosVinculados: 2,
  avisos: [],
};
const entrada = { nome: 'Recepção', descricao: '', permissoes: ['cadastros:consultar'] };

describe('cliente HTTP de perfis (W-05)', () => {
  it('lista os perfis com o número de usuários vinculados, sem os avisos da API', async () => {
    const requisitar = vi.fn().mockResolvedValue({ dados: [perfilDaApi] });
    const perfis = await criarPerfisHttp({ requisitar }).listar();

    expect(requisitar).toHaveBeenCalledWith('/perfis?tamanho=100');
    expect(perfis).toEqual([
      {
        id: 'p1',
        nome: 'Recepção',
        descricao: 'Cadastros e fila.',
        sistema: false,
        permissoes: ['cadastros:consultar'],
        usuariosVinculados: 2,
      },
    ]);
  });

  it('UC-04: sem id cria com POST; com id atualiza com PUT', async () => {
    const requisitar = vi.fn().mockResolvedValue(perfilDaApi);
    const api = criarPerfisHttp({ requisitar });

    await api.salvar(null, entrada);
    await api.salvar('p/1', entrada);

    expect(requisitar).toHaveBeenNthCalledWith(1, '/perfis', { metodo: 'POST', corpo: entrada });
    expect(requisitar).toHaveBeenNthCalledWith(2, '/perfis/p%2F1', {
      metodo: 'PUT',
      corpo: entrada,
    });
  });

  it('nome repetido vira ErroPerfil DUPLICIDADE com a mensagem do servidor', async () => {
    const requisitar = vi
      .fn()
      .mockRejectedValue(new ErroApi(409, 'DUPLICIDADE', 'Já existe um perfil com esse nome.'));

    await expect(criarPerfisHttp({ requisitar }).salvar(null, entrada)).rejects.toEqual(
      new ErroPerfil('DUPLICIDADE', 'Já existe um perfil com esse nome.'),
    );
  });

  it('exclusão com usuários vinculados explica o vínculo (VINCULO_ATIVO)', async () => {
    const requisitar = vi
      .fn()
      .mockRejectedValue(
        new ErroApi(409, 'VINCULO_ATIVO', 'O perfil está vinculado a 2 usuário(s).'),
      );
    const exclusao = criarPerfisHttp({ requisitar }).excluir('p1');

    await expect(exclusao).rejects.toEqual(
      new ErroPerfil('VINCULO_ATIVO', 'O perfil está vinculado a 2 usuário(s).'),
    );
    expect(requisitar).toHaveBeenCalledWith('/perfis/p1', { metodo: 'DELETE' });
  });

  it('falha de rede segue como ErroApi', async () => {
    const erro = new ErroApi(0, 'REDE', 'Sem conexão.');
    const requisitar = vi.fn().mockRejectedValue(erro);
    await expect(criarPerfisHttp({ requisitar }).catalogo()).rejects.toBe(erro);
  });
});
