import { type ClienteHttp } from '@/lib/api/cliente-http';
import { type Pagina } from '@/lib/cadastros/tipos';

import { type SenhaOcorrencia } from './api';

export interface FilaAusencias {
  id: string;
  nome: string;
  especialidade: string;
}

export interface SenhaAusencias extends SenhaOcorrencia {
  pacienteIniciais: string;
  especialidade: string;
  chamadaEm: string | null;
}

export interface QuadroAusencias extends Pagina<SenhaAusencias> {
  sincronizadoEm: string;
}

/** Somente projeções de resumo dos endpoints existentes; sem conteúdo clínico. */
export function criarConsultaAusencias(cliente: ClienteHttp) {
  return {
    listarFilas: () =>
      cliente.requisitar<Pagina<FilaAusencias>>('/filas?ativa=true&pagina=1&tamanho=100'),
    quadro: (filaId: string, pagina: number) =>
      cliente.requisitar<QuadroAusencias>(
        `/filas/${encodeURIComponent(filaId)}/senhas?pagina=${pagina}&tamanho=20`,
      ),
  };
}
