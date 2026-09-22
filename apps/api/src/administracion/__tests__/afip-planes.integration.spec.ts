import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { conPlanesAsignados } from '../../../test/soporte-planes-asignados';
import { PROPUESTA_PLANES } from '../../plataforma/planes/catalogo-planes';
import { runWithTenant } from '../../common/tenant-context';
import { CapacidadesEmpresaService } from '../../suscripciones/capacidades-empresa.service';
import { ConfiguracionFiscalService } from '../configuracion-fiscal.service';
import { AfipIntegracionService } from '../afip-integracion.service';
import type { AfipSdkProvider } from '../invoicing/afip-sdk.provider';
import { IntegracionesService } from '../../integraciones/integraciones.service';

const prisma = new PrismaService();
afterAll(() => prisma.$disconnect());
type Contexto = Parameters<Parameters<typeof conPlanesAsignados>[1]>[0];
const denegada = { response: { code: 'CAPACIDAD_NO_DISPONIBLE' } };
const pendiente = { response: { code: 'CAMBIO_PLAN_PENDIENTE' } };

async function preparar(c: Contexto, indice = 0) {
  const tenant = await c.tx.tenant.create({
    data: { nombre: 'ARCA de ensayo', slug: `arca-${randomUUID()}` },
  });
  const tenantId = tenant.id;
  const auth = { ...c.auth, tenantId };
  const plan = await c.tx.plan.create({
    data: {
      codigo: randomUUID(),
      nombre: 'Contrato fiscal',
      precioMensual: 190,
      featuresJson: { afip: true },
    },
  });
  await c.tx.suscripcion.create({
    data: {
      tenantId,
      planId: plan.id,
      planVersionId: c.versiones[indice].id,
      estado: 'activa',
      proveedor: 'manual',
    },
  });
  const contenido = structuredClone(PROPUESTA_PLANES[0].contenido);
  contenido.funciones.fiscal_argentina = false;
  contenido.almacenamientoModo = 'limitado';
  contenido.almacenamientoGb = 250;
  const sinFiscal = await c.publicar(contenido);
  const config = new ConfiguracionFiscalService(c.db);
  const datos = {
    razonSocial: 'Prueba SA',
    cuit: '30000000015',
    condicionFiscal: 'RI' as const,
    proveedorFacturacion: 'manual' as const,
  };
  const emisor = await config.guardar(auth, datos);
  const pv = await config.crearPuntoVenta(auth, {
    numero: 1,
    nombre: 'Prueba',
  });
  const verificarDelegacion = jest.fn(() =>
    Promise.resolve({ ok: true, numero: 7 }),
  );
  const provider = {
    disponible: true,
    environment: 'dev',
    verificarDelegacion,
  } as unknown as AfipSdkProvider;
  const svc = new AfipIntegracionService(
    c.db,
    config,
    provider,
    new CapacidadesEmpresaService(c.db),
  );
  const cambiarVersion = (versionId: string) =>
    c.tx.suscripcion.update({
      where: { tenantId },
      data: { planVersionId: versionId },
    });
  const retirar = () => cambiarVersion(sinFiscal.id);
  const fila = () =>
    c.tx.integracionTenant.findFirst({
      where: { tenantId, proveedor: 'AFIP' },
    });
  const iniciarCambio = async (versionId = sinFiscal.id) => {
    const oferta = await c.tx.planOferta.create({
      data: {
        planId: plan.id,
        versionId,
        entorno: 'sandbox',
        registroPublico: false,
        recomendado: false,
        creadaPorId: auth.userId,
        motivo: 'Prueba de continuidad ARCA',
      },
    });
    return c.tx.planContratacion.create({
      data: {
        tenantId,
        userId: auth.userId,
        ofertaId: oferta.id,
        ciclo: 'mensual',
        adicionales: 0,
        tipo: 'checkout',
        estado: 'verificar',
        huella: 'ensayo',
        revisionContrato: 0,
        revisionJson: {},
        cobroJson: {},
        expiraEl: new Date(1),
      },
    });
  };
  return {
    tenantId,
    auth,
    config,
    datos,
    emisor,
    pv,
    svc,
    verificarDelegacion,
    retirar,
    fila,
    iniciarCambio,
  };
}

async function escenario(
  fn: (c: Contexto, f: Awaited<ReturnType<typeof preparar>>) => Promise<void>,
  indice = 0,
) {
  await conPlanesAsignados(prisma, async (c) => {
    const f = await preparar(c, indice);
    await runWithTenant(f.tenantId, () => fn(c, f));
  });
}

