import { redirect } from 'next/navigation';

/**
 * Módulo "Chamada" do menu. Chamar a próxima senha é uma operação do painel de fila (UC-09, W-08),
 * onde fica o botão "Chamar próxima"; esta rota leva para lá.
 */
export default function PaginaModuloChamada() {
  redirect('/fila');
}
