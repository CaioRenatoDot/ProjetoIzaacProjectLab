'use client';

import { classeCampo, ErroCampo } from '@filas/ui';
import { type ReactNode, type Ref, useId, useState } from 'react';

import { ROTULO_TURNO } from '@/lib/cadastros/entidades';
import { DIAS_SEMANA, rotuloDiaTurno, TURNOS } from '@/lib/cadastros/formularios';
import { type Disponibilidade, type ItemReferencia } from '@/lib/cadastros/tipos';

/** Obrigatório marcado em texto, não só com asterisco colorido (T-04). */
export function TextoRotulo({ rotulo, obrigatorio }: { rotulo: string; obrigatorio: boolean }) {
  return (
    <>
      {rotulo}
      {obrigatorio && (
        <>
          {' '}
          <span className="font-normal text-texto-secundario">(obrigatório)</span>
        </>
      )}
    </>
  );
}

/** Atributos de acessibilidade do controle conforme dica e erro. */
export function descricaoCampo(id: string, { erro, dica }: { erro?: string; dica?: string }) {
  const descricao = [dica && `${id}-dica`, erro && `${id}-erro`].filter(Boolean).join(' ');
  return {
    'aria-invalid': erro ? true : undefined,
    'aria-describedby': descricao || undefined,
  } as const;
}

export interface CampoRotuladoProps {
  id: string;
  rotulo: string;
  obrigatorio: boolean;
  erro?: string;
  dica?: string;
  children: ReactNode;
}

/** Rótulo visível, dica e erro abaixo do campo (especificação de UI §3.2). O controle recebe `id`. */
export function CampoRotulado({
  id,
  rotulo,
  obrigatorio,
  erro,
  dica,
  children,
}: CampoRotuladoProps) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="font-medium text-texto">
        <TextoRotulo rotulo={rotulo} obrigatorio={obrigatorio} />
      </label>
      {dica && (
        <p id={`${id}-dica`} className="text-secundario text-texto-secundario">
          {dica}
        </p>
      )}
      {children}
      {erro && <ErroCampo id={`${id}-erro`}>{erro}</ErroCampo>}
    </div>
  );
}

interface GrupoProps {
  id: string;
  rotulo: string;
  obrigatorio: boolean;
  erro?: string;
  dica?: string;
  children: ReactNode;
}

/** Grupo de controles (`fieldset` e legenda), para seleção múltipla, sim/não e disponibilidade. */
function Grupo({ id, rotulo, obrigatorio, erro, dica, children }: GrupoProps) {
  return (
    <fieldset
      className="flex min-w-0 flex-col gap-2"
      aria-describedby={descricaoCampo(id, { erro, dica })['aria-describedby']}
    >
      <legend className="font-medium text-texto">
        <TextoRotulo rotulo={rotulo} obrigatorio={obrigatorio} />
      </legend>
      {dica && (
        <p id={`${id}-dica`} className="text-secundario text-texto-secundario">
          {dica}
        </p>
      )}
      {children}
      {erro && <ErroCampo id={`${id}-erro`}>{erro}</ErroCampo>}
    </fieldset>
  );
}

const normalizar = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('pt-BR');

export interface SelecaoMultiplaProps {
  id: string;
  rotulo: string;
  obrigatorio: boolean;
  opcoes: readonly ItemReferencia[];
  valor: readonly string[];
  onChange: (valor: string[]) => void;
  onBlur: () => void;
  erro?: string;
  carregando?: boolean;
  /** Recebe o foco quando o campo é o primeiro inválido. */
  campoRef?: Ref<HTMLInputElement>;
}

/**
 * Seleção múltipla com busca (T-04): a busca filtra a lista de caixas de seleção, que funcionam
 * por teclado (Tab e Espaço). O total de opções visíveis é anunciado.
 */
