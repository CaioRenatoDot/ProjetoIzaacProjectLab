'use client';

import { type RegistroAusencia } from '@/lib/ausencias/api';

/** O painel fornece o registro manual ou recebido da API por expiração; nunca abre modal. */
export function NotificacaoAusencia({ registro }: { registro: RegistroAusencia | null }) {
  return (
    <div role="status" aria-live="polite" aria-atomic="true">
      {registro && (
        <div className="flex flex-col gap-2 rounded-md border border-borda bg-superficie p-4">
          <p>
            Ausência da senha {registro.senha.numero} registrada
            {registro.automatica ? ' automaticamente por expiração da tolerância' : ''}.
            {registro.recursosLiberados && ' Os recursos alocados foram liberados.'}
          </p>
          {registro.restricaoAplicada && (
            <p className="rounded bg-alerta-fundo p-3 text-alerta-texto">
              Restrição aplicada:{' '}
              {registro.restricaoAplicada.tipo === 'RESTRICAO_TEMPORARIA'
                ? 'restrição temporária para novos agendamentos.'
                : 'confirmação prévia para novos agendamentos.'}{' '}
              {registro.restricaoAplicada.descricao}
              {registro.restricaoAplicada.ate &&
                ` Até ${new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(registro.restricaoAplicada.ate))}.`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
