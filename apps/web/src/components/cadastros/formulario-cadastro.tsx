'use client';

import {
  Button,
  classeCampo,
  EstadoCarregando,
  EstadoErro,
  EstadoSemPermissao,
  ModalConfirmacao,
  useConexao,
  usePermissoes,
  useToast,
} from '@filas/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type ReactNode, useId, useState } from 'react';
import { Controller, type UseFormReturn, useForm } from 'react-hook-form';

import { ErroApi } from '@/lib/api/cliente-http';
import { entidadeCadastro, type SlugCadastro } from '@/lib/cadastros/entidades';
import {
  type CampoFormulario,
  camposObrigatorios,
  type Catalogo,
  formularioCadastro,
  type Valores,
  vazio,
} from '@/lib/cadastros/formularios';
import { type Disponibilidade, type ItemReferencia, type Pagina } from '@/lib/cadastros/tipos';
import { destinoSeguro } from '@/lib/sessao/destino';
import { useSessao } from '@/lib/sessao/sessao';

import {
  CampoRotulado,
  descricaoCampo,
  GradeDisponibilidade,
  SelecaoMultipla,
  SimNao,
} from './campos-formulario';

type Registro = { id: string } & Record<string, unknown>;

export interface TelaFormularioCadastroProps {
  slug: SlugCadastro;
  /** Ausente: criação. Presente: edição do registro. */
  id?: string;
  /** Rota de volta depois de salvar ou cancelar (ex.: `/triagem`); só caminho interno. */
  voltar?: string;
}

/** W-04 / T-04: formulário único de criação e edição das cinco entidades base. */
export function TelaFormularioCadastro({ slug, id, voltar }: TelaFormularioCadastroProps) {
  const { tem } = usePermissoes();
  if (!tem(id ? 'cadastros:editar' : 'cadastros:criar')) return <EstadoSemPermissao />;
  if (id) return <Edicao slug={slug} id={id} voltar={voltar} />;
  return <Formulario slug={slug} registro={null} voltar={voltar} />;
}

function Edicao({ slug, id, voltar }: { slug: SlugCadastro; id: string; voltar?: string }) {
  const { cliente } = useSessao();
  const entidade = entidadeCadastro(slug)!;
  const consulta = useQuery({
    queryKey: ['cadastros', slug, 'registro', id],
    queryFn: () => cliente.requisitar<Registro>(`${entidade.endpoint}/${id}`),
  });

  if (consulta.isPending) return <EstadoCarregando rotulo={`Carregando ${entidade.singular}`} />;
  if (consulta.isError) {
    if (consulta.error instanceof ErroApi && consulta.error.status === 403) {
      return <EstadoSemPermissao />;
    }
    return (
      <EstadoErro
        mensagem={`Não foi possível carregar o cadastro de ${entidade.singular}. Verifique a conexão e tente novamente.`}
        onTentarNovamente={() => void consulta.refetch()}
      />
    );
  }
  return <Formulario slug={slug} registro={consulta.data} voltar={voltar} />;
}

const maiuscula = (texto: string) => texto.charAt(0).toLocaleUpperCase('pt-BR') + texto.slice(1);

