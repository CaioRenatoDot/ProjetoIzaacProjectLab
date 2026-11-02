import { type TriagemResumo } from '@filas/contracts';
import { http, HttpResponse } from 'msw';

import { API_URL } from '@/lib/api/config';

/** `GET /triagens` para os cartões da home; o fluxo da tela segue na API em memória. Dados fictícios. */
const TRIAGENS: readonly Omit<TriagemResumo, 'concluidaEm'>[] = [
  {
    id: 'triagem-mock-1',
    pacienteIniciais: 'A.R.',
    especialidadeId: 'especialidade-fisioterapia',
    especialidade: 'Fisioterapia',
    tipoAtendimento: 'PRIMEIRA_CONSULTA',
    prioridade: 'NORMAL',
    senhaEmitida: true,
  },
  {
    id: 'triagem-mock-2',
    pacienteIniciais: 'M.S.',
    especialidadeId: 'especialidade-nutricao',
    especialidade: 'Nutrição',
    tipoAtendimento: 'RETORNO',
    prioridade: 'PREFERENCIAL',
    senhaEmitida: false,
  },
];

export const handlersTriagens = [
  http.get(`${API_URL}/triagens`, ({ request }) => {
    const q = new URL(request.url).searchParams;
    const pagina = Math.max(1, Number(q.get('pagina') ?? 1));
    const tamanho = Math.min(100, Math.max(1, Number(q.get('tamanho') ?? 20)));
    const concluidaEm = new Date().toISOString();
    return HttpResponse.json({
      dados: TRIAGENS.slice((pagina - 1) * tamanho, pagina * tamanho).map((t) => ({
        ...t,
        concluidaEm,
      })),
      meta: {
        pagina,
        tamanho,
        total: TRIAGENS.length,
        totalPaginas: Math.max(1, Math.ceil(TRIAGENS.length / tamanho)),
      },
    });
  }),
];
