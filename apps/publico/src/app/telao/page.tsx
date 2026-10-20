/** Telão da sala de espera (W-09). Rota provisória da Etapa 1-B; o conteúdo entra na Etapa 6. */
export default function Telao() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-12">
      <h1 className="text-telao font-semibold uppercase tracking-wide">Sala de espera</h1>
      <p aria-live="assertive" className="text-senha-telao font-bold">
        —
      </p>
    </main>
  );
}
