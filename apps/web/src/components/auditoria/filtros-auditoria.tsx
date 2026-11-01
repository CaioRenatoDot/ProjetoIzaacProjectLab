'use client';

import { Button, classeCampo, ErroCampo } from '@filas/ui';
import { useQuery } from '@tanstack/react-query';
import { type FormEvent, type ReactNode, useId, useState } from 'react';

import {
  type ErrosFiltro,
  type FiltrosAuditoria,
  FILTROS_VAZIOS,
  OPERACOES,
  ROTULO_MODULO,
  ROTULO_OPERACAO,
  temFiltroAtivo,
  validarFiltros,
} from '@/lib/auditoria/consulta';
import { type UsuarioResumo } from '@/lib/auditoria/tipos';
import { type Pagina } from '@/lib/cadastros/tipos';
import { useSessao } from '@/lib/sessao/sessao';

const ORDEM_CAMPOS: readonly (keyof FiltrosAuditoria)[] = [
  'usuarioId',
  'de',
  'ate',
  'operacao',
  'modulo',
  'entidadeId',
];

export interface FiltrosAuditoriaProps {
  aplicados: FiltrosAuditoria;
  onAplicar: (filtros: FiltrosAuditoria) => void;
}

/**
 * Barra de filtros da T-18. Os filtros só valem ao aplicar; erro aparece abaixo do campo e o foco
 * vai para o primeiro inválido (especificação de UI §3.2). Quem aplica filtros por fora do
 * formulário troca a `key` para o rascunho recomeçar dos filtros aplicados.
 */
export function FiltrosAuditoriaForm({ aplicados, onAplicar }: FiltrosAuditoriaProps) {
  const prefixo = useId();
  const id = (campo: keyof FiltrosAuditoria) => `${prefixo}-${campo}`;
  const [rascunho, setRascunho] = useState(aplicados);
  const [erros, setErros] = useState<ErrosFiltro>({});
  const usuarios = useUsuarios();

  function alterar(campo: keyof FiltrosAuditoria, valor: string) {
    setRascunho((atual) => ({ ...atual, [campo]: valor }));
  }

  function aplicar(evento: FormEvent) {
    evento.preventDefault();
    const encontrados = validarFiltros(rascunho);
    setErros(encontrados);
    const primeiro = ORDEM_CAMPOS.find((campo) => encontrados[campo]);
    if (primeiro) {
      document.getElementById(id(primeiro))?.focus();
      return;
    }
    onAplicar({ ...rascunho, entidadeId: rascunho.entidadeId.trim() });
  }

  function limpar() {
    setErros({});
    setRascunho(FILTROS_VAZIOS);
    onAplicar(FILTROS_VAZIOS);
  }

  const descricaoErro = (campo: keyof FiltrosAuditoria) =>
    erros[campo] ? `${id(campo)}-erro` : undefined;

  return (
    <form
      role="search"
      aria-label="Filtrar trilha de auditoria"
      onSubmit={aplicar}
      noValidate
      className="flex flex-col gap-4 rounded-lg border border-borda-suave p-4"
    >
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
        <Campo id={id('usuarioId')} rotulo="Usuário">
          <select
            id={id('usuarioId')}
            value={rascunho.usuarioId}
            onChange={(e) => alterar('usuarioId', e.target.value)}
            aria-describedby={usuarios.isError ? `${id('usuarioId')}-aviso` : undefined}
            className={classeCampo}
          >
            <option value="">Todos</option>
            {(usuarios.data?.dados ?? []).map((u) => (
              <option key={u.id} value={u.id}>
                {u.ativo ? u.nome : `${u.nome} (inativo)`}
              </option>
            ))}
          </select>
          {usuarios.isError && (
            <p id={`${id('usuarioId')}-aviso`} className="text-secundario text-texto-secundario">
              Não foi possível carregar a lista de usuários. Os demais filtros continuam
              disponíveis.
            </p>
          )}
        </Campo>

        <fieldset className="flex flex-col gap-1">
          <legend className="font-medium">Período</legend>
          <div className="flex flex-wrap gap-2">
            <div className="flex flex-1 flex-col gap-1">
              <label htmlFor={id('de')} className="text-secundario">
                De
              </label>
              <input
                id={id('de')}
                type="date"
                value={rascunho.de}
                onChange={(e) => alterar('de', e.target.value)}
                className={classeCampo}
              />
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <label htmlFor={id('ate')} className="text-secundario">
                Até
              </label>
              <input
                id={id('ate')}
                type="date"
                value={rascunho.ate}
                min={rascunho.de || undefined}
                onChange={(e) => alterar('ate', e.target.value)}
                aria-invalid={erros.ate ? true : undefined}
                aria-describedby={descricaoErro('ate')}
                className={classeCampo}
              />
            </div>
          </div>
          {erros.ate && <ErroCampo id={`${id('ate')}-erro`}>{erros.ate}</ErroCampo>}
        </fieldset>

        <Campo id={id('operacao')} rotulo="Tipo de operação">
          <select
            id={id('operacao')}
            value={rascunho.operacao}
            onChange={(e) => alterar('operacao', e.target.value)}
            className={classeCampo}
          >
            <option value="">Todas</option>
            {OPERACOES.map((operacao) => (
              <option key={operacao} value={operacao}>
                {ROTULO_OPERACAO[operacao]}
              </option>
            ))}
          </select>
        </Campo>

        <Campo id={id('modulo')} rotulo="Módulo">
          <select
            id={id('modulo')}
            value={rascunho.modulo}
            onChange={(e) => alterar('modulo', e.target.value)}
            className={classeCampo}
          >
            <option value="">Todos</option>
            {Object.entries(ROTULO_MODULO).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </select>
        </Campo>

        <Campo id={id('entidadeId')} rotulo="Registro afetado">
          <input
            id={id('entidadeId')}
            type="text"
            value={rascunho.entidadeId}
            onChange={(e) => alterar('entidadeId', e.target.value)}
            spellCheck={false}
            autoComplete="off"
            aria-invalid={erros.entidadeId ? true : undefined}
            aria-describedby={
              [`${id('entidadeId')}-dica`, descricaoErro('entidadeId')].filter(Boolean).join(' ') ||
              undefined
            }
            className={classeCampo}
          />
          <p id={`${id('entidadeId')}-dica`} className="text-secundario text-texto-secundario">
            Identificador do registro. No detalhe de um evento, use “Filtrar por este registro”.
          </p>
          {erros.entidadeId && (
            <ErroCampo id={`${id('entidadeId')}-erro`}>{erros.entidadeId}</ErroCampo>
          )}
        </Campo>
      </div>

      <div className="flex flex-wrap justify-end gap-3">
        {(temFiltroAtivo(aplicados) || temFiltroAtivo(rascunho)) && (
          <Button variante="secundario" onClick={limpar}>
            Limpar filtros
          </Button>
        )}
        <Button type="submit">Aplicar filtros</Button>
      </div>
    </form>
  );
}

function Campo({ id, rotulo, children }: { id: string; rotulo: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="font-medium">
        {rotulo}
      </label>
      {children}
    </div>
  );
}

function useUsuarios() {
  const { cliente } = useSessao();
  return useQuery({
    queryKey: ['auditoria', 'usuarios'],
    queryFn: () => cliente.requisitar<Pagina<UsuarioResumo>>('/usuarios?tamanho=100'),
    staleTime: 5 * 60_000,
  });
}
