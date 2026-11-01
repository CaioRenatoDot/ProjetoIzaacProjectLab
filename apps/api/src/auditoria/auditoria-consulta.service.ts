import { Injectable } from '@nestjs/common';
import {
  type ConsultarAuditoriaQuery,
  type EventoAuditoria,
  type EventoAuditoriaDetalhe,
  type ExportarAuditoriaQuery,
  type ItemReferencia,
  type ListarApoioQuery,
  type RespostaPaginada,
} from '@filas/contracts';
import { type OperacaoAuditoria, type Prisma } from '@prisma/client';

import { type ContextoRequisicao } from '../auth/auth.service';
import { type UsuarioAutenticado } from '../auth/usuario-autenticado';
import { AuditoriaService } from '../common/auditoria/auditoria.service';
import { ErroDominio } from '../common/errors/erro-dominio';
import { deslocamento, montarRespostaPaginada } from '../common/pagination/paginacao';
import { PrismaService } from '../prisma/prisma.service';
import { linhaCsv } from './csv';

const COM_USUARIO = { usuario: { select: { nome: true } } } satisfies Prisma.AuditLogInclude;
type RegistroComUsuario = Prisma.AuditLogGetPayload<{ include: typeof COM_USUARIO }>;

const VERBO: Record<OperacaoAuditoria, string> = {
  CRIAR: 'Criou',
  EDITAR: 'Editou',
  EXCLUIR: 'Excluiu',
  CONSULTAR_SENSIVEL: 'Consultou dado sensível de',
  EXPORTAR: 'Exportou',
  LOGIN: 'Entrou no sistema',
  LOGOUT: 'Saiu do sistema',
};

/** Limite de linhas de uma exportação, além do período máximo de 366 dias. */
const LIMITE_EXPORTACAO = 100_000;

const COLUNAS = [
  'ocorridoEm',
  'usuario',
  'perfilNoMomento',
  'operacao',
  'modulo',
  'entidade',
  'entidadeId',
  'sensivel',
  'justificativa',
  'requestId',
];

function descricao(registro: RegistroComUsuario): string {
  const acao =
    registro.operacao === 'LOGIN' || registro.operacao === 'LOGOUT'
      ? VERBO[registro.operacao]
      : `${VERBO[registro.operacao]} ${registro.entidade}`;
  return registro.justificativa ? `${acao} - justificativa registrada` : acao;
}

function paraEvento(registro: RegistroComUsuario): EventoAuditoria {
  return {
    id: registro.id,
    // Registro sem usuário vem de rotina agendada (expiração de tolerância, alertas).
    usuarioNome: registro.usuario?.nome ?? 'Sistema',
    perfilNoMomento: registro.perfilNomeNoMomento ?? '',
    operacao: registro.operacao,
    modulo: registro.modulo,
    entidade: registro.entidade,
    entidadeId: registro.entidadeId,
    descricao: descricao(registro),
    sensivel: registro.sensivel,
    ocorridoEm: registro.ocorridoEm.toISOString(),
  };
}

/**
 * Consulta e exportação da trilha (RF-12, UC-20, RNF-05). Só leitura: não existe edição nem
 * exclusão de registro, e o usuário de banco da API nem tem essa permissão (#70).
 * Mostra a trilha da unidade de quem consulta (RNF-08) e os registros de rotinas.
 */
