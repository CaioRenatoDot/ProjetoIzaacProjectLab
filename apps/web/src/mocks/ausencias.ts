import { http, HttpResponse } from 'msw';

import { API_URL } from '@/lib/api/config';
import {
  type AusenciaEntrada,
  type DesistenciaEntrada,
  type RegistroAusencia,
} from '@/lib/ausencias/api';
import { type SenhaAusencias } from '@/lib/ausencias/consulta';

import { usuarioMockDaRequisicao } from './handlers';

/** Fixtures da #47. Prazos e restrições são cenários fictícios, não políticas de produção. */
const FILA = {
  id: 'fila-ausencias-dev',
  nome: 'Fila de Fisioterapia',
  especialidade: 'Fisioterapia',
};
const ouvintes = new Set<(registro: RegistroAusencia) => void>();
let senhas: SenhaAusencias[] = [];
const restricoes = new Map<string, NonNullable<RegistroAusencia['restricaoAplicada']>>();

export function reiniciarMockAusencias() {
  const agora = Date.now();
  const base = {
    versao: 1,
    especialidade: FILA.especialidade,
    chamadaEm: new Date(agora).toISOString(),
    toleranciaAte: new Date(agora + 300_000).toISOString(),
  };
  senhas = [
    { ...base, id: 'senha-f013', numero: 'F013', pacienteIniciais: 'A. B. T.', status: 'CHAMADA' },
    { ...base, id: 'senha-f014', numero: 'F014', pacienteIniciais: 'M. A. S.', status: 'CHAMADA' },
    {
      ...base,
      id: 'senha-f015',
      numero: 'F015',
      pacienteIniciais: 'J. C. L.',
      status: 'AGUARDANDO',
      chamadaEm: null,
      toleranciaAte: null,
    },
    {
      ...base,
      id: 'senha-f016',
      numero: 'F016',
      pacienteIniciais: 'P. R. A.',
      status: 'EM_ATENDIMENTO',
      toleranciaAte: null,
    },
    {
      ...base,
      id: 'senha-f017',
      numero: 'F017',
      pacienteIniciais: 'L. F. R.',
      status: 'CHAMADA',
      toleranciaAte: new Date(agora + 30_000).toISOString(),
    },
    { ...base, id: 'senha-f018', numero: 'F018', pacienteIniciais: 'C. D. S.', status: 'CHAMADA' },
  ];
  restricoes.clear();
  restricoes.set('senha-f014', {
    tipo: 'RESTRICAO_TEMPORARIA',
    ate: new Date(agora + 7 * 86_400_000).toISOString().slice(0, 10),
    descricao:
      'Novos agendamentos ficam temporariamente restritos. Procure a recepção para orientação.',
  });
  restricoes.set('senha-f018', {
    tipo: 'CONFIRMACAO_PREVIA',
    ate: null,
    descricao: 'Será necessário confirmar previamente o comparecimento nos próximos agendamentos.',
  });
}

reiniciarMockAusencias();

