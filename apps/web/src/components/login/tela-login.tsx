'use client';

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

  const saudacao = useSaudacao();
  const erroIdentificacao = errors.identificacao?.message;
  const erroSenha = errors.senha?.message;

  return (
    <main className="flex min-h-screen bg-superficie-elevada bg-[radial-gradient(circle_at_80%_10%,rgba(29,78,216,0.10),transparent_45%),radial-gradient(circle_at_20%_90%,rgba(14,165,233,0.10),transparent_40%)]">
      <PainelMarca />

      <div className="flex flex-1 items-center justify-center p-4 md:p-8">
        <div className="flex w-full max-w-md flex-col gap-6 rounded-3xl border border-white/60 bg-superficie/90 p-6 shadow-xl shadow-[#0f172a]/10 backdrop-blur md:p-10 motion-safe:animate-[surgir_400ms_ease-out]">
          <header className="flex items-center gap-3 lg:hidden">
            <Marca className="size-11" />
            <div>
              <p className="text-secao font-semibold">Clínica-Escola</p>
              <p className="text-secundario text-texto-secundario">Sistema de Gestão de Filas</p>
            </div>
          </header>

          <div className="flex flex-col gap-1">
            <p className="text-texto-secundario" suppressHydrationWarning>
              {saudacao}
            </p>
            <h1 className="text-pagina font-semibold">Entrar</h1>
            <p className="text-texto-secundario">Use a sua conta da unidade para continuar.</p>
          </div>

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
                className={CAMPO}
              />
            </Campo>

            <Campo id={id('senha')} rotulo="Senha" obrigatorio erro={erroSenha}>
              <div className="relative">
                <input
                  {...atributosCampo(id('senha'), { erro: erroSenha })}
                  {...register('senha')}
                  type={senhaVisivel ? 'text' : 'password'}
                  autoComplete="current-password"
                  aria-required="true"
                  className={`${CAMPO} pr-14`}
                />
                <button
                  type="button"
                  aria-label="Mostrar senha"
                  aria-controls={id('senha')}
                  aria-pressed={senhaVisivel}
                  title={senhaVisivel ? 'Ocultar senha' : 'Mostrar senha'}
                  onClick={() => setSenhaVisivel((v) => !v)}
                  className="absolute top-1/2 right-1.5 flex size-11 -translate-y-1/2 items-center justify-center rounded-lg text-texto-secundario transition hover:bg-superficie-hover hover:text-texto focus-visible:ring-4 focus-visible:ring-[#1d4ed8]/30 focus-visible:outline-none active:scale-90 aria-pressed:text-[#1d4ed8]"
                >
                  <IconeOlho fechado={!senhaVisivel} />
                </button>
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

            <button
              type="submit"
              className="flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#1d4ed8] to-[#1e3a8a] px-4 font-semibold text-texto-invertido shadow-md shadow-[#1d4ed8]/25 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#1d4ed8]/30 focus-visible:ring-4 focus-visible:ring-[#1d4ed8]/40 focus-visible:outline-none active:translate-y-0 disabled:cursor-not-allowed disabled:from-[#64748b] disabled:to-[#475569] disabled:shadow-none disabled:hover:translate-y-0 motion-reduce:transition-none"
              disabled={!preenchido || login.isPending}
              aria-busy={login.isPending}
            >
              {login.isPending ? 'Entrando…' : 'Entrar'}
            </button>
          </form>

          <p className="text-center text-secundario text-texto-secundario">
            Problemas para entrar? Procure a administração da unidade.
          </p>
        </div>
      </div>
    </main>
  );
}

