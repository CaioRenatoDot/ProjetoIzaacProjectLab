import { TelaAlocacao } from '@/components/alocacao/tela-alocacao';

interface PaginaAlocacaoProps {
  params: Promise<{ id: string }>;
}

/** W-11 / T-10: alocação de recursos da senha, aberta pelo painel de fila. */
export default async function PaginaAlocacao({ params }: PaginaAlocacaoProps) {
  const { id } = await params;
  return <TelaAlocacao senhaId={id} />;
}
