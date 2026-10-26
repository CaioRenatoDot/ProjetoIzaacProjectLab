import { classesBotao, EstadoVazio } from '@filas/ui';
import Link from 'next/link';

import { TelaEncaminhamento } from '@/components/encaminhamento/tela-encaminhamento';

interface PaginaEncaminhamentoProps {
  searchParams: Promise<{ atendimento?: string | string[] }>;
}

/**
 * Módulo "Encaminhamento". O registro parte do encerramento com desfecho de encaminhamento
 * (T-13 → T-14), que abre esta rota com `?atendimento=<id>`.
 */
export default async function PaginaEncaminhamento({ searchParams }: PaginaEncaminhamentoProps) {
  const { atendimento } = await searchParams;
  const id = Array.isArray(atendimento) ? atendimento[0] : atendimento;
  if (id) return <TelaEncaminhamento key={id} atendimentoId={id} />;
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-pagina font-semibold">Encaminhamento</h1>
      <EstadoVazio
        titulo="Nenhum encaminhamento em registro"
        descricao="O encaminhamento parte do encerramento de um atendimento com desfecho de encaminhamento interno ou externo."
        acao={
          <Link href="/atendimento" className={classesBotao.secundario}>
            Ver atendimentos
          </Link>
        }
      />
    </div>
  );
}
