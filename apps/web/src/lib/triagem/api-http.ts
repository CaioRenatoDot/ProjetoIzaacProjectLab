import {
  type Especialidade,
  type Paciente,
  type SenhaEmitida as SenhaEmitidaApi,
  type TriagemDetalhe,
} from '@filas/contracts';

import { type ClienteHttp, ErroApi } from '@/lib/api/cliente-http';
import { criarReclassificacaoHttp } from '@/lib/fila/reclassificacao-http';

import { type CodigoErroTriagem, ErroTriagem, type TriagemApi } from './tipos';

interface Pagina<T> {
  dados: T[];
}

const CODIGOS: readonly CodigoErroTriagem[] = ['SEM_FILA_CONFIGURADA', 'VALIDACAO'];

/** Converte os erros que a tela trata pelo código (`SEM_FILA_CONFIGURADA`, `VALIDACAO`). */
async function comErroTriagem<T>(promessa: Promise<T>): Promise<T> {
  try {
    return await promessa;
  } catch (erro) {
    if (erro instanceof ErroApi && (CODIGOS as string[]).includes(erro.codigo)) {
      throw new ErroTriagem(erro.codigo as CodigoErroTriagem, erro.detail);
    }
    throw erro;
  }
}

/**
 * W-06 e W-07 pela API (#15, #16), conforme `docs/07-pendencias-integracao.md`: busca e
 * especialidades pelos cadastros, triagem e senha pelos endpoints próprios, e a reclassificação
 * pelo mesmo cliente do painel de fila.
 */
export function criarTriagemHttp(cliente: ClienteHttp): TriagemApi {
  return {
    ...criarReclassificacaoHttp(cliente),

    async buscarPacientes(termo) {
      const busca = termo.trim();
      if (!busca) return [];
      const pagina = await cliente.requisitar<Pagina<Paciente>>(
        `/pacientes?busca=${encodeURIComponent(busca)}&tamanho=20`,
      );
      return pagina.dados
        .filter((paciente) => paciente.ativo)
        .map(({ id, iniciais, documento, vinculo, restricaoAtiva, restricaoAte }) => ({
          id,
          iniciais,
          documento,
          vinculo,
          restricaoAtiva,
          restricaoAte,
        }));
    },

    /** Só as ativas com fila ativa (lacuna 8 da triagem, `docs/07`). */
    async listarEspecialidades() {
      const pagina = await cliente.requisitar<Pagina<Especialidade>>(
        '/especialidades?ativa=true&comFila=true&tamanho=100',
      );
      return pagina.dados.map(({ id, nome, ativa, filasVinculadas }) => ({
        id,
        nome,
        ativa,
        filasVinculadas,
      }));
    },

    async registrarTriagem(entrada) {
      const triagem = await comErroTriagem(
        cliente.requisitar<TriagemDetalhe>('/triagens', { metodo: 'POST', corpo: entrada }),
      );
      return {
        id: triagem.id,
        pacienteIniciais: triagem.pacienteIniciais,
        especialidadeId: triagem.especialidadeId,
        especialidade: triagem.especialidade,
        tipoAtendimento: triagem.tipoAtendimento,
        prioridade: triagem.prioridade,
        enquadramentoLegal: triagem.enquadramentoLegal,
      };
    },

    async emitirSenha(entrada) {
      const senha = await comErroTriagem(
        cliente.requisitar<SenhaEmitidaApi>('/senhas', { metodo: 'POST', corpo: entrada }),
      );
      return {
        id: senha.id,
        numero: senha.numero,
        especialidade: senha.especialidade,
        pacienteIniciais: senha.pacienteIniciais,
        prioridade: senha.prioridade,
        tipoAtendimento: senha.tipoAtendimento,
        posicaoEstimada: senha.posicaoEstimada,
        versao: senha.versao,
        avisos: senha.avisos.map(({ codigo, mensagem }) => ({ codigo, mensagem })),
      };
    },
  };
}
