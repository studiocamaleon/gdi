/** Desde apps/api:
 * PDF_RENDER_URL=http://127.0.0.1:3002 npx ts-node --transpile-only scripts/benchmark-pdf-piloto.ts /ruta/datos.json
 * Entrada: PresupuestoPdfDatos. No consulta ni modifica la base o el storage.
 */
import 'reflect-metadata';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import {
  PresupuestoPdfService,
  type PresupuestoPdfDatos,
} from '../src/presupuestos/presupuesto-pdf.service';
import { PresupuestoRenderService } from '../src/presupuestos/pdf-piloto/presupuesto-render.service';
import { PresupuestoPilotoService } from '../src/presupuestos/pdf-piloto/presupuesto-piloto.service';
import { VERSION_PRESUPUESTO_HTML } from '../src/presupuestos/pdf-piloto/presupuesto-html';

function memoriaRenderer() {
  try {
    const [actual, pico] = execFileSync(
      'docker',
      [
        'exec',
        process.env.PDF_RENDER_CONTAINER || 'gdi-saas-pdf-renderer',
        'cat',
        '/sys/fs/cgroup/memory.current',
        '/sys/fs/cgroup/memory.peak',
      ],
      { encoding: 'utf8' },
    )
      .trim()
      .split(/\s+/)
      .map(Number);
    return {
      actualMiB: +(actual / 1024 ** 2).toFixed(1),
      picoMiB: +(pico / 1024 ** 2).toFixed(1),
    };
  } catch {
    return null;
  }
}

async function medir(
  nombre: string,
  n: number,
  concurrencia: number,
  generar: () => Promise<Buffer>,
) {
  let siguiente = 0;
  const muestras: number[] = [];
  let errores = 0;
  const inicio = performance.now();
  await Promise.all(
    Array.from({ length: concurrencia }, async () => {
      while (siguiente++ < n) {
        const t = performance.now();
        try {
          await generar();
          muestras.push(performance.now() - t);
        } catch {
          errores++;
        }
      }
    }),
  );
  muestras.sort((a, b) => a - b);
  const percentil = (p: number) =>
    Math.round(muestras[Math.max(0, Math.ceil(muestras.length * p) - 1)] ?? 0);
  const totalMs = Math.round(performance.now() - inicio);
  const resultado = {
    nombre,
    solicitudes: n,
    concurrencia,
    errores,
    totalMs,
    p50Ms: percentil(0.5),
    p95Ms: percentil(0.95),
  };
  console.log(JSON.stringify(resultado));
  return resultado;
}

