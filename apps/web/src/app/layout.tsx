import { type Metadata } from 'next';
import { type ReactNode } from 'react';

import { Providers } from '@/components/providers';

import './globals.css';

export const metadata: Metadata = {
  title: 'Gestão de Filas — Clínica-Escola',
  description: 'Aplicação operacional do Sistema de Gestão de Filas para Clínicas-Escola',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-superficie text-texto antialiased">
        {/* Raiz estável: o conteúdo troca no cliente (sessão) sem sair do início do body. */}
        <div id="aplicacao">
          <Providers>{children}</Providers>
        </div>
      </body>
    </html>
  );
}
