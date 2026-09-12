import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient, Prisma } from '@prisma/client';
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

// Aceptación opt-in: el worker real y el navegador generan estas capturas.
// Se reproducen sus resultados, sin recalcular ni escribir ventas en la cuenta
// de desarrollo. La persistencia, OT y ejecución usan PostgreSQL de prueba.
const huella = (v: unknown) =>
  createHash('sha256')
    .update(
      JSON.stringify(v, (_k, x) =>
        typeof x === 'number'
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
const carpeta = process.env.F4_CATALOGO_LOCAL_FIXTURE;
const aceptar = carpeta ? describe : describe.skip;
aceptar(
  'Resultados reales del catálogo → snapshot → ejecución (PostgreSQL)',
  () => {
    const db = new PrismaClient();
    afterAll(() => db.$disconnect());
    it.each([
      ['exhibidor-1', 1],
      ['exhibidor-10', 10],
      ['exhibidor-50', 50],
      ['exhibidor-51', 51],
      ['backlight', 1],
    ] as const)(
      'conserva y ejecuta %s con cantidades y dependencias congeladas',
      async (archivo, cantidad) => {
        const catalogo = JSON.parse(
          readFileSync(join(carpeta!, 'catalogo-qa-publicado.json'), 'utf8'),
        );
        const captura = JSON.parse(
          readFileSync(join(carpeta!, `${archivo}-cotizacion.json`), 'utf8'),
        );
        const result = captura.result;
        const c = result.cotizacion;
        expect(result.exitoso).toBe(true);
        expect(
          result.errores.filter(
            (e: { severidad: string }) => e.severidad === 'ERROR',
          ),
        ).toEqual([]);
        const rollback = new Error('rollback catálogo local F4');
        await expect(
          db.$transaction(
            async (tx) => {
              const { id: tenantId } = await tx.tenant.findUniqueOrThrow({
                where: { slug: 'gdi-demo' },
              });
              const categoria =
                await tx.productoSubcategoriaComercial.findFirstOrThrow();
              const insertar = async (
                modelo: string,
                filas: any[],
                cambio: (f: any) => object = () => ({}),
              ) => {
                const meta = Prisma.dmmf.datamodel.models.find(
                  (m) =>
                    m.name.charAt(0).toLowerCase() + m.name.slice(1) === modelo,
                )!;
                for (const fila of [
                  ...new Map(filas.map((f) => [f.id, f])).values(),
                ]) {
                  const datos = { ...fila, tenantId, ...cambio(fila) };
                  // Un null JSON SQL no es JSON null. La fixture conserva la ausencia.
                  for (const f of meta.fields)
                    if (f.type === 'Json' && datos[f.name] === null)
                      delete datos[f.name];
                  await (tx as any)[modelo].create({ data: datos });
                }
              };
              const m = catalogo.modelos;
              await insertar('producto', m.productos, () => ({
                subcategoriaComercialId: categoria.id,
              }));
              await insertar('ruta', m.rutas, (f) => ({
                codigo: `F4-CAPTURA-${f.id}`,
              }));
              await insertar('productoRutaAlternativa', m.alternativas);
              await insertar('productoReceta', m.recetas, () => ({
                revisionPublicadaId: null,
              }));
              await insertar('productoRecetaRevision', m.revisiones);
              await insertar('productoRecetaComponente', m.componentes);
              await insertar('productoRecetaRecurso', m.recursos);
              await insertar('productoRecetaMaterial', m.materiales);
              const { prisma } = serviciosRecorridoF4(tx);
              const motor = new MotorUniversalService(
                prisma as never,
                {} as never,
                {} as never,
              );
              const cargado = catalogo.resueltos[c.productoId];
              const cotizacion = await tx.cotizacion.create({
                data: { tenantId },
              });
              const datos = (motor as any).buildCotizacionItemData({
                tenantId,
                cotizacionId: cotizacion.id,
                productoId: c.productoId,
                jobContext: captura.data.input.jobContext,
                producto: cargado.producto,
                cotizacion: c,
                receta: cargado.receta,
                inputHash: `captura-real-${cantidad}`,
                periodo: c.periodoTarifario,
              });
              const item = await tx.cotizacionItem.create({ data: datos });
              const guardada = {
                result,
                cotizacionId: cotizacion.id,
                cotizacionItemId: item.id,
              };
              const { orden, ordenes, auth } =
                await emitirCotizacionF4(tx, guardada);
              const lectura = await tx.ordenTrabajoItem.findMany({
                where: { ordenId: orden.id },
                include: { pasos: true, cotizacionItem: true },
              });
              expect(lectura).toHaveLength(archivo === 'backlight' ? 3 : 2);
              const hijo = lectura.find((i) => i.parentItemId)!;
              if (archivo === 'backlight') {
                const bastidor = c.componentesFabricados.find(
                  (p: any) => p.codigo === 'BASTIDOR-BACKLIGHT',
                );
                const lona = c.componentesFabricados.find(
                  (p: any) => p.codigo === 'LONA-BACKLIGHT',
                );
                expect(bastidor.jobContext.profundidadMm).toBe(200);
                expect(bastidor.outputsPublicos['lonaBrutaMm.anchoMm']).toBe(
                  2200,
                );
                expect(lona.jobContext.medidaCustomMm).toEqual({
                  anchoMm: 2200,
                  altoMm: 1200,
                });
                expect(
                  lectura
                    .flatMap((i) => i.pasos)
                    .filter((p) => p.tipoEjecucion === 'tercerizado'),
                ).toHaveLength(1);
                const raiz = lectura.find((i) => !i.parentItemId)!;
                expect(raiz.pasos).toHaveLength(1);
                expect(c.pasos[0].operacionesInternas.length).toBeGreaterThan(
                  1,
                );
                await expect(
                  ordenes.accionPaso(
                    auth,
                    orden.id,
                    raiz.id,
                    raiz.pasos[0].id,
                    { accion: 'iniciar' },
                  ),
                ).rejects.toThrow(/dependencias/);
              } else {
                const contexto = hijo.jobContextSnapshotJson as any;
                expect(
                  contexto.piezas.reduce(
                    (n: number, p: any) => n + p.cantidad,
                    0,
                  ),
                ).toBe(cantidad * 9);
                const pasosFuente = c.componentesFabricados[0].pasos;
                const impresion = pasosFuente.find(
                  (p: any) => p.familiaCodigo === 'impresion_por_area',
                );
                const corte = pasosFuente.find(
                  (p: any) => p.familiaCodigo === 'corte_laser',
                );
                const geometria = (placements: any[]) =>
                  placements.map(({ meta, ...posicion }) => ({
                    ...posicion,
                    contornos: meta.contornos,
                    operaciones: meta.operaciones,
                    propietario: meta.propietario,
                    rotacionGrados: meta.rotacionGrados,
                  }));
                expect(
                  huella(geometria(impresion.nestingResult.placements)),
                ).toBe(huella(geometria(corte.nestingResult.placements)));
                expect(impresion.nestingResult.placements).toHaveLength(
                  cantidad * 9,
                );
                for (const familia of ['impresion_por_area', 'corte_laser']) {
                  const paso = hijo.pasos.find(
                    (p) => p.familiaCodigo === familia,
                  )!;
                  const snapshot = snapshotPasoProduccion(
                    hijo as never,
                    paso as never,
                  );
                  expect([
                    familia,
                    huella(snapshot.paso!.nestingResult!.placements),
                  ]).toEqual([
                    familia,
                    huella(
                      pasosFuente.find((p: any) => p.familiaCodigo === familia)
                        .nestingResult.placements,
                    ),
                  ]);
                }
              }
              const ctxAntes = hijo.jobContextSnapshotJson;
              const trazaAntes = hijo.trazabilidadSnapshotJson;
              const final = await ejecutarOrdenF4(
                tx,
                ordenes,
                auth,
                orden.id,
                async (paso) => {
                  if (
                    archivo !== 'backlight' &&
                    paso.familiaCodigo === 'impresion_por_area'
                  ) {
                    const plan = snapshotPasoProduccion(hijo as never, paso as never).paso!.nestingResult!;
                    expect(plan.piezasAcomodadas).toBe(
                      cantidad * 9,
                    );
                    expect(plan.placements).toHaveLength(
                      cantidad * 9,
                    );
                    if (cantidad === 1)
                      writeFileSync(
                        join(carpeta!, 'plan-impresion-catalogo.json'),
                        JSON.stringify({ pasoId: paso.id, plan }),
                      );
                  }
                },
              );
              expect(Number(final.orden.total)).toBe(Number(item.precioTotal));
              const despues = await tx.ordenTrabajoItem.findUniqueOrThrow({
                where: { id: hijo.id },
              });
              expect([
                'contexto',
                huella(despues.jobContextSnapshotJson),
              ]).toEqual(['contexto', huella(ctxAntes)]);
              expect([
                'traza',
                huella(despues.trazabilidadSnapshotJson),
              ]).toEqual(['traza', huella(trazaAntes)]);
              // Conciliar las MISMAS órdenes terminadas con las áreas vecinas.
              // La fecha aislada evita mezclar las ventas del seed de prueba.
              const fecha = new Date('2098-12-05T12:00:00Z');
              const rango = {
                desde: new Date('2098-12-05'),
                hasta: new Date('2098-12-05'),
                zona: 'UTC',
              };
              await tx.ordenTrabajo.update({
                where: { id: orden.id },
                data: { fechaEmision: fecha },
              });
              await tx.ordenTrabajoItemPaso.updateMany({
                where: { ordenId: orden.id },
                data: { completadoEl: fecha },
              });
              const raizComercial = lectura.find((i) => !i.parentItemId)!;
              const ventas = Number(raizComercial.subtotal);
              // Materiales/tintas de las capturas y 50.000 del proveedor del
              // bastidor. Totales auditados antes de persistir, sin consultar SQL.
              const variables = {
                'exhibidor-1': 889.53,
                'exhibidor-10': 8890.32,
                'exhibidor-50': 44126.61,
                'exhibidor-51': 44941.14,
                backlight: 81483.12,
              }[archivo];
              const renta = await new RentabilidadService(
                prisma as never,
              ).periodo(tenantId, rango);
              expect(renta).toMatchObject({
                ventas,
                costoTotal: Math.round(Number(item.costoTotal) * 100) / 100,
                costosVariables: variables,
                itemsSinCosto: 0,
              });
              expect(
                await (new VentasService(prisma as never) as any).totales(
                  tenantId,
                  rango,
                ),
              ).toEqual({ ventas, ordenes: 1, items: 1 });
              const reporte = await new ProductoService(
                prisma as never,
              ).producto(tenantId, rango);
              expect(reporte.porProducto).toHaveLength(1);
              expect(reporte.porProducto[0]).toMatchObject({
                items: 1,
                costosVariables: variables,
                costo: renta.costoTotal,
              });
              expect(
                await (
                  new ReporteProduccionService(prisma as never) as any
                ).throughput(tenantId, rango),
              ).toEqual([{ fecha: '2098-12-05', cantidad: final.ejecutados }]);
              expect(final.orden.publicToken).toBeTruthy();
              const tracking = await ordenes.trackingPublico(
                final.orden.publicToken!,
              );
              expect(tracking.items).toHaveLength(1);
              expect(tracking.progresoPct).toBe(100);
              expect(tracking.items[0]).toMatchObject({
                id: raizComercial.id,
                progresoPct: 100,
              });
              throw rollback;
            },
            { timeout: 60000 },
          ),
        ).rejects.toBe(rollback);
        expect(await db.producto.count({ where: { id: c.productoId } })).toBe(
          0,
        );
      },
      65000,
    );
  },
);
