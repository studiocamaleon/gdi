import { writeFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { MotorUniversalService } from './src/motor-universal/motor.service';
import { AplicarPrecioService } from './src/productos-servicios/precio/aplicar-precio.service';
import { PreciosEspecialesClientesService } from './src/productos-servicios/precio/precios-especiales-clientes/precios-especiales-clientes.service';

const prisma = new PrismaClient();
const tenantId = '5569e52a-e642-4124-9114-daedfdf0136e';

async function main() {
  const salida = process.argv[2];
  const motor = new MotorUniversalService(prisma as never, new AplicarPrecioService(), new PreciosEspecialesClientesService(prisma as never));
  const productos = await prisma.producto.findMany({ where: { tenantId, activo: true }, select: { id: true, codigo: true }, orderBy: { codigo: 'asc' } });

  const filas: Record<string, number> = {};
  for (const p of productos) {
    for (const cantidad of [100, 5000]) {
      const r = await motor.cotizar({ tenantId, productoId: p.id, jobContext: { cantidad, caras: 1 } });
      if (!r.exitoso) continue;
      const costoTiempo = r.cotizacion!.pasos.reduce(
        (acc, x) => acc + ((x.tiempo as unknown as { costoMaquina?: number; costoManoObra?: number } | undefined)
          ? ((x.tiempo as unknown as Record<string, number>).costoMaquina ?? 0) + ((x.tiempo as unknown as Record<string, number>).costoManoObra ?? 0)
          : 0),
        0,
      );
      filas[`${p.codigo}|${cantidad}`] = Math.round(costoTiempo);
    }
  }
  writeFileSync(salida, JSON.stringify(filas, null, 1));
  console.log(`${Object.keys(filas).length} mediciones guardadas en ${salida}`);
  await prisma.$disconnect();
}
void main();
