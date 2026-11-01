import { useEffect, useState } from 'react';

import { PREFIXO_ESTADO_LOCAL } from '@/lib/sessao/estado-local';

const CHAVE = `${PREFIXO_ESTADO_LOCAL}aviso-consulta-registrada`;

/**
 * Aviso de que consultas a dado clínico são registradas, exibido uma vez por sessão (§3.4, RNF-07).
 * A sessão apaga a chave ao entrar e ao sair (`limparEstadoLocal`), então o aviso reaparece a cada login.
 */
export function useAvisoConsultaRegistrada() {
  const [exibir, setExibir] = useState(false);

  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(CHAVE) === null) {
        window.sessionStorage.setItem(CHAVE, '1');
        setExibir(true);
      }
    } catch {
      // Sem storage disponível, o aviso aparece a cada abertura da ficha.
      setExibir(true);
    }
  }, []);

  return exibir;
}
