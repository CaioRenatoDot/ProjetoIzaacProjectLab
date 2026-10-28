import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { AlocacaoService } from '../alocacao/alocacao.service';
import { AuditoriaService } from '../common/auditoria/auditoria.service';
import { EventosDominio } from '../common/eventos/eventos-dominio';
import { Relogio } from '../common/relogio';
import { turnoAtual } from '../common/turno';
import { ParametrosService } from '../parametros/parametros.service';
import { BloqueioRepository } from './bloqueio.repository';

/** RN-10: a falta de supervisor bloqueia somente a fila da especialidade correspondente. */
@Injectable()
export class BloqueioService {
  private readonly logger = new Logger(BloqueioService.name);

  constructor(
    private readonly repositorio: BloqueioRepository,
    private readonly alocacao: AlocacaoService,
    private readonly parametros: ParametrosService,
    private readonly relogio: Relogio,
    private readonly eventos: EventosDominio,
    private readonly auditoria: AuditoriaService,
  ) {}

  async atualizar(id: string, unidadeId: string): Promise<void> {
    const mudanca = await this.repositorio.transacao(async (tx) => {
      const fila = await this.repositorio.fila(tx, id, unidadeId);
      if (!fila) return null;
      const agora = this.relogio.agora();
      let bloqueada = false;
      if (fila.especialidade.exigeSupervisaoDocente) {
        const limite = (await this.parametros.vigentes(unidadeId, fila.especialidadeId, tx))
          .limiteEstudantesSupervisor;
        bloqueada = !(await this.alocacao.haSupervisorDisponivel(
          tx,
          fila.especialidadeId,
          turnoAtual(agora),
          limite,
        ));
      }
      if (fila.bloqueada === bloqueada) return null;
      const motivo = 'Sem supervisor habilitado disponível na especialidade.';
      await this.repositorio.gravar(tx, id, bloqueada, motivo, agora);
      await this.auditoria.registrar(
        {
          operacao: 'EDITAR',
          modulo: 'fila',
          entidade: 'fila',
          entidadeId: id,
          justificativa: bloqueada
            ? `Bloqueio automático: ${motivo} (RN-10)`
            : 'Supervisão regularizada: fila desbloqueada (RN-10).',
        },
        tx,
      );
      return { bloqueada, motivo, especialidade: fila.especialidade.nome, em: agora.toISOString() };
    });
    // Publica somente depois que a gravação do bloqueio foi confirmada.
    if (!mudanca) return;
    const { especialidade, em } = mudanca;
    if (mudanca.bloqueada) {
      this.eventos.emitir('fila.bloqueada', {
        filaId: id,
        especialidade,
        motivo: mudanca.motivo,
        desde: em,
      });
    } else {
      this.eventos.emitir('fila.desbloqueada', { filaId: id, especialidade, em });
    }
  }

  @Cron(CronExpression.EVERY_MINUTE, { name: 'bloqueio-supervisao' })
  async executar(): Promise<void> {
    for (const fila of await this.repositorio.monitoradas()) {
      try {
        await this.atualizar(fila.id, fila.unidadeId);
      } catch (erro) {
        this.logger.error({ err: erro, filaId: fila.id }, 'Falha ao reavaliar supervisão da fila');
      }
    }
  }
}
