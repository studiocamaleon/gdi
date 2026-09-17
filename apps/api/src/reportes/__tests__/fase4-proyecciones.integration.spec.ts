import { PrismaClient } from '@prisma/client';
import { RentabilidadService } from '../rentabilidad.service';
import { ProductoService } from '../producto.service';
import { VentasService } from '../ventas.service';
import { ReporteProduccionService } from '../produccion.service';
import { consolidarEtapasCompuestas } from '../../motor-universal/etapas-compuestas';
import type {
  PasoEjecutado,
  MaterialEjecutado,
} from '../../motor-universal/tipos';

describe('proyecciones comerciales y económicas de F4 (PostgreSQL)', () => {
  const db = new PrismaClient();
  afterAll(() => db.$disconnect());
  const fecha = new Date('2098-11-14T12:00:00Z');
  const rango = {
    desde: new Date('2098-11-14'),
    hasta: new Date('2098-11-14'),
    zona: 'UTC',
  };
  const material = (costoTotal: number, tipoLineaCosto = 'MATERIAL') =>
    ({
      tipoLineaCosto,
      costoTotal,
      cantidad: costoTotal,
      unidad: 'hoja',
      materiaPrimaNombre: 'Material de prueba',
    }) as MaterialEjecutado;

  it.each(
    ['GENERAL', 'MIXTO', 'POR_COMPONENTE'].flatMap((estrategia) =>
      [false, true].map((historico) => ({ estrategia, historico })),
    ),
  )(
    'lee el costo $estrategia (histórico=$historico) sin duplicar operaciones',
    async ({ estrategia, historico }) => {
      const rollback = new Error('revertir proyección');
      await expect(
        db.$transaction(
          async (tx) => {
            const { id: tenantId } = await tx.tenant.findUniqueOrThrow({
              where: { slug: 'gdi-demo' },
            });
            const producto = await tx.producto.findFirstOrThrow({
              where: { tenantId },
            });
            const internos = consolidarEtapasCompuestas([
              {
                rutaPasoId: 'interno',
                rutaPasoOrden: 0,
                contenedorClave: 'ruta:etapa',
                activado: true,
                familiaCodigo: 'trabajo_manual',
                costoTotal: 35,
                tiempo: {
                  costo: 25,
                  totalMin: 25,
                  setupMin: 0,
                  runMin: 25,
                  cleanupMin: 0,
                  tiempoFijoMin: 0,
                },
                materiales: [material(10)],
              },
              {
                rutaPasoId: 'externo',
                rutaPasoOrden: 1,
                contenedorClave: 'ruta:etapa',
                activado: true,
                familiaCodigo: 'trabajo_manual',
                tercerizado: true,
                costoTotal: 55,
                materiales: [material(5)],
              },
            ] as PasoEjecutado[]);
            expect(internos[0].costoTercerizado).toBe(50);
            if (historico) {
              delete internos[0].costoTercerizado;
              for (const op of internos[0].operacionesInternas ?? []) {
                delete op.tercerizado;
                delete op.costoTercerizado;
              }
            }
            const traza = {
              desgloseCostosPricingCompuesto: { estrategia },
              pasos: [
                { activado: true, costoTotal: 20, materiales: [material(20)] },
                ...internos,
                {
                  activado: true,
                  costoTotal: 60,
                  tiempo: { costo: 60 },
                  operacionesIncorporacion: [{ costo: 60 }],
                },
                {
                  activado: false,
                  costoTotal: 999,
                  materiales: [material(999)],
                },
              ],
              componentesFabricados: [
                {
                  codigo: 'hijo',
                  costoTotal: 105,
                  pasos: [
                    {
                      materiales: [
                        material(70),
                        material(10, 'CONSUMIBLE_MAQUINA'),
                        material(5, 'DESGASTE_MAQUINA'),
                      ],
                    },
                  ],
                  componentes: [
                    {
                      codigo: 'nieto',
                      costoTotal: 20,
                      pasos: [{ materiales: [material(20)] }],
                    },
                  ],
                  operacionesIncorporacion: [{ costo: 60 }],
                  analisisNestingCompuesto: {
                    grupos: [{ lote: { costoMaterialTotal: 20 } }],
                  },
                },
              ],
            };
            const cotizacion = await tx.cotizacion.create({
              data: { tenantId },
            });
            const cotizado = await tx.cotizacionItem.create({
              data: {
                tenantId,
                cotizacionId: cotizacion.id,
                productoId: producto.id,
                cantidad: 1,
                jobContextJson: { cantidad: 1 },
                snapshotJson: {},
                costoTotal: 275,
                trazabilidadJson: JSON.parse(JSON.stringify(traza)),
              },
            });
            const orden = await tx.ordenTrabajo.create({
              data: {
                tenantId,
                numero: `PRUEBA-F4-ECONOMIA-${estrategia}`,
                estado: 'produccion',
                fechaEmision: fecha,
              },
            });
            const raiz = await tx.ordenTrabajoItem.create({
              data: {
                tenantId,
                ordenId: orden.id,
                cotizacionItemId: cotizado.id,
                codigo: 'KIT',
                nombre: 'Kit',
                familia: 'Kit',
                cantidad: 1,
                cantidadUnidad: 'unidad',
                subtotal: 400,
                impuestos: 0,
                total: 400,
              },
            });
            for (let i = 0; i < 6; i++) {
              const hijo = await tx.ordenTrabajoItem.create({
                data: {
                  tenantId,
                  ordenId: orden.id,
                  parentItemId: raiz.id,
                  codigo: `hijo-${i}`,
                  nombre: 'Interno',
                  familia: 'Componente',
                  cantidad: 1,
                  cantidadUnidad: 'unidad',
                  subtotal: 0,
                  impuestos: 0,
                  total: 0,
                },
              });
              await tx.ordenTrabajoItemPaso.create({
                data: {
                  tenantId,
                  ordenId: orden.id,
                  itemId: hijo.id,
                  indice: 0,
                  nombre: 'Impresión',
                  familiaCodigo: 'impresion_por_area',
                  categoriaFamilia: 'produccion',
                  estado: 'hecho',
                  completadoEl: fecha,
                  duracionEstimadaMin: i ? 0 : 60,
                  tiempoRealMin: i ? 0 : 60,
                  tiempoFuente: 'medido_lote',
                  nestingLoteRol: i ? 'PARTICIPANTE' : 'OPERATIVO',
                },
              });
            }
            const rentabilidad = await new RentabilidadService(
              tx as never,
            ).periodo(tenantId, rango);
            expect(rentabilidad).toMatchObject({
              ventas: 400,
              costoTotal: 275,
              costosVariables: 190,
              contribucion: 210,
              itemsSinCosto: 0,
            });
            const reporte = await new ProductoService(tx as never).producto(
              tenantId,
              rango,
            );
            expect(reporte.porProducto).toHaveLength(1);
            expect(reporte.porProducto[0]).toMatchObject({
              items: 1,
              costosVariables: 190,
              costo: 275,
            });
            expect(reporte.porPapel.reduce((s, m) => s + m.costo, 0)).toBe(125);
            expect(reporte.consumoTintas.reduce((s, m) => s + m.costo, 0)).toBe(
              10,
            );
            const ventas = new VentasService(tx as never) as unknown as {
              totales: (
                tenant: string,
                periodo: typeof rango,
              ) => Promise<unknown>;
            };
            expect(await ventas.totales(tenantId, rango)).toEqual({
              ventas: 400,
              ordenes: 1,
              items: 1,
            });
            const produccion = new ReporteProduccionService(
              tx as never,
            ) as unknown as {
              throughput: (
                tenant: string,
                periodo: typeof rango,
              ) => Promise<unknown>;
              eficiencia: (
                tenant: string,
                periodo: typeof rango,
              ) => Promise<{
                porFamilia: Array<{
                  muestras: number;
                  realMin: number;
                  estimadoMin: number;
                }>;
              }>;
            };
            expect(await produccion.throughput(tenantId, rango)).toEqual([
              { fecha: '2098-11-14', cantidad: 1 },
            ]);
            expect(
              (await produccion.eficiencia(tenantId, rango)).porFamilia,
            ).toEqual([
              expect.objectContaining({
                muestras: 1,
                realMin: 60,
                estimadoMin: 60,
              }),
            ]);
            throw rollback;
          },
          { timeout: 25000 },
        ),
      ).rejects.toBe(rollback);
      expect(
        await db.ordenTrabajo.count({
          where: { numero: `PRUEBA-F4-ECONOMIA-${estrategia}` },
        }),
      ).toBe(0);
    },
    // La transacción dispone de 25 s; el test también espera su rollback
    // y comprueba que no dejó órdenes persistidas.
    30_000,
  );
});
