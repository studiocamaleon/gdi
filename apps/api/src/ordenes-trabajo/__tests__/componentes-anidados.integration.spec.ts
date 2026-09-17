import { PrismaClient, Prisma } from '@prisma/client';
import { OrdenesTrabajoService } from '../ordenes-trabajo.service';
import { compilarRutaLineal, validarYOrdenarGrafo } from '../grafo-produccion';
import { snapshotPasoProduccion } from '../../produccion/snapshot-paso-produccion';
import { ejecutarOrdenF4, serviciosRecorridoF4 } from '../../../test/soporte-recorridos-f4';
import type { CurrentAuth } from '../../auth/auth.types';

describe('OT de compuesto con lotes anidados (PostgreSQL)', () => {
  const db = new PrismaClient();
  afterAll(() => db.$disconnect());

  it('conserva dos ámbitos con los mismos códigos y materializa una impresión y un corte en cada uno', async () => {
    const rollback = new Error('revertir fixture');
    let comprobado = false;
    await expect(
      db.$transaction(
        async (tx) => {
          const { id: tenantId } = await tx.tenant.findUniqueOrThrow({
            where: { slug: 'gdi-demo' },
          });
          const rutaOrigen = await tx.productoRutaAlternativa.findFirstOrThrow({
            where: { tenantId },
          });
          // La receta del catálogo puede existir: esta prueba necesita su propia
          // alternativa y sus revisiones, todas revertidas con la transacción.
          const ruta = await tx.productoRutaAlternativa.create({
            data: {
              tenantId,
              productoId: rutaOrigen.productoId,
              rutaId: rutaOrigen.rutaId,
              rutaVersion: rutaOrigen.rutaVersion,
              nombre: 'Prueba de componentes anidados',
            },
          });
          const variante = await tx.materiaPrimaVariante.findFirstOrThrow({
            where: { tenantId },
          });
          const receta = await tx.productoReceta.create({
            data: {
              tenantId,
              productoId: ruta.productoId,
              rutaAlternativaId: ruta.id,
              codigo: 'PRUEBA-ANIDADA',
              nombre: 'Prueba anidada',
            },
          });
          const revision = async (numero: number, ids: string[]) => {
            const grafo = compilarRutaLineal(
              ids.map((id, indice) => ({ clave: `ruta:${id}`, indice })),
            );
            return tx.productoRecetaRevision.create({
              data: {
                tenantId,
                recetaId: receta.id,
                numero,
                estado: 'PUBLICADA',
                creadaPorNombre: 'Prueba de integración',
                rutaAlternativaId: ruta.id,
                rutaVersion: 1,
                huellaConfiguracion: `huella-${numero}`,
                snapshotJson: { pasos: grafo.nodos },
                grafoProduccionJson: grafo,
              },
            });
          };
          const hoja = await revision(1, ['print', 'cut']);
          const intermedia = await revision(2, ['ensamble']);
          const raiz = await revision(3, ['final']);
          const relacion = async (
            revisionId: string,
            hija: typeof hoja,
            codigo: string,
            nodo: string,
          ) =>
            tx.productoRecetaComponente.create({
              data: {
                tenantId,
                revisionId,
                productoComponenteId: ruta.productoId,
                recetaRevisionId: hija.id,
                recetaVersion: hija.numero,
                recetaHuella: hija.huellaConfiguracion,
                codigo,
                nombre: codigo,
                nodoIncorporacionClave: `ruta:${nodo}`,
              },
            });
          for (const codigo of ['x', 'y'])
            await relacion(intermedia.id, hoja, codigo, 'ensamble');
          for (const codigo of ['izquierda', 'derecha'])
            await relacion(raiz.id, intermedia, codigo, 'final');
          const paso = (rutaPasoId: string) => ({
            rutaPasoId,
            activado: true,
            familiaCodigo:
              rutaPasoId === 'print' ? 'impresion_por_area' : 'corte_laser',
            nombreVisible: rutaPasoId,
            tiempo: { totalMin: 15 },
            costoTotal: 15,
          });
          const nestingResult = {
            algorithm: 'grid-2d-multi',
            cantidadCalculada: 1,
            unidad: 'pliegos',
            piezasAcomodadas: 60,
            substrates: [
              { kind: 'sheet', count: 1, widthMm: 300, heightMm: 200 },
            ],
            placements: Array.from({ length: 60 }, (_, i) => ({
              pieceId: i % 2 ? 'x' : 'y',
              xMm: 3 + (i % 10) * 12,
              yMm: 4 + Math.floor(i / 10) * 25,
              widthMm: 10,
              heightMm: 20,
              rotated: false,
            })),
          };
          const analisisNestingCompuesto = {
            grupos: ['print', 'cut'].map((tipo) => ({
              aplicacion: { aplicado: true },
              lote: {
                id: tipo,
                ...(tipo === 'cut' ? { layoutOrigenLoteId: 'print' } : {}),
                materialVarianteId: variante.id,
                materialNombre: 'Material cotizado',
                duracionEstimadaMin: 30,
                nestingResult,
                participantes: ['x', 'y'].map((componenteCodigo, i) => ({
                  componenteCodigo,
                  rutaPasoId: tipo,
                  esPasoOperativo: i === 0,
                })),
              },
            })),
          };
          const componentesFabricados = ['izquierda', 'derecha'].map(
            (codigo) => ({
              codigo,
              nombre: codigo,
              recetaRevisionId: intermedia.id,
              cantidad: 10,
              jobContext: { cantidad: 10 },
              pasos: [paso('ensamble')],
              analisisNestingCompuesto,
              componentes: ['x', 'y'].map((codigo) => ({
                codigo,
                nombre: codigo,
                recetaRevisionId: hoja.id,
                cantidad: 30,
                jobContext: {
                  cantidad: 30,
                  piezas: [{ cantidad: 30, anchoMm: 10, altoMm: 20 }],
                },
                pasos: [paso('print'), paso('cut')],
                componentes: [],
              })),
            }),
          );
          const cotizacion = await tx.cotizacion.create({ data: { tenantId } });
          const cotizado = await tx.cotizacionItem.create({
            data: {
              tenantId,
              cotizacionId: cotizacion.id,
              productoId: ruta.productoId,
              cantidad: 10,
              jobContextJson: { cantidad: 10 },
              snapshotJson: {},
              trazabilidadJson: { componentesFabricados },
            },
          });
          const orden = await tx.ordenTrabajo.create({
            data: {
              tenantId,
              numero: 'PRUEBA-F4-ANIDADA',
              estado: 'pendiente',
            },
          });
          const padre = await tx.ordenTrabajoItem.create({
            data: {
              tenantId,
              ordenId: orden.id,
              recetaRevisionId: raiz.id,
              cotizacionItemId: cotizado.id,
              codigo: 'kit',
              nombre: 'Kit',
              familia: 'Prueba',
              cantidad: 10,
              cantidadUnidad: 'unidad',
              subtotal: 100,
              impuestos: 0,
              total: 100,
            },
          });
          await tx.ordenTrabajoItemPaso.create({
            data: {
              tenantId,
              ordenId: orden.id,
              itemId: padre.id,
              indice: 0,
              nodoClave: 'ruta:final',
              rutaPasoId: 'final',
              nombre: 'Final',
              familiaCodigo: 'trabajo_manual',
              categoriaFamilia: 'operaciones_manuales',
            },
          });
          const servicio = Object.create(OrdenesTrabajoService.prototype) as {
            materializarComponentesFabricados: (
              tx: Prisma.TransactionClient,
              tenant: string,
              padres: string[],
            ) => Promise<void>;
          };
          await servicio.materializarComponentesFabricados(tx, tenantId, [
            padre.id,
          ]);
          const leer = () =>
            tx.ordenTrabajoItem.findMany({
              where: { ordenId: orden.id },
              include: { pasos: { orderBy: { indice: 'asc' } } },
              orderBy: { codigo: 'asc' },
            });
          const antes = await leer();
          expect(antes).toHaveLength(7);
          const intermedios = antes.filter((i) => i.parentItemId === padre.id);
          expect(intermedios).toHaveLength(2);
          const operativos = antes
            .flatMap((i) => i.pasos)
            .filter((p) => p.nestingLoteRol === 'OPERATIVO');
          expect(operativos).toHaveLength(4);
          expect(new Set(operativos.map((p) => p.nestingLoteId)).size).toBe(4);
          for (const intermedio of intermedios) {
            expect(intermedio.trazabilidadSnapshotJson).toMatchObject({
              analisisNestingCompuesto,
            });
            const hijos = antes.filter((i) => i.parentItemId === intermedio.id);
            expect(hijos.map((i) => i.componenteCodigo)).toEqual(['x', 'y']);
            expect(hijos.every((i) => Number(i.cantidad) === 30)).toBe(true);
            const ops = hijos
              .flatMap((i) => i.pasos)
              .filter((p) => p.nestingLoteRol === 'OPERATIVO');
            const print = ops.find((p) => p.rutaPasoId === 'print')!;
            const cut = ops.find((p) => p.rutaPasoId === 'cut')!;
            expect(cut.nestingLoteSnapshotJson).toMatchObject({
              layoutOrigenLoteId: print.nestingLoteId,
              ambitoItemId: intermedio.id,
              nestingResult,
            });
            expect(
              hijos
                .flatMap((i) => i.pasos)
                .filter((p) => p.nestingLoteRol === 'PARTICIPANTE'),
            ).toHaveLength(2);
          }
          const dependencias = await tx.ordenTrabajoPasoDependencia.findMany({
            where: { ordenId: orden.id },
          });
          validarYOrdenarGrafo(
            antes
              .flatMap((i) => i.pasos)
              .map((p, indice) => ({ clave: p.id, indice })),
            dependencias.map((d) => ({
              desdeClave: d.predecesorPasoId,
              haciaClave: d.sucesorPasoId,
            })),
          );
          const trabajos = operativos.filter((p) => p.familiaCodigo === 'impresion_por_area');
          expect(trabajos).toHaveLength(2);
          for (const trabajo of trabajos) {
            const item = antes.find((i) => i.id === trabajo.itemId)!;
            const snapshot = snapshotPasoProduccion({ ...item, cotizacionItem: null }, trabajo);
            expect(snapshot.paso?.materiales?.find((m) => m.tipoLineaCosto === 'MATERIAL')?.materialVarianteId).toBe(variante.id);
            expect(snapshot.paso?.nestingResult?.placements).toEqual(
              nestingResult.placements,
            );
            expect(Number(trabajo.duracionEstimadaMin)).toBe(30);
          }
          // Una modificación del producto vivo no cambia la ejecución congelada.
          await tx.producto.update({
            where: { id: ruta.productoId },
            data: { nombre: 'Maestro modificado después de cotizar' },
          });
          await servicio.materializarComponentesFabricados(tx, tenantId, [
            padre.id,
          ]);
          const despues = await leer();
          const proyectar = (items: typeof antes) =>
            items.map((i) => ({
              id: i.id,
              nombre: i.nombre,
              contexto: i.jobContextSnapshotJson,
              traza: i.trazabilidadSnapshotJson,
              pasos: i.pasos.map((p) => ({
                id: p.id,
                lote: p.nestingLoteId,
                snapshot: p.nestingLoteSnapshotJson,
              })),
            }));
          expect(proyectar(despues)).toEqual(proyectar(antes));
          expect(
            await tx.ordenTrabajoPasoDependencia.count({
              where: { ordenId: orden.id },
            }),
          ).toBe(dependencias.length);
          const actor = await tx.user.findFirstOrThrow();
          const authOperacion = {
            tenantId, userId: actor.id, email: actor.email,
            permisos: new Set(['produccion.supervisar']),
          } as CurrentAuth;
          const { ordenes } = serviciosRecorridoF4(tx);
          const participacion = despues.flatMap((i) => i.pasos).find((p) => p.nestingLoteRol === 'PARTICIPANTE')!;
          await expect(ordenes.accionPaso(authOperacion, orden.id, participacion.itemId, participacion.id, { accion: 'completar' })).rejects.toThrow(/operación principal/);
          const final = despues.find((i) => i.id === padre.id)!.pasos[0];
          await expect(ordenes.accionPaso(authOperacion, orden.id, padre.id, final.id, { accion: 'completar' })).rejects.toThrow(/dependencias/);
          const ejecucion = await ejecutarOrdenF4(tx, ordenes, authOperacion, orden.id);
          expect(ejecucion.ejecutados).toBe(7);
          expect(await tx.ordenTrabajoPasoTramo.count({ where: { paso: { ordenId: orden.id, nestingLoteRol: 'PARTICIPANTE' } } })).toBe(0);
          comprobado = true;
          throw rollback;
        },
        { timeout: 25000 },
      ),
    ).rejects.toBe(rollback);
    expect(comprobado).toBe(true);
    expect(
      await db.ordenTrabajo.count({ where: { numero: 'PRUEBA-F4-ANIDADA' } }),
    ).toBe(0);
  });
});
