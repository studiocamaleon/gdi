/** Valida la OT reportada con el motor real. Por defecto revierte las nuevas
 * revisiones; --guardar conserva exclusivamente los archivos en BORRADOR. */
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { PrismaClient, type Prisma } from '@prisma/client';
import { PreparacionesRecorridoService } from '../src/recorridos-vectoriales/preparaciones-recorrido.service';
import { RecorridosVectorialesService } from '../src/recorridos-vectoriales/recorridos-vectoriales.service';
import { serviciosRecorridoF4 } from './soporte-recorridos-f4';
import type { CurrentAuth } from '../src/auth/auth.types';

const db = new PrismaClient();
const rollback = new Error('ROLLBACK_VALIDACION_ARCHIVOS_OT53');
async function main() {
  try {
    await db.$transaction(async (tx) => {
      const orden = await tx.ordenTrabajo.findUniqueOrThrow({ where: { id: '09ba9cf7-4948-4cfd-82c3-6dde3321df6e' }, include: { items: { include: { pasos: true } } } });
      const hijo = orden.items.find((i) => i.pasos.some((p) => p.familiaCodigo === 'corte_hilo_caliente'))!;
      assert.ok(hijo?.parentItemId);
      const paso = hijo.pasos.find((p) => p.familiaCodigo === 'corte_hilo_caliente')!;
      const actor = await tx.user.findFirstOrThrow();
      const auth = { tenantId: orden.tenantId, userId: actor.id, email: actor.email } as CurrentAuth;
      const { prisma } = serviciosRecorridoF4(tx);
      const servicio = new PreparacionesRecorridoService(prisma as never, new RecorridosVectorialesService());
      const seleccion = { rutaComponentes: [hijo.componenteCodigo!], rutaPasoId: paso.rutaPasoId! };
      const revisiones = await servicio.asegurarParaItem(auth, hijo.parentItemId, false, seleccion);
      assert.equal(revisiones.length, 1);
      const revision = revisiones[0];
      assert.equal((revision.metricas as Prisma.JsonObject).cantidadPiezas, 7);
      assert.equal((revision.metricas as Prisma.JsonObject).cantidadContornos, 11);
      assert.equal((revision.perfilMaquina as Prisma.JsonObject).velocidadMmMin, 350);
      assert.equal(revision.estado, 'BORRADOR');
      const segunda = await servicio.asegurarParaItem(auth, hijo.id);
      assert.equal(segunda[0].id, revision.id);
      const tap = await servicio.descargar(auth, revision.id, 'tap');
      assert.ok(tap.bytes.length > 100);
      const plantilla = await servicio.plantillaInstalacion(auth, hijo.parentItemId, undefined, seleccion);
      assert.equal(plantilla.cantidadPiezas, 7);
      assert.equal(plantilla.fuentes.length, 1);
      assert.ok(Math.abs(plantilla.anchoDisenoMm - 885.7495429687499) < 0.01);
      assert.ok(Math.abs(plantilla.altoDisenoMm - 441.32747196531336) < 0.01);
      const svg = await servicio.descargarPlantillaInstalacion(auth, hijo.parentItemId, null, undefined, seleccion);
      const dxf = await servicio.descargarArchivoInstalacion(auth, hijo.parentItemId, 'rigida-dxf', null, undefined, seleccion);
      assert.ok(dxf.bytes.toString().includes('$INSUNITS'));
      await writeFile('/tmp/grafoprint-ot53-plantilla.svg', svg.bytes);
      await writeFile('/tmp/grafoprint-ot53-preview.svg', plantilla.previewSvg);
      await writeFile('/tmp/grafoprint-ot53-corte.tap', tap.bytes);
      console.log(JSON.stringify({ orden: orden.numero, itemId: hijo.id, revisiones: revisiones.length,
        metricas: revision.metricas, plantilla: { piezas: plantilla.cantidadPiezas, ancho: plantilla.anchoDisenoMm, alto: plantilla.altoDisenoMm, paneles: plantilla.paneles.length },
        tapBytes: tap.bytes.length, estado: revision.estado, persistido: process.argv.includes('--guardar') }));
      assert.equal(Number((await tx.ordenTrabajo.findUniqueOrThrow({ where: { id: orden.id } })).total), Number(orden.total));
      if (!process.argv.includes('--guardar')) throw rollback;
    }, { timeout: 120000 });
  } catch (error) { if (error !== rollback) throw error; }
  finally { await db.$disconnect(); }
}
void main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
