import { Button } from '@filas/ui';

/** Página inicial provisória (Etapa 1-B). O login (W-01) e a home por perfil (W-02) entram na Etapa 3. */
export default function Home() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-16">
      <h1 className="text-3xl font-semibold">Sistema de Gestão de Filas</h1>
      <p className="text-slate-700">
        Aplicação operacional da clínica-escola. As telas entram a partir da Etapa 3.
      </p>
      <div>
        <Button className="rounded-md bg-slate-900 px-4 py-2 text-white">Entrar</Button>
      </div>
    </main>
  );
}
