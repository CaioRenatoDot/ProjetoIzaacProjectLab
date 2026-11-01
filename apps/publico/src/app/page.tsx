import { redirect } from 'next/navigation';

/** A raiz da aplicação pública abre o telão. */
export default function Inicio() {
  redirect('/telao');
}
