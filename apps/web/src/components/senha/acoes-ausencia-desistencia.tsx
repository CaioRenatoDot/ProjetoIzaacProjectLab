'use client';

import { Button, useConexao, usePermissoes, useToast } from '@filas/ui';
import { useState } from 'react';

import {
  type AusenciasApi,
  type RegistroAusencia,
  type SenhaOcorrencia,
} from '@/lib/ausencias/api';

import { ModalOcorrencia } from './modal-ocorrencia';
import { NotificacaoAusencia } from './notificacao-ausencia';

export interface AcoesAusenciaDesistenciaProps {
  api: AusenciasApi;
  senha: SenhaOcorrencia;
  onRegistrada: (senha: SenhaOcorrencia) => void;
  onAtualizar: () => void;
}

/** Ações para o painel lateral de W-08 (#41). O servidor continua validando as transições. */
export function AcoesAusenciaDesistencia({
  api,
  senha,
  onRegistrada,
  onAtualizar,
}: AcoesAusenciaDesistenciaProps) {
  const { tem } = usePermissoes();
  const { podeEscrever } = useConexao();
  const toast = useToast();
  const [modal, setModal] = useState<'ausencia' | 'desistencia' | null>(null);
  const [registro, setRegistro] = useState<RegistroAusencia | null>(null);
  const autorizada = tem('ausencia:criar');
  const podeAusencia = senha.status === 'CHAMADA';
  const podeDesistencia = senha.status === 'AGUARDANDO' || senha.status === 'EM_ATENDIMENTO';

  return (
    <div className="flex flex-col gap-3">
      {autorizada && podeAusencia && (
        <Button variante="destrutivo" disabled={!podeEscrever} onClick={() => setModal('ausencia')}>
          Registrar ausência
        </Button>
      )}
      {autorizada && podeDesistencia && (
        <Button
          variante="destrutivo"
          disabled={!podeEscrever}
          onClick={() => setModal('desistencia')}
        >
          Registrar desistência
        </Button>
      )}
      <NotificacaoAusencia registro={registro} />
      {modal && (
        <ModalOcorrencia
          key={`${senha.id}-${senha.versao}-${modal}`}
          api={api}
          senha={senha}
          variante={modal}
          aberto
          onAbertoChange={(aberto) => {
            if (!aberto) setModal(null);
          }}
          onAtualizar={onAtualizar}
          onRegistrada={(resultado) => {
            setModal(null);
            if ('automatica' in resultado) setRegistro(resultado);
            else
              toast({
                tipo: 'sucesso',
                mensagem: `Desistência da senha ${senha.numero} registrada. A senha saiu da fila ativa.${resultado.recursosLiberados ? ' Os recursos alocados foram liberados.' : ''}`,
              });
            onRegistrada(resultado.senha);
          }}
        />
      )}
    </div>
  );
}
