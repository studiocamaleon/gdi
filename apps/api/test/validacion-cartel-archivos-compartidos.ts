import { RecetasProductoService } from '../src/productos-servicios/recetas-producto.service';
import { ProductosService } from '../src/productos-servicios/productos.service';
import { ProductoValidacionService } from '../src/productos-servicios/producto-validacion.service';
/** Validación local del producto real. Todas las escrituras se revierten. */
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { expect } from 'expect';
import { MotorUniversalService } from '../src/motor-universal/motor.service';
import { AplicarPrecioService } from '../src/productos-servicios/precio/aplicar-precio.service';
import { PreciosEspecialesClientesService } from '../src/productos-servicios/precio/precios-especiales-clientes/precios-especiales-clientes.service';
import {
  inspeccionarVector,
  interpretarVector,
} from '../src/productos-servicios/geometrias/interpretar-vector';
import { emitirCotizacionF4, ejecutarOrdenF4, serviciosRecorridoF4 } from './soporte-recorridos-f4';

Object.assign(globalThis, { expect });
const db = new PrismaClient();
const json = (v: unknown) =>
  JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const rollback = new Error('ROLLBACK_VALIDACION_CARTEL');
async function main() {
  try {
    await db.$transaction(
      async (tx) => {
        const producto = await tx.producto.findFirstOrThrow({
          where: { codigo: 'CARTEL-CORPOREO-POLYFAN-CON-FRENTE-ACRILICO' },
        });
        const tenantId = producto.tenantId;
        // También emitir la cotización real guardada, sin recalcularla ni
        // actualizar su receta: reproduce el error reportado en el sheet.
        const ultimaCotizacion = await tx.cotizacionItem.findFirst({
          where: { tenantId, productoId: producto.id, recetaRevisionId: { not: null } },
          orderBy: { createdAt: 'desc' },
        });
        if (ultimaCotizacion) {
          const emitida = await emitirCotizacionF4(tx, {
            cotizacionId: ultimaCotizacion.cotizacionId,
            cotizacionItemId: ultimaCotizacion.id,
          });
          const pasos = await tx.ordenTrabajoItemPaso.findMany({
            where: { ordenId: emitida.orden.id },
            include: { item: { select: { nombre: true, parentItemId: true } } },
          });
          assert.equal(new Set(pasos.filter((p) => p.item.parentItemId).map((p) => p.itemId)).size, 2);
          const ejecucion = await ejecutarOrdenF4(tx, emitida.ordenes, emitida.auth, emitida.orden.id);
          console.log(JSON.stringify({
            validacion: 'cotización real sin recalcular', cotizacionItemId: ultimaCotizacion.id,
            pasos: pasos.map((p) => ({ componente: p.item.nombre, paso: p.nombre, minutos: Number(p.duracionEstimadaMin) })),
            estadoFinal: ejecucion.orden.estado,
          }));
        }
        const receta = await tx.productoReceta.findFirstOrThrow({
          where: { productoId: producto.id, activo: true },
          include: { revisionPublicada: { include: { componentes: true } } },
        });
        const componentesConfiguracion = Object.fromEntries(
          receta.revisionPublicada!.componentes.map((c) => [
            c.codigo,
            Object.fromEntries(
              ((c.configuracionJson as any).bindings ?? [])
                .filter(
                  (b: any) =>
                    b.origen === 'COTIZACION' && b.tipoDato === 'material',
                )
                .map((b: any) => [
                  b.clave.split('.')[0],
                  {
                    [b.clave.split('.').slice(1).join('.')]:
                      b.opciones[0].valor,
                  },
                ]),
            ),
          ]),
        );
        const periodo = (
          await tx.centroCostoTarifaPeriodo.findFirstOrThrow({
            where: { tenantId, estado: 'PUBLICADA' },
            orderBy: { periodo: 'desc' },
          })
        ).periodo;
        const textos = [
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 60"><path d="M0 0H100V60H0Z"/></svg>',
          [
            '0',
            'SECTION',
            '2',
            'ENTITIES',
            '0',
            'LWPOLYLINE',
            '8',
            'CORTE_LETRAS2',
            '90',
            '4',
            '70',
            '1',
            '10',
            '0',
            '20',
            '0',
            '10',
            '80',
            '20',
            '0',
            '10',
            '80',
            '20',
            '40',
            '10',
            '0',
            '20',
            '40',
            '0',
            'LINE',
            '8',
            'GUIA_LETRAS2',
            '10',
            '10',
            '20',
            '10',
            '11',
            '70',
            '21',
            '30',
            '0',
            'ENDSEC',
            '0',
            'EOF',
          ].join('\n'),
        ];
        const piezas = [];
        for (const [i, texto] of textos.entries()) {
          const nombreArchivo = `Letras${i + 1}.${i ? 'dxf' : 'svg'}`;
          const archivo = await tx.archivo.create({
            data: {
              tenantId,
              productoId: producto.id,
              scope: 'PRODUCTO',
              key: `qa/${randomUUID()}`,
              nombreOriginal: nombreArchivo,
              mimeType: i ? 'application/dxf' : 'image/svg+xml',
              estado: 'LISTO',
            },
          });
          const inspeccion = inspeccionarVector(texto, nombreArchivo);
          const seleccion = {
            exteriorId: inspeccion.sugeridaId,
            unidad: 'mm',
            cerrarExterior: false,
            operaciones: [],
          };
          const hash = createHash('sha256').update(texto).digest('hex');
          const fuente = interpretarVector(inspeccion, seleccion, {
            geometriaId: randomUUID(),
            archivoId: archivo.id,
            hash,
            nombreArchivo,
          });
          await tx.geometriaProducto.create({
            data: {
              id: fuente.procedencia.geometriaId,
              tenantId,
              productoId: producto.id,
              archivoId: archivo.id,
              hash,
              interpretacionJson: json(seleccion),
              fuenteJson: json(fuente),
            },
          });
          piezas.push({
            id: i ? 'letras2' : 'principal',
            nombre: `Letras${i + 1}`,
            cantidadPorUnidad: 1,
            fuente: JSON.parse(JSON.stringify(fuente)),
          });
        }
        const { prisma } = serviciosRecorridoF4(tx);
        const productos = new ProductosService(prisma as never);
        const recetas = new RecetasProductoService(
          prisma as never,
          productos,
          new ProductoValidacionService(productos),
          { publicar: async () => undefined } as never,
        );
        // Actualizar la revisión sólo dentro de la transacción: el catálogo local
        // puede tener cambios pendientes posteriores a su última publicación.
        const user = await tx.user.findFirstOrThrow();
        const auth = { tenantId, userId: user.id, email: user.email };
        for (const componente of receta.revisionPublicada!.componentes) {
          const recetaHijo = await tx.productoReceta.findFirst({
            where: {
              productoId: componente.productoComponenteId!,
              activo: true,
              revisionPublicadaId: { not: null },
            },
          });
          if (recetaHijo) {
            const borradorHijo = await recetas.guardarBorrador(
              auth as never,
              componente.productoComponenteId!,
              { rutaAlternativaId: recetaHijo.rutaAlternativaId },
            );
            await recetas.publicar(auth as never, borradorHijo.id, {
              expectedUpdatedAt: borradorHijo.updatedAt.toISOString(),
            });
          }
        }
        const borrador = await recetas.guardarBorrador(
          auth as never,
          producto.id,
          { rutaAlternativaId: receta.rutaAlternativaId },
        );
        await recetas.publicar(auth as never, borrador.id, {
          expectedUpdatedAt: borrador.updatedAt.toISOString(),
        });
        const motor = new MotorUniversalService(
          prisma as never,
          new AplicarPrecioService(),
          new PreciosEspecialesClientesService(prisma as never),
          undefined,
          undefined,
          recetas,
        );
        for (const cantidad of [1, 10]) {
          piezas[1].cantidadPorUnidad = cantidad === 1 ? 1 : 2;
          const coleccion = JSON.parse(JSON.stringify(piezas));
          const guardada = await motor.cotizarYGuardar({
            tenantId,
            productoId: producto.id,
            periodo,
            jobContext: JSON.parse(
              JSON.stringify({
                cantidad,
                coleccionesVectoriales: { principal: coleccion },
                geometriasVectoriales: { principal: coleccion[0].fuente },
                disenosVectoriales: coleccion,
                componentesConfiguracion,
              }),
            ),
          });
          assert.equal(
            guardada.result.exitoso,
            true,
            JSON.stringify(guardada.result.errores),
          );
          const hijos = guardada.result.cotizacion!.componentesFabricados!;
          assert.equal(hijos.length, 2);
          for (const hijo of hijos) {
            const ctx = hijo.jobContext as any;
            assert.equal(ctx.cantidad, cantidad);
            assert.deepEqual(ctx.disenosVectoriales, coleccion);
            const nesting = hijo.pasos?.find(
              (p) => p.nestingResult,
            )?.nestingResult;
            assert.ok(nesting, `Sin nesting en ${hijo.nombre}`);
            assert.equal(
              nesting.piezasAcomodadas,
              cantidad * (1 + piezas[1].cantidadPorUnidad),
            );
            assert.equal(
              new Set(nesting.placements.map((p) => p.pieceId)).size,
              2,
            );
            console.log(
              JSON.stringify({
                cantidadProductos: cantidad,
                componente: hijo.nombre,
                piezas: nesting.piezasAcomodadas,
                material: nesting.sustrato?.nombre,
                archivos: ctx.disenosVectoriales.map(
                  (p: any) => p.fuente.nombreArchivo,
                ),
              }),
            );
          }
          const persistida = await tx.cotizacionItem.findUniqueOrThrow({
            where: { id: guardada.cotizacionItemId! },
          });
          assert.deepEqual(
            (persistida.jobContextJson as any).coleccionesVectoriales.principal,
            coleccion,
          );
          const emitida = await emitirCotizacionF4(tx, guardada);
          const itemsOt = await tx.ordenTrabajoItem.findMany({
            where: { ordenId: emitida.orden.id, parentItemId: { not: null } },
            include: { pasos: true },
          });
          assert.equal(itemsOt.length, 2);
          for (const hijo of hijos) {
            const itemOt = itemsOt.find((item) => item.componenteCodigo === hijo.codigo)!;
            assert.ok(itemOt);
            assert.equal(itemOt.pasos.length, hijo.pasos!.filter((paso) => paso.activado).length);
            for (const paso of hijo.pasos!.filter((paso) => paso.activado)) {
              const pasoOt = itemOt.pasos.find((p) => p.rutaPasoId === paso.rutaPasoId)!;
              assert.ok(pasoOt);
              assert.ok(Math.abs(Number(pasoOt.duracionEstimadaMin) - (paso.tiempo?.totalMin ?? 0)) < 0.001);
            }
          }
          await ejecutarOrdenF4(tx, emitida.ordenes, emitida.auth, emitida.orden.id);
        }
        throw rollback;
      },
      { timeout: 120000 },
    );
  } catch (error) {
    if (error !== rollback) throw error;
  } finally {
    await db.$disconnect();
  }
  console.log(
    'OK: ambos nestings, cantidades, capas, fuentes, guardado, emisión y ejecución de OT; transacción revertida.',
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
