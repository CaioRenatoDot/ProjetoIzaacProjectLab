'use client';

import { Button, classesBotao, Permitido } from '@filas/ui';
import Link from 'next/link';
import { type ReactNode, useState } from 'react';

import {
  descreverGravidade,
  formatarHorario,
  ROTULO_ACAO,
  ROTULO_BOTAO_ACAO,
  ROTULO_TIPO,
} from '@/lib/alertas/apresentacao';
import { type AcaoEscalonamento, type Alerta } from '@/lib/alertas/tipos';

const ACOES: readonly AcaoEscalonamento[] = ['REFORCO_ATENDENTE', 'VAGA_EXTRA'];

const classeEtiqueta =
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-secundario font-medium whitespace-nowrap';

export const idTituloAlerta = (alerta: Alerta) => `alerta-${alerta.id}-titulo`;

export interface CartaoAlertaProps {
  alerta: Alerta;
  podeEscrever: boolean;
  reconhecendo: boolean;
  onReconhecer: (alerta: Alerta) => void;
  onEscalonar: (alerta: Alerta, acao: AcaoEscalonamento) => void;
}

/** Um alerta em aberto da T-17. Reconhecido muda de aparência (fundo neutro e etiqueta). */
export function CartaoAlerta({
  alerta,
  podeEscrever,
  reconhecendo,
  onReconhecer,
  onEscalonar,
}: CartaoAlertaProps) {
  const [menuAberto, setMenuAberto] = useState(false);
  const ativo = alerta.status === 'ATIVO';
  const bloqueio = alerta.tipo === 'FILA_BLOQUEADA';
  const idMenu = `alerta-${alerta.id}-escalonamento`;
  const escalonamentos = alerta.escalonamentos ?? [];

  return (
    <li
      aria-labelledby={idTituloAlerta(alerta)}
      data-status={alerta.status}
      className={`flex flex-col gap-3 rounded-lg border border-l-4 p-4 ${
        ativo
          ? 'border-borda-suave border-l-erro bg-superficie'
          : 'border-borda-suave border-l-borda bg-superficie-elevada'
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 id={idTituloAlerta(alerta)} tabIndex={-1} className="text-secao font-semibold">
          {alerta.especialidade}
        </h3>
        <span
          className={`${classeEtiqueta} ${bloqueio ? 'border-purple-600 bg-purple-100 text-purple-900' : 'border-amber-600 bg-amber-100 text-amber-950'}`}
        >
          {ROTULO_TIPO[alerta.tipo]}
        </span>
        <span
          className={`${classeEtiqueta} ${ativo ? 'border-red-600 bg-red-100 text-red-900' : 'border-gray-400 bg-gray-100 text-gray-800'}`}
        >
          {ativo ? 'Ativo' : 'Reconhecido'}
        </span>
      </div>

      <p className="font-medium">{descreverGravidade(alerta)}</p>

      <dl className="flex flex-wrap gap-x-6 gap-y-1">
        {!bloqueio && alerta.tempoEsperaMinutos !== null && (
          <Dado rotulo="Espera atual">{alerta.tempoEsperaMinutos} min</Dado>
        )}
        {!bloqueio && alerta.limiteMinutos !== null && (
          <Dado rotulo="Limite definido">{alerta.limiteMinutos} min</Dado>
        )}
        <Dado rotulo="Senhas afetadas">{alerta.senhasAfetadas}</Dado>
        <Dado rotulo="Disparado em">{formatarHorario(alerta.disparadoEm)}</Dado>
      </dl>

      {!ativo && alerta.reconhecidoPor && alerta.reconhecidoEm && (
        <p className="text-texto-secundario">
          Reconhecido por {alerta.reconhecidoPor} em {formatarHorario(alerta.reconhecidoEm)}.
        </p>
      )}

      {escalonamentos.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="font-medium">Medidas acionadas</p>
          <ul className="flex flex-col gap-1 text-texto-secundario">
            {escalonamentos.map((e) => (
              <li key={e.id}>
                {ROTULO_ACAO[e.acao]}, por {e.acionadoPor} em {formatarHorario(e.acionadoEm)}
                {e.observacao ? `: ${e.observacao}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-start gap-2">
        <Permitido permissao="fila:consultar">
          <Link
            href={`/fila?filaId=${encodeURIComponent(alerta.filaId)}`}
            aria-label={`Ver fila de ${alerta.especialidade}`}
            className={classesBotao.secundario}
          >
            Ver fila
          </Link>
        </Permitido>
        {ativo && (
          <Permitido permissao="alertas:reconhecer">
            <Button
              variante="secundario"
              aria-label={`Reconhecer alerta de ${alerta.especialidade}`}
              disabled={!podeEscrever || reconhecendo}
              onClick={() => onReconhecer(alerta)}
            >
              Reconhecer alerta
            </Button>
          </Permitido>
        )}
        <Permitido permissao="alertas:escalonar">
          {/* Abaixo de 768 px as medidas ficam num menu por item (T-17). */}
          <Button
            variante="secundario"
            className="md:hidden"
            aria-expanded={menuAberto}
            aria-controls={idMenu}
            onClick={() => setMenuAberto((a) => !a)}
          >
            Escalonar
          </Button>
          <div
            id={idMenu}
            className={`${menuAberto ? 'flex' : 'hidden'} w-full flex-col gap-2 md:flex md:w-auto md:flex-row`}
          >
            {ACOES.map((acao) => (
              <Button
                key={acao}
                aria-label={`${ROTULO_BOTAO_ACAO[acao]} em ${alerta.especialidade}`}
                disabled={!podeEscrever}
                onClick={() => onEscalonar(alerta, acao)}
              >
                {ROTULO_BOTAO_ACAO[acao]}
              </Button>
            ))}
          </div>
        </Permitido>
      </div>
    </li>
  );
}

function Dado({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="flex gap-1">
      <dt className="text-texto-secundario">{rotulo}:</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}
