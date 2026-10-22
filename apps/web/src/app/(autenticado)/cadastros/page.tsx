import { redirect } from 'next/navigation';

/** O módulo Cadastros abre na primeira entidade (W-03). */
export default function PaginaCadastros() {
  redirect('/cadastros/pacientes');
}