@Injectable()
export class AuditoriaConsultaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async consultar(
    query: ConsultarAuditoriaQuery,
    unidadeId: string,
  ): Promise<RespostaPaginada<EventoAuditoria>> {
    const where = this.filtro(query, unidadeId);
    const [dados, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        include: COM_USUARIO,
        orderBy: [{ ocorridoEm: 'desc' }, { id: 'desc' }],
        ...deslocamento(query),
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return montarRespostaPaginada(dados.map(paraEvento), total, query);
  }

  async detalhe(id: string, unidadeId: string): Promise<EventoAuditoriaDetalhe> {
    const registro = await this.prisma.auditLog.findFirst({
      where: { id, ...this.daUnidade(unidadeId) },
      include: COM_USUARIO,
    });
    if (!registro) {
      throw new ErroDominio(
        'NAO_ENCONTRADO',
        404,
        'Evento não encontrado',
        'O evento de auditoria não existe.',
      );
    }
    return {
      ...paraEvento(registro),
      justificativa: registro.justificativa,
      origemIp: registro.origemIp ?? '',
      userAgent: registro.userAgent ?? '',
      requestId: registro.requestId ?? '',
    };
  }

  async usuarios(
    query: ListarApoioQuery,
    unidadeId: string,
  ): Promise<RespostaPaginada<ItemReferencia>> {
    const where: Prisma.UsuarioWhereInput = {
      unidadeId,
      ...(query.busca ? { nome: { contains: query.busca, mode: 'insensitive' } } : {}),
    };
    const [dados, total] = await this.prisma.$transaction([
      this.prisma.usuario.findMany({
        where,
        select: { id: true, nome: true },
        orderBy: { nome: 'asc' },
        ...deslocamento(query),
      }),
      this.prisma.usuario.count({ where }),
    ]);
    return montarRespostaPaginada(dados, total, query);
  }

  /** Gera o CSV e grava `EXPORTAR` com os filtros antes de devolver (T-18). */
  async exportar(
    query: ExportarAuditoriaQuery,
    autor: UsuarioAutenticado,
    contexto: ContextoRequisicao,
  ): Promise<string> {
    const registros = await this.prisma.auditLog.findMany({
      where: this.filtro(query, autor.unidadeId),
      include: COM_USUARIO,
      orderBy: [{ ocorridoEm: 'desc' }, { id: 'desc' }],
      take: LIMITE_EXPORTACAO,
    });
    const linhas = registros.map((registro) =>
      linhaCsv([
        registro.ocorridoEm.toISOString(),
        registro.usuario?.nome ?? 'Sistema',
        registro.perfilNomeNoMomento,
        registro.operacao,
        registro.modulo,
        registro.entidade,
        registro.entidadeId,
        registro.sensivel,
        registro.justificativa,
        registro.requestId,
      ]),
    );

    const filtros = Object.entries(query)
      .filter(([, valor]) => valor !== undefined)
      .map(([chave, valor]) => `${chave}=${String(valor)}`)
      .join(', ');
    await this.auditoria.registrar({
      usuarioId: autor.id,
      perfilNomeNoMomento: autor.perfilNome,
      operacao: 'EXPORTAR',
      modulo: 'auditoria',
      entidade: 'audit_log',
      justificativa: `Filtros: ${filtros}; ${registros.length} registro(s)`,
      ...contexto,
    });

    return [linhaCsv(COLUNAS), ...linhas].join('\n');
  }

  private daUnidade(unidadeId: string): Prisma.AuditLogWhereInput {
    return { OR: [{ usuario: { unidadeId } }, { usuarioId: null }] };
  }

  private filtro(
    query: Pick<
      ConsultarAuditoriaQuery,
      'usuarioId' | 'modulo' | 'operacao' | 'entidadeId' | 'de' | 'ate'
    >,
    unidadeId: string,
  ): Prisma.AuditLogWhereInput {
    return {
      ...this.daUnidade(unidadeId),
      ...(query.usuarioId ? { usuarioId: query.usuarioId } : {}),
      ...(query.modulo ? { modulo: query.modulo } : {}),
      ...(query.operacao ? { operacao: query.operacao } : {}),
      ...(query.entidadeId ? { entidadeId: query.entidadeId } : {}),
      ...(query.de || query.ate
        ? {
            ocorridoEm: {
              ...(query.de ? { gte: new Date(query.de) } : {}),
              ...(query.ate ? { lte: new Date(query.ate) } : {}),
            },
          }
        : {}),
    };
  }
}
