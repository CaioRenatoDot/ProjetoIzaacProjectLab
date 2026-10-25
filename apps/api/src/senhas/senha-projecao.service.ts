import { Injectable } from '@nestjs/common';
import { type SenhaResumo } from '@filas/contracts';

import { iniciais } from '../cadastros/pessoas.util';
import { ErroDominio } from '../common/errors/erro-dominio';
import { ParametrosService } from '../parametros/parametros.service';
import { type SenhaCompleta, SenhasRepository, type Transacao } from './senhas.repository';

/** Monta o `SenhaResumo` (ADR-003: sem conteúdo clínico) usado em respostas, erros e eventos. */
@Injectable()
export class SenhaProjecao {
  constructor(
    private readonly repositorio: SenhasRepository,
    private readonly parametros: ParametrosService,
  ) {}

  async resumo(senha: SenhaCompleta, tx?: Transacao): Promise<SenhaResumo> {
    const [resumo] = await this.resumos([senha], tx);
    return resumo!;
  }

  /** Em lote: um cálculo de posição por fila e um de parâmetros por especialidade. */
  async resumos(senhas: SenhaCompleta[], tx?: Transacao): Promise<SenhaResumo[]> {
    const filas = [...new Set(senhas.map((senha) => senha.filaId))];
    const posicoes = await this.repositorio.posicoes(filas, tx);
    const slaPorEspecialidade = new Map<string, number>();
    for (const senha of senhas) {
      const chave = `${senha.fila.unidadeId}:${senha.fila.especialidadeId}`;
      if (!slaPorEspecialidade.has(chave)) {
        const { slaMinutos } = await this.parametros.vigentes(
          senha.fila.unidadeId,
          senha.fila.especialidadeId,
          tx,
        );
        slaPorEspecialidade.set(chave, slaMinutos);
      }
    }
    const agora = Date.now();
    return senhas.map((senha) => {
      const sla =
        senha.fila.slaMinutos ??
        slaPorEspecialidade.get(`${senha.fila.unidadeId}:${senha.fila.especialidadeId}`)!;
      const fim = senha.chamadaEm?.getTime() ?? agora;
      const tempoEsperaMinutos = Math.max(
        0,
        Math.floor((fim - senha.chegadaEm.getTime()) / 60_000),
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
        posicao: posicoes.get(senha.id) ?? null,
        chegadaEm: senha.chegadaEm.toISOString(),
        chamadaEm: senha.chamadaEm?.toISOString() ?? null,
        toleranciaAte: senha.toleranciaAte?.toISOString() ?? null,
        tempoEsperaMinutos,
        slaExcedido: tempoEsperaMinutos > sla,
        temAgendamentoPrevio: senha.temAgendamentoPrevio,
        // O recurso faltante entra com a parte 7.1 (#21).
        recursoFaltante: null,
        chamadaId: senha.status === 'CHAMADA' ? (senha.chamadas[0]?.id ?? null) : null,
        versao: senha.versao,
      };
    });
  }

  /** 409 com a senha como está agora no banco (docs/04 §6). */
  async versaoDesatualizada(
    senhaId: string,
    unidadeId: string,
    tx?: Transacao,
  ): Promise<ErroDominio> {
    const atual = (await this.repositorio.buscar(senhaId, unidadeId, tx))!;
    return new ErroDominio(
      'VERSAO_DESATUALIZADA',
      409,
      'Senha alterada por outra pessoa',
      'A senha mudou desde que você abriu a tela. Confira o estado atual e tente de novo.',
      { atual: await this.resumo(atual, tx) },
    );
  }
}
