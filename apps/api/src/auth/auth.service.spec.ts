import { Logger } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { type AuditoriaService } from '../common/auditoria/auditoria.service';
import { type AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import { gerarHashSenha } from './senha';
import { type TokenAcessoService } from './token-acesso.service';

describe('AuthService', () => {
  it('RNF-05 revoga a sessão recém-criada quando a auditoria do LOGIN falha', async () => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const usuario = {
      id: 'u1',
      nome: 'Usuario',
      perfilId: 'p1',
      unidadeId: 'un1',
      ativo: true,
      bloqueadoAte: null,
      senhaHash: await gerarHashSenha('senha'),
      perfil: { nome: 'Perfil', permissoes: [] },
      unidade: { nome: 'Unidade' },
    };
    const repository = {
      buscarPorIdentificacao: vi.fn().mockResolvedValue(usuario),
      registrarSucesso: vi.fn().mockResolvedValue(undefined),
      criarSessao: vi.fn().mockResolvedValue({ id: 's1' }),
      revogar: vi.fn().mockResolvedValue(undefined),
    };
    const auditoria = { registrar: vi.fn().mockRejectedValue(new Error('banco fora')) };
    const servico = new AuthService(
      repository as unknown as AuthRepository,
      { assinar: vi.fn() } as unknown as TokenAcessoService,
      auditoria as unknown as AuditoriaService,
    );

    await expect(
      servico.entrar({ identificacao: 'x', senha: 'senha', manterConectado: false }, {}),
    ).rejects.toThrow('banco fora');
    expect(repository.revogar).toHaveBeenCalledWith('s1', 'LOGOUT');
  });
});
