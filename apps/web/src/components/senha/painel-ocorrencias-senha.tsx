'use client';

import { Button, EtiquetaStatus, Modal } from '@filas/ui';

import {
  type AusenciasApi,
  type RegistroAusencia,
  type SenhaOcorrencia,
} from '@/lib/ausencias/api';
import { type SenhaAusencias } from '@/lib/ausencias/consulta';

import { AcoesAusenciaDesistencia } from './acoes-ausencia-desistencia';

interface PainelOcorrenciasSenhaProps {
  api: AusenciasApi;
  senha: SenhaAusencias;
  aberto: boolean;
  onAbertoChange: (aberto: boolean) => void;
  onRegistrada: (senha: SenhaOcorrencia) => void;
  onAusenciaRegistrada: (registro: RegistroAusencia) => void;
  onAtualizar: () => void;
}

/** Parte de ocorrências do painel lateral W-08; reutilizável na integração com #41. */
export function PainelOcorrenciasSenha({
  api,
  senha,
  aberto,
  onAbertoChange,
  onRegistrada,
  onAusenciaRegistrada,
  onAtualizar,
}: PainelOcorrenciasSenhaProps) {
  return (
    <Modal
      aberto={aberto}
      onAbertoChange={onAbertoChange}
      titulo={`Detalhes da senha ${senha.numero}`}
      descricao="Consulte o status e registre ausência ou desistência quando a ação estiver disponível."
      lateral
    >
      <dl className="grid grid-cols-2 gap-3">
        <dt className="font-medium">Paciente</dt>
        <dd>{senha.pacienteIniciais}</dd>
        <dt className="font-medium">Especialidade</dt>
        <dd>{senha.especialidade}</dd>
        <dt className="font-medium">Status</dt>
        <dd>
          <EtiquetaStatus status={senha.status} />
        </dd>
      </dl>
      <AcoesAusenciaDesistencia
        api={api}
        senha={senha}
        onRegistrada={(atual) => {
          onRegistrada(atual);
          onAbertoChange(false);
        }}
        onAusenciaRegistrada={onAusenciaRegistrada}
        onAtualizar={onAtualizar}
      />
      <Button variante="secundario" onClick={() => onAbertoChange(false)}>
        Fechar detalhes
      </Button>
    </Modal>
  );
}
