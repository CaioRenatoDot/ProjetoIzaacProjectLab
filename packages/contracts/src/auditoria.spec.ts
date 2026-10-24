import { describe, expect, it } from 'vitest';

import { ConsultarAuditoriaQuery, ExportarAuditoriaQuery, ModuloAuditoria } from './index';

describe('trilha de auditoria', () => {
  it('módulos: catálogo de permissões e auth', () => {
    expect(ModuloAuditoria.safeParse('auth').success).toBe(true);
    expect(ModuloAuditoria.safeParse('triagem').success).toBe(true);
    expect(ModuloAuditoria.safeParse('financeiro').success).toBe(false);
  });

  it('consulta recusa período invertido', () => {
    expect(
      ConsultarAuditoriaQuery.safeParse({
        de: '2026-10-20T00:00:00-03:00',
        ate: '2026-10-01T00:00:00-03:00',
      }).success,
    ).toBe(false);
  });

  it('exportação exige o período e no máximo 366 dias', () => {
    expect(ExportarAuditoriaQuery.safeParse({}).success).toBe(false);
    expect(
      ExportarAuditoriaQuery.safeParse({
        de: '2024-01-01T00:00:00-03:00',
        ate: '2026-01-01T00:00:00-03:00',
      }).success,
    ).toBe(false);
    expect(
      ExportarAuditoriaQuery.safeParse({
        de: '2026-01-01T00:00:00-03:00',
        ate: '2026-10-01T00:00:00-03:00',
        operacao: 'LOGIN',
      }).success,
    ).toBe(true);
  });
});