function Formulario({
  slug,
  registro,
  voltar,
}: {
  slug: SlugCadastro;
  registro: Registro | null;
  voltar?: string;
}) {
  const entidade = entidadeCadastro(slug)!;
  const formulario = formularioCadastro(slug);
  const { cliente } = useSessao();
  const queryClient = useQueryClient();
  const router = useRouter();
  const mostrarToast = useToast();
  const { podeEscrever } = useConexao();
  const prefixo = useId();

  const destino =
    voltar && destinoSeguro(voltar) !== '/' ? destinoSeguro(voltar) : `/cadastros/${slug}`;
  const primeiroCampo = formulario.secoes[0]!.campos[0]!.nome;

  const form = useForm<Valores>({
    resolver: zodResolver(formulario.schema),
    defaultValues: registro ? formulario.deRegistro(registro) : formulario.vazio,
    mode: 'onTouched',
  });
  const {
    handleSubmit,
    watch,
    setError,
    setFocus,
    getFieldState,
    formState: { isDirty },
  } = form;

  const [duplicado, setDuplicado] = useState<{ mensagem: string; existenteId?: string } | null>(
    null,
  );
  const [descartar, setDescartar] = useState(false);
  const [comImpacto, setComImpacto] = useState<Valores | null>(null);

  const valores = watch();
  const faltaObrigatorio = camposObrigatorios(formulario).some((nome) => vazio(valores[nome]));

  const salvar = useMutation({
    mutationFn: (dados: Valores) =>
      cliente.requisitar<Registro>(
        registro ? `${entidade.endpoint}/${registro.id}` : entidade.endpoint,
        { metodo: registro ? 'PUT' : 'POST', corpo: formulario.paraEntrada(dados) },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['cadastros', slug] });
      const participio = registro ? 'atualizad' : 'cadastrad';
      mostrarToast({
        tipo: 'sucesso',
        mensagem: `${maiuscula(entidade.singular)} ${participio}${entidade.feminino ? 'a' : 'o'}.`,
      });
      router.push(destino);
    },
    onError: (erro) => {
      if (erro instanceof ErroApi && erro.codigo === 'DUPLICIDADE') {
        const existente = erro.extras.recursoExistenteId;
        setDuplicado({
          mensagem: erro.detail,
          existenteId: typeof existente === 'string' ? existente : undefined,
        });
        setFocus(primeiroCampo);
        return;
      }
      if (erro instanceof ErroApi && erro.campos.length > 0) {
        for (const { campo, mensagem } of erro.campos) setError(campo, { message: mensagem });
        setFocus(erro.campos[0]!.campo);
        return;
      }
      mostrarToast({
        tipo: 'erro',
        mensagem:
          erro instanceof ErroApi && erro.detail
            ? erro.detail
            : 'Não foi possível salvar. Verifique a conexão e tente novamente.',
      });
    },
  });

  const enviar = handleSubmit((dados) => {
    if (salvar.isPending || !podeEscrever) return;
    setDuplicado(null);
    const impacto = formulario.impacto;
    if (
      registro &&
      impacto?.emUso(registro) &&
      impacto.campos.some((campo) => getFieldState(campo).isDirty)
    ) {
      setComImpacto(dados);
      return;
    }
    salvar.mutate(dados);
  });

  function cancelar() {
    if (isDirty) setDescartar(true);
    else router.push(destino);
  }

  const indisponivel = faltaObrigatorio || salvar.isPending || !podeEscrever;

  const avisoDuplicado = duplicado && (
    <div role="alert" className="flex flex-col gap-1 rounded-md border border-erro p-3 text-erro">
      <p className="flex items-start gap-1">
        <span aria-hidden="true">⚠</span>
        <span>{duplicado.mensagem}</span>
      </p>
      {duplicado.existenteId && (
        <Link
          href={`/cadastros/${slug}/${duplicado.existenteId}`}
          className="font-medium text-informacao underline"
        >
          Abrir o cadastro existente
        </Link>
      )}
    </div>
  );

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-pagina font-semibold">
          {registro ? `Editar ${entidade.singular}` : entidade.rotuloNovo}
        </h1>
        <p className="text-texto-secundario">
          Campos marcados com &quot;(obrigatório)&quot; precisam ser preenchidos.
        </p>
      </header>

      <form noValidate onSubmit={(e) => void enviar(e)} className="flex flex-col gap-6">
        {formulario.secoes.map((secao, indiceSecao) => (
          <fieldset
            key={secao.legenda}
            className="flex min-w-0 flex-col gap-4 rounded-lg border border-borda-suave p-4"
          >
            <legend className="px-1 text-secao font-semibold">{secao.legenda}</legend>
            {secao.campos.map((campo, indiceCampo) => (
              <CampoDinamico
                key={campo.nome}
                id={`${prefixo}-${campo.nome}`}
                campo={campo}
                form={form}
                aviso={indiceSecao === 0 && indiceCampo === 0 ? avisoDuplicado : undefined}
              />
            ))}
          </fieldset>
        ))}

        {/* Barra de ações fixa no rodapé; neutro à esquerda, primário à direita (T-04, §3.3). */}
        <div className="sticky bottom-0 flex justify-end gap-3 border-t border-borda-suave bg-superficie py-3">
          <Button variante="secundario" onClick={cancelar}>
            Cancelar
          </Button>
          <Button
            type="submit"
            aria-disabled={indisponivel}
            aria-busy={salvar.isPending}
            className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
          >
            {salvar.isPending ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      </form>

      <ModalConfirmacao
        aberto={descartar}
        onAbertoChange={setDescartar}
        titulo="Descartar alterações?"
        descricao="As alterações feitas neste formulário ainda não foram salvas e serão perdidas."
        rotuloConfirmar="Descartar"
        destrutiva
        onConfirmar={() => router.push(destino)}
      />

      <ModalConfirmacao
        aberto={comImpacto !== null}
        onAbertoChange={(aberto) => !aberto && setComImpacto(null)}
        titulo="A alteração afeta alocações em curso"
        descricao={`${formulario.impacto?.mensagem ?? ''} Deseja salvar mesmo assim?`}
        rotuloConfirmar="Salvar mesmo assim"
        onConfirmar={() => {
          if (comImpacto) salvar.mutate(comImpacto);
          setComImpacto(null);
        }}
      />
    </div>
  );
}

