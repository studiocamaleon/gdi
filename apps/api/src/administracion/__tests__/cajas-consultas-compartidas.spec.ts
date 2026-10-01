import { randomUUID } from 'node:crypto';
import { ForbiddenException } from '@nestjs/common';
import { EgresosService } from '../../egresos/egresos.service';
import { CobranzaService } from '../../reportes/cobranza.service';
import type { CurrentAuth } from '../../auth/auth.types';

describe('Las cajas asignadas también se respetan fuera de Tesorería', () => {
  const propia = randomUUID(),
    otra = randomUUID();
  const auth = { tenantId: randomUUID(), userId: randomUUID() } as CurrentAuth;
  function caso() {
    const db = {
      membership: {
        findFirst: jest.fn().mockResolvedValue({
          cuentasRestringidas: true,
          cuentasOperablesIds: [propia],
          cuentasDestinoIds: [otra],
        }),
      },
      datosEmpresa: { findUnique: jest.fn().mockResolvedValue(null) },
      egreso: { findMany: jest.fn().mockResolvedValue([]) },
      cuentaFondos: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { saldo: 100 } }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      pago: {
        findFirst: jest.fn().mockResolvedValue({ cuentaOrigenId: otra }),
      },
      pagoImputacion: {
        findMany: jest.fn().mockResolvedValue([
          {
            monto: 100,
            pago: {
              id: randomUUID(),
              fecha: new Date(),
              cuentaOrigenId: otra,
              cuentaOrigen: { nombre: 'Caja privada' },
              metodoPago: { nombre: 'Efectivo' },
            },
          },
        ]),
      },
      ordenTrabajo: { findMany: jest.fn().mockResolvedValue([]) },
      valor: { findMany: jest.fn().mockResolvedValue([]) },
      $queryRaw: jest.fn().mockResolvedValue([]),
    };
    const pdf = { render: jest.fn() },
      empresa = { paraDocumentos: jest.fn() };
    return {
      db,
      pdf,
      empresa,
      egresos: new EgresosService(
        db as never,
        empresa as never,
        {} as never,
        pdf as never,
      ),
      cobranza: new CobranzaService(db as never),
    };
  }
  it('el resumen de egresos suma únicamente los saldos de las cuentas operables', async () => {
    const c = caso();
    await c.egresos.resumen(auth);
    expect(c.db.cuentaFondos.aggregate).toHaveBeenCalledWith({
      where: { tenantId: auth.tenantId, activo: true, id: { in: [propia] } },
      _sum: { saldo: true },
    });
  });
  it('los pagos conservan su importe pero ocultan la cuenta ajena y su PDF', async () => {
    const c = caso();
    const r = await c.egresos.pagosDeEgreso(auth, randomUUID());
    expect(r.pagos[0]).toMatchObject({
      monto: 100,
      cuentaNombre: 'Cuenta no asignada',
      puedeAbrirComprobante: false,
    });
    await expect(c.egresos.ordenDePagoPdf(auth, r.pagos[0].id)).rejects.toThrow(
      ForbiddenException,
    );
    expect(c.empresa.paraDocumentos).not.toHaveBeenCalled();
    expect(c.pdf.render).not.toHaveBeenCalled();
  });
  it('un informe financiero no lista cajas ni saldos fuera del alcance personal', async () => {
    const c = caso();
    await c.cobranza.finanzas(auth, {
      desde: new Date('2026-01-01'),
      hasta: new Date('2026-01-31'),
    } as never);
    expect(c.db.cuentaFondos.findMany).toHaveBeenCalledWith({
      where: { tenantId: auth.tenantId, id: { in: [propia] } },
      select: { nombre: true, saldo: true },
      orderBy: { nombre: 'asc' },
    });
  });
});