/** Adaptador local do evento automático, até o transporte de #24/#41 estar disponível. */
export function assinarAusenciasAutomaticas(ouvinte: (registro: RegistroAusencia) => void) {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

function problema(status: number, codigo: string, detail: string) {
  return HttpResponse.json(
    { status, codigo, title: 'Não foi possível concluir', detail },
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  );
}

function autorizar(request: Request, cookies: Record<string, string>, permissao: string) {
  const usuario = usuarioMockDaRequisicao(request, cookies);
  if (!usuario) return problema(401, 'NAO_AUTENTICADO', 'Sua sessão expirou. Entre novamente.');
  if (!usuario.permissoes.includes(permissao))
    return problema(403, 'SEM_PERMISSAO', 'Seu perfil não tem acesso a este conteúdo.');
  return null;
}

function registrarAusencia(senha: SenhaAusencias, automatica: boolean): RegistroAusencia {
  senha.status = 'AUSENTE';
  senha.versao += 1;
  return {
    senha: { ...senha },
    automatica,
    recursosLiberados: true,
    restricaoAplicada: restricoes.get(senha.id) ?? null,
  };
}

function expirarTolerancias() {
  for (const senha of senhas) {
    if (
      senha.status !== 'CHAMADA' ||
      !senha.toleranciaAte ||
      Date.parse(senha.toleranciaAte) > Date.now()
    )
      continue;
    const registro = registrarAusencia(senha, true);
    for (const ouvinte of ouvintes) ouvinte(registro);
  }
}

export const handlersAusencias = [
  http.get(`${API_URL}/filas`, ({ request, cookies }) => {
    const erro = autorizar(request, cookies, 'fila:consultar');
    return (
      erro ??
      HttpResponse.json({
        dados: [FILA],
        meta: { pagina: 1, tamanho: 100, total: 1, totalPaginas: 1 },
      })
    );
  }),
  http.get(`${API_URL}/filas/:id/senhas`, ({ request, cookies, params }) => {
    const erro = autorizar(request, cookies, 'fila:consultar');
    if (erro) return erro;
    if (params.id !== FILA.id)
      return problema(404, 'NAO_ENCONTRADO', 'Fila não encontrada. Atualize a lista.');
    expirarTolerancias();
    const url = new URL(request.url);
    const pagina = Math.max(1, Number(url.searchParams.get('pagina')) || 1);
    const tamanho = Math.min(100, Math.max(1, Number(url.searchParams.get('tamanho')) || 20));
    return HttpResponse.json({
      fila: FILA,
      dados: senhas.slice((pagina - 1) * tamanho, pagina * tamanho),
      meta: {
        pagina,
        tamanho,
        total: senhas.length,
        totalPaginas: Math.ceil(senhas.length / tamanho),
      },
      sincronizadoEm: new Date().toISOString(),
    });
  }),
  http.post(`${API_URL}/senhas/:id/ausencia`, async ({ request, cookies, params }) => {
    const erro = autorizar(request, cookies, 'ausencia:criar');
    if (erro) return erro;
    const senha = senhas.find((s) => s.id === params.id);
    if (!senha) return problema(404, 'NAO_ENCONTRADO', 'Senha não encontrada. Atualize a lista.');
    const corpo = (await request.json()) as Partial<AusenciaEntrada>;
    if (
      !Number.isInteger(corpo.versao) ||
      (corpo.observacao !== undefined && typeof corpo.observacao !== 'string')
    )
      return problema(422, 'VALIDACAO', 'Revise os dados e tente novamente.');
    if (corpo.versao !== senha.versao)
      return problema(409, 'VERSAO_DESATUALIZADA', 'A senha foi alterada. Atualize a lista.');
    if (senha.status !== 'CHAMADA')
      return problema(
        409,
        'TRANSICAO_INVALIDA',
        'A senha não está mais chamada. Atualize a lista.',
      );
    if (
      Date.parse(senha.toleranciaAte ?? '') > Date.now() &&
      corpo.confirmadoAntesDaTolerancia !== true
    )
      return problema(
        409,
        'TOLERANCIA_EM_CURSO',
        'Confirme explicitamente o registro antes do fim da tolerância.',
      );
    return HttpResponse.json(registrarAusencia(senha, false));
  }),
  http.post(`${API_URL}/senhas/:id/desistencia`, async ({ request, cookies, params }) => {
    const erro = autorizar(request, cookies, 'ausencia:criar');
    if (erro) return erro;
    const senha = senhas.find((s) => s.id === params.id);
    if (!senha) return problema(404, 'NAO_ENCONTRADO', 'Senha não encontrada. Atualize a lista.');
    const corpo = (await request.json()) as Partial<DesistenciaEntrada>;
    if (
      !Number.isInteger(corpo.versao) ||
      !['PACIENTE', 'EQUIPE'].includes(corpo.origem ?? '') ||
      (corpo.motivo !== undefined && typeof corpo.motivo !== 'string')
    )
      return problema(422, 'VALIDACAO', 'Selecione a origem e revise os dados.');
    if (corpo.versao !== senha.versao)
      return problema(409, 'VERSAO_DESATUALIZADA', 'A senha foi alterada. Atualize a lista.');
    if (senha.status !== 'AGUARDANDO' && senha.status !== 'EM_ATENDIMENTO')
      return problema(
        409,
        'TRANSICAO_INVALIDA',
        'Desistência exige senha aguardando ou em atendimento.',
      );
    const recursosLiberados = senha.status === 'EM_ATENDIMENTO';
    senha.status = 'DESISTENCIA';
    senha.versao += 1;
    return HttpResponse.json({ senha: { ...senha }, recursosLiberados });
  }),
];
