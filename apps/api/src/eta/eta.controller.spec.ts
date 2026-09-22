import { EtaController } from './eta.controller';
import { EtaService } from './eta.service';
import type { CurrentAuth } from '../auth/auth.types';
import { PERMISO_KEY } from '../auth/permiso.decorator';

describe('contexto de previsión comercial', () => {
  it('actualizar el registro diario exige supervisión y no informa éxito si el plan lo impide', async () => {
    expect(
      // Referencia al handler para inspeccionar su permiso, sin invocarlo.
      // eslint-disable-next-line @typescript-eslint/unbound-method
      Reflect.getMetadata(PERMISO_KEY, EtaController.prototype.snapshot),
    ).toEqual(['produccion.supervisar']);
    const snapshotDiario = jest.fn().mockResolvedValue(false);
    const controller = new EtaController({
      snapshotDiario,
    } as unknown as EtaService);
    await expect(
      controller.snapshot({ tenantId: 'empresa' } as CurrentAuth),
    ).resolves.toEqual({ ok: false });
  });
  it('obtiene el reloj y el contexto del tenant de la sesión, serializando calendarios', async () => {
    const contextoSimulacion = jest.fn().mockResolvedValue({
      items: [],
      estaciones: [],
      ahora: new Date('2026-09-10T01:30:00Z'),
      zona: 'America/Argentina/Buenos_Aires',
      margenEtaDias: 1,
      tiempoEntrePasosMin: 5,
      medianas: new Map([['corte', 30]]),
      noLaborables: new Set(['2026-09-21']),
    });
    const controller = new EtaController({
      contextoSimulacion,
    } as unknown as EtaService);
    const r = await controller.contextoPrevision({
      tenantId: 'tenant-autenticado',
    } as CurrentAuth);
    expect(contextoSimulacion).toHaveBeenCalledWith('tenant-autenticado');
    expect(r).toMatchObject({
      ahora: '2026-09-10T01:30:00.000Z',
      margenEtaDias: 1,
      tiempoEntrePasosMin: 5,
      medianas: [['corte', 30]],
      noLaborables: ['2026-09-21'],
    });
  });
});
