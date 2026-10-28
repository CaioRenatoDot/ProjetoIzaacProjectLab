-- Um alerta aberto de cada origem por fila, mesmo sob rotinas concorrentes (RF-11, RN-10).
CREATE UNIQUE INDEX alerta_fila_tipo_aberto_key ON alerta (fila_id, tipo)
  WHERE status IN ('ATIVO', 'RECONHECIDO');
