/**
 * O servidor de desenvolvimento compila cada rota na primeira visita. Sem aquecer, os workers em
 * paralelo clicam antes da hidratação e os testes ficam instáveis.
 */
const ROTAS = ['/', '/login', '/acesso/perfis', '/triagem', '/cadastros/pacientes'];

export default async function aquecerRotas() {
  for (const rota of ROTAS) {
    await fetch(`http://localhost:3000${rota}`, { signal: AbortSignal.timeout(120_000) });
  }
}
