#!/usr/bin/env node
/**
 * F1 del refactor de centros de costo: convierte el modelo derivado en la
 * planilla manual.
 *
 * Llena `CentroCostoLinea` desde las tres tablas viejas y `horasProductivas`
 * desde la capacidad. No borra nada del modelo anterior: eso es F7, recién
 * cuando el motor nuevo haya pasado su gate.
 *
 *   node scripts/migrar-centros-costo-lineas.js            # informa, no escribe
 *   node scripts/migrar-centros-costo-lineas.js --aplicar  # escribe
 *
 * Es idempotente: al aplicar, borra las líneas del período que va a rehacer.
 *
 * La regla que ordena el mapeo: ningún centro puede cambiar de costo. Lo que se
 * convierte es la forma de cargarlo, no el resultado. Por eso los importes se
 * copian de los valores ya calculados (`amortizacionMensualCalc`,
 * `depreciacionMensualCalc`) en vez de recalcularse desde la fórmula nueva —
 * aunque en los datos actuales coincidan exactamente.
 *
 * NOTA: sólo corre contra una base ANTERIOR a F7, donde las tablas del modelo
 * derivado todavía existen. En dev ya se aplicó y esas tablas se retiraron; se
 * conserva porque cualquier otro entorno que siga en el modelo viejo lo
 * necesita para migrar.
 *
 * Ver docs/centros-de-costo-carga-manual-diseno.md §8
 */
const { PrismaClient } = require('@prisma/client');

const APLICAR = process.argv.includes('--aplicar');
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const num = (v) => (v == null ? 0 : Number(v));

/**
 * El tipo de gasto general viejo no tiene equivalente exacto en las categorías
 * de componente. Lo que no mapea queda como OTROS y el tipo original se guarda
 * en las notas, para no perder el dato.
 */
const CATEGORIA_POR_TIPO_GASTO = {
  LIMPIEZA: 'OTROS',
  MANTENIMIENTO: 'MANTENIMIENTO',
  SERVICIOS: 'OTROS',
  ALQUILER: 'ALQUILER',
  OTRO: 'OTROS',
};

