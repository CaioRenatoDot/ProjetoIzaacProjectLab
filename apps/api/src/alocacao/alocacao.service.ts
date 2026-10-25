import { Injectable } from '@nestjs/common';
import {
  type AguardandoRecursoEntrada,
  type Alocacao,
  type AlocacaoEntrada,
  type CampoInvalido,
  type SenhaResumo,
  type StatusSenha,
} from '@filas/contracts';
import { Prisma } from '@prisma/client';

import { ErroDominio, ErroValidacao } from '../common/errors/erro-dominio';
import { EventosDominio } from '../common/eventos/eventos-dominio';
import { IdempotenciaService } from '../common/idempotencia/idempotencia.service';
import { Relogio } from '../common/relogio';
import { turnoAtual } from '../common/turno';
import { ParametrosService } from '../parametros/parametros.service';
import { MaquinaSenha } from '../senhas/maquina/maquina-senha.service';
import { SenhaProjecao } from '../senhas/senha-projecao.service';
import { SenhasRepository, type Transacao } from '../senhas/senhas.repository';
import { type AlocacaoCompleta, paraAlocacao } from './alocacao.projecao';
import { AlocacaoRepository } from './alocacao.repository';

const ALOCAVEIS: StatusSenha[] = ['CHAMADA', 'AGUARDANDO_RECURSO'];
const MOTIVO_BLOQUEIO = 'Sem supervisor habilitado disponível na especialidade.';

/** Sinaliza, de dentro da transação, que nenhum supervisor está disponível (RN-07, RN-10). */
class SemSupervisorDisponivel extends Error {}

const indisponivel = (detalhe: string) =>
  new ErroDominio('RECURSO_INDISPONIVEL', 409, 'Recurso indisponível', detalhe);

const transicaoInvalida = (detalhe: string) =>
  new ErroDominio('TRANSICAO_INVALIDA', 409, 'Ação indisponível para esta senha', detalhe);

interface Usuario {
  id: string;
  unidadeId: string;
}

/**
 * Alocação de estudante, supervisor e sala (UC-10, RF-06). Revalida RN-05 a RN-09 dentro da
 * transação; o limite do supervisor é contado com a linha dele bloqueada (RN-08). Alocar não
 * muda o status da senha (docs/03 §5).
 */
@Injectable()
export class AlocacaoService {
  constructor(
    private readonly repositorio: AlocacaoRepository,
    private readonly senhas: SenhasRepository,
    private readonly projecao: SenhaProjecao,
    private readonly maquina: MaquinaSenha,
    private readonly parametros: ParametrosService,
    private readonly idempotencia: IdempotenciaService,
    private readonly eventos: EventosDominio,
    private readonly relogio: Relogio,
  ) {}

  async confirmar(
    senhaId: string,
    entrada: AlocacaoEntrada,
    usuario: Usuario,
    chaveIdempotencia: string | undefined,
  ): Promise<Alocacao> {
    return this.comBloqueioPorFaltaDeSupervisor(senhaId, usuario, () =>
      this.idempotencia.executar(
        {
          usuarioId: usuario.id,
          chave: chaveIdempotencia,
          operacao: `POST /senhas/${senhaId}/alocacao`,
          corpo: entrada,
        },
        async (tx) => ({ corpo: await this.alocar(tx, senhaId, entrada, usuario, false) }),
      ),
    );
  }

  async trocar(senhaId: string, entrada: AlocacaoEntrada, usuario: Usuario): Promise<Alocacao> {
    return this.comBloqueioPorFaltaDeSupervisor(senhaId, usuario, () =>
      this.senhas.transacao((tx) => this.alocar(tx, senhaId, entrada, usuario, true)),
    );
  }

  /** "Manter aguardando" (W-11): CHAMADA → AGUARDANDO_RECURSO com o recurso faltante. */
  async manterAguardando(
    senhaId: string,
    entrada: AguardandoRecursoEntrada,
    unidadeId: string,
  ): Promise<SenhaResumo> {
    const { mudanca, senha } = await this.senhas.transacao(async (tx) => {
      const mudanca = await this.maquina.transicionar(tx, {
        senhaId,
        unidadeId,
        versao: entrada.versao,
        para: 'AGUARDANDO_RECURSO',
      });
      await this.repositorio.registrarRecursoFaltante(
        tx,
        senhaId,
        entrada.recursoFaltante,
        entrada.observacao ?? null,
      );
      return { mudanca, senha: await this.resumo(tx, senhaId, unidadeId) };
    });
    this.maquina.publicar(mudanca);
    return senha;
  }

