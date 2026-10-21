import { redirect } from 'next/navigation';

/** O módulo Acesso tem, por enquanto, só a tela de perfis. */
export default function PaginaAcesso() {
  redirect('/acesso/perfis');
}
