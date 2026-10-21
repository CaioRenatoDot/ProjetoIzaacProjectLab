import { useEffect, useState } from 'react';

const CHAVE = 'filas-aviso-consulta-registrada';

/**
 * Aviso de que consultas a dado clínico são registradas, exibido uma vez por sessão (§3.4, RNF-07).
 * A sessão chama `reiniciarAvisoConsulta` ao entrar e ao sair, então o aviso reaparece a cada login.
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

export function reiniciarAvisoConsulta() {
  try {
    window.sessionStorage.removeItem(CHAVE);
  } catch {
    // Sem storage disponível, não há o que reiniciar.
  }
}
