/**
 * Reparación puntual: rehace `saldoPosterior` de todos los movimientos de
 * todas las cuentas, en el orden en que los lee la vista.
 *
 * Hace falta una vez porque las acreditaciones con fecha retroactiva
 * dejaron viejo el saldo corrido de las filas posteriores (ver
 * CobrosService.recalcularSaldoCorrido, que ya lo previene de acá en más).
 *
 * No toca `CuentaFondos.saldo`: si el recalculado no coincide, lo reporta
 * para mirarlo a mano en vez de pisar el saldo bueno.
 *
 * Uso: npx ts-node -r tsconfig-paths/register reparar-saldo-corrido.ts [--aplicar]
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const aplicar = process.argv.includes('--aplicar');

async function main() {
  const cuentas = await prisma.cuentaFondos.findMany({
    select: { id: true, nombre: true, saldo: true, tenantId: true },
  });

  let filasMal = 0;
  for (const cuenta of cuentas) {
    const movs = await prisma.movimientoFondos.findMany({
      where: { cuentaId: cuenta.id },
      orderBy: [{ fecha: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        fecha: true,
        tipo: true,
        monto: true,
        concepto: true,
        saldoPosterior: true,
      },
    });
    if (movs.length === 0) continue;

    let saldo = 0;
    const correcciones: Array<{ id: string; de: number; a: number }> = [];
    for (const mov of movs) {
      saldo += (mov.tipo === 'entrada' ? 1 : -1) * Number(mov.monto);
      if (Number(mov.saldoPosterior) !== saldo) {
        correcciones.push({
          id: mov.id,
          de: Number(mov.saldoPosterior),
          a: saldo,
        });
        console.log(
          `  ${mov.fecha.toISOString().slice(0, 10)}  ${mov.concepto.slice(0, 34).padEnd(34)}` +
            `  ${Number(mov.saldoPosterior).toLocaleString('es-AR').padStart(13)}` +
            ` → ${saldo.toLocaleString('es-AR')}`,
        );
      }
    }

    const deriva = saldo - Number(cuenta.saldo);
    if (correcciones.length > 0 || deriva !== 0) {
      console.log(`\n${cuenta.nombre} (${correcciones.length} filas mal)`);
      if (deriva !== 0) {
        console.log(
          `  ⚠ el saldo recalculado (${saldo.toLocaleString('es-AR')}) no coincide` +
            ` con CuentaFondos.saldo (${Number(cuenta.saldo).toLocaleString('es-AR')}),` +
            ` deriva ${deriva.toLocaleString('es-AR')} — NO se toca, revisar a mano.`,
        );
      }
    }
    filasMal += correcciones.length;

    if (aplicar) {
      for (const c of correcciones) {
        await prisma.movimientoFondos.update({
          where: { id: c.id },
          data: { saldoPosterior: c.a },
        });
      }
    }
  }

  console.log(
    `\n${cuentas.length} cuentas revisadas · ${filasMal} filas con saldo corrido incorrecto` +
      (aplicar ? ' · CORREGIDAS' : ' · simulación (pasá --aplicar para escribir)'),
  );
  await prisma.$disconnect();
}

void main();
