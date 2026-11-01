import { Injectable } from '@nestjs/common';
import { type MotivoRevogacao, type Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { BLOQUEIO_MINUTOS, TENTATIVAS_ATE_BLOQUEIO } from './sessao.constantes';

const COM_PERFIL_E_UNIDADE = {
  perfil: { select: { nome: true, permissoes: { select: { permissao: true } } } },
  unidade: { select: { nome: true } },
} satisfies Prisma.UsuarioInclude;

export type UsuarioComPerfil = Prisma.UsuarioGetPayload<{ include: typeof COM_PERFIL_E_UNIDADE }>;

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  buscarPorIdentificacao(identificacao: string): Promise<UsuarioComPerfil | null> {
    return this.prisma.usuario.findUnique({
      where: { identificacao },
      include: COM_PERFIL_E_UNIDADE,
    });
  }

  /**
   * Conta a falha num único UPDATE: com várias tentativas simultâneas, nenhuma se perde. A quinta
   * bloqueia e zera o contador. Devolve o fim do bloqueio, ou `null` se esta falha não bloqueou.
   * Se o usuário já estava bloqueado (inclusive por uma tentativa concorrente), nada muda e o
   * bloqueio vigente é devolvido.
   */
  async registrarFalha(usuarioId: string): Promise<Date | null> {
    const linhas = await this.prisma.$queryRaw<{ bloqueado_ate: Date | null }[]>`
      UPDATE usuario
         SET tentativas_falhas = CASE WHEN tentativas_falhas + 1 >= ${TENTATIVAS_ATE_BLOQUEIO}
                                      THEN 0 ELSE tentativas_falhas + 1 END,
             bloqueado_ate = CASE WHEN tentativas_falhas + 1 >= ${TENTATIVAS_ATE_BLOQUEIO}
                                  THEN now() + make_interval(mins => ${BLOQUEIO_MINUTOS}::int)
                                  ELSE NULL END
       WHERE id = ${usuarioId}::uuid
         AND (bloqueado_ate IS NULL OR bloqueado_ate <= now())
      RETURNING bloqueado_ate`;
    if (linhas.length > 0) {
      return linhas[0]!.bloqueado_ate;
    }
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { bloqueadoAte: true },
    });
    return usuario?.bloqueadoAte ?? null;
  }

  async registrarSucesso(usuarioId: string): Promise<void> {
    await this.prisma.usuario.update({
      where: { id: usuarioId },
      data: { tentativasFalhas: 0, bloqueadoAte: null, ultimoLoginEm: new Date() },
    });
  }

  criarSessao(dados: {
    usuarioId: string;
    tokenHash: string;
    expiraEm: Date;
    manterConectado: boolean;
  }) {
    return this.prisma.sessao.create({ data: dados });
  }

  buscarSessao(id: string) {
    return this.prisma.sessao.findUnique({ where: { id } });
  }

  /** Troca o hash só se ainda for o atual e a sessão estiver aberta; quem atualizar 1 linha vence. */
  async rotacionar(id: string, hashAtual: string, hashNovo: string): Promise<boolean> {
    const { count } = await this.prisma.sessao.updateMany({
      where: { id, tokenHash: hashAtual, revogadaEm: null, expiraEm: { gt: new Date() } },
      data: { hashAnterior: hashAtual, tokenHash: hashNovo, rotacionadaEm: new Date() },
    });
    return count === 1;
  }

  async revogar(id: string, motivo: MotivoRevogacao): Promise<void> {
    await this.prisma.sessao.updateMany({
      where: { id, revogadaEm: null },
      data: { revogadaEm: new Date(), motivoRevogacao: motivo },
    });
  }

  /** Usuário da sessão, se ela estiver aberta e o usuário ativo; senão `null`. */
  async usuarioDaSessaoAtiva(
    sessaoId: string,
    usuarioId: string,
  ): Promise<UsuarioComPerfil | null> {
    const sessao = await this.prisma.sessao.findFirst({
      where: { id: sessaoId, usuarioId, revogadaEm: null, expiraEm: { gt: new Date() } },
      select: { usuario: { include: COM_PERFIL_E_UNIDADE } },
    });
    return sessao?.usuario.ativo ? sessao.usuario : null;
  }
}
