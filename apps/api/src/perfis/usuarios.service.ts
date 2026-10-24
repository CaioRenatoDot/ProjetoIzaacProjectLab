import { Injectable } from '@nestjs/common';
import {
  type ListarUsuariosQuery,
  type RespostaPaginada,
  type Usuario,
  type UsuarioAlteracao,
  type UsuarioEntrada,
} from '@filas/contracts';
import { type MotivoRevogacao, Prisma } from '@prisma/client';

import { gerarHashSenha } from '../auth/senha';
import { type UsuarioAutenticado } from '../auth/usuario-autenticado';
import { ErroDominio, ErroValidacao } from '../common/errors/erro-dominio';
import { deslocamento, montarRespostaPaginada } from '../common/pagination/paginacao';
import { type UsuarioComPerfilNome, UsuariosRepository } from './usuarios.repository';

const naoEncontrado = () =>
  new ErroDominio('NAO_ENCONTRADO', 404, 'Usuário não encontrado', 'O usuário não existe.');

const duplicado = (recursoExistenteId: string) =>
  new ErroDominio(
    'DUPLICIDADE',
    409,
    'Usuário já cadastrado',
    'Já existe um usuário com essa matrícula ou e-mail. Abra o cadastro existente.',
    { recursoExistenteId },
  );

const perfilInexistente = () =>
  new ErroValidacao([{ campo: 'perfilId', mensagem: 'Selecione um perfil existente.' }]);

/** Nunca devolve senha nem hash. */
function paraUsuario(usuario: UsuarioComPerfilNome): Usuario {
  const bloqueado = usuario.bloqueadoAte && usuario.bloqueadoAte > new Date();
  return {
    id: usuario.id,
    nome: usuario.nome,
    identificacao: usuario.identificacao,
    perfilId: usuario.perfilId,
    perfilNome: usuario.perfil.nome,
    ativo: usuario.ativo,
    ultimoLoginEm: usuario.ultimoLoginEm?.toISOString() ?? null,
    bloqueadoAte: bloqueado ? usuario.bloqueadoAte!.toISOString() : null,
  };
}

@Injectable()
export class UsuariosService {
  constructor(private readonly repository: UsuariosRepository) {}

  async listar(query: ListarUsuariosQuery): Promise<RespostaPaginada<Usuario>> {
    const { skip, take } = deslocamento(query);
    const { dados, total } = await this.repository.listar(query, skip, take);
    return montarRespostaPaginada(dados.map(paraUsuario), total, query);
  }

  async consultar(id: string): Promise<Usuario> {
    const usuario = await this.repository.buscar(id);
    if (!usuario) throw naoEncontrado();
    return paraUsuario(usuario);
  }

  async criar(entrada: UsuarioEntrada, autor: UsuarioAutenticado): Promise<Usuario> {
    const existente = await this.repository.buscarPorIdentificacao(entrada.identificacao);
    if (existente) throw duplicado(existente.id);
    if (!(await this.repository.perfilExiste(entrada.perfilId))) throw perfilInexistente();

    try {
      const usuario = await this.repository.criar({
        nome: entrada.nome,
        identificacao: entrada.identificacao,
        senhaHash: await gerarHashSenha(entrada.senhaInicial),
        perfilId: entrada.perfilId,
        unidadeId: autor.unidadeId,
        ativo: entrada.ativo,
      });
      return paraUsuario(usuario);
    } catch (erro) {
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002') {
        const concorrente = await this.repository.buscarPorIdentificacao(entrada.identificacao);
        if (concorrente) throw duplicado(concorrente.id);
      }
      throw erro;
    }
  }

  async alterar(
    id: string,
    alteracao: UsuarioAlteracao,
    autor: UsuarioAutenticado,
  ): Promise<Usuario> {
    const atual = await this.repository.buscar(id);
    if (!atual) throw naoEncontrado();

    const proprio = id === autor.id;
    if (proprio && alteracao.ativo === false) {
      throw new ErroValidacao([
        { campo: 'ativo', mensagem: 'Você não pode inativar o próprio usuário.' },
      ]);
    }
    if (proprio && alteracao.perfilId && alteracao.perfilId !== atual.perfilId) {
      throw new ErroValidacao([
        { campo: 'perfilId', mensagem: 'Você não pode trocar o próprio perfil.' },
      ]);
    }
    if (alteracao.perfilId && !(await this.repository.perfilExiste(alteracao.perfilId))) {
      throw perfilInexistente();
    }

    const dados: Prisma.UsuarioUncheckedUpdateInput = {
      ...(alteracao.nome !== undefined ? { nome: alteracao.nome } : {}),
      ...(alteracao.perfilId !== undefined ? { perfilId: alteracao.perfilId } : {}),
      ...(alteracao.ativo !== undefined ? { ativo: alteracao.ativo } : {}),
      ...(alteracao.novaSenha ? { senhaHash: await gerarHashSenha(alteracao.novaSenha) } : {}),
      ...(alteracao.desbloquear ? { tentativasFalhas: 0, bloqueadoAte: null } : {}),
    };

    let revogacao: { motivo: MotivoRevogacao; manterSessao?: string } | undefined;
    if (alteracao.ativo === false && atual.ativo) {
      revogacao = { motivo: 'USUARIO_INATIVADO' };
    } else if (alteracao.novaSenha) {
      revogacao = {
        motivo: 'SENHA_REDEFINIDA',
        manterSessao: proprio ? autor.sessaoId : undefined,
      };
    }

    return paraUsuario(await this.repository.alterar(id, dados, revogacao));
  }
}