/** Logotipo: uma senha de atendimento com o recorte lateral de bilhete. Decorativo. */
function Marca({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className={className}>
      <rect width="48" height="48" rx="12" fill="#1d4ed8" />
      <path
        d="M12 15a3 3 0 0 1 3-3h18a3 3 0 0 1 3 3v5a4 4 0 0 0 0 8v5a3 3 0 0 1-3 3H15a3 3 0 0 1-3-3v-5a4 4 0 0 0 0-8z"
        fill="#ffffff"
      />
      <path
        d="M19 20h10M19 24h10M19 28h6"
        stroke="#1d4ed8"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

const FILA_ILUSTRATIVA = [
  { numero: 'F014', texto: 'Chamada · Sala 03', destaque: true },
  { numero: 'N102', texto: 'Preferencial · aguardando' },
  { numero: 'P007', texto: 'Aguardando' },
];

/** Painel de marca a partir de 1024 px. A fila é ilustração, sem dado real (RNF-07). */
function PainelMarca() {
  return (
    <aside
      aria-hidden="true"
      className="relative hidden w-[44%] max-w-xl flex-col justify-between overflow-hidden bg-primaria p-12 text-texto-invertido lg:flex"
    >
      <div className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-[#1d4ed8] opacity-30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-16 size-80 rounded-full bg-[#0ea5e9] opacity-20 blur-3xl" />

      <div className="relative flex items-center gap-3">
        <Marca className="size-12" />
        <div>
          <p className="text-secao font-semibold">Clínica-Escola</p>
          <p className="text-[#cbd5e1]">Sistema de Gestão de Filas</p>
        </div>
      </div>

      <div className="relative flex flex-col gap-6">
        <p className="text-[2rem] leading-tight font-semibold">
          Cada paciente no seu tempo, cada atendimento no seu lugar.
        </p>
        <ul className="flex flex-col gap-3">
          {FILA_ILUSTRATIVA.map((senha) => (
            <li
              key={senha.numero}
              className={`flex items-center gap-4 rounded-xl border px-4 py-3 ${senha.destaque ? 'border-[#60a5fa] bg-white/10' : 'border-white/15 bg-white/5'}`}
            >
              <span className="font-mono text-secao font-semibold tracking-wider">
                {senha.numero}
              </span>
              <span className="text-[#cbd5e1]">{senha.texto}</span>
              {senha.destaque && (
                <span className="ml-auto size-2.5 rounded-full bg-[#4ade80] motion-safe:animate-pulse" />
              )}
            </li>
          ))}
        </ul>
      </div>

      <p className="relative text-secundario text-[#cbd5e1]">
        Triagem, chamada, atendimento e encaminhamento em um só lugar.
      </p>
    </aside>
  );
}

/** Campo da tela de login: mais alto e arredondado, com anel de foco e borda de erro (3:1). */
const CAMPO =
  'h-12 w-full rounded-xl border border-borda bg-superficie px-4 text-texto transition placeholder:text-texto-secundario hover:border-texto-secundario focus-visible:border-[#1d4ed8] focus-visible:ring-4 focus-visible:ring-[#1d4ed8]/20 focus-visible:outline-none aria-invalid:border-2 aria-invalid:border-erro';

/** Saudação pelo horário local; calculada no cliente para não divergir do servidor. */
function useSaudacao() {
  const [saudacao, setSaudacao] = useState('Olá!');
  useEffect(() => {
    const hora = new Date().getHours();
    setSaudacao(hora < 12 ? 'Bom dia!' : hora < 18 ? 'Boa tarde!' : 'Boa noite!');
  }, []);
  return saudacao;
}

/** Olho que se fecha: o traço se desenha e a pupila encolhe (sem movimento se o sistema pedir). */
function IconeOlho({ fechado }: { fechado: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle
        cx="12"
        cy="12"
        r="3"
        className={`origin-center transition-transform duration-300 motion-reduce:transition-none ${fechado ? 'scale-50' : 'scale-100'}`}
      />
      <path
        d="M4 4l16 16"
        strokeDasharray="23"
        strokeDashoffset={fechado ? 0 : 23}
        className="transition-[stroke-dashoffset] duration-300 ease-out motion-reduce:transition-none"
      />
    </svg>
  );
}