export function SelecaoMultipla({
  id,
  rotulo,
  obrigatorio,
  opcoes,
  valor,
  onChange,
  onBlur,
  erro,
  carregando,
  campoRef,
}: SelecaoMultiplaProps) {
  const [busca, setBusca] = useState('');
  const termo = normalizar(busca.trim());
  const visiveis = termo ? opcoes.filter((o) => normalizar(o.nome).includes(termo)) : opcoes;
  const selecionadas = opcoes.filter((o) => valor.includes(o.id));

  function alternar(opcaoId: string, marcada: boolean) {
    onChange(marcada ? [...valor, opcaoId] : valor.filter((v) => v !== opcaoId));
  }

  return (
    <Grupo id={id} rotulo={rotulo} obrigatorio={obrigatorio} erro={erro}>
      <label htmlFor={`${id}-busca`} className="sr-only">
        Buscar em {rotulo}
      </label>
      <input
        id={`${id}-busca`}
        ref={campoRef}
        type="search"
        value={busca}
        placeholder={`Buscar em ${rotulo.toLocaleLowerCase('pt-BR')}`}
        onChange={(e) => setBusca(e.target.value)}
        aria-controls={`${id}-opcoes`}
        aria-invalid={erro ? true : undefined}
        className={classeCampo}
      />
      <p role="status" className="sr-only">
        {carregando ? 'Carregando opções' : `${visiveis.length} de ${opcoes.length} opções`}
      </p>
      <ul
        id={`${id}-opcoes`}
        aria-label={rotulo}
        className="flex max-h-56 flex-col gap-1 overflow-y-auto rounded-md border border-borda-suave p-2"
      >
        {visiveis.map((opcao) => (
          <li key={opcao.id}>
            <label className="flex min-h-toque items-center gap-2 rounded px-2 hover:bg-superficie-hover">
              <input
                type="checkbox"
                checked={valor.includes(opcao.id)}
                onChange={(e) => alternar(opcao.id, e.target.checked)}
                onBlur={onBlur}
                className="size-5"
              />
              {opcao.nome}
            </label>
          </li>
        ))}
        {!carregando && visiveis.length === 0 && (
          <li className="px-2 py-1 text-texto-secundario">
            Nenhuma opção encontrada para a busca.
          </li>
        )}
      </ul>
      <p className="text-secundario text-texto-secundario">
        {selecionadas.length === 0
          ? 'Nenhuma selecionada.'
          : `Selecionadas: ${selecionadas.map((o) => o.nome).join(', ')}.`}
      </p>
    </Grupo>
  );
}

export interface GradeDisponibilidadeProps {
  id: string;
  rotulo: string;
  obrigatorio: boolean;
  valor: readonly Disponibilidade[];
  onChange: (valor: Disponibilidade[]) => void;
  onBlur: () => void;
  erro?: string;
  campoRef?: Ref<HTMLInputElement>;
}

/** Disponibilidade: combinação de dia da semana com turno (Tabelas 2 e 3). */
export function GradeDisponibilidade({
  id,
  rotulo,
  obrigatorio,
  valor,
  onChange,
  onBlur,
  erro,
  campoRef,
}: GradeDisponibilidadeProps) {
  const marcado = (dia: number, turno: string) =>
    valor.some((d) => d.diaSemana === dia && d.turno === turno);

  function alternar(item: Disponibilidade, marcar: boolean) {
    onChange(
      marcar
        ? [...valor, item]
        : valor.filter((d) => !(d.diaSemana === item.diaSemana && d.turno === item.turno)),
    );
  }

  return (
    <Grupo id={id} rotulo={rotulo} obrigatorio={obrigatorio} erro={erro}>
      <div className="overflow-x-auto">
        <table className="border-collapse">
          <thead>
            <tr>
              <td />
              {TURNOS.map((turno) => (
                <th key={turno} scope="col" className="px-3 py-1 text-left font-medium">
                  {ROTULO_TURNO[turno]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DIAS_SEMANA.map(([dia, nome], linha) => (
              <tr key={dia}>
                <th scope="row" className="pr-3 text-left font-normal">
                  {nome}
                </th>
                {TURNOS.map((turno, coluna) => (
                  <td key={turno} className="px-3">
                    <input
                      ref={linha === 0 && coluna === 0 ? campoRef : undefined}
                      type="checkbox"
                      aria-label={rotuloDiaTurno(nome, turno)}
                      checked={marcado(dia, turno)}
                      onChange={(e) => alternar({ diaSemana: dia, turno }, e.target.checked)}
                      onBlur={onBlur}
                      className="size-5 align-middle"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Grupo>
  );
}

export interface SimNaoProps {
  rotulo: string;
  obrigatorio: boolean;
  valor: boolean | undefined;
  onChange: (valor: boolean) => void;
  onBlur: () => void;
  erro?: string;
  campoRef?: Ref<HTMLInputElement>;
}

export function SimNao({
  rotulo,
  obrigatorio,
  valor,
  onChange,
  onBlur,
  erro,
  campoRef,
}: SimNaoProps) {
  const id = useId();
  return (
    <Grupo id={id} rotulo={rotulo} obrigatorio={obrigatorio} erro={erro}>
      <div className="flex gap-6">
        {[true, false].map((opcao) => (
          <label key={String(opcao)} className="flex min-h-toque items-center gap-2">
            <input
              ref={opcao ? campoRef : undefined}
              type="radio"
              name={id}
              checked={valor === opcao}
              onChange={() => onChange(opcao)}
              onBlur={onBlur}
              aria-invalid={erro ? true : undefined}
              className="size-5"
            />
            {opcao ? 'Sim' : 'Não'}
          </label>
        ))}
      </div>
    </Grupo>
  );
}
