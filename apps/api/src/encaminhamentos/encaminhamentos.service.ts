import { Injectable } from '@nestjs/common';
import { Encaminhamento, type EncaminhamentoEntrada, prioridadeEfetiva } from '@filas/contracts';

import { type UsuarioAutenticado } from '../auth/usuario-autenticado';
import { AuditoriaService } from '../common/auditoria/auditoria.service';
import { ErroDominio, ErroValidacao } from '../common/errors/erro-dominio';
import { EventosDominio } from '../common/eventos/eventos-dominio';
import { SenhaProjecao } from '../senhas/senha-projecao.service';
import { SenhasRepository } from '../senhas/senhas.repository';
import { SenhasService } from '../senhas/senhas.service';
import { EncaminhamentosRepository } from './encaminhamentos.repository';

export interface ContextoEncaminhamento {
  usuario: Pick<UsuarioAutenticado, 'id' | 'unidadeId' | 'perfilNome'>;
  origemIp?: string;
  userAgent?: string;
  requestId?: string;
}

@Injectable()
export class EncaminhamentosService {
  constructor(
    private readonly repository: EncaminhamentosRepository,
    private readonly senhas: SenhasRepository,
    private readonly emissao: SenhasService,
    private readonly projecao: SenhaProjecao,
    private readonly auditoria: AuditoriaService,
    private readonly eventos: EventosDominio,
  ) {}

  async registrar(
    id: string,
    entrada: EncaminhamentoEntrada,
    contexto: ContextoEncaminhamento,
  ): Promise<Encaminhamento> {
    const { usuario, ...origemAuditoria } = contexto;
    const resposta = await this.senhas.transacao(async (tx) => {
      const origem = await this.repository.origem(tx, id, usuario.unidadeId);
      if (!origem)
        throw new ErroDominio(
          'NAO_ENCONTRADO',
          404,
          'Atendimento não encontrado',
          'O registro não existe ou foi removido.',
        );
      const existente = await this.repository.existente(tx, id);
      if (existente)
        throw new ErroDominio(
          'DUPLICIDADE',
          409,
          'Encaminhamento já registrado',
          'Este atendimento já possui encaminhamento.',
          { recursoExistenteId: existente.id },
        );
      if (
        origem.senha.status !== 'ENCERRADO' ||
        origem.desfecho !== `ENCAMINHAMENTO_${entrada.tipo}`
      )
        throw new ErroDominio(
          'TRANSICAO_INVALIDA',
          409,
          'Encaminhamento indisponível',
          'Encerre e valide o atendimento com o desfecho correspondente ao encaminhamento.',
        );
      const motivo = entrada.motivo?.trim() ?? '';
      if (entrada.tipo === 'INTERNO' && entrada.prioridadeSugerida === 'URGENTE' && !motivo)
        throw new ErroValidacao([
          {
            campo: 'motivo',
            mensagem: 'Informe o motivo clínico para sugerir prioridade urgente.',
          },
        ]);
      const destino =
        entrada.tipo === 'INTERNO'
          ? await this.repository.destino(tx, entrada.especialidadeDestinoId, usuario.unidadeId)
          : null;
      if (entrada.tipo === 'INTERNO' && (!destino || !destino.ativo))
        throw new ErroDominio(
          'ESPECIALIDADE_INATIVA',
          409,
          'Especialidade indisponível',
          'A especialidade de destino não existe ou está inativa. Escolha outro destino.',
        );
      const senhaId =
        entrada.tipo === 'INTERNO'
          ? await this.emissao.emitirNaFila(tx, {
              unidadeId: usuario.unidadeId,
              especialidadeId: entrada.especialidadeDestinoId,
              triagemId: origem.senha.triagemId,
              pacienteId: origem.senha.pacienteId,
              senhaOrigemId: origem.senha.id,
              tipoAtendimento: origem.senha.tipoAtendimento,
              prioridade: prioridadeEfetiva(
                entrada.prioridadeSugerida ?? origem.senha.prioridade,
                origem.senha.triagem.enquadramentoLegal,
              ),
              temAgendamentoPrevio: false,
            })
          : null;
      const registro = await this.repository.criar(tx, {
        atendimentoId: id,
        tipo: entrada.tipo,
        especialidadeDestinoId: destino?.id ?? null,
        instituicaoDestino: entrada.tipo === 'EXTERNO' ? entrada.instituicaoDestino : null,
        motivo,
        prioridadeSugerida:
          entrada.tipo === 'INTERNO' ? (entrada.prioridadeSugerida ?? null) : null,
        senhaGeradaId: senhaId,
        observacoes: entrada.tipo === 'EXTERNO' ? (entrada.observacoes ?? null) : null,
        criadoPor: usuario.id,
      });
      const senha = senhaId ? await this.senhas.buscar(senhaId, usuario.unidadeId, tx) : null;
      const resumo = senha ? await this.projecao.resumo(senha, tx) : null;
      await this.auditoria.registrar(
        {
          ...origemAuditoria,
          usuarioId: usuario.id,
          perfilNomeNoMomento: usuario.perfilNome,
          operacao: 'CRIAR',
          modulo: 'encaminhamento',
          entidade: 'encaminhamento',
          entidadeId: registro.id,
        },
        tx,
      );
      return Encaminhamento.parse({
        id: registro.id,
        atendimentoOrigemId: id,
        tipo: registro.tipo,
        especialidadeDestino: destino?.nome ?? null,
        instituicaoDestino: registro.instituicaoDestino,
        motivo: registro.motivo,
        senhaGerada: resumo,
        criadoEm: registro.criadoEm.toISOString(),
        avisos: senha?.fila.bloqueada
          ? [
              {
                codigo: 'FILA_BLOQUEADA',
                mensagem:
                  'A senha foi emitida, mas a chamada da fila de destino está suspensa por falta de supervisor disponível.',
              },
            ]
          : [],
      });
    });
    if (resposta.senhaGerada) this.eventos.emitir('senha.criada', resposta.senhaGerada);
    return resposta;
  }
}
