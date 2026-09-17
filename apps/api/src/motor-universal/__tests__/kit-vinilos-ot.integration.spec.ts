import { declararUnidadPrecioFixture } from '../../../test/fixture-unidad-precio';
import { Prisma, PrismaClient } from '@prisma/client';
import { ProductosService } from '../../productos-servicios/productos.service';
import { ProductoValidacionService } from '../../productos-servicios/producto-validacion.service';
import { RecetasProductoService } from '../../productos-servicios/recetas-producto.service';
import { AplicarPrecioService } from '../../productos-servicios/precio/aplicar-precio.service';
import { PreciosEspecialesClientesService } from '../../productos-servicios/precio/precios-especiales-clientes/precios-especiales-clientes.service';
import { MotorUniversalService } from '../motor.service';
import {
  emitirCotizacionF4,
  ejecutarOrdenF4,
  serviciosRecorridoF4,
} from '../../../test/soporte-recorridos-f4';
import type { CurrentAuth } from '../../auth/auth.types';
import type { JobContext } from '../tipos';

const piezas = [
  {
    id: 'pieza1',
    tipo: 'RECTANGULAR',
    nombre: 'Pieza 1',
    cantidadPorUnidad: 1,
    medidas: { anchoMm: 300, altoMm: 100 },
  },
  {
    id: 'pieza2',
    tipo: 'RECTANGULAR',
    nombre: 'Pieza 2',
    cantidadPorUnidad: 2,
    medidas: { anchoMm: 400, altoMm: 500 },
  },
];

