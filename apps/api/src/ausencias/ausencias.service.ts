import { Injectable } from '@nestjs/common';
import {
  type RegistrarAusenciaEntrada,
  type RegistroAusencia,
  type RestricaoAplicada,
} from '@filas/contracts';

import { AuditoriaService } from '../common/auditoria/auditoria.service';
import { ErroDominio, ErroValidacao } from '../common/errors/erro-dominio';
import { EventosDominio } from '../common/eventos/eventos-dominio';
import { Relogio } from '../common/relogio';
import { ParametrosService } from '../parametros/parametros.service';
import { MaquinaSenha, type MudancaStatus } from '../senhas/maquina/maquina-senha.service';
import { SenhaProjecao } from '../senhas/senha-projecao.service';
import { SenhasRepository, type Transacao } from '../senhas/senhas.repository';

const FUSO = 'America/Sao_Paulo';
/** Senhas tratadas por execução da rotina; o resto fica para o minuto seguinte. */
const LOTE_DA_ROTINA = 100;

/** Data de calendário no fuso da unidade, somada de `dias`, como AAAA-MM-DD. */
function dataNaUnidade(agora: Date, dias: number): string {
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO }).format(agora);
  const data = new Date(`${hoje}T00:00:00Z`);
  data.setUTCDate(data.getUTCDate() + dias);
  return data.toISOString().slice(0, 10);
}

interface SenhaBloqueada {
  id: string;
  versao: number;
  pacienteId: string;
  unidadeId: string;
  especialidadeId: string;
  retornosTolerancia: number;
}

interface Efeito {
  mudanca: MudancaStatus;
  registro: RegistroAusencia | null;
}

/**
 * Ausência (UC-16, RF-09) e tolerância (RN-12): na primeira expiração a senha volta à fila com
 * a chegada original; na segunda, vira ausência automática. Ausências repetidas aplicam a
 * restrição temporária da RN-13, pelos parâmetros da unidade.
 */
@Injectable()
export class AusenciasService {
  constructor(
    private readonly senhas: SenhasRepository,
    private readonly projecao: SenhaProjecao,
    private readonly maquina: MaquinaSenha,
    private readonly parametros: ParametrosService,
    private readonly auditoria: AuditoriaService,
    private readonly eventos: EventosDominio,
    private readonly relogio: Relogio,
  ) {}

  async registrarManual(
    senhaId: string,
    entrada: RegistrarAusenciaEntrada,
    usuarioId: string,
    unidadeId: string,
  ): Promise<RegistroAusencia> {
    const agora = this.relogio.agora();
    const efeito = await this.senhas.transacao(async (tx) => {
      const senha = await this.bloquear(tx, senhaId, unidadeId);
      if (!senha) {
        throw new ErroDominio(
          'NAO_ENCONTRADO',
          404,
          'Senha não encontrada',
          'O registro não existe ou foi removido.',
        );
      }
      if (senha.versao !== entrada.versao) {
        throw await this.projecao.versaoDesatualizada(senhaId, unidadeId, tx);
      }
      const toleranciaAte = await tx.senha.findUniqueOrThrow({
        where: { id: senhaId },
        select: { status: true, toleranciaAte: true },
      });
      if (
        toleranciaAte.status === 'CHAMADA' &&
        toleranciaAte.toleranciaAte &&
        agora < toleranciaAte.toleranciaAte &&
        !entrada.confirmadoAntesDaTolerancia
      ) {
        throw new ErroValidacao([
          {
            campo: 'confirmadoAntesDaTolerancia',
            mensagem: 'A tolerância ainda não terminou. Confirme para registrar a ausência agora.',
          },
        ]);
      }
      return this.ausentar(tx, senha, agora, { usuarioId, observacao: entrada.observacao ?? null });
    });
    this.publicar(efeito);
    return efeito.registro!;
  }

  /** Rotina da RN-12: trata as senhas CHAMADA com tolerância vencida, uma transação por senha. */
  async processarToleranciasVencidas(): Promise<number> {
    let tratadas = 0;
    while (tratadas < LOTE_DA_ROTINA) {
      const agora = this.relogio.agora();
      const efeito = await this.senhas.transacao(async (tx) => {
        const [vencida] = await tx.$queryRaw<{ id: string; unidade_id: string }[]>`
          SELECT s.id, f.unidade_id
            FROM senha s JOIN fila f ON f.id = s.fila_id
           WHERE s.status = 'CHAMADA' AND s.tolerancia_ate < ${agora}
           ORDER BY s.tolerancia_ate
           LIMIT 1
             FOR UPDATE OF s SKIP LOCKED`;
        if (!vencida) return null;
        const senha = (await this.bloquear(tx, vencida.id, vencida.unidade_id))!;
        return senha.retornosTolerancia === 0
          ? this.devolverAFila(tx, senha, agora)
          : this.ausentar(tx, senha, agora, { usuarioId: null, observacao: null });
      });
      if (!efeito) break;
      this.publicar(efeito);
      tratadas += 1;
    }
    return tratadas;
  }

