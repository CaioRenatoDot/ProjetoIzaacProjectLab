import { type Prioridade } from '@filas/contracts';
import { http, HttpResponse } from 'msw';

import { API_URL } from '@/lib/api/config';
import { type Encaminhamento, type EncaminhamentoEntrada } from '@/lib/encaminhamento/api';

import { atendimentoDaSimulacao } from './atendimentos';
import { filasDaSimulacao, incluirSenhaSimulada } from './filas';
import { usuarioMockDaRequisicao } from './handlers';

/**
 * Simulação do encaminhamento (UC-14, UC-15), até a API da #26. Dados fictícios (RNF-07).
 *
 * - Interno gera senha AGUARDANDO na fila de destino, vinculada ao atendimento de origem.
 * - Fonoaudiologia está bloqueada por falta de supervisor: o encaminhamento é aceito, com o aviso
 *   `FILA_BLOQUEADA` (RN-10).
 * - Psicologia é inativada no momento do envio (409 ESPECIALIDADE_INATIVA), para o caso de corrida
 *   da T-14; depois disso some dos destinos.
 */

const INATIVADA_NO_ENVIO = 'Psicologia';

let sequencia = 0;

export function reiniciarMockEncaminhamentos() {
  sequencia = 0;
}

function problema(
  status: number,
  codigo: string,
  detail: string,
  extras: Record<string, unknown> = {},
) {
  return HttpResponse.json(
    { status, codigo, title: 'Não foi possível concluir', detail, ...extras },
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  );
}

const semPermissao = () =>
  problema(403, 'SEM_PERMISSAO', 'Seu perfil não tem acesso a este conteúdo.');

const campoObrigatorio = (campo: string, mensagem: string) =>
  problema(422, 'VALIDACAO', 'Revise os campos destacados.', { campos: [{ campo, mensagem }] });

export const handlersEncaminhamentos = [
  http.post(`${API_URL}/atendimentos/:id/encaminhamentos`, async ({ request, cookies, params }) => {
    const usuario = usuarioMockDaRequisicao(request, cookies);
    if (!usuario) return problema(401, 'NAO_AUTENTICADO', 'Sua sessão expirou. Entre novamente.');
    if (!usuario.permissoes.includes('encaminhamento:criar')) return semPermissao();
    const achado = atendimentoDaSimulacao(params.id);
    if (!achado) return semPermissao();
    const { atendimento, senha } = achado;
    const entrada = (await request.json().catch(() => ({}))) as Partial<EncaminhamentoEntrada>;

    sequencia += 1;
    const base = {
      id: `encaminhamento-simulado-${sequencia}`,
      atendimentoOrigemId: atendimento.id,
      criadoEm: new Date().toISOString(),
    };

    if (entrada.tipo === 'EXTERNO') {
      const instituicao = entrada.instituicaoDestino?.trim();
      const motivo = entrada.motivo?.trim();
      if (!instituicao) {
        return campoObrigatorio('instituicaoDestino', 'Informe a instituição ou o serviço.');
      }
      if (!motivo) return campoObrigatorio('motivo', 'Informe o motivo do encaminhamento.');
      const registro: Encaminhamento = {
        ...base,
        tipo: 'EXTERNO',
        especialidadeDestino: null,
        instituicaoDestino: instituicao,
        motivo,
        senhaGerada: null,
        avisos: [],
      };
      return HttpResponse.json(registro, { status: 201 });
    }

    if (entrada.tipo !== 'INTERNO') return campoObrigatorio('tipo', 'Escolha o tipo.');
    const fila = filasDaSimulacao().find(
      (f) => f.especialidadeId === entrada.especialidadeDestinoId,
    );
    if (!fila || !fila.ativa) {
      return problema(
        409,
        'ESPECIALIDADE_INATIVA',
        'A especialidade de destino não existe ou está inativa. Escolha outro destino.',
      );
    }
    if (fila.especialidade === INATIVADA_NO_ENVIO) {
      fila.ativa = false;
      return problema(
        409,
        'ESPECIALIDADE_INATIVA',
        `${fila.especialidade} acabou de ser inativada e não recebe encaminhamentos. Escolha outro destino.`,
      );
    }
    const prioridade: Prioridade = entrada.prioridadeSugerida ?? 'NORMAL';
    const senhaGerada = incluirSenhaSimulada(fila, {
      pacienteIniciais: senha.pacienteIniciais,
      prioridade,
    });
    const registro: Encaminhamento = {
      ...base,
      tipo: 'INTERNO',
      especialidadeDestino: fila.especialidade,
      instituicaoDestino: null,
      motivo: entrada.motivo?.trim() ?? '',
      senhaGerada,
      avisos: fila.bloqueio.ativo
        ? [
            {
              codigo: 'FILA_BLOQUEADA',
              mensagem: `${fila.especialidade} está sem supervisor disponível: a chamada da nova senha fica suspensa até a regularização.`,
            },
          ]
        : [],
    };
    return HttpResponse.json(registro, { status: 201 });
  }),
];
