import {
  Injectable,
  Logger,
  type OnModuleInit,
  type OnModuleDestroy,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  Alerta,
  Escalonamento,
  type AlertaNormalizado,
  type ConsultarAlertasQuery,
  type EscalonamentoEntrada,
  type TipoAlerta,
} from '@filas/contracts';

import { type UsuarioAutenticado } from '../auth/usuario-autenticado';
import { AuditoriaService } from '../common/auditoria/auditoria.service';
import { ErroDominio } from '../common/errors/erro-dominio';
import { EventosDominio } from '../common/eventos/eventos-dominio';
import { Relogio } from '../common/relogio';
import { ParametrosService } from '../parametros/parametros.service';
import { AlertasRepository, type RegistroAlerta, type TransacaoAlerta } from './alertas.repository';

export interface ContextoAlerta {
  usuario: Pick<UsuarioAutenticado, 'id' | 'unidadeId' | 'perfilNome'>;
  origemIp?: string;
  userAgent?: string;
  requestId?: string;
}
type Efeito = { unidadeId: string } & (
  { criado: Alerta; normalizado?: never } | { normalizado: AlertaNormalizado; criado?: never }
);

@Injectable()
export class AlertasService implements OnModuleInit, OnModuleDestroy, OnApplicationBootstrap {
  private readonly logger = new Logger(AlertasService.name);
  private readonly cancelar: (() => void)[] = [];

  constructor(
    private readonly repository: AlertasRepository,
    private readonly parametros: ParametrosService,
    private readonly auditoria: AuditoriaService,
    private readonly eventos: EventosDominio,
    private readonly relogio: Relogio,
  ) {}

  onModuleInit(): void {
    for (const nome of ['fila.bloqueada', 'fila.desbloqueada'] as const)
      this.cancelar.push(
        this.eventos.assinar(nome, ({ filaId }) => this.sincronizarBloqueio(filaId)),
      );
  }

  async onApplicationBootstrap(): Promise<void> {
    // Recupera eventos perdidos durante a parada sem recalcular a disponibilidade da #19.
    for (const fila of await this.repository.recuperarBloqueios())
      await this.sincronizarBloqueio(fila.id);
  }

  onModuleDestroy(): void {
    this.cancelar.forEach((cancelar) => cancelar());
  }

  async listar(unidadeId: string, query: ConsultarAlertasQuery) {
    const { registros, total } = await this.repository.listar(unidadeId, query);
    return {
      dados: registros.map((r) => this.projetar(r)),
      meta: {
        pagina: query.pagina,
        tamanho: query.tamanho,
        total,
        totalPaginas: Math.ceil(total / query.tamanho),
      },
    };
  }

  async reconhecer(id: string, contexto: ContextoAlerta): Promise<Alerta> {
    return this.repository.transacao(async (tx) => {
      const alerta = await this.exigirAberto(tx, id, contexto.usuario.unidadeId);
      if (alerta.status === 'RECONHECIDO') return this.projetar(alerta);
      const atualizado = await this.repository.reconhecer(
        tx,
        id,
        contexto.usuario.id,
        this.relogio.agora(),
      );
      await this.auditar(tx, 'EDITAR', 'alerta', id, contexto);
      return this.projetar(atualizado);
    });
  }

  async escalonar(
    id: string,
    entrada: EscalonamentoEntrada,
    contexto: ContextoAlerta,
  ): Promise<Escalonamento> {
    return this.repository.transacao(async (tx) => {
      await this.exigirAberto(tx, id, contexto.usuario.unidadeId);
      const { autor, acionadoEm, ...registro } = await this.repository.escalonar(tx, {
        alertaId: id,
        acao: entrada.acao,
        observacao: entrada.observacao?.trim() || null,
        acionadoPor: contexto.usuario.id,
        acionadoEm: this.relogio.agora(),
      });
      await this.auditar(tx, 'CRIAR', 'escalonamento', registro.id, contexto);
      return Escalonamento.parse({
        ...registro,
        acionadoPor: autor.nome,
        acionadoEm: acionadoEm.toISOString(),
      });
    });
  }

  @Cron(CronExpression.EVERY_MINUTE, { name: 'alertas-sla' })
  async executar(): Promise<void> {
    for (const fila of await this.repository.filasAtivas()) {
      try {
        await this.avaliarSla(fila.id);
      } catch (erro) {
        this.logger.error({ err: erro, filaId: fila.id }, 'Falha ao avaliar SLA da fila');
      }
    }
  }

