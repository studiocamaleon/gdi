/** Cambia sólo la representación, registro a registro y con control de versión.
 * TS_NODE_PROJECT=tsconfig.json node -r ts-node/register scripts/compactar-snapshots-f4.ts --tenant=UUID [--aplicar] [--restaurar]
 * Sin --aplicar sólo informa. --restaurar permite volver al JSON expandido.
 * Ejecutar con todos los procesos API/worker actualizados al lector nuevo.
 */
import { Prisma, PrismaClient } from '@prisma/client';
import {
  prepararDatosSnapshot,
  restaurarDatosSnapshot,
} from '../src/prisma/snapshots.extension';

const tenantId = process.argv.find((a) => a.startsWith('--tenant='))?.slice(9);
if (!tenantId || !/^[a-f0-9-]{36}$/i.test(tenantId))
  throw new Error('Indicá --tenant=UUID.');
const aplicar = process.argv.includes('--aplicar');
const restaurar = process.argv.includes('--restaurar');
const db = new PrismaClient();
const modelos = [
  ['CotizacionItem', ['trazabilidadJson', 'jobContextJson', 'snapshotJson']],
  [
    'OrdenTrabajoItem',
    [
      'trazabilidadSnapshotJson',
      'jobContextSnapshotJson',
      'recetaSnapshotJson',
    ],
  ],
  ['OrdenTrabajoItemPaso', ['nestingLoteSnapshotJson']],
] as const;
async function main() {
  const resumen = [];
  for (const [nombre, campos] of modelos) {
    const versionado = Prisma.dmmf.datamodel.models
      .find((m) => m.name === nombre)!
      .fields.some((f) => f.name === 'updatedAt');
    const modelo = (db as any)[nombre[0].toLowerCase() + nombre.slice(1)];
    const fila = {
      modelo: nombre,
      leidos: 0,
      candidatos: 0,
      modificados: 0,
      conflictos: 0,
      bytesAntes: 0,
      bytesDespues: 0,
    };
    let cursor: string | undefined;
    for (;;) {
      // Sólo IDs en cada página; nunca mantener veinte snapshots grandes en RAM.
      const ids = await modelo.findMany({
        where: { tenantId },
        select: { id: true },
        orderBy: { id: 'asc' },
        take: 20,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      if (!ids.length) break;
      for (const { id } of ids) {
        const registro = await modelo.findFirst({
          where: { id, tenantId },
          select: {
            id: true,
            ...(versionado ? { updatedAt: true } : {}),
            ...Object.fromEntries(campos.map((c) => [c, true])),
          },
        });
        if (!registro) continue;
        fila.leidos++;
        const originales = Object.fromEntries(
          campos.map((c) => [c, registro[c]]),
        );
        const preparados = restaurar
          ? restaurarDatosSnapshot(nombre, originales)
          : prepararDatosSnapshot(nombre, originales);
        const cambios = Object.fromEntries(
          campos
            .filter((c) => preparados[c] !== originales[c])
            .map((c) => [c, preparados[c]]),
        );
        if (!Object.keys(cambios).length) continue;
        fila.candidatos++;
        fila.bytesAntes += Buffer.byteLength(JSON.stringify(originales));
        fila.bytesDespues += Buffer.byteLength(JSON.stringify(preparados));
        if (aplicar) {
          const update = await modelo.updateMany({
            where: {
              id,
              tenantId,
              ...(versionado
                ? { updatedAt: registro.updatedAt }
                : {
                    // Los ítems de OT no tienen updatedAt. Comparar los campos
                    // originales impide pisar una edición concurrente del plan.
                    AND: campos.map((c) => ({
                      [c]: { equals: originales[c] ?? Prisma.AnyNull },
                    })),
                  }),
            },
            // No aparentar una edición comercial: valores y fecha histórica se conservan.
            data: {
              ...cambios,
              ...(versionado ? { updatedAt: registro.updatedAt } : {}),
            },
          });
          fila.modificados += update.count;
          if (!update.count) fila.conflictos++;
        }
        await new Promise<void>((resolve) => setImmediate(resolve));
      }
      cursor = ids[ids.length - 1].id;
    }
    resumen.push(fila);
  }
  console.log(
    JSON.stringify({ tenantId, aplicar, restaurar, resumen }, null, 2),
  );
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
