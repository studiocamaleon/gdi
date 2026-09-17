/** Captura reproducible del servidor. Crea sólo trabajos de cálculo; jamás
 * llama a cotizarYGuardar ni emite una OT. Exige tenant/producto/ruta explícitos.
 * Ejecutar desde apps/api con --env-file=.env y ts-node/register.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ProduccionService } from '../../src/produccion/produccion.service';
import { EtaService } from '../../src/eta/eta.service';
import { CotizacionJobsService } from '../../src/workers/cotizacion/cotizacion-jobs.service';
import { obtenerCotizacionesF6 } from '../../src/eta/planificacion/cotizaciones-por-cantidad';
import { planificarCotizacionesF6 } from '../../src/eta/planificacion/adaptador-cotizacion';
import { compactarJson } from '../../src/common/json-compartido';

const [tenantId, productoId, rutaAlternativaId, salida] = process.argv.slice(2);
if (
  ![tenantId, productoId, rutaAlternativaId].every((id) =>
    /^[0-9a-f-]{36}$/i.test(id ?? ''),
  ) ||
  !salida
)
  throw new Error(
    'Indicá tenantId, productoId, rutaAlternativaId y carpeta de salida.',
  );
const db = new PrismaService(),
  jobs = new CotizacionJobsService();
async function main() {
  await db.producto.findFirstOrThrow({ where: { id: productoId, tenantId } });
  await db.productoRutaAlternativa.findFirstOrThrow({
    where: { id: rutaAlternativaId, productoId, tenantId },
  });
  const carpeta = resolve(salida);
  mkdirSync(carpeta, { recursive: true });
  const entregas = [1, 2, 3, 4].map((i) => ({
    id: `entrega-${i}`,
    cantidad: 50,
  }));
  const fuentes = await obtenerCotizacionesF6({
    input: {
      tenantId,
      productoId,
      rutaAlternativaId,
      jobContext: { cantidad: 200 },
    },
    entregas,
    cotizar: async (input) => {
      const inicio = Date.now();
      let job = await jobs.crear({ cotizacion: input });
      console.log(
        JSON.stringify({
          evento: 'cotizando',
          cantidad: input.jobContext.cantidad,
        }),
      );
      while (job.estado === 'pendiente' || job.estado === 'procesando') {
        if (Date.now() - inicio > 420000)
          throw new Error(
            'La captura agotó su presupuesto; el cálculo puede seguir en su cola.',
          );
        await new Promise((r) => setTimeout(r, 1000));
        job = await jobs.consultar(tenantId, job.id);
      }
      if (!job.resultado)
        throw new Error(
          job.error?.mensaje ?? 'El cálculo no devolvió un resultado.',
        );
      console.log(
        JSON.stringify({
          evento: 'calculado',
          cantidad: input.jobContext.cantidad,
          ms: Date.now() - inicio,
          exitoso: job.resultado.exitoso,
        }),
      );
      return job.resultado;
    },
  });
  for (const fuente of fuentes)
    writeFileSync(
      resolve(carpeta, `fuente-${fuente.cotizacion.cantidadPedida}.json.gz`),
      gzipSync(JSON.stringify(compactarJson(fuente))),
    );
  // Tomar la carga DESPUÉS de cotizar: el nesting puede haber tardado minutos.
  const produccion = new ProduccionService(db);
  const taller = await new EtaService(db, produccion).contextoSimulacion(
    tenantId,
  );
  const config = await produccion.getConfiguracion(tenantId);
  writeFileSync(
    resolve(carpeta, 'taller.json'),
    JSON.stringify(
      {
        ...taller,
        medianas: [...taller.medianas],
        noLaborables: [...taller.noLaborables],
        config,
      },
      null,
      2,
    ),
  );
  const preparaciones = fuentes[0].cotizacion.pasos
    .filter((p) => p.activado && p.familiaCodigo === 'pre_prensa')
    .map((p) => `producto/ruta:${p.rutaPasoId}`);
  const r = planificarCotizacionesF6({
    tenantId,
    configuracionId: fuentes[0].configuracionId,
    fuentes,
    cantidad: 200,
    entregas,
    taller,
    margenDiasHabiles: config.margenEtaDias,
    prioridadSinFechas: 'PRIMERAS_ENTREGAS',
    condicionesPendientes: [
      'Disponibilidad de materiales y calibración física de tiempos sin confirmar.',
    ],
    operacionesUnaVez: preparaciones,
  });
  writeFileSync(
    resolve(carpeta, 'resultado.json'),
    JSON.stringify(
      {
        politicaEscenario: 'Preparar vector una vez por pedido; caso exhibidor',
        ...r,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      evento: 'planificado',
      operaciones: r.entrada.operaciones.length,
      alternativas: r.resultado.alternativas.length,
      recomendada: r.resultado.recomendadaId,
      condiciones: r.resultado.alternativas[0].condiciones,
    }),
  );
}
void main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await jobs.onApplicationShutdown();
    await db.$disconnect();
  });
