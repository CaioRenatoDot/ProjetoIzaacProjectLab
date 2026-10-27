/**
 * O servidor de desenvolvimento compila cada rota na primeira visita. Sem aquecer, os workers em
 * paralelo clicam antes da hidratação e os testes ficam instáveis.
 */
const ROTAS = [
  '/',
  '/login',
  '/acesso/perfis',
  '/triagem',
  '/ausencias',
  '/cadastros/pacientes',
  '/cadastros/pacientes/novo',
  '/cadastros/pacientes/paciente-1',
  '/fila',
  '/fila/senhas/senha-f013/alocacao',
  '/auditoria',
  '/indicadores',
  '/indicadores/alertas',
];

export default async function aquecerRotas() {
  for (const rota of ROTAS) {
    await fetch(`http://localhost:3000${rota}`, { signal: AbortSignal.timeout(120_000) });
  }
}