async function main() {
  if (!process.argv[2])
    throw new Error('Falta la ruta al JSON PresupuestoPdfDatos.');
  const datos = JSON.parse(
    await readFile(resolve(process.argv[2]), 'utf8'),
  ) as PresupuestoPdfDatos;
  const salida = resolve(__dirname, '../../../output/pdf');
  const temporal = resolve(__dirname, '../../../tmp/pdfs');
  await mkdir(salida, { recursive: true });
  await mkdir(temporal, { recursive: true });
  const actual = new PresupuestoPdfService();
  const piloto = new PresupuestoRenderService();
  const memoriaAntes = memoriaRenderer();
  const tActual = performance.now();
  const pdfActual = await actual.generar(datos);
  const primeraActualMs = Math.round(performance.now() - tActual);
  const tPiloto = performance.now();
  const pdfPiloto = await piloto.generar(datos);
  const primeraPilotoMs = Math.round(performance.now() - tPiloto);
  await writeFile(resolve(salida, 'presupuesto-actual.pdf'), pdfActual);
  await writeFile(resolve(salida, 'presupuesto-piloto.pdf'), pdfPiloto);

  // Estrés de layout: usa datos sintéticos identificados, nunca emite un presupuesto.
  const largo: PresupuestoPdfDatos = {
    ...datos,
    numero: 'PRUEBA-PAGINACION',
    cliente: 'Cliente de prueba',
    items: Array.from({ length: 24 }, (_, n) => ({
      ...datos.items[0],
      nombre: `Producto de prueba ${String(n + 1).padStart(2, '0')} · Señalética e impresión`,
      adicionales: ['Terminación mate', 'Embalaje individual'],
    })),
    subtotal: datos.subtotal * 24,
    impuestos: datos.impuestos * 24,
    total: datos.total * 24,
    observaciones:
      'Muestra para verificar paginación. No corresponde a una operación comercial.\nÚltima observación del documento.',
  };
  await writeFile(
    resolve(temporal, 'paginacion-piloto.pdf'),
    await piloto.generar(largo),
  );
  await writeFile(
    resolve(temporal, 'paginacion-actual.pdf'),
    await actual.generar(largo),
  );
  const sinLogo = {
    ...datos,
    numero: 'PRUEBA-SIN-LOGO',
    logoDataUri: null,
    negocio: 'Imprenta de prueba',
    cliente: 'Cliente de prueba',
  };
  await writeFile(
    resolve(temporal, 'sin-logo.pdf'),
    await piloto.generar(sinLogo),
  );
  const extenso = {
    ...sinLogo,
    numero: 'PRUEBA-TEXTO-LARGO',
    items: [
      {
        ...sinLogo.items[0],
        specs: Array.from({ length: 65 }, (_, n) => ({
          etiqueta: `Detalle ${n + 1}`,
          valor:
            'Terminación de alta calidad, color según muestra y medidas confirmadas por el cliente.',
        })),
      },
    ],
  };
  await writeFile(
    resolve(temporal, 'texto-largo.pdf'),
    await piloto.generar(extenso),
  );

  const escenarios = [];
  escenarios.push(
    await medir('jsPDF corto', 20, 1, () => actual.generar(datos)),
  );
  escenarios.push(
    await medir('HTML corto', 20, 1, () => piloto.generar(datos)),
  );
  escenarios.push(
    await medir('HTML ráfaga corto', 20, 4, () => piloto.generar(datos)),
  );
  escenarios.push(
    await medir('jsPDF 24 productos', 5, 1, () => actual.generar(largo)),
  );
  escenarios.push(
    await medir('HTML 24 productos', 5, 1, () => piloto.generar(largo)),
  );
  process.env.PRESUPUESTO_PDF_PILOTO = 'true';
  const cache = new PresupuestoPilotoService(piloto, {
    exigir: async () => undefined, // Fixture: mide render/caché sin una empresa real.
  } as never);
  await cache.generar('tenant-benchmark', 'presupuesto-benchmark', datos);
  escenarios.push(
    await medir('HTML caché caliente', 20, 4, () =>
      cache.generar('tenant-benchmark', 'presupuesto-benchmark', datos),
    ),
  );
  const resultado = {
    fecha: new Date().toISOString(),
    plantilla: VERSION_PRESUPUESTO_HTML,
    entorno: {
      plataforma: process.platform,
      arquitectura: process.arch,
      node: process.version,
      rendererCpu: 2,
      rendererLimiteMiB: 1024,
      rendererConcurrencia: 2,
    },
    primeraLlamada: {
      jsPdfMs: primeraActualMs,
      htmlMs: primeraPilotoMs,
      chromiumPreiniciado: true,
    },
    bytes: { jsPdf: pdfActual.length, html: pdfPiloto.length },
    memoriaRenderer: { antes: memoriaAntes, despues: memoriaRenderer() },
    escenarios,
    limites:
      'Medición local de render; no incluye consultas a BD, subida a storage ni descarga del navegador. No es una prueba de capacidad de producción. La ráfaga envía 4 pedidos a Chromium con 2 slots. Caché medida en proceso, sin HTTP. Memoria del contenedor incluye Chromium, Gotenberg y page cache.',
  };
  await writeFile(
    resolve(temporal, 'benchmark.json'),
    JSON.stringify(resultado, null, 2),
  );
  console.log(
    JSON.stringify({
      bytes: resultado.bytes,
      memoriaRenderer: resultado.memoriaRenderer,
    }),
  );
  if (escenarios.some((e) => e.errores)) process.exitCode = 1;
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
