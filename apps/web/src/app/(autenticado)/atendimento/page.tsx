import {
  type FiltroAtendimento,
  FILTROS_ATENDIMENTO,
  ListaAtendimentos,
} from '@/components/atendimento/lista-atendimentos';
import { TelaAtendimento } from '@/components/atendimento/tela-atendimento';

interface PaginaAtendimentoProps {
  searchParams: Promise<{ senha?: string | string[]; status?: string | string[] }>;
}

const primeiro = (valor: string | string[] | undefined) =>
  Array.isArray(valor) ? valor[0] : valor;

/**
 * Módulo "Atendimento". Com `?senha=<id>` (painel de fila), conduz o atendimento da senha
 * (W-12 / W-13); sem senha, lista os atendimentos, filtrados por `?status=` (cartão da home).
 */
export default async function PaginaAtendimento({ searchParams }: PaginaAtendimentoProps) {
  const parametros = await searchParams;
  const senha = primeiro(parametros.senha);
  if (senha) return <TelaAtendimento key={senha} senhaId={senha} />;
  const status = primeiro(parametros.status) ?? '';
  const filtro: FiltroAtendimento =
    status in FILTROS_ATENDIMENTO ? (status as FiltroAtendimento) : 'ativos';
  return <ListaAtendimentos filtroInicial={filtro} />;
}
