/** Uso desde apps/api:
 * node --env-file=.env -r ts-node/register scripts/reconciliar-anticipos-historicos.ts
 *   --tenant UUID --cliente UUID [--aplicar --respaldo /ruta/nueva.json]
 * Sin --aplicar simula dentro de una transacción que se revierte íntegramente.
 */
import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'node:fs';
import type { PrismaService } from '../src/prisma/prisma.service';
import { FacturacionOrdenesService } from '../src/administracion/facturacion-ordenes.service';
import { reconciliarAnticiposHistoricos } from '../src/administracion/reconciliacion-anticipos';
import { FidelizacionService } from '../src/fidelizacion/fidelizacion.service';

const arg = (nombre: string) => process.argv[process.argv.indexOf(nombre) + 1];
const aplicar = process.argv.includes('--aplicar');
const tenantId = arg('--tenant');
const clienteId = arg('--cliente');
const respaldo = process.argv.includes('--respaldo') ? arg('--respaldo') : null;
const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
const prisma = new PrismaClient();
const motor = new FacturacionOrdenesService(prisma as PrismaService);
const fidelizacion = new FidelizacionService(prisma as PrismaService);
const simulacion = new Error('SIMULACION');

async function main() {
  if (!uuid.test(tenantId) || !uuid.test(clienteId) || (aplicar && !respaldo)) {
    throw new Error(
      'Requiere --tenant UUID --cliente UUID y, para aplicar, --respaldo /ruta/nueva.json.',
    );
  }
  let resultado: unknown;
  try {
    await prisma.$transaction(
      async (tx) => {
        await tx.cliente.findFirstOrThrow({
          where: { id: clienteId, tenantId },
        });
        const filtro = { tenantId, clienteId };
        const antes = {
          ordenes: await tx.ordenTrabajo.findMany({
            where: filtro,
            select: {
              id: true,
              numero: true,
              estado: true,
              total: true,
              cobradoTotal: true,
            },
          }),
          cobros: await tx.cobro.findMany({
            where: filtro,
            include: { aplicacionesOrden: true, imputaciones: true },
          }),
          comprobantes: await tx.comprobante.findMany({ where: filtro }),
          fidelizacion: await tx.fidelizacionMovimiento.findMany({
            where: filtro,
          }),
        };
        if (respaldo && aplicar)
          writeFileSync(
            respaldo,
            JSON.stringify(
              { tenantId, clienteId, fecha: new Date(), ...antes },
              null,
              2,
            ),
            { flag: 'wx', mode: 0o600 },
          );
        const correcciones = await reconciliarAnticiposHistoricos(
          tx,
          motor,
          tenantId,
          clienteId,
        );
        for (const orden of antes.ordenes)
          await fidelizacion.reconciliarOrden(tx, tenantId, orden.id);
        const despues = await tx.ordenTrabajo.findMany({
          where: { ...filtro, estado: { in: ['finalizada', 'entregada'] } },
          select: {
            numero: true,
            total: true,
            cobradoTotal: true,
            aplicacionesCobro: {
              select: {
                monto: true,
                cobro: { select: { numeroRecibo: true, anuladoEl: true } },
              },
            },
          },
          orderBy: { numero: 'asc' },
        });
        resultado = {
          modo: aplicar ? 'aplicado' : 'simulacion',
          correcciones,
          ordenes: despues,
        };
        if (!aplicar) throw simulacion;
      },
      { isolationLevel: 'Serializable', timeout: 30000 },
    );
  } catch (error) {
    if (error !== simulacion) throw error;
  }
  console.log(JSON.stringify(resultado, null, 2));
}
main()
  .catch((e: unknown) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
