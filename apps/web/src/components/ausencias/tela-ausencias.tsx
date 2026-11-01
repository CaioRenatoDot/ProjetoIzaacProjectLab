'use client';

import {
  APRESENTACAO_STATUS,
  Button,
  classeCampo,
  EstadoCarregando,
  EstadoErro,
  EstadoSemPermissao,
  EstadoVazio,
  EtiquetaStatus,
  useConexao,
  usePermissoes,
} from '@filas/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import { PainelOcorrenciasSenha } from '@/components/senha/painel-ocorrencias-senha';
import { NotificacaoAusencia } from '@/components/senha/notificacao-ausencia';
import { ErroApi, type ClienteHttp } from '@/lib/api/cliente-http';
import {
  criarAusenciasApi,
  type RegistroAusencia,
  type SenhaOcorrencia,
} from '@/lib/ausencias/api';
import { criarConsultaAusencias, type QuadroAusencias } from '@/lib/ausencias/consulta';

export interface SimulacaoAusencias {
  reiniciar: () => void;
  assinar: (ouvinte: (registro: RegistroAusencia) => void) => () => void;
}

export function TelaAusencias({
  cliente,
  simulacao,
  assinarAusenciasAutomaticas,
}: {
  cliente: ClienteHttp;
  simulacao?: SimulacaoAusencias;
  assinarAusenciasAutomaticas?: SimulacaoAusencias['assinar'];
}) {
  const { tem } = usePermissoes();
  const { podeEscrever } = useConexao();
  const permitida = tem('ausencia:consultar') && tem('fila:consultar');
  const consulta = useMemo(() => criarConsultaAusencias(cliente), [cliente]);
  const api = useMemo(() => criarAusenciasApi(cliente), [cliente]);
  const cache = useQueryClient();
  const [filaSelecionada, setFilaSelecionada] = useState('');
  const [pagina, setPagina] = useState(1);
  const [senhaSelecionadaId, setSenhaSelecionadaId] = useState<string | null>(null);
  const [aviso, setAviso] = useState<RegistroAusencia | null>(null);
  const filas = useQuery({
    queryKey: ['ausencias', 'filas'],
    queryFn: consulta.listarFilas,
    enabled: permitida,
  });
  const filaId = filaSelecionada || filas.data?.dados[0]?.id || '';
  const chave = ['ausencias', 'quadro', filaId, pagina] as const;
  const quadro = useQuery({
    queryKey: chave,
    queryFn: () => consulta.quadro(filaId, pagina),
    enabled: permitida && !!filaId,
    refetchInterval: 5000,
  });

  const selecionada = quadro.data?.dados.find((s) => s.id === senhaSelecionadaId);

  const assinar = assinarAusenciasAutomaticas ?? simulacao?.assinar;
  useEffect(() => {
    if (!assinar || !permitida) return;
    return assinar(setAviso);
  }, [assinar, permitida]);

  function atualizarSenha(senha: SenhaOcorrencia) {
    cache.setQueryData<QuadroAusencias>(
      chave,
      (atual) =>
        atual && {
          ...atual,
          dados: atual.dados.map((s) => (s.id === senha.id ? { ...s, ...senha } : s)),
        },
    );
    void cache.invalidateQueries({ queryKey: ['ausencias', 'quadro'] });
  }

  function reiniciar() {
    simulacao?.reiniciar();
    setAviso(null);
    setSenhaSelecionadaId(null);
    void cache.invalidateQueries({ queryKey: ['ausencias'] });
  }

  if (!permitida) return <EstadoSemPermissao />;
  const erro = filas.error ?? quadro.error;
  if (erro instanceof ErroApi && erro.status === 403) return <EstadoSemPermissao />;

  return (
    <section className="flex flex-col gap-6" aria-labelledby="titulo-ausencias">
      <header>
        <h1 id="titulo-ausencias" className="text-pagina font-semibold">
          Ausências e desistências
        </h1>
        <p className="text-texto-secundario">
          Registre o não comparecimento ou a saída voluntária do paciente.
        </p>
      </header>
      {simulacao && (
        <aside
          aria-label="Ambiente de demonstração"
          className="flex flex-col gap-3 rounded-lg bg-alerta-fundo p-4 text-alerta-texto"
        >
          <p>Ambiente de demonstração com dados fictícios. Nenhum atendimento real é alterado.</p>
          <p>
            F014 e F018 demonstram restrições. F017 expira automaticamente em 30 segundos após
            iniciar a simulação.
          </p>
          <Button variante="secundario" onClick={reiniciar}>
            Reiniciar demonstração
          </Button>
        </aside>
      )}
      <NotificacaoAusencia registro={aviso} />
      {erro ? (
        <EstadoErro
          mensagem="Não foi possível carregar as senhas. Verifique a conexão e tente novamente."
          onTentarNovamente={() => {
            void filas.refetch();
            if (filaId) void quadro.refetch();
          }}
        />
      ) : filas.isPending ? (
        <EstadoCarregando rotulo="Carregando filas" />
      ) : !filas.data?.dados.length ? (
        <EstadoVazio
          titulo="Nenhuma fila disponível"
          descricao="As filas ativas aparecerão aqui."
        />
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="fila-ausencias" className="font-medium">
                Fila
              </label>
              <select
                id="fila-ausencias"
                className={classeCampo}
                value={filaId}
                onChange={(e) => {
                  setFilaSelecionada(e.target.value);
                  setPagina(1);
                  setSenhaSelecionadaId(null);
                }}
              >
                {filas.data.dados.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome}
                  </option>
                ))}
              </select>
            </div>
            <Button
              variante="secundario"
              onClick={() => {
                void quadro.refetch();
              }}
              disabled={quadro.isFetching}
            >
              Atualizar
            </Button>
          </div>
          {quadro.isPending ? (
            <EstadoCarregando rotulo="Carregando senhas" />
          ) : !quadro.data?.dados.length ? (
            <EstadoVazio
              titulo="Nenhuma senha nesta fila"
              descricao="As senhas aparecerão aqui quando forem emitidas."
            />
          ) : (
            <>
              <p className="text-secundario text-texto-secundario">
                Última atualização:{' '}
                {new Date(quadro.data.sincronizadoEm).toLocaleTimeString('pt-BR')}
              </p>
              <ul className="grid gap-4 lg:grid-cols-2">
                {quadro.data.dados.map((senha) => (
                  <li key={senha.id}>
                    <article
                      aria-label={`Senha ${senha.numero}`}
                      className="flex h-full flex-col gap-4 rounded-lg border border-borda bg-superficie p-5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <h2 className="text-secao font-semibold">{senha.numero}</h2>
                        <EtiquetaStatus status={senha.status} />
                      </div>
                      <p>
                        Paciente: {senha.pacienteIniciais} · {senha.especialidade}
                      </p>
                      {senha.status === 'CHAMADA' && senha.toleranciaAte && (
                        <p className="text-secundario text-texto-secundario">
                          Tolerância até {new Date(senha.toleranciaAte).toLocaleTimeString('pt-BR')}
                          . A confirmação mostra o tempo restante.
                        </p>
                      )}
                      <Button
                        variante="secundario"
                        onClick={() => setSenhaSelecionadaId(senha.id)}
                        aria-label={`Detalhes da senha ${senha.numero}`}
                      >
                        Detalhes
                      </Button>
                      {!['CHAMADA', 'AGUARDANDO', 'EM_ATENDIMENTO'].includes(senha.status) && (
                        <p className="text-secundario text-texto-secundario">
                          Registro concluído: {APRESENTACAO_STATUS[senha.status].rotulo}.
                        </p>
                      )}
                    </article>
                  </li>
                ))}
              </ul>
              <nav
                aria-label="Paginação das senhas"
                className="flex items-center justify-between gap-3"
              >
                <Button
                  variante="secundario"
                  disabled={pagina <= 1 || quadro.isFetching}
                  onClick={() => setPagina((p) => p - 1)}
                >
                  Anterior
                </Button>
                <span>
                  Página {pagina} de {Math.max(1, quadro.data.meta.totalPaginas)}
                </span>
                <Button
                  variante="secundario"
                  disabled={pagina >= quadro.data.meta.totalPaginas || quadro.isFetching}
                  onClick={() => setPagina((p) => p + 1)}
                >
                  Próxima
                </Button>
              </nav>
            </>
          )}
        </>
      )}
      {selecionada && (
        <PainelOcorrenciasSenha
          api={api}
          senha={selecionada}
          aberto
          onAbertoChange={(aberto) => {
            if (!aberto) setSenhaSelecionadaId(null);
          }}
          onRegistrada={atualizarSenha}
          onAusenciaRegistrada={setAviso}
          onAtualizar={() => {
            void quadro.refetch();
          }}
        />
      )}
      {!podeEscrever && (
        <p role="alert">Conexão perdida. As alterações estão pausadas até a reconexão.</p>
      )}
    </section>
  );
}
