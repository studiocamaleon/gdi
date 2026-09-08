import { Prisma, PrismaClient } from '@prisma/client';
import { OrdenesTrabajoService } from '../src/ordenes-trabajo/ordenes-trabajo.service';
import { ProduccionService } from '../src/produccion/produccion.service';
import { EtaService } from '../src/eta/eta.service';
import { EnlacesPublicosService } from '../src/enlaces-publicos/enlaces-publicos.service';
import { FidelizacionService } from '../src/fidelizacion/fidelizacion.service';
import { FacturacionOrdenesService } from '../src/administracion/facturacion-ordenes.service';
import { DesarrolloDocumentalService } from '../src/desarrollo-documental/desarrollo-documental.service';
import { DatosEmpresaService } from '../src/tenants/datos-empresa.service';
import type { CurrentAuth } from '../src/auth/auth.types';
import { randomUUID } from 'node:crypto';
import type { MotorUniversalService } from '../src/motor-universal/motor.service';

// La transacción exterior permite ejecutar los servicios reales y revertir la
// fixture entera. No sirve para probar concurrencia entre transacciones.
export function serviciosRecorridoF4(
  tx: Prisma.TransactionClient | PrismaClient,
) {
  const prisma = new Proxy(tx, {
    get(target, prop) {
      if (prop === '$transaction' && !('$connect' in tx))
        return (fn: (client: Prisma.TransactionClient) => Promise<unknown>) =>
          fn(tx);
      return Reflect.get(target, prop);
    },
  });
  const produccion = new ProduccionService(prisma as never);
  const enlaces = new EnlacesPublicosService(prisma as never);
  const eta = new EtaService(prisma as never, produccion);
  const documentos = new DesarrolloDocumentalService(
    prisma as never,
    enlaces,
    {} as never,
  );
  const ordenes = new OrdenesTrabajoService(
    prisma as never,
    eta,
    {} as never,
    // Únicamente las comunicaciones y la preparación externa de recorridos se
    // aíslan. Cotización, materialización, DAG, gates, ejecución y ETA son reales.
    { sincronizar: async () => undefined } as never,
    enlaces,
    new DatosEmpresaService(prisma as never),
    {} as never,
    new FacturacionOrdenesService(prisma as never),
    { asegurarParaItem: async () => undefined } as never,
    new FidelizacionService(prisma as never),
    documentos,
  );
  return { prisma, produccion, enlaces, eta, documentos, ordenes };
}

export async function ejecutarOrdenF4(
  tx: Prisma.TransactionClient | PrismaClient,
  ordenes: OrdenesTrabajoService,
  auth: CurrentAuth,
  ordenId: string,
  verificarFrontera?: (paso: {
    id: string;
    familiaCodigo: string;
  }) => Promise<void>,
) {
  let ejecutados = 0;
  for (let vuelta = 0; vuelta < 100; vuelta++) {
    const pasos = await tx.ordenTrabajoItemPaso.findMany({
      where: { tenantId: auth.tenantId, ordenId },
      include: { dependenciasEntrantes: { include: { predecesor: true } } },
      orderBy: { indice: 'asc' },
    });
    if (pasos.every((p) => p.estado === 'hecho')) break;
    const siguiente = pasos.find(
      (p) =>
        p.estado !== 'hecho' &&
        p.nestingLoteRol !== 'PARTICIPANTE' &&
        (p.nodoClave
          ? p.dependenciasEntrantes.every(
              (d) => !d.obligatoria || d.predecesor.estado === 'hecho',
            )
          : pasos
              .filter(
                (otro) => otro.itemId === p.itemId && otro.indice < p.indice,
              )
              .every((otro) => otro.estado === 'hecho')),
    );
    expect(siguiente).toBeDefined();
    const p = siguiente!;
    await verificarFrontera?.(p);
    if (p.tipoEjecucion === 'tercerizado') {
      await ordenes.avanzarCompra(auth, p.id, 'pedido');
      await ordenes.avanzarCompra(auth, p.id, 'recibido');
      ejecutados++;
      continue;
    }
    if (p.modoRegistro === 'cronometro' && p.estado === 'pendiente')
      await ordenes.accionPaso(auth, ordenId, p.itemId, p.id, {
        accion: 'iniciar',
      });
    await ordenes.accionPaso(auth, ordenId, p.itemId, p.id, {
      accion: 'completar',
    });
    ejecutados++;
  }
  const orden = await tx.ordenTrabajo.findUniqueOrThrow({
    where: { id: ordenId },
    include: { pasos: true },
  });
  expect(orden.estado).toBe('finalizada');
  expect(orden.progresoPct).toBe(100);
  expect(orden.fechaFinalizada).not.toBeNull();
  expect(orden.pasos.every((p) => p.estado === 'hecho')).toBe(true);
  expect(
    orden.pasos
      .filter((p) => p.nestingLoteRol === 'PARTICIPANTE')
      .every((p) => Number(p.tiempoRealMin) === 0),
  ).toBe(true);
  expect(
    await tx.ordenTrabajoPasoTramo.count({
      where: { paso: { ordenId }, finEl: null },
    }),
  ).toBe(0);
  return { orden, ejecutados };
}

export async function emitirCotizacionF4(
  tx: Prisma.TransactionClient,
  guardada: Awaited<ReturnType<MotorUniversalService['cotizarYGuardar']>>,
) {
  const cotizado = await tx.cotizacionItem.findUniqueOrThrow({
    where: { id: guardada.cotizacionItemId! },
    include: { producto: true },
  });
  const tenantId = cotizado.tenantId;
  const actor = await tx.user.findFirstOrThrow();
  const auth = {
    tenantId,
    userId: actor.id,
    email: actor.email,
    permisos: new Set([
      'produccion.supervisar',
      'comercial.ver',
      'finanzas.ver_margenes',
    ]),
  } as CurrentAuth;
  const cliente = await tx.cliente.upsert({
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
  const { ordenes, ...servicios } = serviciosRecorridoF4(tx);
  const orden = await ordenes.create(auth, {
    idempotencyKey: randomUUID(),
    estado: 'pendiente',
    clienteId: cliente.id,
    cotizacionId: guardada.cotizacionId!,
    fechaEntrega: '2099-12-01',
    items: [
      {
        cotizacionItemId: cotizado.id,
        codigo: cotizado.producto.codigo,
        nombre: cotizado.producto.nombre,
        familia: 'Aceptación F4',
        cantidad: Number(cotizado.cantidad),
        cantidadUnidad: 'unidad',
        subtotal: 0,
        impuestos: 0,
        total: 0,
      },
    ],
  });
  expect(orden.total).toBe(Number(cotizado.precioTotal));
  return { ...servicios, ordenes, auth, orden, cotizado };
}
