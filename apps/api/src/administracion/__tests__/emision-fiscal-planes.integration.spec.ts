import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { runWithTenant } from '../../common/tenant-context';
import { conPlanesAsignados } from '../../../test/soporte-planes-asignados';
import { PROPUESTA_PLANES } from '../../plataforma/planes/catalogo-planes';
import { CapacidadesEmpresaService } from '../../suscripciones/capacidades-empresa.service';
import { EmisionFiscalService } from '../emision-fiscal.service';
import { ComprobantesService } from '../comprobantes.service';
import { ManualProvider } from '../invoicing/manual.provider';
import type { AfipSdkProvider } from '../invoicing/afip-sdk.provider';
import type {
  EmitirInput,
  EmitirResultado,
} from '../invoicing/invoicing-provider';
import { FacturacionOrdenesService } from '../facturacion-ordenes.service';
import { FacturaService } from '../factura.service';
import { operacionesCambioPlan } from '../../plataforma/planes/operaciones-cambio-plan';

const prisma = new PrismaService();
afterAll(() => prisma.$disconnect());
type Contexto = Parameters<Parameters<typeof conPlanesAsignados>[1]>[0];
const denegada = { response: { code: 'CAPACIDAD_NO_DISPONIBLE' } };
const exito = (input: EmitirInput): EmitirResultado => ({
  estado: 'emitido',
  numero: input.numero!,
  cae: '12345678901234',
  caeVencimiento: '2026-10-02',
  raw: { autorizada: true },
});