  private async devolverAFila(tx: Transacao, senha: SenhaBloqueada, agora: Date): Promise<Efeito> {
    const mudanca = await this.maquina.transicionar(tx, {
      senhaId: senha.id,
      unidadeId: senha.unidadeId,
      versao: senha.versao,
      para: 'AGUARDANDO',
      agora,
    });
    await tx.senha.update({
      where: { id: senha.id },
      data: { retornosTolerancia: { increment: 1 } },
    });
    await this.liberarAlocacao(tx, senha.id, agora);
    await this.auditoria.registrar(
      {
        operacao: 'EDITAR',
        modulo: 'ausencia',
        entidade: 'senha',
        entidadeId: senha.id,
        justificativa: 'Tolerância expirada: devolvida à fila (RN-12)',
      },
      tx,
    );
    return { mudanca, registro: null };
  }

  private async ausentar(
    tx: Transacao,
    senha: SenhaBloqueada,
    agora: Date,
    origem: { usuarioId: string | null; observacao: string | null },
  ): Promise<Efeito> {
    const automatica = origem.usuarioId === null;
    const mudanca = await this.maquina.transicionar(tx, {
      senhaId: senha.id,
      unidadeId: senha.unidadeId,
      versao: senha.versao,
      para: 'AUSENTE',
      agora,
    });
    const recursosLiberados = await this.liberarAlocacao(tx, senha.id, agora);
    await tx.ausencia.create({
      data: {
        senhaId: senha.id,
        automatica,
        observacao: origem.observacao,
        registradoPor: origem.usuarioId,
        registradoEm: agora,
      },
    });
    if (automatica) {
      await this.auditoria.registrar(
        {
          operacao: 'CRIAR',
          modulo: 'ausencia',
          entidade: 'ausencia',
          entidadeId: senha.id,
          justificativa: 'Tolerância expirada pela segunda vez (RN-12)',
        },
        tx,
      );
    }
    const restricaoAplicada = await this.aplicarReincidencia(tx, senha, agora);
    const atual = (await this.senhas.buscar(senha.id, senha.unidadeId, tx))!;
    return {
      mudanca,
      registro: {
        senha: await this.projecao.resumo(atual, tx),
        automatica,
        recursosLiberados,
        restricaoAplicada,
      },
    };
  }

  /** RN-13: `reincidencias_restricao` ausências em `janela_reincidencia_dias` restringem o paciente. */
  private async aplicarReincidencia(
    tx: Transacao,
    senha: SenhaBloqueada,
    agora: Date,
  ): Promise<RestricaoAplicada | null> {
    const { reincidenciasRestricao, janelaReincidenciaDias } = await this.parametros.vigentes(
      senha.unidadeId,
      senha.especialidadeId,
      tx,
    );
    const ausencias = await tx.ausencia.count({
      where: {
        senha: { pacienteId: senha.pacienteId },
        registradoEm: { gte: new Date(agora.getTime() - janelaReincidenciaDias * 86_400_000) },
      },
    });
    if (ausencias < reincidenciasRestricao) return null;
    const ate = dataNaUnidade(agora, janelaReincidenciaDias);
    await tx.paciente.update({
      where: { id: senha.pacienteId },
      data: { restricaoAtiva: true, restricaoAte: new Date(`${ate}T00:00:00Z`) },
    });
    return {
      tipo: 'RESTRICAO_TEMPORARIA',
      ate,
      descricao: `Paciente com ${ausencias} ausências em ${janelaReincidenciaDias} dias: restrição temporária até ${ate}. A triagem continua permitida, com aviso.`,
    };
  }

  private async liberarAlocacao(tx: Transacao, senhaId: string, agora: Date): Promise<boolean> {
    const { count } = await tx.alocacao.updateMany({
      where: { senhaId, liberadaEm: null },
      data: { liberadaEm: agora },
    });
    return count > 0;
  }

  /** Lê a senha com a linha bloqueada até o fim da transação. */
  private async bloquear(
    tx: Transacao,
    senhaId: string,
    unidadeId: string,
  ): Promise<SenhaBloqueada | null> {
    const [linha] = await tx.$queryRaw<
      {
        id: string;
        versao: number;
        paciente_id: string;
        especialidade_id: string;
        retornos_tolerancia: number;
      }[]
    >`
      SELECT s.id, s.versao, s.paciente_id, f.especialidade_id, s.retornos_tolerancia
        FROM senha s JOIN fila f ON f.id = s.fila_id
       WHERE s.id = ${senhaId}::uuid AND f.unidade_id = ${unidadeId}::uuid
         FOR UPDATE OF s`;
    return linha
      ? {
          id: linha.id,
          versao: linha.versao,
          pacienteId: linha.paciente_id,
          unidadeId,
          especialidadeId: linha.especialidade_id,
          retornosTolerancia: linha.retornos_tolerancia,
        }
      : null;
  }

  private publicar(efeito: Efeito): void {
    this.maquina.publicar(efeito.mudanca);
    if (efeito.registro) {
      this.eventos.emitir('ausencia.registrada', {
        senha: efeito.registro.senha,
        automatica: efeito.registro.automatica,
        restricaoAplicada: efeito.registro.restricaoAplicada,
      });
    }
  }
}