function useCatalogo(catalogo: Catalogo | undefined): {
  opcoes: ItemReferencia[];
  carregando: boolean;
} {
  const { cliente } = useSessao();
  const consulta = useQuery({
    queryKey: ['cadastros', 'catalogo', catalogo],
    queryFn: () => cliente.requisitar<Pagina<ItemReferencia>>(`/${catalogo}?tamanho=100`),
    enabled: catalogo !== undefined,
    staleTime: 5 * 60_000,
  });
  return {
    opcoes: (consulta.data?.dados ?? []).map(({ id, nome }) => ({ id, nome })),
    carregando: consulta.isPending && catalogo !== undefined,
  };
}

const TIPO_INPUT = { texto: 'text', telefone: 'tel', email: 'email', data: 'date' } as const;

function CampoDinamico({
  id,
  campo,
  form,
  aviso,
}: {
  id: string;
  campo: CampoFormulario;
  form: UseFormReturn<Valores>;
  aviso?: ReactNode;
}) {
  const { register, control, formState } = form;
  const erro = formState.errors[campo.nome]?.message;
  const { opcoes, carregando } = useCatalogo(campo.catalogo);
  const base = { id, rotulo: campo.rotulo, obrigatorio: campo.obrigatorio, erro };
  const acessibilidade = { id, ...descricaoCampo(id, { erro, dica: campo.dica }) };

  switch (campo.tipo) {
    case 'texto':
    case 'telefone':
    case 'email':
    case 'data':
      return (
        <CampoRotulado {...base} dica={campo.dica}>
          <input
            {...acessibilidade}
            {...register(campo.nome)}
            type={TIPO_INPUT[campo.tipo]}
            autoComplete={campo.autoComplete}
            aria-required={campo.obrigatorio}
            className={classeCampo}
          />
          {aviso}
        </CampoRotulado>
      );
    case 'area':
      return (
        <CampoRotulado {...base} dica={campo.dica}>
          <textarea
            {...acessibilidade}
            {...register(campo.nome)}
            rows={3}
            className={classeCampo}
          />
        </CampoRotulado>
      );
    case 'inteiro':
      return (
        <CampoRotulado {...base} dica={campo.dica}>
          <input
            {...acessibilidade}
            {...register(campo.nome, { valueAsNumber: true })}
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            aria-required={campo.obrigatorio}
            className={`${classeCampo} max-w-40`}
          />
        </CampoRotulado>
      );
    case 'selecao': {
      const lista = campo.opcoes ?? opcoes.map((o) => ({ valor: o.id, rotulo: o.nome }));
      return (
        <CampoRotulado {...base} dica={campo.dica}>
          <select
            {...acessibilidade}
            {...register(campo.nome)}
            aria-required={campo.obrigatorio}
            className={classeCampo}
          >
            <option value="">{carregando ? 'Carregando…' : 'Selecione'}</option>
            {lista.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.rotulo}
              </option>
            ))}
          </select>
        </CampoRotulado>
      );
    }
    case 'multipla':
      return (
        <Controller
          name={campo.nome}
          control={control}
          render={({ field }) => (
            <SelecaoMultipla
              {...base}
              opcoes={opcoes}
              carregando={carregando}
              valor={field.value as string[]}
              onChange={field.onChange}
              onBlur={field.onBlur}
              campoRef={field.ref}
            />
          )}
        />
      );
    case 'disponibilidade':
      return (
        <Controller
          name={campo.nome}
          control={control}
          render={({ field }) => (
            <GradeDisponibilidade
              {...base}
              valor={field.value as Disponibilidade[]}
              onChange={field.onChange}
              onBlur={field.onBlur}
              campoRef={field.ref}
            />
          )}
        />
      );
    case 'simnao':
      return (
        <Controller
          name={campo.nome}
          control={control}
          render={({ field }) => (
            <SimNao
              rotulo={campo.rotulo}
              obrigatorio={campo.obrigatorio}
              erro={erro}
              valor={field.value as boolean | undefined}
              onChange={field.onChange}
              onBlur={field.onBlur}
              campoRef={field.ref}
            />
          )}
        />
      );
  }
}
