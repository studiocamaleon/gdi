/**
 * Rehace los componentes de SUELDOS y CARGAS de todos los centros de costo a
 * partir del legajo de cada persona.
 *
 * De acá en más esto pasa solo: se dispara al guardar la dotación de un centro
 * y al cargar un cambio de sueldo (NominaCostosService). El script existe para
 * el momento del corte —cuando la nómina se mudó al legajo y alguien corrigió
 * los sueldos a mano— y para cualquier sospecha posterior de que un centro
 * quedó viejo.
 *
 * Sin `--aplicar` sólo informa las diferencias; no escribe nada.
 *
 * Uso: npx ts-node -r tsconfig-paths/register scripts/resincronizar-nomina-centros.ts [--aplicar]
 * Ver docs/legajos-nomina-diseno.md
 */
import { NestFactory } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';

import { AppModule } from '../src/app.module';
import { NominaCostosService } from '../src/empleados/nomina-costos.service';

const prisma = new PrismaClient();
const aplicar = process.argv.includes('--aplicar');

function ars(n: number) {
  return n.toLocaleString('es-AR', { maximumFractionDigits: 0 });
}

async function totalSueldos(centroCostoId: string, periodo: string) {
  const filas = await prisma.centroCostoComponenteCostoPeriodo.findMany({
    where: {
      centroCostoId,
      periodo,
      empleadoId: { not: null },
      categoria: { in: ['SUELDOS', 'CARGAS'] },
    },
    select: { importeMensual: true },
  });
  return filas.reduce((n, f) => n + Number(f.importeMensual), 0);
}

async function main() {
  // Los centros/períodos que tienen gente asignada. Un centro sin dotación no
  // tiene nada que sincronizar.
  const objetivos = await prisma.centroCostoRecurso.findMany({
    where: { tipoRecurso: 'EMPLEADO', activo: true, empleadoId: { not: null } },
    select: { tenantId: true, centroCostoId: true, periodo: true },
    distinct: ['centroCostoId', 'periodo'],
    orderBy: [{ periodo: 'asc' }],
  });

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error'],
  });
  const nomina = app.get(NominaCostosService);

  let cambiados = 0;
  const faltantes = new Set<string>();

  for (const objetivo of objetivos) {
    const centro = await prisma.centroCosto.findUnique({
      where: { id: objetivo.centroCostoId },
      select: { codigo: true, nombre: true },
    });
    const antes = await totalSueldos(objetivo.centroCostoId, objetivo.periodo);

    if (!aplicar) {
      // En seco no se puede saber el "después" sin escribir, así que se informa
      // el estado y se deja la comparación para la corrida real.
      console.log(
        `  ${centro?.codigo ?? '?'} ${objetivo.periodo}  hoy: $${ars(antes)}`,
      );
      continue;
    }

    const resultado = await nomina.sincronizarCentroPeriodo(
      objetivo.tenantId,
      objetivo.centroCostoId,
      objetivo.periodo,
    );
    const despues = await totalSueldos(
      objetivo.centroCostoId,
      objetivo.periodo,
    );

    for (const persona of resultado.sinRemuneracion) {
      // Con el período: "X no tiene sueldo" a secas asusta de más cuando en
      // realidad falta sólo en un mes viejo, anterior a su primer registro.
      faltantes.add(
        `${persona.nombre} — ${centro?.codigo ?? '?'} ${objetivo.periodo}`,
      );
    }

    const delta = despues - antes;
    if (Math.abs(delta) >= 0.01) cambiados += 1;
    console.log(
      `  ${centro?.codigo ?? '?'} ${objetivo.periodo}  $${ars(antes)} → $${ars(despues)}` +
        (Math.abs(delta) >= 0.01
          ? `   (${delta > 0 ? '+' : ''}${ars(delta)})`
          : '   sin cambios'),
    );
  }

  console.log(
    aplicar
      ? `\n${objetivos.length} centro/período procesados, ${cambiados} con cambios.`
      : `\n${objetivos.length} centro/período a procesar. Corré con --aplicar para escribir.`,
  );

  if (faltantes.size > 0) {
    console.log(
      `\nOJO: ${faltantes.size} asignación(es) sin sueldo vigente en el legajo — ` +
        `ese costo no se está imputando:\n  ${[...faltantes].join('\n  ')}`,
    );
  }

  await app.close();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
