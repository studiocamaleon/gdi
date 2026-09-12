import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import type { PrismaService } from '../src/prisma/prisma.service';
import { cotizacionesExhibidor } from './fixtures/f6-planificacion/cotizaciones-exhibidor';

export async function crearFixtureLotesF6(
  tx: Prisma.TransactionClient,
  db: Pick<PrismaService, 'prepararSnapshot'>,
) {
  const tenant = await tx.tenant.findUniqueOrThrow({
    where: { slug: 'gdi-demo' },
  });
  const tenantId = tenant.id;
  const origen = await tx.productoRutaAlternativa.findFirstOrThrow({
    where: { tenantId },
  });
  const ruta = await tx.productoRutaAlternativa.create({
    data: {
      tenantId,
      productoId: origen.productoId,
      rutaId: origen.rutaId,
      rutaVersion: origen.rutaVersion,
      nombre: 'F6 lotes QA',
    },
  });
  const receta = await tx.productoReceta.create({
    data: {
      tenantId,
      productoId: origen.productoId,
      rutaAlternativaId: ruta.id,
      codigo: `F6-QA-${randomUUID()}`,
      nombre: 'Lotes ejecutables QA',
    },
  });
  const capturas = cotizacionesExhibidor();
  const c = capturas[0].cotizacion;
  const total = capturas[3].cotizacion;
  const hijo = c.componentesFabricados![0];
  const revision = async (numero: number, grafo: unknown) =>
    tx.productoRecetaRevision.create({
      data: {
        tenantId,
        recetaId: receta.id,
        numero,
        estado: 'PUBLICADA',
        creadaPorNombre: 'QA',
        rutaAlternativaId: ruta.id,
        rutaVersion: 1,
        huellaConfiguracion: `f6-${numero}`,
        snapshotJson: { grafoProduccion: grafo } as Prisma.InputJsonValue,
        grafoProduccionJson: grafo as Prisma.InputJsonValue,
      },
    });
  const rr = await revision(1, c.grafoProduccion),
    rh = await revision(2, hijo.grafoProduccion);
  c.receta = { revisionId: rr.id, version: 1, huella: rr.huellaConfiguracion };
  hijo.recetaRevisionId = rh.id;
  total.receta = c.receta;
  total.componentesFabricados![0].recetaRevisionId = rh.id;
  await tx.productoRecetaComponente.create({
    data: {
      tenantId,
      revisionId: rr.id,
      productoComponenteId: origen.productoId,
      recetaRevisionId: rh.id,
      recetaVersion: 2,
      recetaHuella: rh.huellaConfiguracion,
      codigo: hijo.codigo,
      nombre: hijo.nombre,
      nodoIncorporacionClave: hijo.nodoIncorporacionClave,
      nodosPredecesoresClaves: hijo.nodosPredecesoresClaves,
    },
  });
  const q = await tx.cotizacion.create({ data: { tenantId } });
  const qi = await tx.cotizacionItem.create({
    data: db.prepararSnapshot('CotizacionItem', {
      tenantId,
      cotizacionId: q.id,
      productoId: origen.productoId,
      cantidad: 200,
      recetaRevisionId: rr.id,
      recetaVersion: 1,
      recetaHuella: rr.huellaConfiguracion,
      snapshotJson: {},
      jobContextJson: { cantidad: 200 },
      trazabilidadJson: {
        pasos: total.pasos,
        componentesFabricados: total.componentesFabricados,
      } as unknown as Prisma.InputJsonValue,
    }),
  });
  const orden = await tx.ordenTrabajo.create({
    data: {
      tenantId,
      numero: `QA-${randomUUID()}`,
      estado: 'pendiente',
      total: 1000,
      items: {
        create: {
          tenantId,
          cotizacionItemId: qi.id,
          recetaRevisionId: rr.id,
          recetaVersion: 1,
          recetaHuella: rr.huellaConfiguracion,
          recetaSnapshotJson: rr.snapshotJson!,
          codigo: 'EXH',
          nombre: 'Exhibidor',
          familia: 'QA',
          cantidad: 200,
          cantidadUnidad: 'u',
          subtotal: 1000,
          impuestos: 0,
          total: 1000,
        },
      },
    },
    include: { items: true },
  });
  const raiz = orden.items[0];
  const plan = await tx.planEntregaItem.create({
    data: {
      tenantId,
      ordenItemId: raiz.id,
      revisionActual: 1,
      alternativaElegidaId: 'por-entrega',
      ajusteNestingAceptado: true,
    },
  });
  const rev = await tx.planEntregaRevision.create({
    data: {
      tenantId,
      planId: plan.id,
      numero: 1,
      idempotencyKey: randomUUID(),
      solicitudHuella: 'qa',
      origenHuella: 'qa',
      cantidad: 200,
      solicitadoPorId: randomUUID(),
      estado: 'LISTA',
      solicitudJson: {},
      resultadoJson: {
        politica: 'POR_ENTREGA',
        nesting: { estado: 'REQUIERE_AJUSTE' },
        resultado: {
          alternativas: [
            {
              id: 'por-entrega',
              estado: 'CONDICIONADA',
              operaciones: [0, 1, 2, 3].flatMap((i) =>
                [
                  ...c.pasos
                    .filter((p) => p.activado)
                    .map((p) => ({
                      p,
                      ambito: 'producto',
                      prefijo:
                        p.familiaCodigo === 'ensamble_estructural'
                          ? 'extra'
                          : 'ruta',
                    })),
                  ...hijo
                    .pasos!.filter((p) => p.activado)
                    .map((p) => ({
                      p,
                      ambito: `producto/${hijo.codigo}`,
                      prefijo:
                        p.familiaCodigo === 'corte_laser' ? 'extra' : 'ruta',
                    })),
                ].map(({ p, ambito, prefijo }) => ({
                  id: `${i}-${p.rutaPasoId}`,
                  operacion: `${ambito}/${prefijo}:${p.rutaPasoId}`,
                  desde: i * 50,
                  hasta: (i + 1) * 50,
                  medicion: {
                    preparacionMin: 0,
                    ejecucionMin: p.tiempo!.totalMin,
                  },
                })),
              ),
              traza: [0, 1, 2, 3].flatMap((i) =>
                [...c.pasos, ...hijo.pasos!]
                  .filter((p) => p.activado)
                  .map((p) => ({
                    pasoId: `${i}-${p.rutaPasoId}`,
                    inicio: `2026-09-${15 + i}T12:00:00.000Z`,
                  })),
              ),
              entregas: [0, 1, 2, 3].map((i) => ({
                id: `e${i}`,
                fechaSugerida: `2026-09-${15 + i}`,
              })),
            },
          ],
        },
      },
      entregas: {
        create: [0, 1, 2, 3].map((i) => ({
          clave: `e${i}`,
          secuencia: i,
          cantidad: 50,
        })),
      },
    },
  });
  await tx.fuenteProduccionEntrega.create({
    data: db.prepararSnapshot('FuenteProduccionEntrega', {
      tenantId,
      revisionId: rev.id,
      cantidad: 50,
      calculoJson: c as unknown as Prisma.InputJsonValue,
      contextoJson: { cantidad: 50 },
    }),
  });
  return { tenantId, raiz, plan, rev, c, orden, ruta, receta, cotizacion: q };
}
