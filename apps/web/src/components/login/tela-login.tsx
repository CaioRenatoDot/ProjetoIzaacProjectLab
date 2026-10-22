'use client';

import { Button, classeCampo } from '@filas/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useState } from 'react';
import { useForm } from 'react-hook-form';

import { atributosCampo, Campo } from '@/components/triagem/campos';
import { destinoSeguro } from '@/lib/sessao/destino';
import { type LoginEntrada, LoginSchema, mensagemErroLogin } from '@/lib/sessao/login';
import { useSessao } from '@/lib/sessao/sessao';

export interface TelaLoginProps {
  /** Valor bruto de `?redirect=`; só caminho interno é aceito (`destinoSeguro`). */
  redirect?: string;
  /** `?expirada=1`: a sessão anterior expirou (T-01, estados especiais). */
  expirada?: boolean;
  /** Terminal compartilhado (recepção): sem credencial persistente (T-01, DAS §3.2). */
  terminalCompartilhado?: boolean;
}

/** W-01 / T-01: login. Coluna única, sem menu lateral. */
export function TelaLogin({ redirect, expirada, terminalCompartilhado }: TelaLoginProps) {
  const { estado, entrar } = useSessao();
  const router = useRouter();
  const destino = destinoSeguro(redirect);
  const prefixo = useId();
  const id = (campo: string) => `${prefixo}-${campo}`;
  const [senhaVisivel, setSenhaVisivel] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<LoginEntrada>({
    resolver: zodResolver(LoginSchema),
    defaultValues: { identificacao: '', senha: '', manterConectado: false },
  });

  const login = useMutation({
    mutationFn: (dados: LoginEntrada) =>
      entrar({ ...dados, manterConectado: terminalCompartilhado ? false : dados.manterConectado }),
    onError: (erro) => setMensagem(mensagemErroLogin(erro)),
  });

  useEffect(() => {
    if (estado === 'autenticado') router.replace(destino);
  }, [estado, destino, router]);

  const [identificacao, senha] = watch(['identificacao', 'senha']);
  const preenchido = identificacao.trim() !== '' && senha !== '';

  const enviar = handleSubmit((dados) => {
    // Limpa antes de enviar, para o leitor de tela anunciar de novo uma mensagem repetida.
    setMensagem(null);
    login.mutate(dados);
  });

  const erroIdentificacao = errors.identificacao?.message;
  const erroSenha = errors.senha?.message;

  return (
    <main className="flex min-h-screen items-center justify-center bg-superficie-elevada p-4">
      <div className="flex w-full max-w-md flex-col gap-6 rounded-lg border border-borda-suave bg-superficie p-8 shadow-sm">
        <header className="flex flex-col gap-1 text-center">
          <p className="text-secao font-semibold">Clínica-Escola</p>
          <p className="text-texto-secundario">Sistema de Gestão de Filas</p>
        </header>

        <h1 className="text-pagina font-semibold">Entrar</h1>

        {expirada && (
          <p role="status" className="rounded-md bg-alerta-fundo p-3 text-alerta-texto">
            Sua sessão expirou. Entre novamente para continuar de onde parou.
          </p>
        )}

        <form noValidate onSubmit={(e) => void enviar(e)} className="flex flex-col gap-4">
          <Campo
            id={id('identificacao')}
            rotulo="Matrícula ou e-mail institucional"
            obrigatorio
            erro={erroIdentificacao}
          >
            <input
              {...atributosCampo(id('identificacao'), { erro: erroIdentificacao })}
              {...register('identificacao')}
              type="text"
              autoComplete="username"
              autoFocus
              aria-required="true"
              className={classeCampo}
            />
          </Campo>

          <Campo id={id('senha')} rotulo="Senha" obrigatorio erro={erroSenha}>
            <div className="flex gap-2">
              <input
                {...atributosCampo(id('senha'), { erro: erroSenha })}
                {...register('senha')}
                type={senhaVisivel ? 'text' : 'password'}
                autoComplete="current-password"
                aria-required="true"
                className={`${classeCampo} min-w-0 flex-1`}
              />
              <Button
                variante="secundario"
                aria-controls={id('senha')}
                aria-pressed={senhaVisivel}
                onClick={() => setSenhaVisivel((v) => !v)}
              >
                Mostrar senha
              </Button>
            </div>
          </Campo>

          <div className="flex flex-col gap-1">
            <label className="flex min-h-toque items-center gap-2">
              <input
                {...register('manterConectado')}
                type="checkbox"
                disabled={terminalCompartilhado}
                aria-describedby={terminalCompartilhado ? id('manter-dica') : undefined}
                className="size-5"
              />
              Manter conectado
            </label>
            {terminalCompartilhado && (
              <p id={id('manter-dica')} className="text-secundario text-texto-secundario">
                Indisponível em terminal compartilhado.
              </p>
            )}
          </div>

          <div aria-live="assertive" aria-atomic="true">
            {mensagem && (
              <p className="flex items-start gap-1 rounded-md border border-erro p-3 text-erro">
                <span aria-hidden="true">⚠</span>
                <span>{mensagem}</span>
              </p>
            )}
          </div>

          <Button
            type="submit"
            disabled={!preenchido || login.isPending}
            aria-busy={login.isPending}
          >
            {login.isPending ? 'Entrando…' : 'Entrar'}
          </Button>
        </form>

        <p className="text-center text-secundario text-texto-secundario">
          Problemas para entrar? Procure a administração da unidade.
        </p>
      </div>
    </main>
  );
}
