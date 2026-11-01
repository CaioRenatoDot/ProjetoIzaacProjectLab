'use client';

import {
  Button,
  classeCampo,
  ErroCampo,
  EstadoCarregando,
  EstadoErro,
  EstadoSemPermissao,
  EstadoVazio,
  ModalConfirmacao,
  Permitido,
  useConexao,
  usePermissoes,
  useToast,
} from '@filas/ui';
import { useCallback, useEffect, useId, useRef, useState } from 'react';

import { MatrizPermissoes } from './matriz-permissoes';
import {
  avisoUsuariosAfetados,
  nomeDaCopia,
  semPermissaoDeConsulta,
  somenteLeitura,
  validarNome,
} from '@/lib/perfis/regras';
import { ErroPerfil, type ModuloCatalogo, type Perfil, type PerfisApi } from '@/lib/perfis/tipos';

interface Rascunho {
  /** `null` para perfil ainda não salvo (novo ou duplicado). */
  id: string | null;
  nome: string;
  descricao: string;
  permissoes: Set<string>;
}

type Carga =
  | { estado: 'carregando' }
  | { estado: 'erro' }
  | { estado: 'pronto'; catalogo: ModuloCatalogo[]; perfis: Perfil[] };

type Confirmacao = { tipo: 'salvar'; mensagens: string[] } | { tipo: 'excluir' };

const rascunhoDe = (perfil: Perfil): Rascunho => ({
  id: perfil.id,
  nome: perfil.nome,
  descricao: perfil.descricao,
  permissoes: new Set(perfil.permissoes),
});