function construirLineas({
  centro,
  periodo,
  componentes,
  recursos,
  maquinariaPorRecurso,
  empleadosPorId,
}) {
  const lineas = [];
  const descartados = [];
  let orden = 0;
  const nueva = (extra) => ({
    tenantId: centro.tenantId,
    centroCostoId: centro.id,
    periodo,
    orden: orden++,
    ...extra,
  });

  // ── Empleados ────────────────────────────────────────────────────────────
  // SUELDOS y CARGAS son hoy dos componentes por persona. En la planilla son
  // una sola línea con el sueldo y las cargas como porcentaje.
  // Los componentes sin `empleadoId` no se pueden aparear por nombre: hay
  // períodos viejos donde el sueldo se llama "Sueldos del equipo" y las cargas
  // "Cargas y aportes". Agruparlos por nombre partía la persona en dos líneas
  // —una con sueldo y sin cargas, otra con cargas y sueldo cero— y el total del
  // centro cerraba igual, así que el error pasaba desapercibido. Todos los
  // huérfanos del período van a un solo bucket.
  const SIN_LEGAJO = '__sin_legajo__';
  const porPersona = new Map();
  for (const c of componentes) {
    if (c.categoria !== 'SUELDOS' && c.categoria !== 'CARGAS') continue;
    const clave = c.empleadoId ?? SIN_LEGAJO;
    const acc = porPersona.get(clave) ?? {
      empleadoId: c.empleadoId,
      sueldos: 0,
      cargas: 0,
      nombreSueldos: null,
      nombreCualquiera: c.nombre,
    };
    if (c.categoria === 'SUELDOS') {
      acc.sueldos += num(c.importeMensual);
      acc.nombreSueldos = acc.nombreSueldos ?? c.nombre;
    } else {
      acc.cargas += num(c.importeMensual);
    }
    porPersona.set(clave, acc);
  }

  for (const [clave, p] of porPersona) {
    const empleado = p.empleadoId ? empleadosPorId.get(p.empleadoId) : null;
    // El nombre se congela como texto. Sin legajo detrás, se usa el del
    // componente de sueldos y se le limpia el prefijo ("Sueldo · Fulano").
    const nombre =
      empleado?.nombreCompleto ??
      (p.nombreSueldos ?? p.nombreCualquiera).replace(
        /^(Sueldo|Cargas sociales)\s*·\s*/i,
        '',
      );
    const cargasPct = p.sueldos > 0 ? (p.cargas / p.sueldos) * 100 : 0;
    lineas.push(
      nueva({
        seccion: 'EMPLEADO',
        nombre,
        categoria: 'SUELDOS',
        ocupacion: empleado?.ocupacion ?? null,
        salarioMensual: round2(p.sueldos),
        cargasPct: Number(cargasPct.toFixed(6)),
        importeMensual: round2(p.sueldos + p.cargas),
        notas:
          clave === SIN_LEGAJO
            ? 'Consolida líneas de sueldos y cargas que no estaban asociadas a un legajo'
            : null,
      }),
    );
  }

  // ── Resto de componentes ─────────────────────────────────────────────────
  for (const c of componentes) {
    if (c.categoria === 'SUELDOS' || c.categoria === 'CARGAS') continue;
    lineas.push(
      nueva({
        seccion: 'GASTO_GENERAL',
        nombre: c.nombre,
        categoria: c.categoria,
        importeMensual: round2(num(c.importeMensual)),
        notas: c.notas ?? null,
      }),
    );
  }

  // ── Recursos ─────────────────────────────────────────────────────────────
  for (const r of recursos) {
    const notasPct =
      r.porcentajeAsignacion != null && Number(r.porcentajeAsignacion) !== 100
        ? `Asignación original: ${r.porcentajeAsignacion}%`
        : null;

    if (r.tipoRecurso === 'EMPLEADO') {
      // Hoy no suman al costo del centro: la mano de obra entra sólo por los
      // componentes. Migrarlos duplicaría los sueldos.
      descartados.push(r.nombreRecurso ?? r.id);
      continue;
    }

    if (r.tipoRecurso === 'GASTO_GENERAL') {
      lineas.push(
        nueva({
          seccion: 'GASTO_GENERAL',
          nombre: r.nombreRecurso ?? 'Gasto general',
          categoria: CATEGORIA_POR_TIPO_GASTO[r.tipoGastoGeneral] ?? 'OTROS',
          importeMensual: round2(num(r.valorMensual)),
          notas:
            [r.tipoGastoGeneral ? `Tipo original: ${r.tipoGastoGeneral}` : null, r.descripcion, notasPct]
              .filter(Boolean)
              .join(' · ') || null,
        }),
      );
      continue;
    }

    if (r.tipoRecurso === 'ACTIVO_FIJO') {
      lineas.push(
        nueva({
          seccion: 'ACTIVO_FIJO',
          nombre: r.nombreRecurso ?? 'Activo fijo',
          categoria: 'AMORTIZACION',
          vidaUtilRestanteMeses: r.vidaUtilRestanteMeses ?? null,
          valorActual: r.valorActual == null ? null : round2(r.valorActual),
          valorFinalVida:
            r.valorFinalVida == null ? null : round2(r.valorFinalVida),
          importeMensual: round2(num(r.depreciacionMensualCalc)),
          notas: [r.descripcion, notasPct].filter(Boolean).join(' · ') || null,
        }),
      );
      continue;
    }

    if (r.tipoRecurso === 'MAQUINARIA') {
      const m = (maquinariaPorRecurso.get(r.id) ?? []).find(
        (fila) => fila.periodo === periodo,
      );
      if (!m) {
        descartados.push(`${r.nombreRecurso ?? r.id} (sin fila de período)`);
        continue;
      }
      const nombreMaquina = r.nombreRecurso ?? 'Máquina';
      lineas.push(
        nueva({
          seccion: 'ACTIVO_FIJO',
          nombre: nombreMaquina,
          categoria: 'AMORTIZACION',
          vidaUtilRestanteMeses: m.vidaUtilMeses,
          valorActual: round2(m.valorCompra),
          valorFinalVida: round2(m.valorResidual),
          importeMensual: round2(num(m.amortizacionMensualCalc)),
          notas: notasPct,
        }),
      );
      // Lo que la ficha de máquina calculaba aparte pasa a ser lo que es: una
      // línea de gasto que se escribe a mano.
      const derivados = [
        ['Energía', 'ENERGIA', num(m.energiaMensualCalc)],
        ['Mantenimiento', 'MANTENIMIENTO', num(m.mantenimientoMensual)],
        ['Seguros', 'OTROS', num(m.segurosMensual)],
        ['Otros fijos', 'OTROS', num(m.otrosFijosMensual)],
      ];
      for (const [etiqueta, categoria, importe] of derivados) {
        if (importe <= 0) continue;
        lineas.push(
          nueva({
            seccion: 'GASTO_GENERAL',
            nombre: `${etiqueta} · ${nombreMaquina}`,
            categoria,
            importeMensual: round2(importe),
          }),
        );
      }
    }
  }

  return { lineas, descartados };
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const [centros, componentes, recursos, maquinaria, capacidades, empleados] =
      await Promise.all([
        prisma.centroCosto.findMany({
          select: { id: true, tenantId: true, codigo: true, nombre: true },
          orderBy: { codigo: 'asc' },
        }),
        prisma.centroCostoComponenteCostoPeriodo.findMany(),
        prisma.centroCostoRecurso.findMany({ where: { activo: true } }),
        prisma.centroCostoRecursoMaquinaPeriodo.findMany(),
        prisma.centroCostoCapacidadPeriodo.findMany(),
        prisma.empleado.findMany({
          select: { id: true, nombreCompleto: true, ocupacion: true },
        }),
      ]);

    const empleadosPorId = new Map(empleados.map((e) => [e.id, e]));
    const maquinariaPorRecurso = new Map();
    for (const fila of maquinaria) {
      const lista = maquinariaPorRecurso.get(fila.centroCostoRecursoId) ?? [];
      lista.push(fila);
      maquinariaPorRecurso.set(fila.centroCostoRecursoId, lista);
    }

    const periodos = [
      ...new Set([
        ...componentes.map((c) => c.periodo),
        ...recursos.map((r) => r.periodo),
      ]),
    ].sort();

    console.log(
      `${APLICAR ? 'APLICANDO' : 'SIMULANDO'} — ${centros.length} centros, períodos: ${periodos.join(', ')}\n`,
    );

    let totalLineas = 0;
    let totalDescartados = 0;
    const problemas = [];

    for (const periodo of periodos) {
      for (const centro of centros) {
        const comps = componentes.filter(
          (c) => c.centroCostoId === centro.id && c.periodo === periodo,
        );
        const recs = recursos.filter(
          (r) => r.centroCostoId === centro.id && r.periodo === periodo,
        );
        if (comps.length === 0 && recs.length === 0) continue;

        const { lineas, descartados } = construirLineas({
          centro,
          periodo,
          componentes: comps,
          recursos: recs,
          maquinariaPorRecurso,
          empleadosPorId,
        });

        // El invariante de la migración: la suma de las líneas nuevas tiene que
        // dar lo mismo que la suma de los orígenes viejos.
        const esperado = round2(
          comps.reduce((a, c) => a + num(c.importeMensual), 0) +
            recs.reduce((a, r) => {
              if (r.tipoRecurso === 'GASTO_GENERAL') return a + num(r.valorMensual);
              if (r.tipoRecurso === 'ACTIVO_FIJO')
                return a + num(r.depreciacionMensualCalc);
              if (r.tipoRecurso === 'MAQUINARIA') {
                const m = (maquinariaPorRecurso.get(r.id) ?? []).find(
                  (fila) => fila.periodo === periodo,
                );
                return a + num(m?.costoMensualTotalCalc);
              }
              return a;
            }, 0),
        );
        const obtenido = round2(
          lineas.reduce((a, l) => a + Number(l.importeMensual), 0),
        );
        const delta = round2(Math.abs(obtenido - esperado));
        if (delta > 0.01) {
          problemas.push({ centro: centro.nombre, periodo, esperado, obtenido, delta });
        }

        // El total del centro puede cerrar y la línea estar mal igual: si el
        // sueldo y las cargas de una persona caen en líneas distintas, la suma
        // da bien pero cada línea queda rota. Hay que verificar que cada línea
        // se reconstruya desde sus propios campos, que es lo que hará la UI.
        for (const l of lineas) {
          let recalculado = null;
          if (l.seccion === 'EMPLEADO') {
            recalculado = round2(
              Number(l.salarioMensual) * (1 + Number(l.cargasPct) / 100),
            );
          } else if (l.seccion === 'ACTIVO_FIJO' && l.vidaUtilRestanteMeses) {
            recalculado = round2(
              (Number(l.valorActual) - Number(l.valorFinalVida)) /
                l.vidaUtilRestanteMeses,
            );
          }
          // Cinco centavos: guardar las cargas como porcentaje hace que el
          // total reconstruido derive en el último centavo, y eso es esperable.
          // Lo que esta verificación busca no es el redondeo sino las líneas
          // estructuralmente rotas —sueldo en cero, cargas en otra línea—, que
          // se van por órdenes de magnitud.
          if (
            recalculado != null &&
            Math.abs(recalculado - Number(l.importeMensual)) > 0.05
          ) {
            problemas.push({
              centro: `${centro.nombre} → línea "${l.nombre}"`,
              periodo,
              esperado: Number(l.importeMensual),
              obtenido: recalculado,
              delta: round2(Math.abs(recalculado - Number(l.importeMensual))),
            });
          }
        }
        const marca = problemas.some(
          (p) => p.periodo === periodo && p.centro.startsWith(centro.nombre),
        )
          ? '✗'
          : ' ';

        console.log(
          `${marca} ${periodo}  ${centro.nombre.padEnd(30)} ${String(lineas.length).padStart(2)} líneas  ${obtenido.toLocaleString('es-AR')}${delta > 0.01 ? `  (esperado ${esperado.toLocaleString('es-AR')}, Δ ${delta})` : ''}`,
        );

        totalLineas += lineas.length;
        totalDescartados += descartados.length;

        if (APLICAR) {
          await prisma.$transaction([
            prisma.centroCostoLinea.deleteMany({
              where: { centroCostoId: centro.id, periodo },
            }),
            prisma.centroCostoLinea.createMany({ data: lineas }),
          ]);
        }
      }
    }

    // Las horas productivas salen del override manual si estaba puesto, y si no
    // de la capacidad práctica que calculaba la fórmula.
    let horasEscritas = 0;
    for (const cap of capacidades) {
      const horas =
        cap.overrideManualCapacidad != null
          ? Number(cap.overrideManualCapacidad)
          : Number(cap.capacidadPractica);
      if (APLICAR) {
        await prisma.centroCostoCapacidadPeriodo.update({
          where: { id: cap.id },
          data: { horasProductivas: horas },
        });
      }
      horasEscritas += 1;
    }

    console.log(
      `\n${APLICAR ? '✓ Aplicado' : '· Simulado'}: ${totalLineas} líneas, ${horasEscritas} capacidades con horas productivas.`,
    );
    if (totalDescartados > 0) {
      console.log(
        `  ${totalDescartados} recurso(s) de tipo EMPLEADO descartados a propósito: hoy no suman al costo.`,
      );
    }
    if (problemas.length > 0) {
      console.log(
        `\n✗ ${problemas.length} centro(s) no cierran contra el modelo viejo:`,
      );
      problemas.forEach((p) =>
        console.log(
          `  ${p.centro} (${p.periodo}): esperado ${p.esperado}, obtenido ${p.obtenido}, Δ ${p.delta}`,
        ),
      );
      process.exitCode = 1;
    } else {
      console.log('  Todos los centros cierran contra el modelo viejo.');
    }
    if (!APLICAR) {
      console.log('\n  Nada se escribió. Volvé a correr con --aplicar.');
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