describe('ARCA — contrato publicado y continuidad de la integración', () => {
  it.each([0, 1, 2])(
    'activa con el plan publicado %s y conserva quién verificó',
    async (indice) => {
      await escenario(async (_c, f) => {
        await expect(f.svc.activar(f.auth)).resolves.toMatchObject({
          estado: 'CONECTADA',
          planPermiteAfip: true,
          puedeOperarAfip: true,
        });
        expect(f.verificarDelegacion).toHaveBeenCalledWith(f.datos.cuit, 1);
        expect(await f.fila()).toMatchObject({
          conectadaPorId: f.auth.userId,
          metadataJson: { cuitVerificado: f.datos.cuit, ultimoNumeroVisto: 7 },
        });
        expect(await f.svc.facturacionHabilitada(f.tenantId)).toBe(true);
      }, indice);
    },
  );

  it('la versión sin función prevalece sobre el afip=true anterior; ni consulta ni escribe', async () => {
    await escenario(async (_c, f) => {
      await f.retirar();
      await expect(f.svc.activar(f.auth)).rejects.toMatchObject(denegada);
      await expect(f.svc.verificar(f.auth)).rejects.toMatchObject(denegada);
      expect(f.verificarDelegacion).not.toHaveBeenCalled();
      expect(await f.fila()).toBeNull();
    });
  });

  it('un cambio pendiente que retira ARCA bloquea activar y verificar aunque haya vencido su revisión', async () => {
    await escenario(async (_c, f) => {
      await f.iniciarCambio();
      await expect(f.svc.activar(f.auth)).rejects.toMatchObject(pendiente);
      await expect(f.svc.verificar(f.auth)).rejects.toMatchObject(pendiente);
      expect(f.verificarDelegacion).not.toHaveBeenCalled();
      expect(await f.fila()).toBeNull();
    });
  });

  it('una ampliación pendiente no concede ARCA antes del pago', async () => {
    await escenario(async (c, f) => {
      await f.retirar();
      await f.iniciarCambio(c.versiones[0].id);
      await expect(f.svc.activar(f.auth)).rejects.toMatchObject(denegada);
      expect(f.verificarDelegacion).not.toHaveBeenCalled();
    });
  });

  it('retirar la función durante la consulta impide aplicar el OK externo', async () => {
    await escenario(async (_c, f) => {
      f.verificarDelegacion.mockImplementationOnce(async () => {
        await f.retirar();
        return { ok: true, numero: 7 };
      });
      await expect(f.svc.activar(f.auth)).rejects.toMatchObject(denegada);
      expect(await f.fila()).toBeNull();
    });
  });

  it('iniciar un cambio de plan durante la consulta también impide la activación', async () => {
    await escenario(async (_c, f) => {
      f.verificarDelegacion.mockImplementationOnce(async () => {
        await f.iniciarCambio();
        return { ok: true, numero: 7 };
      });
      await expect(f.svc.activar(f.auth)).rejects.toMatchObject(pendiente);
      expect(await f.fila()).toBeNull();
    });
  });

  it('dar de baja durante la consulta conserva la integración desconectada', async () => {
    await escenario(async (c, f) => {
      f.verificarDelegacion.mockImplementationOnce(async () => {
        await c.tx.suscripcion.update({
          where: { tenantId: f.tenantId },
          data: { estado: 'baja' },
        });
        return { ok: true, numero: 7 };
      });
      await expect(f.svc.activar(f.auth)).rejects.toMatchObject(denegada);
      expect(await f.fila()).toBeNull();
    });
  });

  it('cambiar el CUIT mientras ARCA responde exige verificar los datos nuevos', async () => {
    await escenario(async (_c, f) => {
      f.verificarDelegacion.mockImplementationOnce(async () => {
        await f.config.guardar(f.auth, { ...f.datos, cuit: '30000000023' });
        return { ok: true, numero: 7 };
      });
      await expect(f.svc.activar(f.auth)).rejects.toThrow(/cambió durante/);
      expect(await f.fila()).toBeNull();
    });
  });

  it('desactivar la conexión mientras ARCA responde no se revierte con esa respuesta', async () => {
    await escenario(async (_c, f) => {
      await f.svc.activar(f.auth);
      f.verificarDelegacion.mockImplementationOnce(async () => {
        await f.svc.desactivar(f.auth);
        return { ok: true, numero: 7 };
      });
      await expect(f.svc.activar(f.auth)).rejects.toThrow(/cambió durante/);
      expect(await f.fila()).toMatchObject({ estado: 'DESCONECTADA' });
    });
  });

  it('cambiar el punto de venta durante la verificación descarta el resultado obsoleto', async () => {
    await escenario(async (_c, f) => {
      f.verificarDelegacion.mockImplementationOnce(async () => {
        await f.config.actualizarPuntoVenta(f.auth, f.pv.id, {
          numero: 2,
          nombre: 'Otro punto',
        });
        return { ok: true, numero: 7 };
      });
      await expect(f.svc.verificar(f.auth)).rejects.toThrow(/cambió durante/);
      expect(await f.fila()).toBeNull();
    });
  });

  it('la desconexión por la ruta genérica también prevalece sobre una activación pendiente', async () => {
    await escenario(async (c, f) => {
      await f.svc.activar(f.auth);
      const anterior = await f.fila();
      const generica = new IntegracionesService(
        c.db,
        {} as never,
        {} as never,
        {} as never,
      );
      f.verificarDelegacion.mockImplementationOnce(async () => {
        await generica.desconectar('AFIP');
        return { ok: true, numero: 7 };
      });
      await expect(f.svc.activar(f.auth)).rejects.toThrow(/cambió durante/);
      expect(await f.fila()).toMatchObject({
        estado: 'DESCONECTADA',
        metadataJson: anterior?.metadataJson,
      });
      await c.tx.suscripcion.update({
        where: { tenantId: f.tenantId },
        data: { estado: 'baja' },
      });
      await expect(generica.desconectar('AFIP')).rejects.toMatchObject(
        denegada,
      );
    });
  });

  it('verificar guarda el chequeo sin activar; todos los puntos inactivos no llaman a ARCA', async () => {
    await escenario(async (_c, f) => {
      await expect(f.svc.verificar(f.auth)).resolves.toMatchObject({
        ok: true,
      });
      expect(await f.fila()).toMatchObject({ estado: 'DESCONECTADA' });
      await f.config.actualizarPuntoVenta(f.auth, f.pv.id, {
        numero: 1,
        nombre: 'Prueba',
        activo: false,
      });
      f.verificarDelegacion.mockClear();
      await expect(f.svc.verificar(f.auth)).resolves.toMatchObject({
        ok: false,
        puntoVenta: null,
      });
      expect(f.verificarDelegacion).not.toHaveBeenCalled();
    });
  });

  it('sin la función, conserva datos e historial y permite desconectar; no ofrece facturar', async () => {
    await escenario(async (_c, f) => {
      await f.svc.activar(f.auth);
      const anterior = await f.fila();
      await f.retirar();
      await expect(f.svc.obtener(f.auth)).resolves.toMatchObject({
        estado: 'CONECTADA',
        planPermiteAfip: false,
        puedeOperarAfip: false,
        puedeDesactivarAfip: true,
      });
      expect(await f.svc.facturacionHabilitada(f.tenantId)).toBe(false);
      await expect(f.svc.desactivar(f.auth)).resolves.toMatchObject({
        estado: 'DESCONECTADA',
      });
      expect((await f.fila())?.metadataJson).toEqual(anterior?.metadataJson);
    });
  });

  it('en sólo lectura conserva la inclusión pero impide activar y desconectar', async () => {
    await escenario(async (c, f) => {
      await f.svc.activar(f.auth);
      await c.tx.suscripcion.update({
        where: { tenantId: f.tenantId },
        data: { estado: 'baja' },
      });
      await expect(f.svc.obtener(f.auth)).resolves.toMatchObject({
        planPermiteAfip: true,
        puedeOperarAfip: false,
        puedeDesactivarAfip: false,
      });
      await expect(f.svc.desactivar(f.auth)).rejects.toMatchObject(denegada);
      await expect(f.svc.activar(f.auth)).rejects.toMatchObject(denegada);
      expect(await f.fila()).toMatchObject({ estado: 'CONECTADA' });
    });
  });

  it('la función no habilita ARCA para otro país', async () => {
    await escenario(async (c, f) => {
      await c.tx.datosEmpresa.create({
        data: { tenantId: f.tenantId, paisCodigo: 'CL' },
      });
      await expect(f.svc.activar(f.auth)).rejects.toThrow(/Argentina/);
      await expect(f.svc.obtener(f.auth)).resolves.toMatchObject({
        puedeOperarAfip: false,
      });
      expect(f.verificarDelegacion).not.toHaveBeenCalled();
    });
  });

  it('conserva edición de identidad sin ARCA, pero no altas de puntos ni selección del proveedor fiscal', async () => {
    await escenario(async (_c, f) => {
      await f.retirar();
      await expect(
        f.config.guardar(f.auth, {
          ...f.datos,
          razonSocial: 'Nombre actualizado',
        }),
      ).resolves.toMatchObject({ razonSocial: 'Nombre actualizado' });
      await expect(
        f.config.crearPuntoVenta(f.auth, { numero: 2, nombre: 'Nuevo' }),
      ).rejects.toMatchObject(denegada);
      await expect(
        f.config.actualizarPuntoVenta(f.auth, f.pv.id, {
          numero: 2,
          nombre: 'Otro',
        }),
      ).rejects.toMatchObject(denegada);
      await expect(
        f.config.guardar(f.auth, {
          ...f.datos,
          proveedorFacturacion: 'afipsdk',
        }),
      ).rejects.toMatchObject(denegada);
      expect((await f.config.obtener(f.auth))?.proveedorFacturacion).toBe(
        'manual',
      );
    });
  });

  it('al cambiar el CUIT desconecta la delegación anterior, sin borrar su chequeo', async () => {
    await escenario(async (_c, f) => {
      await f.svc.activar(f.auth);
      await f.config.guardar(f.auth, { ...f.datos, cuit: '30000000023' });
      expect(await f.fila()).toMatchObject({
        estado: 'DESCONECTADA',
        metadataJson: { cuitVerificado: f.datos.cuit },
      });
    });
  });

  it('la consulta explícita de otra empresa no usa la conexión del contexto actual', async () => {
    await escenario(async (_c, f) => {
      await f.svc.activar(f.auth);
      // Un id desconocido tampoco puede reutilizar el registro del tenant activo.
      await expect(f.svc.facturacionHabilitada(randomUUID())).rejects.toThrow();
      expect(await f.svc.facturacionHabilitada(f.tenantId)).toBe(true);
    });
  });
});
