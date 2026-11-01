'use client';

import { type ModuloCatalogo } from '@/lib/perfis/tipos';

const ROTULO_OPERACAO: Record<string, string> = {
  consultar: 'Consultar',
  criar: 'Criar',
  editar: 'Editar',
  excluir: 'Excluir',
  chamar: 'Chamar',
  reclassificar: 'Reclassificar',
  validar: 'Validar',
  consultar_sensivel: 'Consultar dado sensível',
  exportar: 'Exportar',
  reconhecer: 'Reconhecer',
  escalonar: 'Escalonar',
};

export const rotuloOperacao = (operacao: string) => ROTULO_OPERACAO[operacao] ?? operacao;

export interface MatrizPermissoesProps {
  catalogo: readonly ModuloCatalogo[];
  marcadas: ReadonlySet<string>;
  somenteLeitura: boolean;
  onAlternar: (permissao: string) => void;
}

/**
 * Tabela real, com cabeçalhos de linha e de grupo associados (T-05): uma linha por operação,
 * agrupada por módulo. Cada caixa é anunciada como "Módulo — operação".
 */
export function MatrizPermissoes({
  catalogo,
  marcadas,
  somenteLeitura,
  onAlternar,
}: MatrizPermissoesProps) {
  return (
    <table className="w-full border-collapse text-left">
      <caption className="sr-only">Matriz de permissões do perfil</caption>
      <thead>
        <tr className="border-b border-borda-suave">
          <th scope="col" className="py-2">
            Operação
          </th>
          <th scope="col" className="w-28 py-2 text-center">
            Permitida
          </th>
        </tr>
      </thead>
      {catalogo.map((modulo) => (
        <tbody key={modulo.modulo}>
          <tr className="bg-superficie-elevada">
            <th scope="colgroup" colSpan={2} className="px-2 py-2 font-semibold">
              {modulo.rotulo}
              {modulo.sensivel && (
                <span className="ml-2 rounded bg-alerta-fundo px-2 py-0.5 text-secundario font-medium text-alerta-texto">
                  Módulo sensível
                </span>
              )}
            </th>
          </tr>
          {modulo.operacoes.map((op) => {
            const rotulo = `${modulo.rotulo} — ${rotuloOperacao(op.operacao)}`;
            return (
              <tr key={op.permissao} className="border-b border-borda-suave">
                <th scope="row" className="py-2 pl-6 font-normal">
                  {rotuloOperacao(op.operacao)}
                </th>
                <td className="text-center">
                  {/* A célula inteira é o alvo de toque (44 x 44 px); o rótulo acessível fica na caixa. */}
                  <label className="inline-flex min-h-toque min-w-toque cursor-pointer items-center justify-center">
                    <input
                      type="checkbox"
                      aria-label={rotulo}
                      checked={marcadas.has(op.permissao)}
                      disabled={somenteLeitura}
                      onChange={() => onAlternar(op.permissao)}
                      className="h-5 w-5 accent-primaria"
                    />
                  </label>
                </td>
              </tr>
            );
          })}
        </tbody>
      ))}
    </table>
  );
}
