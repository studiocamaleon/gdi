import { claveFechaEnZona } from '../../common/zona';
import {
  fechaValidezPresupuesto,
  idempotenciaConversionPresupuesto,
} from '../presupuestos.service';

describe('invariantes del ciclo de presupuestos', () => {
  it('la validez termina al final del día comercial y no a la hora de emisión', () => {
    const zona = 'America/Argentina/Buenos_Aires';
    const vence = fechaValidezPresupuesto(
      new Date('2026-08-16T20:37:00.000Z'),
      15,
      zona,
    );
    expect(claveFechaEnZona(vence, zona)).toBe('2026-08-31');
    expect(claveFechaEnZona(new Date(vence.getTime() + 1), zona)).toBe(
      '2026-09-01',
    );
  });

  it('la aritmética de validez respeta otra zona y cruces de mes', () => {
    const zona = 'America/Tegucigalpa';
    const vence = fechaValidezPresupuesto(
      new Date('2026-02-27T23:00:00.000Z'),
      3,
      zona,
    );
    expect(claveFechaEnZona(vence, zona)).toBe('2026-03-02');
  });

  it('una misma selección produce una clave idempotente estable', () => {
    const cotizacion = '89311f21-9bb2-457f-90af-04bb5235628e';
    const a = '11111111-1111-4111-a111-111111111111';
    const b = '22222222-2222-4222-a222-222222222222';
    const primera = idempotenciaConversionPresupuesto(cotizacion, [a, b]);
    expect(idempotenciaConversionPresupuesto(cotizacion, [b, a])).toBe(primera);
    expect(primera).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(idempotenciaConversionPresupuesto(cotizacion, [a])).not.toBe(
      primera,
    );
  });
});
