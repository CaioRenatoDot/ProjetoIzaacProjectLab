'use client';

import { Button, EstadoCarregando, EstadoErro, PainelLateral } from '@filas/ui';
import { useQuery } from '@tanstack/react-query';
import { type ReactNode } from 'react';

import { ErroApi } from '@/lib/api/cliente-http';
import { formatarDataHora, ROTULO_OPERACAO, rotuloModulo } from '@/lib/auditoria/consulta';
import { type EventoAuditoria, type EventoAuditoriaDetalhe } from '@/lib/auditoria/tipos';
import { useSessao } from '@/lib/sessao/sessao';

import { MarcaSensivel } from './marca-sensivel';

export interface DetalheEventoProps {
  evento: EventoAuditoria | null;
  onFechar: () => void;
  onFiltrarRegistro: (entidadeId: string) => void;
}

/** Painel de detalhe da T-18. Somente leitura: nenhum evento pode ser editado ou excluído. */
export function DetalheEvento({ evento, onFechar, onFiltrarRegistro }: DetalheEventoProps) {
  return (
    <PainelLateral
      aberto={evento !== null}
      onAbertoChange={(aberto) => !aberto && onFechar()}
      titulo="Detalhe do evento"
      descricao={evento ? `${evento.descricao}, em ${formatarDataHora(evento.ocorridoEm)}.` : ''}
    >
      {evento && <Conteudo evento={evento} onFiltrarRegistro={onFiltrarRegistro} />}
    </PainelLateral>
  );
}

function Conteudo({
  evento,
  onFiltrarRegistro,
}: {
  evento: EventoAuditoria;
  onFiltrarRegistro: (entidadeId: string) => void;
}) {
  const { cliente } = useSessao();
  const detalhe = useQuery({
    queryKey: ['auditoria', 'evento', evento.id],
    queryFn: () => cliente.requisitar<EventoAuditoriaDetalhe>(`/auditoria/${evento.id}`),
    // Registro de auditoria nunca muda depois de gravado.
    staleTime: Infinity,
  });

  if (detalhe.isPending) return <EstadoCarregando linhas={6} rotulo="Carregando o evento" />;
  if (detalhe.isError) {
    const semPermissao = detalhe.error instanceof ErroApi && detalhe.error.status === 403;
    return (
      <EstadoErro
        mensagem={
          semPermissao
            ? 'Seu perfil não tem acesso a este conteúdo.'
            : 'Não foi possível carregar o evento. Verifique a conexão e tente novamente.'
        }
        onTentarNovamente={() => void detalhe.refetch()}
      />
    );
  }

  const e = detalhe.data;
  const registro = e.entidadeId;
  return (
    <div className="flex flex-col gap-6">
      {e.sensivel && <MarcaSensivel />}
      <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-[auto_1fr]">
        <Item rotulo="Usuário">{e.usuarioNome}</Item>
        <Item rotulo="Perfil no momento da ação">{e.perfilNoMomento}</Item>
        <Item rotulo="Operação">{ROTULO_OPERACAO[e.operacao]}</Item>
        <Item rotulo="Data e hora">{formatarDataHora(e.ocorridoEm)}</Item>
        <Item rotulo="Módulo">{rotuloModulo(e.modulo)}</Item>
        <Item rotulo="Registro afetado">
          {e.entidadeId ? (
            <>
              {e.entidade} <span className="font-mono break-all">{e.entidadeId}</span>
            </>
          ) : (
            'Nenhum registro específico'
          )}
        </Item>
        <Item rotulo="Descrição">{e.descricao}</Item>
        {e.justificativa && <Item rotulo="Justificativa informada">{e.justificativa}</Item>}
      </dl>

      <section aria-labelledby="origem-acesso" className="flex flex-col gap-2">
        <h3 id="origem-acesso" className="font-semibold">
          Origem do acesso
        </h3>
        <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-[auto_1fr]">
          <Item rotulo="Endereço IP">{e.origemIp}</Item>
          <Item rotulo="Navegador">{e.userAgent}</Item>
          <Item rotulo="Identificador da requisição">
            <span className="font-mono break-all">{e.requestId}</span>
          </Item>
        </dl>
      </section>

      {registro && (
        <Button variante="secundario" onClick={() => onFiltrarRegistro(registro)}>
          Filtrar por este registro
        </Button>
      )}
    </div>
  );
}

function Item({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="contents">
      <dt className="font-medium">{rotulo}</dt>
      <dd className="break-words text-texto-secundario">{children}</dd>
    </div>
  );
}