  async avaliarSla(filaId: string): Promise<void> {
    const efeito = await this.repository.transacao(async (tx) => {
      const fila = await this.repository.fila(tx, filaId);
      if (!fila?.ativa) return null;
      const agora = this.relogio.agora();
      const limite =
        fila.slaMinutos ??
        (await this.parametros.vigentes(fila.unidadeId, fila.especialidadeId, tx)).slaMinutos;
      const espera = await this.repository.espera(
        tx,
        filaId,
        new Date(agora.getTime() - limite * 60_000),
      );
      return this.atualizar(tx, fila, 'SLA_EXCEDIDO', espera.acima > 0, agora, {
        tempoEsperaMinutos: espera.maisAntiga
          ? Math.ceil((agora.getTime() - espera.maisAntiga.getTime()) / 60_000)
          : 0,
        limiteMinutos: limite,
        senhasAfetadas: espera.acima,
      });
    });
    this.publicar(efeito);
  }

  async sincronizarBloqueio(filaId: string): Promise<void> {
    const efeito = await this.repository.transacao(async (tx) => {
      const fila = await this.repository.fila(tx, filaId);
      if (!fila) return null;
      const agora = this.relogio.agora();
      const espera = await this.repository.espera(tx, filaId, agora);
      return this.atualizar(tx, fila, 'FILA_BLOQUEADA', fila.bloqueada, agora, {
        tempoEsperaMinutos: null,
        limiteMinutos: null,
        senhasAfetadas: espera.aguardando,
      });
    });
    this.publicar(efeito);
  }

  private async atualizar(
    tx: TransacaoAlerta,
    fila: { id: string; unidadeId: string },
    tipo: TipoAlerta,
    ativo: boolean,
    agora: Date,
    dados: {
      tempoEsperaMinutos: number | null;
      limiteMinutos: number | null;
      senhasAfetadas: number;
    },
  ): Promise<Efeito | null> {
    const aberto = await this.repository.aberto(tx, fila.id, tipo);
    if (aberto && !ativo) {
      await this.repository.normalizar(tx, aberto.id, agora);
      await this.auditar(tx, 'EDITAR', 'alerta', aberto.id);
      return {
        unidadeId: fila.unidadeId,
        normalizado: { alertaId: aberto.id, normalizadoEm: agora.toISOString() },
      };
    }
    if (aberto || !ativo) return null;
    const novo = await this.repository.criar(tx, {
      ...dados,
      tipo,
      filaId: fila.id,
      unidadeId: fila.unidadeId,
      disparadoEm: agora,
    });
    await this.auditar(tx, 'CRIAR', 'alerta', novo.id);
    return { unidadeId: fila.unidadeId, criado: this.projetar(novo) };
  }

  private publicar(efeito: Efeito | null): void {
    if (!efeito) return;
    if (efeito.criado)
      this.eventos.emitir('sla.excedido', { unidadeId: efeito.unidadeId, dados: efeito.criado });
    else
      this.eventos.emitir('sla.normalizado', {
        unidadeId: efeito.unidadeId,
        dados: efeito.normalizado,
      });
  }

  private async exigirAberto(tx: TransacaoAlerta, id: string, unidadeId: string) {
    const alerta = await this.repository.bloquear(tx, id, unidadeId);
    if (!alerta)
      throw new ErroDominio(
        'NAO_ENCONTRADO',
        404,
        'Alerta não encontrado',
        'O registro não existe ou foi removido.',
      );
    if (alerta.status === 'NORMALIZADO')
      throw new ErroDominio(
        'TRANSICAO_INVALIDA',
        409,
        'Alerta normalizado',
        'Esta ação não está disponível para um alerta normalizado.',
      );
    return alerta;
  }

  private auditar(
    tx: TransacaoAlerta,
    operacao: 'CRIAR' | 'EDITAR',
    entidade: string,
    entidadeId: string,
    contexto?: ContextoAlerta,
  ) {
    const { usuario, ...origem } = contexto ?? {};
    return this.auditoria.registrar(
      {
        ...origem,
        usuarioId: usuario?.id ?? null,
        perfilNomeNoMomento: usuario?.perfilNome ?? null,
        operacao,
        entidade,
        entidadeId,
        modulo: 'alertas',
      },
      tx,
    );
  }

  private projetar(r: RegistroAlerta): Alerta {
    return Alerta.parse({
      id: r.id,
      tipo: r.tipo,
      status: r.status,
      filaId: r.filaId,
      especialidade: r.fila.especialidade.nome,
      tempoEsperaMinutos: r.tempoEsperaMinutos,
      limiteMinutos: r.limiteMinutos,
      senhasAfetadas: r.senhasAfetadas ?? 0,
      disparadoEm: r.disparadoEm.toISOString(),
      reconhecidoPor: r.reconhecedor?.nome ?? null,
      reconhecidoEm: r.reconhecidoEm?.toISOString() ?? null,
      normalizadoEm: r.normalizadoEm?.toISOString() ?? null,
      escalonamentos: r.escalonamentos.map(({ autor, acionadoEm, ...medida }) => ({
        ...medida,
        acionadoPor: autor.nome,
        acionadoEm: acionadoEm.toISOString(),
      })),
    });
  }
}
