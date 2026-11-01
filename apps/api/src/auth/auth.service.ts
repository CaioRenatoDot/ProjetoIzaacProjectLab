import { Injectable, Logger, type OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { type LoginEntrada, type LoginResposta, type RenovacaoResposta } from '@filas/contracts';

import { AuditoriaService } from '../common/auditoria/auditoria.service';
import { ErroDominio } from '../common/errors/erro-dominio';
import { AuthRepository, type UsuarioComPerfil } from './auth.repository';
import { BloqueioInexistentes } from './bloqueio-inexistentes';
import { gerarSegredo, hashSegredo, lerRefresh, montarRefresh } from './refresh-token';
import { gerarHashSenha, senhaConfere } from './senha';
import { ACESSO_MINUTOS, JANELA_ROTACAO_SEGUNDOS, SESSAO_HORAS } from './sessao.constantes';
import { TokenAcessoService } from './token-acesso.service';
import { paraUsuarioSessao, type UsuarioAutenticado } from './usuario-autenticado';

/** Dados da requisição que vão para a trilha de auditoria. */
export interface ContextoRequisicao {
  origemIp?: string;
  userAgent?: string;
  requestId?: string;
}

export interface SessaoEmitida {
  refresh: string;
  expiraEm: Date;
  manterConectado: boolean;
}

const credencialInvalida = () =>
  new ErroDominio(
    'CREDENCIAL_INVALIDA',
    401,
    'Não foi possível entrar',
    'Identificação ou senha incorreta. Verifique os dados e tente novamente.',
  );

const bloqueado = (restanteMs: number) => {
  const minutos = Math.max(1, Math.ceil(restanteMs / 60_000));
  return new ErroDominio(
    'BLOQUEIO_TEMPORARIO',
    401,
    'Acesso bloqueado temporariamente',
    `Excesso de tentativas. Tente novamente em ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'}.`,
    { minutosRestantes: minutos },
  );
};

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);
  private readonly bloqueioInexistentes = new BloqueioInexistentes();
  /** Hash fictício: o login de usuário inexistente também roda o argon2 e leva o mesmo tempo. */
  private hashFicticio = '';

  constructor(
    private readonly repository: AuthRepository,
    private readonly tokens: TokenAcessoService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.hashFicticio = await gerarHashSenha(gerarSegredo());
  }

  async entrar(
    entrada: LoginEntrada,
    contexto: ContextoRequisicao,
  ): Promise<{ resposta: LoginResposta; sessao: SessaoEmitida }> {
    const usuario = await this.repository.buscarPorIdentificacao(entrada.identificacao);

    if (!usuario) {
      const restante = this.bloqueioInexistentes.bloqueioRestante(entrada.identificacao);
      if (restante > 0) throw bloqueado(restante);
      await senhaConfere(this.hashFicticio, entrada.senha);
      this.registrarFalhaNoLog(null, 'inexistente', contexto);
      const bloqueou = this.bloqueioInexistentes.registrarFalha(entrada.identificacao);
      throw bloqueou > 0 ? bloqueado(bloqueou) : credencialInvalida();
    }

    if (usuario.bloqueadoAte && usuario.bloqueadoAte > new Date()) {
      throw bloqueado(usuario.bloqueadoAte.getTime() - Date.now());
    }

    // Conta inativa com a senha certa também é falha: a resposta não pode revelar que a conta existe.
    const confere = await senhaConfere(usuario.senhaHash, entrada.senha);
    if (!confere || !usuario.ativo) {
      this.registrarFalhaNoLog(usuario.id, confere ? 'inativo' : 'senha', contexto);
      const bloqueadoAte = await this.repository.registrarFalha(usuario.id);
      if (bloqueadoAte && bloqueadoAte > new Date()) {
        throw bloqueado(bloqueadoAte.getTime() - Date.now());
      }
      throw credencialInvalida();
    }

    await this.repository.registrarSucesso(usuario.id);
    const segredo = gerarSegredo();
    const expiraEm = new Date(Date.now() + SESSAO_HORAS * 3_600_000);
    const sessao = await this.repository.criarSessao({
      usuarioId: usuario.id,
      tokenHash: hashSegredo(segredo),
      expiraEm,
      manterConectado: entrada.manterConectado,
    });

    try {
      await this.auditoria.registrar({
        usuarioId: usuario.id,
        perfilNomeNoMomento: usuario.perfil.nome,
        operacao: 'LOGIN',
        modulo: 'auth',
        entidade: 'sessao',
        entidadeId: sessao.id,
        ...contexto,
      });
    } catch (erro) {
      // Sem o registro do LOGIN, a sessão não pode ficar aberta (RNF-05).
      await this.repository.revogar(sessao.id, 'LOGOUT');
      throw erro;
    }

    const acesso = this.emitirAcesso(usuario, sessao.id, expiraEm);
    return {
      resposta: { ...acesso, usuario: paraUsuarioSessao(usuario) },
      sessao: {
        refresh: montarRefresh({ sessaoId: sessao.id, segredo }),
        expiraEm,
        manterConectado: entrada.manterConectado,
      },
    };
  }

  async renovar(cookie: unknown): Promise<{ resposta: RenovacaoResposta; sessao: SessaoEmitida }> {
    const refresh = lerRefresh(cookie);
    if (!refresh) throw new UnauthorizedException();

    const sessao = await this.repository.buscarSessao(refresh.sessaoId);
    if (!sessao || sessao.revogadaEm || sessao.expiraEm <= new Date()) {
      throw new UnauthorizedException();
    }

    const hashApresentado = hashSegredo(refresh.segredo);
    if (hashApresentado !== sessao.tokenHash) {
      const dentroDaJanela =
        hashApresentado === sessao.hashAnterior &&
        sessao.rotacionadaEm !== null &&
        Date.now() - sessao.rotacionadaEm.getTime() <= JANELA_ROTACAO_SEGUNDOS * 1000;
      // Fora da janela de duas abas, refresh antigo reapresentado indica roubo: encerra a sessão.
      if (!dentroDaJanela) {
        await this.repository.revogar(sessao.id, 'REUSO');
        this.logger.warn({ sessaoId: sessao.id }, 'Refresh reutilizado; sessão revogada');
      }
      throw new UnauthorizedException();
    }

    const segredo = gerarSegredo();
    const venceu = await this.repository.rotacionar(
      sessao.id,
      hashApresentado,
      hashSegredo(segredo),
    );
    if (!venceu) throw new UnauthorizedException();

    const usuario = await this.repository.usuarioDaSessaoAtiva(sessao.id, sessao.usuarioId);
    if (!usuario) {
      await this.repository.revogar(sessao.id, 'USUARIO_INATIVADO');
      throw new UnauthorizedException();
    }

    return {
      resposta: this.emitirAcesso(usuario, sessao.id, sessao.expiraEm),
      sessao: {
        refresh: montarRefresh({ sessaoId: sessao.id, segredo }),
        expiraEm: sessao.expiraEm,
        manterConectado: sessao.manterConectado,
      },
    };
  }

  /** Sempre conclui: cookie ausente, inválido ou de sessão encerrada não gera erro (docs/04 §2). */
  async encerrar(cookie: unknown, contexto: ContextoRequisicao): Promise<void> {
    const refresh = lerRefresh(cookie);
    if (!refresh) return;
    const sessao = await this.repository.buscarSessao(refresh.sessaoId);
    if (!sessao || sessao.revogadaEm) return;

    const hash = hashSegredo(refresh.segredo);
    if (hash !== sessao.tokenHash && hash !== sessao.hashAnterior) return;

    await this.repository.revogar(sessao.id, 'LOGOUT');
    const usuario = await this.repository.usuarioDaSessaoAtiva(sessao.id, sessao.usuarioId);
    await this.auditoria.registrar({
      usuarioId: sessao.usuarioId,
      perfilNomeNoMomento: usuario?.perfil.nome ?? null,
      operacao: 'LOGOUT',
      modulo: 'auth',
      entidade: 'sessao',
      entidadeId: sessao.id,
      ...contexto,
    });
  }

  /** Valida o access token e confere no banco a sessão, o usuário ativo e as permissões. */
  async autenticar(token: string): Promise<UsuarioAutenticado | null> {
    const conteudo = this.tokens.verificar(token);
    if (!conteudo) return null;
    const usuario = await this.repository.usuarioDaSessaoAtiva(conteudo.sid, conteudo.sub);
    return usuario ? { ...paraUsuarioSessao(usuario), sessaoId: conteudo.sid } : null;
  }

  private emitirAcesso(
    usuario: UsuarioComPerfil,
    sessaoId: string,
    fimDaSessao: Date,
  ): RenovacaoResposta {
    const ateFimDaSessao = Math.floor((fimDaSessao.getTime() - Date.now()) / 1000);
    const expiraEm = Math.max(1, Math.min(ACESSO_MINUTOS * 60, ateFimDaSessao));
    const sessao = paraUsuarioSessao(usuario);
    const accessToken = this.tokens.assinar(
      {
        sub: sessao.id,
        sid: sessaoId,
        nome: sessao.nome,
        perfilId: sessao.perfilId,
        perfilNome: sessao.perfilNome,
        unidadeId: sessao.unidadeId,
        permissoes: sessao.permissoes,
      },
      expiraEm,
    );
    return { accessToken, expiraEm };
  }

  /** Falha de login não tem operação na auditoria; vai para o log, nunca com identificação ou senha. */
  private registrarFalhaNoLog(
    usuarioId: string | null,
    motivo: 'inexistente' | 'senha' | 'inativo',
    contexto: ContextoRequisicao,
  ): void {
    this.logger.warn({ usuarioId, motivo, requestId: contexto.requestId }, 'Falha de autenticação');
  }
}