  private async alocar(
    tx: Transacao,
    senhaId: string,
    entrada: AlocacaoEntrada,
    usuario: Usuario,
    troca: boolean,
  ): Promise<Alocacao> {
    const senha = await this.repositorio.senhaParaAlocar(tx, senhaId, usuario.unidadeId);
    if (!senha) {
      throw new ErroDominio(
        'NAO_ENCONTRADO',
        404,
        'Senha não encontrada',
        'O registro não existe ou foi removido.',
      );
    }
    if (senha.versao !== entrada.versao) {
      throw await this.projecao.versaoDesatualizada(senhaId, usuario.unidadeId, tx);
    }
    if (!ALOCAVEIS.includes(senha.status)) {
      throw transicaoInvalida(
        'Só é possível alocar senha chamada ou aguardando recurso, antes de o atendimento começar.',
      );
    }
    const vigente = await this.repositorio.vigente(tx, senhaId);
    if (!troca && vigente) {
      throw transicaoInvalida('A senha já tem recursos alocados. Use a troca de recurso.');
    }
    if (troca && !vigente) throw transicaoInvalida('A senha ainda não tem recursos alocados.');
    const agora = this.relogio.agora();
    // Na troca, o recurso mantido não pode conflitar consigo mesmo.
    if (vigente) await this.repositorio.liberar(tx, vigente.id, agora);

    const especialidade = senha.fila.especialidade;
    const noTurno = turnoAtual(agora);
    const [estudante, sala] = await Promise.all([
      this.repositorio.estudante(
        tx,
        entrada.estudanteId,
        noTurno?.diaSemana ?? null,
        noTurno?.turno ?? null,
      ),
      this.repositorio.sala(tx, entrada.salaId),
    ]);
    const supervisorId = entrada.supervisorId;
    if (supervisorId && !(await this.repositorio.bloquearSupervisor(tx, supervisorId))) {
      throw new ErroValidacao([{ campo: 'supervisorId', mensagem: 'Supervisor não encontrado.' }]);
    }
    const supervisor = supervisorId
      ? await this.repositorio.supervisor(
          tx,
          supervisorId,
          noTurno?.diaSemana ?? null,
          noTurno?.turno ?? null,
        )
      : null;

    // 422: a escolha não serve para esta senha.
    const campos: CampoInvalido[] = [];
    if (!estudante || !estudante.ativo || estudante.especialidade.unidadeId !== usuario.unidadeId) {
      campos.push({ campo: 'estudanteId', mensagem: 'Estudante não encontrado ou inativo.' });
    } else if (estudante.especialidadeId !== senha.fila.especialidadeId) {
      // RN-06: só a especialidade tem fonte no modelo (nível, habilitações e procedimentos exigidos não têm).
      campos.push({ campo: 'estudanteId', mensagem: 'Estudante de outra especialidade.' });
    }
    if (!sala || !sala.ativo || sala.unidadeId !== usuario.unidadeId) {
      campos.push({ campo: 'salaId', mensagem: 'Sala não encontrada ou inativa.' });
    } else {
      const naSala = new Set(sala.recursos.map((recurso) => recurso.recursoId));
      if (especialidade.recursosExigidos.some(({ recursoId }) => !naSala.has(recursoId))) {
        campos.push({
          campo: 'salaId',
          mensagem: 'A sala não tem os recursos exigidos pela especialidade.',
        });
      }
    }
    if (!especialidade.exigeSupervisaoDocente && supervisorId) {
      campos.push({ campo: 'supervisorId', mensagem: 'Esta especialidade não exige supervisão.' });
    }
    if (supervisor) {
      if (!supervisor.ativo) {
        campos.push({ campo: 'supervisorId', mensagem: 'Supervisor inativo.' });
      } else if (
        !supervisor.especialidades.some((e) => e.especialidadeId === senha.fila.especialidadeId)
      ) {
        campos.push({
          campo: 'supervisorId',
          mensagem: 'Supervisor não habilitado nesta especialidade.',
        });
      }
    }
    const semSupervisorEscolhido = especialidade.exigeSupervisaoDocente && !supervisorId;
    if (campos.length) throw new ErroValidacao(campos);

    const limiteDaUnidade = (
      await this.parametros.vigentes(usuario.unidadeId, senha.fila.especialidadeId, tx)
    ).limiteEstudantesSupervisor;
    if (semSupervisorEscolhido) {
      if (
        !(await this.haSupervisorDisponivel(
          tx,
          senha.fila.especialidadeId,
          noTurno,
          limiteDaUnidade,
        ))
      ) {
        throw new SemSupervisorDisponivel();
      }
      throw new ErroValidacao([
        { campo: 'supervisorId', mensagem: 'Esta especialidade exige supervisor (RN-07).' },
      ]);
    }

    // 409: serve, mas não está livre agora.
    if (!estudante!.disponibilidades.length) {
      throw indisponivel('O estudante não está disponível neste turno (RN-05).');
    }
    if (estudante!._count.alocacoes > 0) {
      throw indisponivel('O estudante já está em outro atendimento (RN-05).');
    }
    if (sala!.situacao !== 'DISPONIVEL' || sala!._count.alocacoes > 0) {
      throw indisponivel('A sala não está disponível agora (RN-09).');
    }
    if (supervisor) {
      const limite = supervisor.limiteEstudantesSimultaneos ?? limiteDaUnidade;
      const foraDoTurno = !supervisor.disponibilidades.length;
      const noLimite = supervisor._count.alocacoes >= limite;
      if (foraDoTurno || noLimite) {
        if (
          !(await this.haSupervisorDisponivel(
            tx,
            senha.fila.especialidadeId,
            noTurno,
            limiteDaUnidade,
            supervisorId!,
          ))
        ) {
          throw new SemSupervisorDisponivel();
        }
        if (foraDoTurno)
          throw indisponivel('O supervisor não está disponível neste turno (RN-07).');
        throw new ErroDominio(
          'LIMITE_SUPERVISAO_ATINGIDO',
          409,
          'Limite de supervisão atingido',
          `O supervisor já acompanha ${supervisor._count.alocacoes} estudante(s), o limite dele (RN-08). Escolha outro supervisor.`,
        );
      }
    }

    let alocacao: AlocacaoCompleta;
    try {
      alocacao = await this.repositorio.criar(tx, {
        senhaId,
        estudanteId: entrada.estudanteId,
        supervisorId: supervisorId ?? null,
        salaId: entrada.salaId,
        confirmadaPor: usuario.id,
      });
    } catch (erro) {
      // Índices únicos parciais de estudante e sala (RN-05, RN-09): outra confirmação venceu.
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002') {
        throw indisponivel('O estudante ou a sala acabou de ser alocado em outra senha.');
      }
      throw erro;
    }
    if (!(await this.repositorio.incrementarVersao(tx, senhaId, senha.versao))) {
      throw await this.projecao.versaoDesatualizada(senhaId, usuario.unidadeId, tx);
    }
    return paraAlocacao(alocacao);
  }

  /** Há supervisor habilitado, no turno e abaixo do limite (RN-07, RN-08)? */
  private async haSupervisorDisponivel(
    tx: Transacao,
    especialidadeId: string,
    noTurno: ReturnType<typeof turnoAtual>,
    limiteDaUnidade: number,
    exceto?: string,
  ): Promise<boolean> {
    if (!noTurno) return false;
    const candidatos = await this.repositorio.supervisoresNoTurno(
      tx,
      especialidadeId,
      noTurno.diaSemana,
      noTurno.turno,
      exceto,
    );
    return candidatos.some(
      (c) => c._count.alocacoes < (c.limiteEstudantesSimultaneos ?? limiteDaUnidade),
    );
  }

  /**
   * SUPERVISOR_INDISPONIVEL (RN-10): a alocação foi desfeita; em outra transação, a senha
   * CHAMADA vai a AGUARDANDO_RECURSO e a fila é bloqueada.
   */
  private async comBloqueioPorFaltaDeSupervisor<T>(
    senhaId: string,
    usuario: Usuario,
    operacao: () => Promise<T>,
  ): Promise<T> {
    try {
      return await operacao();
    } catch (erro) {
      if (!(erro instanceof SemSupervisorDisponivel)) throw erro;
    }
    const efeitos = await this.senhas.transacao(async (tx) => {
      const senha = await this.repositorio.senhaParaAlocar(tx, senhaId, usuario.unidadeId);
      if (!senha) return null;
      const mudanca =
        senha.status === 'CHAMADA'
          ? await this.maquina.transicionar(tx, {
              senhaId,
              unidadeId: usuario.unidadeId,
              versao: senha.versao,
              para: 'AGUARDANDO_RECURSO',
            })
          : null;
      if (mudanca) await this.repositorio.registrarRecursoFaltante(tx, senhaId, 'SUPERVISOR', null);
      const agora = this.relogio.agora();
      const bloqueou = await this.repositorio.bloquearFila(
        tx,
        senha.filaId,
        MOTIVO_BLOQUEIO,
        agora,
      );
      return {
        mudanca,
        bloqueio: bloqueou
          ? {
              filaId: senha.filaId,
              especialidade: senha.fila.especialidade.nome,
              motivo: MOTIVO_BLOQUEIO,
              desde: agora.toISOString(),
            }
          : null,
      };
    });
    if (efeitos?.mudanca) this.maquina.publicar(efeitos.mudanca);
    if (efeitos?.bloqueio) this.eventos.emitir('fila.bloqueada', efeitos.bloqueio);
    throw new ErroDominio(
      'SUPERVISOR_INDISPONIVEL',
      409,
      'Sem supervisor disponível',
      'Nenhum supervisor habilitado nesta especialidade está disponível agora. A senha ficou aguardando recurso e as chamadas da fila foram suspensas até a regularização (RN-10).',
    );
  }

  private async resumo(tx: Transacao, senhaId: string, unidadeId: string): Promise<SenhaResumo> {
    return this.projecao.resumo((await this.senhas.buscar(senhaId, unidadeId, tx))!, tx);
  }
}
