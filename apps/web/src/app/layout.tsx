import { type Metadata } from 'next';
import { type ReactNode } from 'react';

import './globals.css';

export const metadata: Metadata = {
  title: 'Gestão de Filas — Clínica-Escola',
  description: 'Aplicação operacional do Sistema de Gestão de Filas para Clínicas-Escola',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-white text-slate-900 antialiased">{children}</body>
    </html>
  );
}
