import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpAdapterHost } from '@nestjs/core';
import {
  ChamadaExibida,
  EstadoPainel,
  type EventosFila,
  type NomeEventoFila,
} from '@filas/contracts';
import { type Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';

import { EventosDominio } from '../common/eventos/eventos-dominio';
import { Relogio } from '../common/relogio';
import { type Ambiente } from '../config/ambiente';
import { FilasRepository } from '../filas/filas.repository';
import { type Inscricao, SocketAuthService } from './socket-auth.service';
import { TempoRealRepository } from './tempo-real.repository';

const EVENTOS: NomeEventoFila[] = [
  'senha.criada',
  'senha.chamada',
  'senha.status_alterado',
  'senha.reclassificada',
  'ausencia.registrada',
  'fila.bloqueada',
  'fila.desbloqueada',
  'fila.metricas',
];

@Injectable()
export class TempoRealGateway implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(TempoRealGateway.name);
  private readonly cancelar: (() => void)[] = [];
  private io?: Server;

  constructor(
    private readonly http: HttpAdapterHost,
    private readonly config: ConfigService<Ambiente, true>,
    private readonly auth: SocketAuthService,
    private readonly repositorio: TempoRealRepository,
    private readonly filas: FilasRepository,
    private readonly eventos: EventosDominio,
    private readonly relogio: Relogio,
  ) {}

  onApplicationBootstrap(): void {
    const origens = this.config.get('CORS_ORIGENS', { infer: true });
    this.io = new Server(this.http.httpAdapter.getHttpServer() as HttpServer, {
      cors: { origin: origens, credentials: true },
      allowRequest: (req, aceitar) =>
        aceitar(null, !req.headers.origin || origens.includes(req.headers.origin)),
    });
    for (const canal of ['/filas', '/painel', '/alertas'] as const) {
      const namespace = this.io.of(canal);
      const inscricoes = new WeakMap<Socket, Inscricao>();
      namespace.use((socket, next) => {
        void (async () => {
          const inscricao = await this.auth.autorizar(socket, canal);
          await socket.join(inscricao.sala);
          inscricoes.set(socket, inscricao);
        })().then(
          () => next(),
          () => next(new Error('CONEXAO_NAO_AUTORIZADA')),
        );
      });
      namespace.on('connection', (socket) => {
        const inscricao = inscricoes.get(socket)!;
        if (canal === '/painel') {
          void this.enviarEstado(socket, inscricao.unidadeId).catch((erro: unknown) => {
            this.logger.error({ err: erro }, 'Falha ao recuperar painel público');
            socket.disconnect(true);
          });
        } else {
          const expirar = setTimeout(
            () => socket.disconnect(true),
            Math.max(0, inscricao.expira! - Date.now()),
          );
          const conferir = setInterval(() => {
            void this.auth.vigente(inscricao).then(
              (vigente) => {
                if (!vigente) socket.disconnect(true);
              },
              () => socket.disconnect(true),
            );
          }, 30_000);
          expirar.unref();
          conferir.unref();
          socket.on('disconnect', () => {
            clearTimeout(expirar);
            clearInterval(conferir);
          });
        }
      });
    }
    for (const nome of EVENTOS)
      this.cancelar.push(this.eventos.assinar(nome, (carga) => this.repassar(nome, carga)));
  }

  private async enviarEstado(socket: Socket, unidadeId: string): Promise<void> {
    const chamadas = await this.repositorio.chamadasPublicas(unidadeId, this.relogio.agora());
    socket.emit(
      'painel.estado',
      EstadoPainel.parse({ atual: chamadas[0] ?? null, anteriores: chamadas.slice(1) }),
    );
  }

  private async repassar(nome: NomeEventoFila, carga: EventosFila[NomeEventoFila]): Promise<void> {
    const filaId = 'filaId' in carga ? carga.filaId : 'senha' in carga ? carga.senha.filaId : null;
    const fila = filaId
      ? await this.repositorio.fila(filaId)
      : 'senhaId' in carga
        ? await this.repositorio.filaDaSenha(carga.senhaId)
        : null;
    if (!fila || !this.io) return;
    const destino = this.io.of('/filas').to(`especialidade:${fila.especialidadeId}`);
    destino.emit(nome, carga);
    if (nome === 'senha.chamada' && 'chamada' in carga) {
      this.io
        .of('/painel')
        .to(`unidade:${fila.unidadeId}`)
        .emit(
          'chamada.exibir',
          ChamadaExibida.parse({
            numero: carga.senha.numero,
            especialidade: carga.senha.especialidade,
            local: carga.chamada.local,
            sequencia: carga.chamada.sequencia,
            em: carga.chamada.chamadoEm,
          }),
        );
    }
    if (nome !== 'fila.metricas') {
      const { aguardando, emAtendimento, tempoMedioEsperaMinutos } = await this.filas.metricas(
        fila.id,
      );
      destino.emit('fila.metricas', {
        filaId: fila.id,
        aguardando,
        emAtendimento,
        tempoMedioEsperaMinutos,
      });
    }
  }

  async onModuleDestroy(): Promise<void> {
    for (const cancelar of this.cancelar) cancelar();
    if (this.io) await this.io.close();
  }
}
