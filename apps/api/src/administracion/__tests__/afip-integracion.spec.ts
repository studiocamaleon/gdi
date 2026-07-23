import { EstadoIntegracion } from '@prisma/client';
import { AfipIntegracionService } from '../afip-integracion.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { ConfiguracionFiscalService } from '../configuracion-fiscal.service';
import type { AfipSdkProvider } from '../invoicing/afip-sdk.provider';
import type { CurrentAuth } from '../../auth/auth.types';

/**
 * La integración AFIP: verificar la delegación y encender la facturación.
 *
 * Lo que se prueba es la lógica de decisión —qué prende el botón Facturar y
 * qué no—, con Prisma, la config fiscal y ARCA mockeados. La llamada real a
 * ARCA se prueba aparte; acá importa que:
 *  - sin CUIT o sin punto de venta ni se llama a ARCA (precondición),
 *  - activar sólo prende si la verificación pasa,
 *  - `facturacionHabilitada` es exactamente `estado === CONECTADA`.
 */

const AUTH = { tenantId: 't1', userId: 'u1', email: 'a@b.c' } as CurrentAuth;

function armar(opts: {
  cuit?: string | null;
  puntosVenta?: Array<{
    numero: number;
    numeroFormateado: string;
    activo: boolean;
  }>;
  disponible?: boolean;
  verificar?: { ok: boolean; numero: number | null; motivo?: string };
  filaEstado?: EstadoIntegracion | null;
}) {
  type UpsertArg = { update?: { estado?: EstadoIntegracion } };
  const upsert = jest.fn<Promise<unknown>, [UpsertArg]>().mockResolvedValue({});
  const update = jest.fn().mockResolvedValue({});
  const prisma = {
    integracionTenant: {
      findFirst: jest
        .fn()
        .mockResolvedValue(
          opts.filaEstado ? { id: 'i1', estado: opts.filaEstado } : null,
        ),
      upsert,
      update,
    },
  } as unknown as PrismaService;

  const configFiscal = {
    obtener: jest.fn().mockResolvedValue(
      opts.cuit === undefined && !opts.puntosVenta
        ? null
        : {
            cuit: opts.cuit ?? null,
            razonSocial: 'Demo SRL',
            condicionFiscal: 'RI',
            domicilioFiscal: 'Calle 1',
            puntosVenta: opts.puntosVenta ?? [],
          },
    ),
  } as unknown as ConfiguracionFiscalService;

  const verificarDelegacion = jest
    .fn()
    .mockResolvedValue(opts.verificar ?? { ok: true, numero: 0 });
  const afip = {
    get environment() {
      return 'prod' as const;
    },
    get disponible() {
      return opts.disponible ?? true;
    },
    verificarDelegacion,
  } as unknown as AfipSdkProvider;

  const svc = new AfipIntegracionService(prisma, configFiscal, afip);
  return { svc, upsert, update, verificarDelegacion };
}

const PV_OK = [{ numero: 1, numeroFormateado: '0001', activo: true }];

describe('AfipIntegracionService.verificar', () => {
  it('sin CUIT no llama a ARCA y explica qué falta', async () => {
    const { svc, verificarDelegacion } = armar({
      cuit: null,
      puntosVenta: PV_OK,
    });
    const r = await svc.verificar(AUTH);
    expect(r.ok).toBe(false);
    expect(r.motivo).toMatch(/CUIT/i);
    expect(verificarDelegacion).not.toHaveBeenCalled();
  });

  it('sin punto de venta tampoco llama a ARCA', async () => {
    const { svc, verificarDelegacion } = armar({
      cuit: '20111111112',
      puntosVenta: [],
    });
    const r = await svc.verificar(AUTH);
    expect(r.ok).toBe(false);
    expect(verificarDelegacion).not.toHaveBeenCalled();
  });

  it('con los datos, prueba contra ARCA y refleja el OK', async () => {
    const { svc, verificarDelegacion } = armar({
      cuit: '20111111112',
      puntosVenta: PV_OK,
      verificar: { ok: true, numero: 7 },
    });
    const r = await svc.verificar(AUTH);
    expect(verificarDelegacion).toHaveBeenCalledWith('20111111112', 1);
    expect(r).toMatchObject({
      ok: true,
      cuit: '20111111112',
      puntoVenta: 1,
      ultimoNumero: 7,
    });
  });

  it('si ARCA rechaza, devuelve el motivo y no está ok', async () => {
    const { svc } = armar({
      cuit: '20111111112',
      puntosVenta: PV_OK,
      verificar: { ok: false, numero: null, motivo: 'CUIT no autorizado' },
    });
    const r = await svc.verificar(AUTH);
    expect(r.ok).toBe(false);
    expect(r.motivo).toBe('CUIT no autorizado');
  });

  it('elige el primer punto de venta ACTIVO', async () => {
    const { svc, verificarDelegacion } = armar({
      cuit: '20111111112',
      puntosVenta: [
        { numero: 9, numeroFormateado: '0009', activo: false },
        { numero: 3, numeroFormateado: '0003', activo: true },
      ],
    });
    await svc.verificar(AUTH);
    expect(verificarDelegacion).toHaveBeenCalledWith('20111111112', 3);
  });
});

describe('AfipIntegracionService.activar', () => {
  it('si la verificación pasa, deja CONECTADA', async () => {
    const { svc, upsert } = armar({
      cuit: '20111111112',
      puntosVenta: PV_OK,
      verificar: { ok: true, numero: 0 },
    });
    await svc.activar(AUTH);
    const estados = upsert.mock.calls
      .map((c) => c[0].update?.estado)
      .filter(Boolean);
    expect(estados).toContain(EstadoIntegracion.CONECTADA);
  });

  it('si la verificación falla, deja ERROR y NO conecta', async () => {
    const { svc, upsert } = armar({
      cuit: '20111111112',
      puntosVenta: PV_OK,
      verificar: { ok: false, numero: null, motivo: 'no delegado' },
    });
    await svc.activar(AUTH);
    const estados = upsert.mock.calls
      .map((c) => c[0].update?.estado)
      .filter(Boolean);
    expect(estados).toContain(EstadoIntegracion.ERROR);
    expect(estados).not.toContain(EstadoIntegracion.CONECTADA);
  });
});

describe('AfipIntegracionService.facturacionHabilitada', () => {
  it('es true sólo con la integración CONECTADA', async () => {
    const conectada = armar({ filaEstado: EstadoIntegracion.CONECTADA });
    await expect(conectada.svc.facturacionHabilitada()).resolves.toBe(true);

    const error = armar({ filaEstado: EstadoIntegracion.ERROR });
    await expect(error.svc.facturacionHabilitada()).resolves.toBe(false);

    const sinFila = armar({ filaEstado: null });
    await expect(sinFila.svc.facturacionHabilitada()).resolves.toBe(false);
  });
});
