import { Prisma, PrismaClient } from '@prisma/client';
import { OrdenesTrabajoService } from '../ordenes-trabajo.service';
import { compilarRutaLineal, validarYOrdenarGrafo } from '../grafo-produccion';
import {
  ejecutarOrdenF4,
  serviciosRecorridoF4,
} from '../../../test/soporte-recorridos-f4';
import type { CurrentAuth } from '../../auth/auth.types';

describe('incorporación de componentes en pasos opcionales (PostgreSQL)', () => {
  const db = new PrismaClient();
  afterAll(() => db.$disconnect());

  it.each([
    {
      caso: 'conserva la incorporación activa',
      activado: true,
      materializado: true,
      siguientes: true,
      declarado: true,
      error: false,
    },
    {
      caso: 'salta opcionales hasta cada primer sucesor activo',
      activado: false,
      materializado: false,
      siguientes: true,
      declarado: true,
      error: false,
    },
    {
      caso: 'espera ambos componentes cuando no hay sucesores activos',
      activado: false,
      materializado: false,
      siguientes: false,
      declarado: true,
      error: false,
    },
    {
      caso: 'rechaza una incorporación activa que falta en la OT',
      activado: true,
      materializado: false,
      siguientes: true,
      declarado: true,
      error: true,
    },
    {
      caso: 'rechaza una incorporación sin evidencia de desactivación',
      activado: undefined,
      materializado: false,
      siguientes: true,
      declarado: true,
      error: true,
    },
    {
      caso: 'rechaza una incorporación ausente de la receta congelada',
      activado: false,
      materializado: false,
      siguientes: true,
      declarado: false,
      error: true,
    },
  ])('$caso', async (escenario) => {
    const rollback = new Error('revertir prueba de incorporación');
    await expect(
      db.$transaction(
        async (tx) => {
          const { id: tenantId } = await tx.tenant.findUniqueOrThrow({
            where: { slug: 'gdi-demo' },
          });
          const origen = await tx.productoRutaAlternativa.findFirstOrThrow({
            where: { tenantId },
          });
          const ruta = await tx.productoRutaAlternativa.create({
            data: {
              tenantId,
              productoId: origen.productoId,
              rutaId: origen.rutaId,
              rutaVersion: origen.rutaVersion,
              nombre: 'Prueba incorporación opcional',
            },
          });
          const receta = await tx.productoReceta.create({
            data: {
              tenantId,
              productoId: origen.productoId,
              rutaAlternativaId: ruta.id,
              codigo: 'QA-INCORPORACION',
              nombre: 'Incorporación opcional',
            },
          });
          const claves = [
            'preparacion',
            'incorporacion',
            'opcional',
            'pintura',
            'control',
            'final',
          ];
          const grafo = validarYOrdenarGrafo(
            claves
              .filter(
                (clave) => escenario.declarado || clave !== 'incorporacion',
              )
              .map((clave, indice) => ({ clave: `ruta:${clave}`, indice })),
            (escenario.declarado
              ? [
                  ['preparacion', 'incorporacion'],
                  ['incorporacion', 'opcional'],
                  ['opcional', 'pintura'],
                  ['opcional', 'control'],
                  ['pintura', 'final'],
                  ['control', 'final'],
                ]
              : [
                  ['preparacion', 'pintura'],
                  ['pintura', 'final'],
                ]
            ).map(([desde, hacia]) => ({
              desdeClave: `ruta:${desde}`,
              haciaClave: `ruta:${hacia}`,
            })),
          );
          const crearRevision = (numero: number, grafoRevision: typeof grafo) =>
            tx.productoRecetaRevision.create({
              data: {
                tenantId,
                recetaId: receta.id,
                numero,
                estado: 'PUBLICADA',
                creadaPorNombre: 'Prueba',
                rutaAlternativaId: ruta.id,
                rutaVersion: 1,
                huellaConfiguracion: `qa-${numero}`,
                snapshotJson: { pasos: grafoRevision.nodos },
                grafoProduccionJson: grafoRevision,
              },
            });
          const revisionPadre = await crearRevision(1, grafo);
          const revisionHija = await crearRevision(
            2,
            compilarRutaLineal([{ clave: 'ruta:corte', indice: 0 }]),
          );
          for (const codigo of ['polyfan', 'acrilico']) {
            await tx.productoRecetaComponente.create({
              data: {
                tenantId,
                revisionId: revisionPadre.id,
                productoComponenteId: origen.productoId,
                recetaRevisionId: revisionHija.id,
                recetaVersion: 2,
                recetaHuella: revisionHija.huellaConfiguracion,
                codigo,
                nombre: codigo,
                politicaEjecucion: 'INDEPENDIENTE',
                nodoIncorporacionClave: 'ruta:incorporacion',
                nodosPredecesoresClaves: ['ruta:preparacion'],
              },
            });
          }
          const orden = await tx.ordenTrabajo.create({
            data: { tenantId, numero: 'QA-INCORPORACION', estado: 'pendiente' },
          });
          const trazaPaso = (
            rutaPasoId: string,
            activado: boolean | undefined,
          ) => ({
            rutaPasoId,
            activado,
            familiaCodigo: 'trabajo_manual',
            nombreVisible: rutaPasoId,
            tiempo: { totalMin: 5 },
            costoTotal: 5,
          });
          const activas = [
            'preparacion',
            ...(escenario.materializado ? ['incorporacion'] : []),
            ...(escenario.siguientes ? ['pintura', 'control', 'final'] : []),
          ];
          const traza = {
            pasos: claves.map((clave) =>
              trazaPaso(
                clave,
                clave === 'incorporacion'
                  ? escenario.activado
                  : activas.includes(clave),
              ),
            ),
            componentesFabricados: ['polyfan', 'acrilico'].map((codigo) => ({
              codigo,
              nombre: codigo,
              jobContext: { cantidad: 1 },
              pasos: [trazaPaso('corte', true)],
            })),
          };
          const padre = await tx.ordenTrabajoItem.create({
            data: {
              tenantId,
              ordenId: orden.id,
              recetaRevisionId: revisionPadre.id,
              trazabilidadSnapshotJson: JSON.parse(
                JSON.stringify(traza),
              ) as Prisma.InputJsonValue,
              codigo: 'cartel',
              nombre: 'Cartel',
              familia: 'Prueba',
              cantidad: 1,
              cantidadUnidad: 'unidad',
              subtotal: 100,
              impuestos: 0,
              total: 100,
            },
          });
          await tx.ordenTrabajoItemPaso.createMany({
            data: activas.map((clave, indice) => ({
              tenantId,
              ordenId: orden.id,
              itemId: padre.id,
              indice,
              nodoClave: `ruta:${clave}`,
              rutaPasoId: clave,
              nombre: clave,
              familiaCodigo: 'trabajo_manual',
              categoriaFamilia: 'operaciones_manuales',
            })),
          });
          const servicio = Object.create(OrdenesTrabajoService.prototype) as {
            materializarComponentesFabricados: (
              tx: Prisma.TransactionClient,
              tenant: string,
              padres: string[],
            ) => Promise<void>;
          };
          const materializar = () =>
            servicio.materializarComponentesFabricados(tx, tenantId, [
              padre.id,
            ]);
          if (escenario.error) {
            await expect(materializar()).rejects.toThrow(
              /nodo de incorporación/,
            );
            throw rollback;
          }
          await materializar();
          const items = await tx.ordenTrabajoItem.findMany({
            where: { ordenId: orden.id },
            include: { pasos: true },
          });
          const hijos = items.filter((item) => item.parentItemId === padre.id);
          expect(hijos).toHaveLength(2);
          expect(hijos.every((hijo) => hijo.pasos.length === 1)).toBe(true);
          const pasos = items.flatMap((item) => item.pasos);
          expect(pasos).toHaveLength(activas.length + 2);
          const dependencias = await tx.ordenTrabajoPasoDependencia.findMany({
            where: { ordenId: orden.id },
          });
          const preparacion = pasos.find(
            (paso) =>
              paso.itemId === padre.id && paso.nodoClave === 'ruta:preparacion',
          )!;
          for (const hijo of hijos) {
            expect(dependencias).toEqual(
              expect.arrayContaining([
                expect.objectContaining({
                  predecesorPasoId: preparacion.id,
                  sucesorPasoId: hijo.pasos[0].id,
                }),
              ]),
            );
            const destinos = dependencias
              .filter((d) => d.predecesorPasoId === hijo.pasos[0].id)
              .map(
                (d) => pasos.find((p) => p.id === d.sucesorPasoId)!.nodoClave,
              )
              .sort();
            expect(destinos).toEqual(
              escenario.materializado
                ? ['ruta:incorporacion']
                : escenario.siguientes
                  ? ['ruta:control', 'ruta:pintura']
                  : [],
            );
            expect(Number(hijo.pasos[0].duracionEstimadaMin)).toBe(5);
          }
          validarYOrdenarGrafo(
            pasos.map((p, indice) => ({ clave: p.id, indice })),
            dependencias.map((d) => ({
              desdeClave: d.predecesorPasoId,
              haciaClave: d.sucesorPasoId,
            })),
          );
          await materializar();
          expect(
            await tx.ordenTrabajoItemPaso.count({
              where: { ordenId: orden.id },
            }),
          ).toBe(pasos.length);
          expect(
            await tx.ordenTrabajoPasoDependencia.count({
              where: { ordenId: orden.id },
            }),
          ).toBe(dependencias.length);

          const { ordenes } = serviciosRecorridoF4(tx);
          const actor = await tx.user.findFirstOrThrow();
          const auth = {
            tenantId,
            userId: actor.id,
            email: actor.email,
            permisos: new Set(['produccion.supervisar']),
          } as CurrentAuth;
          const completar = (p: typeof preparacion) =>
            ordenes.accionPaso(auth, orden.id, p.itemId, p.id, {
              accion: 'completar',
              sinTiempoConfirmado: true,
            });
          await expect(completar(hijos[0].pasos[0])).rejects.toThrow(
            /dependencias/,
          );
          await completar(preparacion);
          await completar(hijos[0].pasos[0]);
          expect(
            (
              await tx.ordenTrabajo.findUniqueOrThrow({
                where: { id: orden.id },
              })
            ).estado,
          ).not.toBe('finalizada');
          if (escenario.siguientes) {
            const clave = escenario.materializado
              ? 'ruta:incorporacion'
              : 'ruta:pintura';
            await expect(
              completar(pasos.find((p) => p.nodoClave === clave)!),
            ).rejects.toThrow(/dependencias/);
          }
          await ejecutarOrdenF4(tx, ordenes, auth, orden.id);
          throw rollback;
        },
        { timeout: 25000 },
      ),
    ).rejects.toBe(rollback);
  });
});
