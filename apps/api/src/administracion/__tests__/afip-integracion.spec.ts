import { EstadoIntegracion } from '@prisma/client';
import { AfipIntegracionService } from '../afip-integracion.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { ConfiguracionFiscalService } from '../configuracion-fiscal.service';
import type { AfipSdkProvider } from '../invoicing/afip-sdk.provider';
import type { SuscripcionesService } from '../../suscripciones/suscripciones.service';
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
  /** ¿El plan incluye AFIP? Default true (tenant legacy / plan con AFIP). */
  planAfip?: boolean;
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

  const suscripciones = {
    feature: jest.fn().mockResolvedValue(opts.planAfip ?? true),
  } as unknown as SuscripcionesService;

  const svc = new AfipIntegracionService(
    prisma,
    configFiscal,
    afip,
    suscripciones,
  );
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

  it('un downgrade corta la facturación aunque la delegación siga verificada', async () => {
    const { svc } = armar({
      filaEstado: EstadoIntegracion.CONECTADA,
      planAfip: false,
    });
    await expect(svc.facturacionHabilitada()).resolves.toBe(false);
  });
});

describe('AfipIntegracionService — gate por plan (etapa B)', () => {
  it('activar rechaza si el plan no incluye AFIP, sin llamar a ARCA', async () => {
    const { svc, verificarDelegacion, upsert } = armar({
      cuit: '20111111112',
      puntosVenta: PV_OK,
      planAfip: false,
    });
    await svc.activar(AUTH);
    // No se verificó delegación: el motivo es comercial, no técnico.
    expect(verificarDelegacion).not.toHaveBeenCalled();
    const estados = upsert.mock.calls
      .map((c) => c[0].update?.estado)
      .filter(Boolean);
    expect(estados).not.toContain(EstadoIntegracion.CONECTADA);
  });

  it('con el plan que lo incluye, activar sigue el camino normal', async () => {
    const { svc, upsert } = armar({
      cuit: '20111111112',
      puntosVenta: PV_OK,
      verificar: { ok: true, numero: 0 },
      planAfip: true,
    });
    await svc.activar(AUTH);
    const estados = upsert.mock.calls
      .map((c) => c[0].update?.estado)
      .filter(Boolean);
    expect(estados).toContain(EstadoIntegracion.CONECTADA);
  });
});

describe('AfipIntegracionService.obtener — CUIT propio', () => {
  const REPRESENTANTE = '30717654321';
  // Con `await` adentro: en un `return fn()` sin await, el finally corre con
  // la promesa PENDIENTE y restaura el env antes de que el servicio lo lea.
  // Así este test pasaba o fallaba según qué .env hubiera cargado Prisma en
  // el worker — determinista sólo de casualidad.
  const conRepresentante = async <T>(fn: () => Promise<T>): Promise<T> => {
    const antes = process.env.AFIP_REPRESENTANTE_CUIT;
    process.env.AFIP_REPRESENTANTE_CUIT = REPRESENTANTE;
    try {
      return await fn();
    } finally {
      if (antes === undefined) delete process.env.AFIP_REPRESENTANTE_CUIT;
      else process.env.AFIP_REPRESENTANTE_CUIT = antes;
    }
  };

  it('marca esCuitPropio cuando el emisor factura con el CUIT del certificado', async () => {
    await conRepresentante(async () => {
      const { svc } = armar({ cuit: '30717654321', puntosVenta: PV_OK });
      const dto = await svc.obtener(AUTH);
      expect(dto.esCuitPropio).toBe(true);
    });
  });

  it('compara por dígitos: da igual que uno venga con guiones', async () => {
    await conRepresentante(async () => {
      const { svc } = armar({ cuit: '30-71765432-1', puntosVenta: PV_OK });
      const dto = await svc.obtener(AUTH);
      expect(dto.esCuitPropio).toBe(true);
    });
  });

  it('un tenant de tercero NO es CUIT propio', async () => {
    await conRepresentante(async () => {
      const { svc } = armar({ cuit: '20111111112', puntosVenta: PV_OK });
      const dto = await svc.obtener(AUTH);
      expect(dto.esCuitPropio).toBe(false);
    });
  });
});