async function preparar(c: Contexto, indice = 0) {
  const tenant = await c.tx.tenant.create({
    data: { nombre: 'Emisión de ensayo', slug: `emision-${randomUUID()}` },
  });
  const tenantId = tenant.id;
  const auth = {
    ...c.auth,
    tenantId,
    permisos: new Set(['administracion.gestionar', 'administracion.anular']),
  };
  const plan = await c.tx.plan.create({
    data: {
      codigo: randomUUID(),
      nombre: 'Fiscal',
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
  const retirar = () =>
    c.tx.suscripcion.update({
      where: { tenantId },
      data: { planVersionId: sinFiscal.id },
    });
  const config = await c.tx.configuracionFiscal.create({
    data: {
      tenantId,
      razonSocial: 'Emisor original',
      cuit: '30000000015',
      condicionFiscal: 'RI',
      proveedorFacturacion: 'afipsdk',
    },
  });
  const pv = await c.tx.puntoVenta.create({
    data: {
      tenantId,
      configuracionFiscalId: config.id,
      numero: 1,
      nombre: 'Prueba',
    },
  });
  await c.tx.integracionTenant.create({
    data: { tenantId, proveedor: 'AFIP', estado: 'CONECTADA' },
  });
  const emitir = jest.fn((input: EmitirInput) => Promise.resolve(exito(input)));
  const consultarEmitido = jest.fn(
    (
      _pv: number,
      _tipo: string,
      _letra: string,
      _n: number,
      _cuit: string,
      esperado: EmitirInput,
    ): Promise<EmitirResultado | null> => Promise.resolve(exito(esperado)),
  );
  const ultimoNumero = jest.fn(() => Promise.resolve(0));
  const provider = {
    codigo: 'afipsdk',
    disponible: true,
    environment: 'dev',
    cuitOperativo: (cuit: string) => cuit,
    emitir,
    consultarEmitido,
    ultimoNumero,
  } as unknown as AfipSdkProvider;
  const capacidades = new CapacidadesEmpresaService(c.db);
  const facturacion = new FacturacionOrdenesService(c.db);
  const emision = new EmisionFiscalService(
    c.db,
    new ManualProvider(),
    provider,
    facturacion,
    capacidades,
  );
  const svc = Object.create(
    ComprobantesService.prototype,
  ) as ComprobantesService;
  Object.assign(svc, {
    prisma: c.db,
    capacidades,
    emisiones: emision,
    facturacionOrdenes: facturacion,
    afipIntegracion: { facturacionHabilitada: () => Promise.resolve(true) },
    congelarPdf: jest.fn(),
    publicar: jest.fn(),
    avisos: { avisar: jest.fn() },
  });
  const nuevo = (extra: Record<string, unknown> = {}) =>
    svc.crear(auth, {
      tipo: 'factura',
      puntoVentaId: pv.id,
      items: [
        {
          descripcion: 'Prueba',
          cantidad: 1,
          precioUnitarioSinIva: 121,
          alicuotaIva: 21,
        },
      ],
      ...extra,
    });
  const fila = (id: string) =>
    c.tx.comprobante.findUniqueOrThrow({ where: { id } });
  const intento = (id: string) =>
    c.tx.comprobanteEmision.findFirstOrThrow({
      where: { comprobanteId: id, tenantId },
      orderBy: { creadaEl: 'desc' },
    });
  return {
    tenantId,
    auth,
    pv,
    config,
    svc,
    emision,
    emitir,
    ultimoNumero,
    consultarEmitido,
    provider,
    capacidades,
    facturacion,
    nuevo,
    fila,
    intento,
    retirar,
    sinFiscal,
    plan,
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

describe('Emisión fiscal — contrato publicado, admisión y recuperación', () => {
  it.each([0, 1, 2])(
    'crea y emite con el contrato publicado %s; congela la identidad fiscal',
    async (indice) => {
      await escenario(async (c, f) => {
        const borrador = await f.nuevo();
        expect(await f.svc.emitir(f.auth, borrador.id)).toMatchObject({
          estado: 'emitido',
          numero: 1,
          cae: '12345678901234',
        });
        expect(await f.intento(borrador.id)).toMatchObject({
          estado: 'emitido',
          serieActiva: null,
          solicitadaPorId: f.auth.userId,
        });
        await c.tx.configuracionFiscal.update({
          where: { id: f.config.id },
          data: { razonSocial: 'Nombre cambiado', cuit: '30000000023' },
        });
        const pdf = new FacturaService(c.db, {
          paraDocumentos: () => Promise.resolve({}),
        } as never);
        expect(
          (await pdf.documento(f.tenantId, borrador.id)).emisor.razonSocial,
        ).toBe('Emisor original');
        expect(f.emitir).toHaveBeenCalledTimes(1);
        await f.svc.emitir(f.auth, borrador.id);
        expect(f.emitir).toHaveBeenCalledTimes(1);
      }, indice);
    },
  );
  it('un borrador numerado anterior bloquea nuevos envíos de su serie', async () => {
    await escenario(async (c, f) => {
      const anterior = await f.nuevo();
      await c.tx.comprobante.update({
        where: { id: anterior.id },
        data: { numero: 7 },
      });
      const nuevo = await f.nuevo();
      await expect(f.emision.emitir(f.auth, nuevo.id)).rejects.toThrow(
        /envío anterior con número fiscal/,
      );
      expect(f.ultimoNumero).not.toHaveBeenCalled();
      expect(f.emitir).not.toHaveBeenCalled();
    });
  });
  it('retirar la función bloquea nuevos borradores y la emisión de uno existente', async () => {
    await escenario(async (_c, f) => {
      const b = await f.nuevo();
      await f.retirar();
      await expect(f.nuevo()).rejects.toMatchObject(denegada);
      await expect(f.emision.emitir(f.auth, b.id)).rejects.toMatchObject(
        denegada,
      );
      expect(f.emitir).not.toHaveBeenCalled();
      expect(f.ultimoNumero).not.toHaveBeenCalled();
      expect(await f.svc.obtener(f.auth, b.id)).toMatchObject({
        estado: 'borrador',
      });
    });
  });
  it('si el plan cambia mientras se obtiene el número no se envía; el borrador se libera', async () => {
    await escenario(async (_c, f) => {
      const b = await f.nuevo();
      f.ultimoNumero.mockImplementationOnce(async () => {
        await f.retirar();
        return 0;
      });
      await expect(f.emision.emitir(f.auth, b.id)).rejects.toMatchObject(
        denegada,
      );
      expect(f.emitir).not.toHaveBeenCalled();
      expect(await f.fila(b.id)).toMatchObject({
        estado: 'borrador',
        numero: null,
      });
      expect(await f.intento(b.id)).toMatchObject({
        estado: 'sin_envio',
        serieActiva: null,
      });
    });
  });
  it('un cambio pendiente que quita ARCA bloquea la admisión', async () => {
    await escenario(async (c, f) => {
      const b = await f.nuevo();
      const oferta = await c.tx.planOferta.create({
        data: {
          planId: f.plan.id,
          versionId: f.sinFiscal.id,
          entorno: 'sandbox',
          registroPublico: false,
          recomendado: false,
          creadaPorId: f.auth.userId,
          motivo: 'Ensayo',
        },
      });
      await c.tx.planContratacion.create({
        data: {
          tenantId: f.tenantId,
          userId: f.auth.userId,
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
      await expect(f.emision.emitir(f.auth, b.id)).rejects.toMatchObject({
        response: { code: 'CAMBIO_PLAN_PENDIENTE' },
      });
      expect(f.ultimoNumero).not.toHaveBeenCalled();
    });
  });
  it('cambiar CUIT durante la preparación aborta antes del POST', async () => {
    await escenario(async (c, f) => {
      const b = await f.nuevo();
      f.ultimoNumero.mockImplementationOnce(async () => {
        await c.tx.configuracionFiscal.update({
          where: { id: f.config.id },
          data: { cuit: '30000000023' },
        });
        return 0;
      });
      await expect(f.emision.emitir(f.auth, b.id)).rejects.toThrow(
        /Cambió la configuración/,
      );
      expect(f.emitir).not.toHaveBeenCalled();
    });
  });
  it('desconectar ARCA o perder el proveedor nunca cae silenciosamente en manual', async () => {
    await escenario(async (c, f) => {
      const b = await f.nuevo();
      await c.tx.integracionTenant.updateMany({
        where: { tenantId: f.tenantId },
        data: { estado: 'DESCONECTADA' },
      });
      await expect(f.emision.emitir(f.auth, b.id)).rejects.toThrow(
        /activá la integración/,
      );
      Object.defineProperty(f.provider, 'disponible', { value: false });
      await expect(f.emision.emitir(f.auth, b.id)).rejects.toThrow(
        /no está disponible/,
      );
      expect(await f.fila(b.id)).toMatchObject({
        estado: 'borrador',
        numero: null,
      });
    });
  });
  it('un timeout se guarda; un segundo clic no reenvía y bloquea la misma serie', async () => {
    await escenario(async (_c, f) => {
      const b = await f.nuevo();
      const otro = await f.nuevo();
      f.emitir.mockRejectedValueOnce(new Error('timeout'));
      expect(await f.svc.emitir(f.auth, b.id)).toMatchObject({
        estado: 'por_verificar',
        numero: 1,
      });
      await f.svc.emitir(f.auth, b.id);
      expect(f.emitir).toHaveBeenCalledTimes(1);
      await expect(f.emision.emitir(f.auth, otro.id)).rejects.toThrow(
        /otro envío fiscal pendiente/,
      );
      await expect(f.svc.descartar(f.auth, b.id)).rejects.toThrow();
      expect(await f.fila(otro.id)).toMatchObject({
        estado: 'borrador',
        numero: null,
      });
    });
  });
  it('recupera después de retirar ARCA, una sola vez, y actualiza la OT en la misma transacción', async () => {
    await escenario(async (c, f) => {
      const ot = await c.tx.ordenTrabajo.create({
        data: {
          tenantId: f.tenantId,
          numero: 'OT-FISCAL-PRUEBA',
          estado: 'finalizada',
          total: 121,
        },
      });
      const b = await f.nuevo({ ordenes: [{ ordenId: ot.id, monto: 121 }] });
      f.emitir.mockRejectedValueOnce(new Error('timeout'));
      await f.emision.emitir(f.auth, b.id);
      await f.retirar();
      const antes = await c.tx.ordenTrabajo.findUniqueOrThrow({
        where: { id: ot.id },
      });
      expect(Number(antes.facturadoTotal)).toBe(0);
      expect(await f.emision.consultar(f.auth, b.id)).toMatchObject({
        aplicada: true,
      });
      expect(
        Number(
          (await c.tx.ordenTrabajo.findUniqueOrThrow({ where: { id: ot.id } }))
            .facturadoTotal,
        ),
      ).toBe(121);
      expect(await f.emision.consultar(f.auth, b.id)).toMatchObject({
        aplicada: false,
      });
      expect(f.consultarEmitido).toHaveBeenCalledTimes(1);
      expect(f.emitir).toHaveBeenCalledTimes(1);
      expect(await f.intento(b.id)).toMatchObject({
        consultadaPorId: f.auth.userId,
        serieActiva: null,
      });
    });
  });
  it('la respuesta de una emisión admitida se persiste aunque el plan se dé de baja', async () => {
    await escenario(async (c, f) => {
      const b = await f.nuevo();
      f.emitir.mockImplementationOnce(async (input) => {
        await c.tx.suscripcion.update({
          where: { tenantId: f.tenantId },
          data: { estado: 'baja' },
        });
        return exito(input);
      });
      expect(await f.emision.emitir(f.auth, b.id)).toMatchObject({
        aplicada: true,
      });
      expect(await f.fila(b.id)).toMatchObject({ estado: 'emitido' });
    });
  });
  it('una consulta vacía o fallida no libera la serie ni repite el envío', async () => {
    await escenario(async (_c, f) => {
      const b = await f.nuevo();
      f.emitir.mockRejectedValueOnce(new Error('timeout'));
      await f.emision.emitir(f.auth, b.id);
      f.consultarEmitido.mockResolvedValueOnce(null);
      await f.emision.consultar(f.auth, b.id);
      f.consultarEmitido.mockRejectedValueOnce(new Error('otro receptor'));
      await f.emision.consultar(f.auth, b.id);
      expect(await f.fila(b.id)).toMatchObject({
        estado: 'por_verificar',
        cae: null,
      });
      expect((await f.intento(b.id)).serieActiva).not.toBeNull();
      expect(f.emitir).toHaveBeenCalledTimes(1);
    });
  });
  it('no consulta un envío de homologación en producción', async () => {
    await escenario(async (_c, f) => {
      const b = await f.nuevo();
      f.emitir.mockRejectedValueOnce(new Error('timeout'));
      await f.emision.emitir(f.auth, b.id);
      Object.defineProperty(f.provider, 'environment', { value: 'prod' });
      await expect(f.emision.consultar(f.auth, b.id)).rejects.toThrow(
        /entorno fiscal cambió/,
      );
      expect(f.consultarEmitido).not.toHaveBeenCalled();
    });
  });
  it('si falla la contabilidad no pierde la respuesta fiscal; la consulta puede recuperar', async () => {
    await escenario(async (_c, f) => {
      const b = await f.nuevo();
      jest
        .spyOn(f.facturacion, 'alEmitirComprobanteTx')
        .mockRejectedValueOnce(new Error('db temporal'));
      await f.emision.emitir(f.auth, b.id);
      expect(await f.intento(b.id)).toMatchObject({
        estado: 'verificar',
        respuestaJson: { autorizada: true },
      });
      expect(await f.fila(b.id)).toMatchObject({
        estado: 'por_verificar',
        cae: null,
      });
      expect(await f.emision.consultar(f.auth, b.id)).toMatchObject({
        aplicada: true,
      });
    });
  });
  it('rechazo explícito libera la serie y guarda los errores; la próxima factura reutiliza el número no autorizado', async () => {
    await escenario(async (_c, f) => {
      const b = await f.nuevo();
      f.emitir.mockResolvedValueOnce({
        estado: 'rechazado',
        errores: ['Datos incorrectos'],
        raw: { Resultado: 'R' },
      });
      await f.emision.emitir(f.auth, b.id);
      expect(await f.fila(b.id)).toMatchObject({
        estado: 'rechazado',
        numero: null,
        rechazoJson: { errores: ['Datos incorrectos'] },
      });
      const otro = await f.nuevo();
      await f.emision.emitir(f.auth, otro.id);
      expect(await f.fila(otro.id)).toMatchObject({
        estado: 'emitido',
        numero: 1,
      });
    });
  });
  it('exige permisos para emitir y consultar, y no permite consultar otro tenant', async () => {
    await escenario(async (_c, f) => {
      const b = await f.nuevo();
      const sinPermiso = { ...f.auth, permisos: new Set<string>() };
      await expect(f.emision.emitir(sinPermiso, b.id)).rejects.toMatchObject({
        status: 403,
      });
      await expect(f.emision.consultar(sinPermiso, b.id)).rejects.toMatchObject(
        { status: 403 },
      );
      await expect(
        f.emision.consultar(f.auth, randomUUID()),
      ).rejects.toMatchObject({ status: 404 });
      expect(f.emitir).not.toHaveBeenCalled();
    });
  });
  it('modo manual explícito emite sin red y permite completar un CAE histórico al retirar ARCA, sin reemplazarlo', async () => {
    await escenario(async (c, f) => {
      await c.tx.configuracionFiscal.update({
        where: { id: f.config.id },
        data: { proveedorFacturacion: 'manual' },
      });
      const b = await f.nuevo();
      await f.emision.emitir(f.auth, b.id);
      await f.retirar();
      expect(await f.fila(b.id)).toMatchObject({
        estado: 'emitido',
        cae: null,
      });
      expect(f.emitir).not.toHaveBeenCalled();
      await f.svc.cargarCae(f.auth, b.id, {
        cae: '12345678901234',
        caeVencimiento: '2026-10-02',
      });
      await expect(
        f.svc.cargarCae(f.auth, b.id, {
          cae: '12345678901235',
          caeVencimiento: '2026-10-02',
        }),
      ).rejects.toThrow(/registrada/);
    });
  });
  it('una factura en verificación reserva el importe de su OT aunque la otra use otro PV', async () => {
    await escenario(async (c, f) => {
      const ot = await c.tx.ordenTrabajo.create({
        data: {
          tenantId: f.tenantId,
          numero: 'OT-DOS-FACTURAS',
          estado: 'finalizada',
          total: 121,
        },
      });
      const a = await f.nuevo({ ordenes: [{ ordenId: ot.id, monto: 121 }] });
      const b = await f.nuevo({ ordenes: [{ ordenId: ot.id, monto: 121 }] });
      const pv2 = await c.tx.puntoVenta.create({
        data: {
          tenantId: f.tenantId,
          configuracionFiscalId: f.config.id,
          numero: 2,
          nombre: 'Otra serie',
        },
      });
      await c.tx.comprobante.update({
        where: { id: b.id },
        data: { puntoVentaId: pv2.id },
      });
      f.emitir.mockRejectedValueOnce(new Error('timeout'));
      await f.emision.emitir(f.auth, a.id);
      await expect(f.emision.emitir(f.auth, b.id)).rejects.toThrow(
        /no se puede facturar más|sin facturar/,
      );
      expect(f.emitir).toHaveBeenCalledTimes(1);
    });
  });
  it('dos notas no pueden acreditar dos veces, incluso con una pendiente de ARCA', async () => {
    await escenario(async (_c, f) => {
      const original = await f.nuevo();
      await f.emision.emitir(f.auth, original.id);
      const a = await f.nuevo({
        tipo: 'nota_credito',
        comprobanteOrigenId: original.id,
      });
      const b = await f.nuevo({
        tipo: 'nota_credito',
        comprobanteOrigenId: original.id,
      });
      f.emitir.mockRejectedValueOnce(new Error('timeout'));
      await f.emision.emitir(f.auth, a.id);
      await expect(f.emision.emitir(f.auth, b.id)).rejects.toThrow(
        /acreditar dos veces/,
      );
      await expect(
        f.emision.emitir(
          { ...f.auth, permisos: new Set(['administracion.gestionar']) },
          b.id,
        ),
      ).rejects.toMatchObject({ status: 403 });
    });
  });
  it('el diagnóstico de retirada incluye pendientes fiscales y cambia si cambia el comprobante pendiente', async () => {
    await escenario(async (_c, f) => {
      const a = await f.nuevo();
      const antes = await operacionesCambioPlan(
        prisma as never,
        f.tenantId,
        new Set(),
      );
      expect(antes.every((o) => o.cantidad === 0)).toBe(true);
      f.emitir.mockRejectedValueOnce(new Error('timeout'));
      await f.emision.emitir(f.auth, a.id);
      const d = await operacionesCambioPlan(
        _c.tx,
        f.tenantId,
        new Set(['fiscal_argentina']),
      );
      expect(d.find((o) => o.codigo === 'fiscal_pendiente')).toMatchObject({
        cantidad: 1,
        permiteRetiradaConRevision: true,
      });
    });
  });
});
