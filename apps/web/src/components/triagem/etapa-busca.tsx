'use client';

import { Button, classeCampo, classesBotao, EstadoCarregando, EstadoErro } from '@filas/ui';
import Link from 'next/link';
import { useId, useState } from 'react';

import { Campo, atributosCampo } from './campos';
import { useFocoNoTitulo } from './use-foco-titulo';
import { mascararDocumento } from '@/lib/triagem/schema';
import { type PacienteBusca, type TriagemApi } from '@/lib/triagem/tipos';

type Resultado =
  | { estado: 'ocioso' }
  | { estado: 'carregando' }
  | { estado: 'erro' }
  | { estado: 'pronto'; pacientes: PacienteBusca[] };

export interface EtapaBuscaProps {
  api: TriagemApi;
  onSelecionar: (paciente: PacienteBusca) => void;
}

/** Etapa 1 de W-06: busca por nome ou documento, resultado com nome abreviado (P-03). */
export function EtapaBusca({ api, onSelecionar }: EtapaBuscaProps) {
  const titulo = useFocoNoTitulo();
  const idBusca = useId();
  const [termo, setTermo] = useState('');
  const [erroTermo, setErroTermo] = useState<string>();
  const [resultado, setResultado] = useState<Resultado>({ estado: 'ocioso' });

  async function buscar() {
    if (!termo.trim()) {
      setErroTermo('Digite o nome ou o documento do paciente para buscar.');
      return;
    }
    setErroTermo(undefined);
    setResultado({ estado: 'carregando' });
    try {
      setResultado({ estado: 'pronto', pacientes: await api.buscarPacientes(termo.trim()) });
    } catch {
      setResultado({ estado: 'erro' });
    }
  }

  return (
    <section aria-labelledby="titulo-busca" className="flex max-w-2xl flex-col gap-4">
      <h1 id="titulo-busca" ref={titulo} tabIndex={-1} className="text-pagina font-semibold">
        Triagem: buscar paciente
      </h1>
      <p className="text-texto-secundario">Etapa 1 de 3</p>

      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void buscar();
        }}
      >
        <Campo id={idBusca} rotulo="Nome ou documento" erro={erroTermo}>
          <input
            {...atributosCampo(idBusca, { erro: erroTermo })}
            type="search"
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            className={classeCampo}
          />
        </Campo>
        <div>
          <Button type="submit">Buscar</Button>
        </div>
      </form>

      <div aria-live="polite">
        {resultado.estado === 'carregando' && <EstadoCarregando linhas={3} rotulo="Buscando" />}
        {resultado.estado === 'erro' && (
          <EstadoErro
            mensagem="Não foi possível buscar agora. Verifique a conexão e tente novamente."
            onTentarNovamente={() => void buscar()}
          />
        )}
        {resultado.estado === 'pronto' && resultado.pacientes.length === 0 && (
          <div className="flex flex-col items-start gap-3 py-4">
            <p>Nenhum paciente encontrado para essa busca.</p>
            <Link
              href="/cadastros/pacientes/novo?voltar=/triagem"
              className={classesBotao.secundario}
            >
              Cadastrar novo paciente
            </Link>
          </div>
        )}
        {resultado.estado === 'pronto' && resultado.pacientes.length > 0 && (
          <ul aria-label="Pacientes encontrados" className="flex flex-col gap-2">
            {resultado.pacientes.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 rounded-md border border-borda-suave p-3"
              >
                <span className="flex flex-col">
                  <span className="font-semibold">{p.iniciais}</span>
                  <span className="text-secundario text-texto-secundario">
                    Documento {mascararDocumento(p.documento)}
                    {p.restricaoAtiva ? ' · com restrição por ausências' : ''}
                  </span>
                </span>
                <Button variante="secundario" onClick={() => onSelecionar(p)}>
                  Selecionar<span className="sr-only"> paciente {p.iniciais}</span>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
