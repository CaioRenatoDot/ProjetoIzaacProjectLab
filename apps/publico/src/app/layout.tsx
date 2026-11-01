import { type Metadata } from 'next';
import { type ReactNode } from 'react';

import './globals.css';

export const metadata: Metadata = {
  title: 'Sala de espera — Clínica-Escola',
  description: 'Telão da sala de espera e consulta de senha pelo paciente',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
