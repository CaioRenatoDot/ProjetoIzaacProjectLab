/** Consulta de senha pelo paciente (W-10). Rota provisória da Etapa 1-B; o conteúdo entra na Etapa 6. */
export default function Consulta() {
  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-10">
      <h1 className="text-2xl font-semibold">Consultar minha senha</h1>
      <p className="text-consulta">
        Informe o número da senha. A consulta não revela dados de outra pessoa.
      </p>
    </main>
  );
}
