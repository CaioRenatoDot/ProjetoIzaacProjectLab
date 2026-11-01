import { type ReactNode } from 'react';

import { AreaAutenticada } from '@/components/area-autenticada';

export default function LayoutAutenticado({ children }: { children: ReactNode }) {
  return <AreaAutenticada>{children}</AreaAutenticada>;
}
