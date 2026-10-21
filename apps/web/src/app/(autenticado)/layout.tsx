import { type ReactNode } from 'react';

import { Shell } from '@/components/shell';
import { obterSessaoProvisoria } from '@/lib/sessao';

export default function LayoutAutenticado({ children }: { children: ReactNode }) {
  return <Shell sessao={obterSessaoProvisoria()}>{children}</Shell>;
}
