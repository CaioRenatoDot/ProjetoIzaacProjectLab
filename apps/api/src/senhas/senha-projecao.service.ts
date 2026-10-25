import { Injectable } from '@nestjs/common';
import { type SenhaResumo } from '@filas/contracts';

import { iniciais } from '../cadastros/pessoas.util';
import { ErroDominio } from '../common/errors/erro-dominio';
import { ParametrosService } from '../parametros/parametros.service';
import { type SenhaCompleta, SenhasRepository } from './senhas.repository';

/** Monta o `SenhaResumo` (ADR-003: sem conteúdo clínico) usado em respostas, erros e eventos. */
@Injectable()
export class SenhaProjecao {
  constructor(
    private readonly repositorio: SenhasRepository,
    private readonly parametros: ParametrosService,
  ) {}

  async resumo(senha: SenhaCompleta): Promise<SenhaResumo> {
    const { slaMinutos: slaDaUnidade } = await this.parametros.vigentes(
      senha.fila.unidadeId,
      senha.fila.especialidadeId,
    );
    const sla = senha.fila.slaMinutos ?? slaDaUnidade;
    const fim = senha.chamadaEm ?? new Date();
    const tempoEsperaMinutos = Math.max(
      0,
      Math.floor((fim.getTime() - senha.chegadaEm.getTime()) / 60_000),
    );
    return {
      id: senha.id,
      numero: senha.numero,
      filaId: senha.filaId,
      especialidade: senha.fila.especialidade.nome,
      pacienteIniciais: iniciais(senha.paciente.nomeCompleto),
      prioridade: senha.prioridade,
      tipoAtendimento: senha.tipoAtendimento,
      status: senha.status,
      posicao: await this.repositorio.posicao(senha.id),
      chegadaEm: senha.chegadaEm.toISOString(),
      chamadaEm: senha.chamadaEm?.toISOString() ?? null,
      toleranciaAte: senha.toleranciaAte?.toISOString() ?? null,
      tempoEsperaMinutos,
      slaExcedido: tempoEsperaMinutos > sla,
      temAgendamentoPrevio: senha.temAgendamentoPrevio,
      versao: senha.versao,
    };
  }

  /** 409 com a senha como está agora no banco (docs/04 §6). */
  async versaoDesatualizada(senhaId: string, unidadeId: string): Promise<ErroDominio> {
    const atual = (await this.repositorio.buscar(senhaId, unidadeId))!;
    return new ErroDominio(
      'VERSAO_DESATUALIZADA',
      409,
      'Senha alterada por outra pessoa',
      'A senha mudou desde que você abriu a tela. Confira o estado atual e tente de novo.',
      { atual: await this.resumo(atual) },
    );
  }
}
