import { createHash, randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { restaurarJson } from '../../common/json-compartido';
import { MotorUniversalService } from '../../motor-universal/motor.service';
import {
  emitirCotizacionF4,
  ejecutarOrdenF4,
  serviciosRecorridoF4,
} from '../../../test/soporte-recorridos-f4';
import { snapshotPasoProduccion } from '../../produccion/snapshot-paso-produccion';
import { RentabilidadService } from '../../reportes/rentabilidad.service';
import { ProductoService } from '../../reportes/producto.service';
import { VentasService } from '../../reportes/ventas.service';
import { ReporteProduccionService } from '../../reportes/produccion.service';

const leer = (archivo: string): any =>
  restaurarJson(
    JSON.parse(
      gunzipSync(
        readFileSync(
          join(
            __dirname,
            '../../../test/fixtures/f4-persistencia',
            `${archivo}.json.gz`,
          ),
        ),
      ).toString(),
    ),
  );
const huella = (v: unknown, exacta = false) =>
  createHash('sha256')
    .update(
      JSON.stringify(v, (_k, x) =>
        !exacta && typeof x === 'number'
          ? Math.round(x * 1e9) / 1e9
          : x && typeof x === 'object' && !Array.isArray(x)
            ? Object.fromEntries(
                Object.keys(x)
                  .sort()
                  .map((k) => [k, x[k]]),
              )
            : x,
      ),
    )
    .digest('hex');
const catalogo = leer('catalogo-qa-publicado');
const db = new PrismaService();
const tenantId = randomUUID();
const medidas: any[] = [];
let creado = false;
// Conserva las transacciones REALES, sin proxy de rollback ni aumento del
// timeout. Los únicos dobles son la búsqueda ya calculada y comunicaciones.
const transacciones: number[] = [];
const prisma = new Proxy(db, {
  get(target, prop) {
    if (prop === '$transaction')
      return (fn: any, opts: any) =>
        typeof fn !== 'function'
          ? target.$transaction(fn, opts)
          : target.$transaction(async (tx) => {
              const t = performance.now();
              try {
                return await fn(tx);
              } finally {
                transacciones.push(performance.now() - t);
              }
            }, opts);
    return Reflect.get(target, prop);
  },
});
beforeAll(async () => {
  await db.tenant.create({
    data: {
      id: tenantId,
      nombre: 'Aceptación snapshots F4',
      slug: `cierre-${tenantId}`,
    },
  });
  creado = true;
  const categoria = await db.productoSubcategoriaComercial.findFirstOrThrow();
  const insertar = async (
    modelo: string,
    filas: any[],
    cambio: (f: any) => object = () => ({}),
  ) => {
    const meta = Prisma.dmmf.datamodel.models.find(
      (m) => m.name.charAt(0).toLowerCase() + m.name.slice(1) === modelo,
    )!;
    for (const fila of [...new Map(filas.map((f) => [f.id, f])).values()]) {
      const data = { ...fila, tenantId, ...cambio(fila) };
      for (const f of meta.fields)
        if (f.type === 'Json' && data[f.name] === null) delete data[f.name];
      await (db as any)[modelo].create({ data });
    }
  };
  const m = catalogo.modelos;
  await insertar('producto', m.productos, () => ({
    subcategoriaComercialId: categoria.id,
  }));
  await insertar('ruta', m.rutas, (f) => ({ codigo: `F4-CIERRE-${f.id}` }));
  await insertar('productoRutaAlternativa', m.alternativas);
  await insertar('productoReceta', m.recetas, () => ({
    revisionPublicadaId: null,
  }));
  await insertar('productoRecetaRevision', m.revisiones);
  await insertar('productoRecetaComponente', m.componentes);
  await insertar('productoRecetaRecurso', m.recursos);
  await insertar('productoRecetaMaterial', m.materiales);
}, 30000);
afterAll(async () => {
  if (process.env.F4_MEDICIONES_SALIDA)
    writeFileSync(
      process.env.F4_MEDICIONES_SALIDA,
      JSON.stringify({ medidas, transacciones }, null, 2),
    );
  if (creado) await db.tenant.delete({ where: { id: tenantId } });
  await db.$disconnect();
}, 30000);

it.each([50, 100, 150])(
  'guarda, recotiza, emite y ejecuta %s exhibidores preservando geometría y reportes',
  async (cantidad) => {
    const captura = leer(`exhibidor-${cantidad}-cotizacion`);
    const anterior = leer(`exhibidor-${cantidad === 50 ? 100 : 50}-cotizacion`);
    const c = captura.result.cotizacion;
    const cargado = catalogo.resueltos[c.productoId];
    const motor = new MotorUniversalService(
      prisma as never,
      {} as never,
      {} as never,
      undefined,
      undefined,
      { resolverPublicadaParaCotizar: async () => cargado.receta } as never,
    );
    jest
      .spyOn(motor as any, 'cargarProductoYRuta')
      .mockResolvedValue(cargado.producto);
    const cotizar = jest
      .spyOn(motor, 'cotizar')
      .mockResolvedValue(anterior.result);
    let t = performance.now();
    const guardada = await motor.cotizarYGuardar({
      ...anterior.data.input,
      tenantId,
    });
    expect(guardada.cotizacionItemId).toBeTruthy();
    const medicion: any = { cantidad, guardarMs: performance.now() - t };
    cotizar.mockResolvedValue(captura.result);
    t = performance.now();
    await motor.recotizarItem({
      tenantId,
      cotizacionItemId: guardada.cotizacionItemId!,
      jobContext: captura.data.input.jobContext,
    });
    medicion.recotizarMs = performance.now() - t;
    const reabierta = await db.cotizacionItem.findUniqueOrThrow({
      where: { id: guardada.cotizacionItemId! },
    });
    expect(Number(reabierta.cantidad)).toBe(cantidad);
    expect(
      huella((reabierta.trazabilidadJson as any).componentesFabricados),
    ).toBe(huella(c.componentesFabricados));
    // La consulta SQL ve costos y componentes, sin tener que descomprimir CAD.
    const [almacenado] = await db.$queryRaw<
      Array<{ bytes: number; variable: number }>
    >`
    SELECT octet_length("trazabilidadJson"::text)::int AS bytes,
      jsonb_array_length("trazabilidadJson"->'componentesFabricados')::int AS variable
    FROM "CotizacionItem" WHERE id = ${reabierta.id}::uuid`;
    medicion.snapshotBytes = almacenado.bytes;
    medicion.originalBytes = Buffer.byteLength(
      JSON.stringify(reabierta.trazabilidadJson),
    );
    expect(almacenado.variable).toBe(1);
    expect(almacenado.bytes).toBeLessThan(medicion.originalBytes / 20);
    t = performance.now();
    const { orden, ordenes, produccion, auth } = await emitirCotizacionF4(
      prisma,
      guardada,
    );
    medicion.emitirMs = performance.now() - t;
    const lectura = await db.ordenTrabajoItem.findMany({
      where: { ordenId: orden.id },
      include: { pasos: true, cotizacionItem: true },
    });
    expect(lectura).toHaveLength(2);
    const hijo = lectura.find((i) => i.parentItemId)!;
    expect(
      (hijo.jobContextSnapshotJson as any).piezas.reduce(
        (s: number, p: any) => s + p.cantidad,
        0,
      ),
    ).toBe(cantidad * 9);
    for (const familia of ['impresion_por_area', 'corte_laser']) {
      const paso = hijo.pasos.find((p) => p.familiaCodigo === familia)!;
      const real = snapshotPasoProduccion(hijo as never, paso as never).paso!
        .nestingResult!;
      const esperado = c.componentesFabricados[0].pasos.find(
        (p: any) => p.familiaCodigo === familia,
      ).nestingResult;
      expect(huella(real)).toBe(huella(esperado));
      expect(huella(real.placements, true)).toBe(
        huella(esperado.placements, true),
      );
      expect(real.placements).toHaveLength(cantidad * 9);
      expect(real.cantidadCalculada).toBe(cantidad * 0.64);
    }
    const antes = huella(hijo.trazabilidadSnapshotJson);
    const final = await ejecutarOrdenF4(
      prisma,
      ordenes,
      auth,
      orden.id,
      async (paso) => {
        if (paso.familiaCodigo !== 'impresion_por_area') return;
        const cola = await produccion.simulador(auth);
        const plan = cola.jobs.find(
          (j) => j.pasoId === paso.id,
        )!.planFabricacion!;
        expect(plan.placements).toHaveLength(cantidad * 9);
        expect(plan).not.toHaveProperty('costingPreview');
      },
    );
    expect(Number(final.orden.total)).toBe(Number(reabierta.precioTotal));
    expect(
      huella(
        (
          await db.ordenTrabajoItem.findUniqueOrThrow({
            where: { id: hijo.id },
          })
        ).trazabilidadSnapshotJson,
      ),
    ).toBe(antes);
    const fecha = new Date(
      `2098-12-${cantidad === 50 ? '05' : cantidad === 100 ? '06' : '07'}T12:00:00Z`,
    );
    const rango = { desde: fecha, hasta: fecha, zona: 'UTC' };
    await db.ordenTrabajo.update({
      where: { id: orden.id },
      data: { fechaEmision: fecha },
    });
    await db.ordenTrabajoItemPaso.updateMany({
      where: { ordenId: orden.id },
      data: { completadoEl: fecha },
    });
    const ventas = Number(lectura.find((i) => !i.parentItemId)!.subtotal);
    const variables = (
      { 50: 43926.61, 100: 87853.22, 150: 131779.83 } as Record<number, number>
    )[cantidad];
    const renta = await new RentabilidadService(prisma as never).periodo(
      tenantId,
      rango,
    );
    expect(renta).toMatchObject({
      ventas,
      costosVariables: variables,
      costoTotal: Math.round(Number(reabierta.costoTotal) * 100) / 100,
      itemsSinCosto: 0,
    });
    expect(
      await (new VentasService(prisma as never) as any).totales(
        tenantId,
        rango,
      ),
    ).toEqual({ ventas, ordenes: 1, items: 1 });
    const reporte = await new ProductoService(prisma as never).producto(
      tenantId,
      rango,
    );
    expect(reporte.porProducto).toHaveLength(1);
    expect(reporte.porProducto[0]).toMatchObject({
      items: 1,
      costosVariables: variables,
      costo: renta.costoTotal,
    });
    expect(
      await (new ReporteProduccionService(prisma as never) as any).throughput(
        tenantId,
        rango,
      ),
    ).toEqual([
      { fecha: fecha.toISOString().slice(0, 10), cantidad: final.ejecutados },
    ]);
    const tracking = await ordenes.trackingPublico(final.orden.publicToken!);
    expect(tracking.items).toHaveLength(1);
    expect(tracking.progresoPct).toBe(100);
    medidas.push(medicion);
    console.log('F4_PERSISTENCIA', JSON.stringify(medicion));
  },
  120000,
);

it('atiende cuatro guardados y tres emisiones concurrentes, con reintento idempotente', async () => {
  const captura = leer('exhibidor-150-cotizacion');
  const c = captura.result.cotizacion;
  const cargado = catalogo.resueltos[c.productoId];
  const motor = new MotorUniversalService(
    prisma as never,
    {} as never,
    {} as never,
    undefined,
    undefined,
    { resolverPublicadaParaCotizar: async () => cargado.receta } as never,
  );
  jest
    .spyOn(motor as any, 'cargarProductoYRuta')
    .mockResolvedValue(cargado.producto);
  jest.spyOn(motor, 'cotizar').mockResolvedValue(captura.result);
  let t = performance.now();
  const guardadas = await Promise.all(
    Array.from({ length: 4 }, () =>
      motor.cotizarYGuardar({ ...captura.data.input, tenantId }),
    ),
  );
  const guardarMs = performance.now() - t;
  expect(new Set(guardadas.map((g) => g.cotizacionItemId)).size).toBe(4);
  const cliente = await db.cliente.upsert({
    where: { tenantId_nombre: { tenantId, nombre: 'Aceptación F4' } },
    update: {},
    create: {
      tenantId,
      nombre: 'Aceptación F4',
      telefonoCodigo: '54',
      telefonoNumero: '2902000000',
      paisCodigo: 'AR',
    },
  });
  const actor = await db.user.findFirstOrThrow();
  const auth = {
    tenantId,
    userId: actor.id,
    email: actor.email,
    permisos: new Set([
      'produccion.supervisar',
      'comercial.ver',
      'finanzas.ver_margenes',
    ]),
  } as never;
  const { ordenes } = serviciosRecorridoF4(prisma);
  const solicitudes = guardadas.slice(0, 3).map((g) => ({
    idempotencyKey: randomUUID(),
    estado: 'pendiente' as const,
    fechaEntrega: '2099-12-01',
    clienteId: cliente.id,
    cotizacionId: g.cotizacionId!,
    items: [
      {
        cotizacionItemId: g.cotizacionItemId!,
        codigo: cargado.producto.productoCodigo,
        nombre: cargado.producto.productoNombre,
        familia: 'Aceptación F4',
        cantidad: 150,
        cantidadUnidad: 'unidad',
        subtotal: 0,
        impuestos: 0,
        total: 0,
      },
    ],
  }));
  t = performance.now();
  const emisiones = await Promise.allSettled(
    solicitudes.map((s) => ordenes.create(auth, s)),
  );
  for (const r of emisiones) if (r.status === 'rejected') throw r.reason;
  const creadas = emisiones.map(
    (r) =>
      (r as PromiseFulfilledResult<Awaited<ReturnType<typeof ordenes.create>>>)
        .value,
  );
  const emitirMs = performance.now() - t;
  expect(new Set(creadas.map((o) => o.id)).size).toBe(3);
  const antes = await db.ordenTrabajo.count({ where: { tenantId } });
  const repetidas = await Promise.all([
    ordenes.create(auth, solicitudes[0]),
    ordenes.create(auth, solicitudes[0]),
  ]);
  expect(repetidas.map((o) => o.id)).toEqual([creadas[0].id, creadas[0].id]);
  expect(await db.ordenTrabajo.count({ where: { tenantId } })).toBe(antes);
  medidas.push({
    concurrencia: { guardar: 4, emitir: 3 },
    guardarMs,
    emitirMs,
  });
}, 120000);
