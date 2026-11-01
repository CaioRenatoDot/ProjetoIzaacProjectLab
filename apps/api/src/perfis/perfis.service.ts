import { Injectable } from '@nestjs/common';
import {
  type ListarPerfisQuery,
  type Perfil,
  type PerfilAtualizado,
  type PerfilEntrada,
  type RespostaPaginada,
} from '@filas/contracts';
import { Prisma } from '@prisma/client';

import { ErroDominio } from '../common/errors/erro-dominio';
import { deslocamento, montarRespostaPaginada } from '../common/pagination/paginacao';
import { PerfisRepository, type PerfilComDetalhe } from './perfis.repository';
import { avisosDoPerfil, mesmoConjunto } from './regras';

const naoEncontrado = () =>
  new ErroDominio(
    'NAO_ENCONTRADO',
    404,
    'Perfil não encontrado',
    'O perfil não existe ou foi removido.',
  );

const perfilDoSistema = () =>
  new ErroDominio(
    'PERFIL_SISTEMA',
    409,
    'Perfil do sistema',
    'O perfil do sistema não pode ser editado nem excluído. Crie um perfil novo se precisar de outra combinação.',
  );

const duplicado = (recursoExistenteId: string) =>
  new ErroDominio(
    'DUPLICIDADE',
    409,
    'Perfil já cadastrado',
    'Já existe um perfil com esse nome. Abra o perfil existente ou escolha outro nome.',
    { recursoExistenteId },
  );

function paraPerfil(perfil: PerfilComDetalhe, comAvisos = false): Perfil {
  const permissoes = perfil.permissoes.map(({ permissao }) => permissao);
  return {
    id: perfil.id,
    nome: perfil.nome,
    descricao: perfil.descricao ?? '',
    sistema: perfil.sistema,
    permissoes,
    usuariosVinculados: perfil._count.usuarios,
    avisos: comAvisos ? avisosDoPerfil(permissoes) : [],
  };
}

@Injectable()
export class PerfisService {
  constructor(private readonly repository: PerfisRepository) {}

  async listar(query: ListarPerfisQuery): Promise<RespostaPaginada<Perfil>> {
    const { skip, take } = deslocamento(query);
    const { dados, total } = await this.repository.listar(query.busca, skip, take);
    return montarRespostaPaginada(
      dados.map((perfil) => paraPerfil(perfil)),
      total,
      query,
    );
  }

  async consultar(id: string): Promise<Perfil> {
    const perfil = await this.repository.buscar(id);
    if (!perfil) throw naoEncontrado();
    return paraPerfil(perfil);
  }

  async criar(entrada: PerfilEntrada): Promise<Perfil> {
    const existente = await this.repository.buscarPorNome(entrada.nome);
    if (existente) throw duplicado(existente.id);
    try {
      return paraPerfil(await this.repository.criar(entrada), true);
    } catch (erro) {
      throw await this.duplicidadeConcorrente(erro, entrada.nome);
    }
  }

  async atualizar(id: string, entrada: PerfilEntrada): Promise<PerfilAtualizado> {
    const atual = await this.repository.buscar(id);
    if (!atual) throw naoEncontrado();
    if (atual.sistema) throw perfilDoSistema();
    const existente = await this.repository.buscarPorNome(entrada.nome, id);
    if (existente) throw duplicado(existente.id);

    const mudouPermissoes = !mesmoConjunto(
      atual.permissoes.map(({ permissao }) => permissao),
      entrada.permissoes,
    );
    try {
      const perfil = await this.repository.atualizar(id, entrada);
      return {
        ...paraPerfil(perfil, true),
        usuariosAfetados: mudouPermissoes ? perfil._count.usuarios : 0,
      };
    } catch (erro) {
      throw await this.duplicidadeConcorrente(erro, entrada.nome);
    }
  }

  async excluir(id: string): Promise<void> {
    const perfil = await this.repository.buscar(id);
    if (!perfil) throw naoEncontrado();
    if (perfil.sistema) throw perfilDoSistema();
    if (perfil._count.usuarios > 0) {
      throw new ErroDominio(
        'VINCULO_ATIVO',
        409,
        'Perfil com usuários vinculados',
        `O perfil está vinculado a ${perfil._count.usuarios} usuário(s). Troque o perfil desses usuários antes de excluir.`,
      );
    }
    await this.repository.excluir(id);
  }

  /** Duas gravações simultâneas com o mesmo nome: a segunda vira DUPLICIDADE, nunca 500. */
  private async duplicidadeConcorrente(erro: unknown, nome: string): Promise<unknown> {
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002') {
      const existente = await this.repository.buscarPorNome(nome);
      if (existente) return duplicado(existente.id);
    }
    return erro;
  }
}
