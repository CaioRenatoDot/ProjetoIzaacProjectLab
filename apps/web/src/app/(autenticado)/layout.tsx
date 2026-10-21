import { type ReactNode } from 'react';

import { Shell } from '@/components/shell';
import { obterSessao } from '@/lib/sessao';

export default async function LayoutAutenticado({ children }: { children: ReactNode }) {
  return <Shell sessao={await obterSessao()}>{children}</Shell>;
}