/** W-05 / T-05: lista de perfis à esquerda, editor e matriz de permissões à direita. */
export function TelaPerfis({ api }: { api: PerfisApi }) {
  const { tem } = usePermissoes();
  const { podeEscrever } = useConexao();
  const mostrarToast = useToast();
  const idNome = useId();
  const campoNome = useRef<HTMLInputElement>(null);

  const [carga, setCarga] = useState<Carga>({ estado: 'carregando' });
  const [rascunho, setRascunho] = useState<Rascunho | null>(null);
  const [erroNome, setErroNome] = useState<string | null>(null);
  const [confirmacao, setConfirmacao] = useState<Confirmacao | null>(null);
  const [enviando, setEnviando] = useState(false);

  const carregar = useCallback(async () => {
    setCarga({ estado: 'carregando' });
    try {
      const [catalogo, perfis] = await Promise.all([api.catalogo(), api.listar()]);
      setCarga({ estado: 'pronto', catalogo, perfis });
      setRascunho((atual) => {
        const mantido = atual?.id ? perfis.find((p) => p.id === atual.id) : undefined;
        if (mantido) return rascunhoDe(mantido);
        return perfis[0] ? rascunhoDe(perfis[0]) : null;
      });
    } catch {
      setCarga({ estado: 'erro' });
    }
  }, [api]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  if (!tem('perfis:consultar')) return <EstadoSemPermissao />;
  if (carga.estado === 'carregando') return <EstadoCarregando linhas={6} />;
  if (carga.estado === 'erro') {
    return (
      <EstadoErro
        mensagem="Não foi possível carregar os perfis. Verifique a conexão e tente novamente."
        onTentarNovamente={() => void carregar()}
      />
    );
  }

  const { catalogo, perfis } = carga;
  const perfilSalvo = rascunho?.id ? perfis.find((p) => p.id === rascunho.id) : undefined;
  const bloqueado = perfilSalvo ? somenteLeitura(perfilSalvo) : false;
  const podeEditar = rascunho?.id === null ? tem('perfis:criar') : tem('perfis:editar');
  const leitura = bloqueado || !podeEditar || !podeEscrever;

  function selecionar(perfil: Perfil) {
    setRascunho(rascunhoDe(perfil));
    setErroNome(null);
  }

  function novo() {
    setRascunho({ id: null, nome: '', descricao: '', permissoes: new Set() });
    setErroNome(null);
  }

  function duplicar(origem: Perfil) {
    setRascunho({
      id: null,
      nome: nomeDaCopia(origem.nome, perfis),
      descricao: origem.descricao,
      permissoes: new Set(origem.permissoes),
    });
    setErroNome(null);
  }

  function alternar(permissao: string) {
    setRascunho((r) => {
      if (!r) return r;
      const permissoes = new Set(r.permissoes);
      if (permissoes.has(permissao)) permissoes.delete(permissao);
      else permissoes.add(permissao);
      return { ...r, permissoes };
    });
  }

  function cancelar() {
    if (perfilSalvo) selecionar(perfilSalvo);
    else if (perfis[0]) selecionar(perfis[0]);
    else setRascunho(null);
  }

  function pedirSalvar() {
    if (!rascunho) return;
    const erro = validarNome(rascunho.nome, perfis, rascunho.id);
    setErroNome(erro);
    if (erro) {
      campoNome.current?.focus();
      return;
    }

    const mensagens = [
      perfilSalvo && avisoUsuariosAfetados(perfilSalvo.usuariosVinculados),
      semPermissaoDeConsulta([...rascunho.permissoes]) &&
        'O perfil não tem nenhuma permissão de consulta: quem o usar não verá nenhum módulo.',
    ].filter((m): m is string => Boolean(m));

    if (mensagens.length > 0) setConfirmacao({ tipo: 'salvar', mensagens });
    else void salvar();
  }

  async function salvar() {
    if (!rascunho) return;
    setConfirmacao(null);
    setEnviando(true);
    try {
      const salvo = await api.salvar(rascunho.id, {
        nome: rascunho.nome.trim(),
        descricao: rascunho.descricao.trim(),
        permissoes: [...rascunho.permissoes],
      });
      setRascunho(rascunhoDe(salvo));
      mostrarToast({ tipo: 'sucesso', mensagem: `Perfil "${salvo.nome}" salvo.` });
      await carregar();
    } catch (e) {
      if (e instanceof ErroPerfil && e.codigo === 'DUPLICIDADE') {
        setErroNome(e.message);
        campoNome.current?.focus();
      } else mostrarToast({ tipo: 'erro', mensagem: mensagemDeErro(e, 'salvar') });
    } finally {
      setEnviando(false);
    }
  }

  async function excluir() {
    if (!perfilSalvo) return;
    setConfirmacao(null);
    setEnviando(true);
    try {
      await api.excluir(perfilSalvo.id);
      mostrarToast({ tipo: 'sucesso', mensagem: `Perfil "${perfilSalvo.nome}" excluído.` });
      setRascunho(null);
      await carregar();
    } catch (e) {
      mostrarToast({ tipo: 'erro', irreversivel: true, mensagem: mensagemDeErro(e, 'excluir') });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <p className="md:hidden">
        A gestão de perfis está disponível em telas a partir de 768 px. Use um computador ou tablet.
      </p>
      <div className="hidden gap-6 md:flex">
        <section aria-labelledby="titulo-perfis" className="flex w-64 shrink-0 flex-col gap-3">
          <h1 id="titulo-perfis" className="text-pagina font-semibold">
            Perfis
          </h1>
          <Permitido permissao="perfis:criar">
            <Button variante="primario" onClick={novo} disabled={!podeEscrever}>
              Novo perfil
            </Button>
          </Permitido>
          {perfis.length === 0 ? (
            <EstadoVazio titulo="Nenhum perfil cadastrado." />
          ) : (
            <ul className="flex flex-col gap-1">
              {perfis.map((p) => {
                const ativo = rascunho?.id === p.id;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => selecionar(p)}
                      aria-current={ativo ? 'true' : undefined}
                      className={`min-h-toque w-full rounded-md px-3 py-2 text-left ${ativo ? 'bg-primaria text-texto-invertido' : 'hover:bg-superficie-hover'}`}
                    >
                      <span className="block">{p.nome}</span>
                      <span
                        className={`block text-secundario ${ativo ? 'text-texto-invertido' : 'text-texto-secundario'}`}
                      >
                        {p.sistema ? 'Perfil do sistema · ' : ''}
                        {p.usuariosVinculados} usuário(s)
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {rascunho ? (
          <section aria-label="Editor do perfil" className="flex min-w-0 flex-1 flex-col gap-4">
            {bloqueado && (
              <p role="note" className="rounded-md bg-superficie-elevada p-3 text-texto">
                Perfil do sistema: as permissões aparecem só para leitura e não podem ser alteradas.
              </p>
            )}
            <div className="flex flex-col gap-1">
              <label htmlFor={idNome} className="font-medium">
                Nome
              </label>
              <input
                id={idNome}
                ref={campoNome}
                value={rascunho.nome}
                readOnly={leitura}
                required
                aria-invalid={erroNome ? true : undefined}
                aria-describedby={erroNome ? `${idNome}-erro` : undefined}
                onChange={(e) => setRascunho({ ...rascunho, nome: e.target.value })}
                className={classeCampo}
              />
              {erroNome && <ErroCampo id={`${idNome}-erro`}>{erroNome}</ErroCampo>}
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor={`${idNome}-descricao`} className="font-medium">
                Descrição
              </label>
              <textarea
                id={`${idNome}-descricao`}
                rows={2}
                value={rascunho.descricao}
                readOnly={leitura}
                onChange={(e) => setRascunho({ ...rascunho, descricao: e.target.value })}
                className={classeCampo}
              />
            </div>

            <MatrizPermissoes
              catalogo={catalogo}
              marcadas={rascunho.permissoes}
              somenteLeitura={leitura}
              onAlternar={alternar}
            />

            <div className="flex flex-wrap justify-end gap-3">
              {perfilSalvo && (
                <Permitido permissao="perfis:criar">
                  <Button
                    variante="secundario"
                    onClick={() => duplicar(perfilSalvo)}
                    disabled={!podeEscrever}
                  >
                    Duplicar
                  </Button>
                </Permitido>
              )}
              {!leitura && (
                <>
                  <Button variante="secundario" onClick={cancelar} disabled={enviando}>
                    Cancelar
                  </Button>
                  <Button variante="primario" onClick={pedirSalvar} disabled={enviando}>
                    Salvar
                  </Button>
                </>
              )}
              {perfilSalvo && !bloqueado && (
                <Permitido permissao="perfis:excluir">
                  <Button
                    variante="destrutivo"
                    onClick={() => setConfirmacao({ tipo: 'excluir' })}
                    disabled={enviando || !podeEscrever}
                  >
                    Excluir perfil
                  </Button>
                </Permitido>
              )}
            </div>
          </section>
        ) : (
          <EstadoVazio titulo="Selecione um perfil na lista para ver as permissões." />
        )}
      </div>

      <ModalConfirmacao
        aberto={confirmacao?.tipo === 'salvar'}
        onAbertoChange={(aberto) => !aberto && setConfirmacao(null)}
        titulo="Confirmar alteração do perfil"
        descricao={confirmacao?.tipo === 'salvar' ? confirmacao.mensagens.join(' ') : undefined}
        rotuloConfirmar="Salvar mesmo assim"
        onConfirmar={() => void salvar()}
      />
      <ModalConfirmacao
        aberto={confirmacao?.tipo === 'excluir'}
        onAbertoChange={(aberto) => !aberto && setConfirmacao(null)}
        titulo={`Excluir o perfil "${perfilSalvo?.nome ?? ''}"?`}
        descricao="Esta ação não pode ser desfeita."
        destrutiva
        rotuloConfirmar="Excluir perfil"
        onConfirmar={() => void excluir()}
      />
    </>
  );
}

function mensagemDeErro(erro: unknown, acao: 'salvar' | 'excluir') {
  if (erro instanceof ErroPerfil) return erro.message;
  return `Não foi possível ${acao} o perfil. Verifique a conexão e tente novamente.`;
}