describe('Kit de Vinilos: receta publicada → motor → OT (PostgreSQL)', () => {
  const db = new PrismaClient();
  afterAll(() => db.$disconnect());
  it('conserva 3/30/150 piezas al guardar y ejecutar, y permite editar piezas y grupos sin multiplicar dos veces', async () => {
    const rollback = new Error('rollback kit F4');
    await expect(
      db.$transaction(
        async (tx) => {
          const { id: tenantId } = await tx.tenant.findUniqueOrThrow({
            where: { slug: 'gdi-demo' },
          });
          // La transacción revierte también la unidad declarada del seed histórico.
          await declararUnidadPrecioFixture(tx, tenantId);
          const user = await tx.user.findFirstOrThrow();
          const auth = {
            tenantId,
            userId: user.id,
            email: user.email,
          } as CurrentAuth;
          const { prisma } = serviciosRecorridoF4(tx);
          const productos = new ProductosService(prisma as never);
          const recetas = new RecetasProductoService(
            prisma as never,
            productos,
            new ProductoValidacionService(productos),
            { publicar: async () => undefined } as never,
          );
          const publicar = async (borrador: {
            id: string;
            updatedAt: Date;
          }) => {
            try {
              return await recetas.publicar(auth, borrador.id, {
                expectedUpdatedAt: borrador.updatedAt.toISOString(),
              });
            } catch (error) {
              throw new Error(
                JSON.stringify(
                  (error as { getResponse?: () => unknown }).getResponse?.() ??
                    error,
                ),
              );
            }
          };
          const viniloDb = await tx.producto.findFirstOrThrow({
            where: { tenantId, codigo: 'VINILO-BLANCO-IMP' },
          });
          const vinilo = await productos.obtenerProducto(tenantId, viniloDb.id);
          const rutaVinilo =
            vinilo.rutasAlternativas.find((r) => r.esPreferida) ??
            vinilo.rutasAlternativas[0];
          // El seed comercial permite cotizar sin laminado pero no trae su slot;
          // para publicar una receta completa declaramos también ese opcional.
          const laminado = rutaVinilo.configPasos.find(
            (p) => p.rutaPaso.familiaCodigo === 'laminado',
          )!;
          const film =
            await tx.productoConfigPasoSlotMaterialCandidato.findFirstOrThrow({
              where: {
                tenantId,
                slotMaterial: { slotCodigo: 'film' },
                defaultVarianteId: { not: null },
              },
            });
          await tx.productoConfigPasoSlotMaterial.create({
            data: {
              tenantId,
              productoConfigPasoId: laminado.id,
              slotCodigo: 'film',
              modoSeleccion: 'HARDCODED',
              materialVarianteId: film.defaultVarianteId,
              formula: 'por_metro_lineal',
            },
          });
          const borradorVinilo = await recetas.guardarBorrador(
            auth,
            vinilo.id,
            { rutaAlternativaId: rutaVinilo.id, componentes: [] },
          );
          await publicar(borradorVinilo);
          const padre = await tx.producto.create({
            data: {
              tenantId,
              subcategoriaComercialId: viniloDb.subcategoriaComercialId,
              codigo: 'PRUEBA-F4-KIT-VINILOS',
              nombre: 'Kit de Vinilos · aceptación',
              estructuraProducto: 'COMPUESTO',
              dimensionesRequeridas: [],
              modoMedidas: 'FIJA',
              precioConfigJson: {
                metodoCalculo: 'por_margen',
                detalle: { marginPct: 25 },
              },
              atributosComercialesJson: {
                nestingCompuesto: {
                  version: 1,
                  politica: 'CONSOLIDAR_COMPATIBLES',
                },
              },
            },
          });
          const ruta = await tx.ruta.create({
            data: {
              tenantId,
              codigo: 'PRUEBA-F4-KIT',
              nombre: 'Ensamble de kit',
            },
          });
          const paso = await tx.rutaPaso.create({
            data: {
              tenantId,
              rutaId: ruta.id,
              orden: 0,
              familiaCodigo: 'trabajo_manual',
              nombreVisible: 'Preparar kit',
            },
          });
          await tx.rutaVersion.create({
            data: {
              tenantId,
              rutaId: ruta.id,
              version: 1,
              snapshotJson: { pasos: [JSON.parse(JSON.stringify(paso))] },
            },
          });
          const alternativa = await tx.productoRutaAlternativa.create({
            data: {
              tenantId,
              productoId: padre.id,
              rutaId: ruta.id,
              rutaVersion: 1,
              nombre: ruta.nombre,
              esPreferida: true,
            },
          });
          const modelo = await tx.productoConfigPaso.findFirstOrThrow({
            where: { tenantId, rutaPaso: { familiaCodigo: 'embalaje' } },
          });
          await tx.productoConfigPaso.create({
            data: {
              tenantId,
              productoRutaAlternativaId: alternativa.id,
              rutaPasoId: paso.id,
              modoActivacion: 'OBLIGATORIO',
              modoTiempo: modelo.modoTiempo,
              mecanismoCantidad: modelo.mecanismoCantidad,
              paramsPasoJson: modelo.paramsPasoJson as Prisma.InputJsonValue,
              centroCostoId: modelo.centroCostoId,
              tiempoFijoOverrideMin: 5,
              setupOverrideMin: 0,
              cleanupOverrideMin: 0,
            },
          });
          const bindings = [
            {
              clave: 'cantidad',
              origen: 'PADRE',
              padreClave: 'cantidad',
              requerido: true,
            },
          ];
          for (const config of rutaVinilo.configPasos)
            for (const slot of config.slotsMateriales) {
              if (slot.modoSeleccion === 'COMERCIAL_ELIGE') {
                const varianteId = slot.candidatos.find(
                  (c) => c.defaultVarianteId,
                )?.defaultVarianteId;
                expect(varianteId).toBeDefined();
                bindings.push({
                  clave: `slotMaterial_${config.id}_${slot.slotCodigo}`,
                  origen: 'FIJO',
                  valor: varianteId,
                } as never);
              }
            }
          const configurar = async (
            minimo: number,
            cantidadComponentes = 1,
          ) => {
            const borrador = await recetas.guardarBorrador(auth, padre.id, {
              rutaAlternativaId: alternativa.id,
              componentes: Array.from(
                { length: cantidadComponentes },
                (_, i) => ({
                  productoComponenteId: vinilo.id,
                  codigo: i === 0 ? 'VINILO' : 'VINILO2',
                  nombre: 'Vinilos impresos',
                  cantidad: 1,
                  formula: 'por_unidad',
                  unidad: 'unidad',
                  requerido: true,
                  orden: i,
                  nodoIncorporacionClave: `ruta:${paso.id}`,
                  configuracionJson: {
                    version: 2,
                    piezas,
                    piezasEditables: true,
                    bindings,
                    repeticion: {
                      version: 1,
                      permitida: true,
                      minimo,
                      maximo: 20,
                    },
                  },
                }),
              ),
            });
            return publicar(borrador);
          };
          await configurar(1);
          const motor = new MotorUniversalService(
            prisma as never,
            new AplicarPrecioService(),
            new PreciosEspecialesClientesService(prisma as never),
            undefined,
            undefined,
            recetas,
          );
          for (const cantidad of [1, 10, 50]) {
            const guardada = await motor.cotizarYGuardar({
              tenantId,
              productoId: padre.id,
              periodo: '2026-06',
              jobContext: { cantidad },
            });
            expect(guardada.result.errores).toEqual([]);
            const componentes =
              guardada.result.cotizacion!.componentesFabricados!;
            expect(componentes).toHaveLength(1);
            expect(
              (componentes[0].jobContext as JobContext).piezas!.map(
                (p) => p.cantidad,
              ),
            ).toEqual([cantidad, cantidad * 2]);
            const {
              orden,
              ordenes,
              auth: operador,
            } = await emitirCotizacionF4(tx, guardada);
            const hijo = await tx.ordenTrabajoItem.findFirstOrThrow({
              where: { ordenId: orden.id, parentItemId: { not: null } },
            });
            expect(hijo.jobContextSnapshotJson).toMatchObject({
              cantidad,
              piezas: [{ cantidad }, { cantidad: cantidad * 2 }],
            });
            await ejecutarOrdenF4(tx, ordenes, operador, orden.id);
          }
          const editar = await motor.cotizar({
            tenantId,
            productoId: padre.id,
            periodo: '2026-06',
            jobContext: {
              cantidad: 10,
              componentesConfiguracion: {
                VINILO: {
                  piezas: [
                    {
                      ...piezas[0],
                      cantidadPorUnidad: 4,
                      medidas: { anchoMm: 250, altoMm: 150 },
                    },
                  ],
                },
              },
            },
          });
          expect(editar.errores).toEqual([]);
          expect(
            editar.cotizacion!.componentesFabricados![0].jobContext!.piezas,
          ).toMatchObject([{ cantidad: 40, anchoMm: 250, altoMm: 150 }]);
          await configurar(0);
          const vacio = await motor.cotizar({
            tenantId,
            productoId: padre.id,
            periodo: '2026-06',
            jobContext: { cantidad: 10 },
          });
          expect(vacio.errores).toEqual([]);
          expect(vacio.cotizacion!.componentesFabricados ?? []).toHaveLength(0);
          const grupos = await motor.cotizarYGuardar({
            tenantId,
            productoId: padre.id,
            periodo: '2026-06',
            jobContext: {
              cantidad: 10,
              componentesConfiguracion: {
                VINILO: {
                  __ocurrenciasAdicionales: [
                    {
                      id: 'sucursal-a',
                      nombre: 'Sucursal A',
                      valores: { piezas: [piezas[0]] },
                    },
                    {
                      id: 'sucursal-b',
                      nombre: 'Sucursal B',
                      valores: { piezas: [piezas[1]] },
                    },
                  ],
                },
              },
            },
          });
          expect(grupos.result.errores).toEqual([]);
          expect(
            grupos.result.cotizacion!.componentesFabricados!.map((c) =>
              (c.jobContext as JobContext).piezas!.reduce(
                (n, p) => n + p.cantidad,
                0,
              ),
            ),
          ).toEqual([10, 20]);
          const {
            orden,
            ordenes,
            auth: operador,
          } = await emitirCotizacionF4(tx, grupos);
          await ejecutarOrdenF4(tx, ordenes, operador, orden.id);

          // Dos kits contienen los mismos códigos internos. Cada kit debe retener
          // su propia operación de impresión consolidada y su propio snapshot.
          await configurar(1, 2);
          const superior = await productos.duplicarProducto(
            tenantId,
            padre.id,
            {
              nombre: 'Kit de dos kits',
              codigo: 'PRUEBA-F4-DOS-NIVELES',
              activo: true,
            },
          );
          const rutaSuperior =
            await tx.productoRutaAlternativa.findFirstOrThrow({
              where: { productoId: superior.id },
            });
          const borradorSuperior = await recetas.guardarBorrador(
            auth,
            superior.id,
            {
              rutaAlternativaId: rutaSuperior.id,
              componentes: ['izquierda', 'derecha'].map((codigo, i) => ({
                productoComponenteId: padre.id,
                codigo,
                nombre: codigo,
                cantidad: 1,
                formula: 'por_unidad',
                unidad: 'unidad',
                requerido: true,
                orden: i,
                nodoIncorporacionClave: `ruta:${paso.id}`,
                configuracionJson: {
                  version: 2,
                  bindings: [
                    {
                      clave: 'cantidad',
                      origen: 'PADRE',
                      padreClave: 'cantidad',
                    },
                  ],
                },
              })),
            },
          );
          await publicar(borradorSuperior);
          const anidada = await motor.cotizarYGuardar({
            tenantId,
            productoId: superior.id,
            periodo: '2026-06',
            jobContext: { cantidad: 10 },
          });
          expect(anidada.result.errores).toEqual([]);
          expect(anidada.result.cotizacion!.componentesFabricados).toHaveLength(
            2,
          );
          for (const kit of anidada.result.cotizacion!.componentesFabricados!) {
            expect(kit.componentes).toHaveLength(2);
            expect(kit.analisisNestingCompuesto?.aplicadoACostos).toBe(true);
          }
          const doble = await emitirCotizacionF4(tx, anidada);
          const antes = await tx.ordenTrabajoItem.findMany({
            where: { ordenId: doble.orden.id },
            include: { pasos: true },
            orderBy: { id: 'asc' },
          });
          expect(antes).toHaveLength(7);
          const impresiones = antes
            .flatMap((i) => i.pasos)
            .filter(
              (p) =>
                p.nestingLoteRol === 'OPERATIVO' &&
                p.familiaCodigo === 'impresion_por_area',
            );
          expect(impresiones).toHaveLength(2);
          expect(new Set(impresiones.map((p) => p.nestingLoteId)).size).toBe(2);
          await tx.producto.update({
            where: { id: vinilo.id },
            data: {
              nombre: 'Vinilo modificado después de vender',
              medidaDefaultAnchoMm: 9999,
            },
          });
          const lectura = await doble.ordenes.findOne(
            doble.auth,
            doble.orden.id,
          );
          expect(JSON.stringify(lectura)).not.toContain(
            'Vinilo modificado después de vender',
          );
          await ejecutarOrdenF4(tx, doble.ordenes, doble.auth, doble.orden.id);
          const despues = await tx.ordenTrabajoItem.findMany({
            where: { ordenId: doble.orden.id },
            orderBy: { id: 'asc' },
          });
          expect(
            despues.map((i) => [
              i.jobContextSnapshotJson,
              i.trazabilidadSnapshotJson,
              i.recetaRevisionId,
            ]),
          ).toEqual(
            antes.map((i) => [
              i.jobContextSnapshotJson,
              i.trazabilidadSnapshotJson,
              i.recetaRevisionId,
            ]),
          );
          throw rollback;
        },
        { timeout: 60000 },
      ),
    ).rejects.toBe(rollback);
    expect(
      await db.producto.count({ where: { codigo: 'PRUEBA-F4-KIT-VINILOS' } }),
    ).toBe(0);
  }, 65000);
});
