import { FidelizacionController } from './fidelizacion.controller';
import type { FidelizacionService } from './fidelizacion.service';
import type { CurrentAuth } from '../auth/auth.types';
import { expandir } from '../auth/permisos';

describe('Canje sin acceso a costos', () => {
  const simular = jest.fn(async (..._args: unknown[]) => ({
    puntosEstimados: 15,
    puntosEstimadosMonto: 150,
    canjePuntos: 5,
    canjeMonto: 50,
    snapshot: { porcentajeMargen: 8 },
  }));
  const controller = new FidelizacionController({
    simular,
  } as unknown as FidelizacionService);
  const auth = (extras: string[] = []) =>
    ({
      tenantId: 'empresa-ficticia',
      permisos: expandir([
        'acceso.por_vista',
        'comercial.ordenes.gestionar',
        ...extras,
      ]),
    }) as CurrentAuth;
  beforeEach(() => simular.mockClear());
  it('permite calcular el canje sin recibir margen y deja la acumulación sin estimación', async () => {
    const res = await controller.simular(auth(), 'cliente-ficticio', {
      total: 1000,
      canjePuntos: 5,
    });
    expect(simular).toHaveBeenCalledWith(
      'empresa-ficticia',
      'cliente-ficticio',
      0,
      1000,
      5,
    );
    expect(res).toEqual({
      puntosEstimados: null,
      puntosEstimadosMonto: null,
      canjePuntos: 5,
      canjeMonto: 50,
    });
  });
  it('un valor enviado manualmente no permite inferir la configuración de margen', async () => {
    const res = await controller.simular(auth(), 'cliente-ficticio', {
      margen: 999999,
      total: 1000,
    });
    expect(res).not.toHaveProperty('snapshot');
    expect(res.puntosEstimados).toBeNull();
    expect(simular.mock.calls[0][2]).toBe(0);
  });
  it('con el permiso financiero conserva la estimación sin enviar configuración interna', async () => {
    const res = await controller.simular(
      auth(['finanzas.ver_margenes']),
      'cliente-ficticio',
      { margen: 400, total: 1000 },
    );
    expect(res.puntosEstimados).toBe(15);
    expect(res).not.toHaveProperty('snapshot');
  });
});
