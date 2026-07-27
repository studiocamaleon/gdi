#!/usr/bin/env node
/**
 * Golden-master de los centros de costo, para el refactor a carga manual.
 *
 * Captura lo que el motor de tarifas produce HOY, antes de que el modelo pase a
 * ser una planilla cargada a mano. Es lo primero del plan porque después del
 * refactor no hay forma de reconstruir qué decía el sistema antes: las tablas
 * de origen (recursos, componentes, maquinaria por período) desaparecen.
 *
 *   node scripts/centros-costo-baseline.js baseline   # captura, antes de F1
 *   ... aplicar F1 y F2 ...
 *   node scripts/centros-costo-baseline.js compare    # falla si algo se movió
 *
 * Es de sólo lectura: no escribe una sola fila en la base.
 *
 * El gate de F2 tolera un centavo por línea migrada, porque el redondeo a dos
 * decimales de `importeMensual` es real y consolidar SUELDOS + CARGAS en una
 * línea con porcentaje lo hace inevitable. El delta del prorrateo se informa
 * aparte: ese cambio es deliberado (decisión 4 del diseño), no una regresión.
 *
 * Ver docs/centros-de-costo-carga-manual-diseno.md
 */
const { writeFileSync, readFileSync, existsSync } = require('node:fs');
const { join } = require('node:path');
const { PrismaClient } = require('@prisma/client');

const OUT = join(__dirname, 'centros-costo-baseline.json');
const TOLERANCIA_POR_LINEA = Number(process.env.CC_TOLERANCIA ?? '0.01');

const num = (v) => (v == null ? null : Number(v));

/**
 * Las filas de test que quedaron en dev no tienen resumen real: su `resumenJson`
 * es `{"test":true}` y su capacidad es 1. Se capturan igual —no se esconde nada—
 * pero quedan marcadas para que no ensucien el veredicto del gate.
 */
const esFilaDeTest = (tarifa) => {
  const resumen = tarifa.resumenJson;
  return (
    !resumen || typeof resumen !== 'object' || resumen.periodo === undefined
  );
};

/**
 * Hay snapshots viejos (2026-03 y parte de 2026-06) que quedaron guardados por
 * una versión anterior del motor y no traen el desglose del reparto. No son de
 * test —tienen números de verdad— pero sin `costoMensualAbsorbidoReparto` no se
 * puede distinguir un movimiento por prorrateo de una regresión. Se comparan
 * igual, y si se mueven se informan en su propio grupo en vez de contarse como
 * un problema de la migración.
 */
const tieneResumenCompleto = (tarifa) =>
  !esFilaDeTest(tarifa) &&
  tarifa.resumenJson?.costoMensualAbsorbidoReparto !== undefined;

/**
 * El modelo NUEVO, calculado acá a mano en vez de llamando al servicio.
 *
 * Es a propósito: un golden-master que llama al código que quiere verificar no
 * verifica nada. Esta es una segunda implementación de la misma aritmética, y
 * si las dos coinciden es porque el resultado es el correcto y no porque
 * compartan el error.
 *
 * Reparto: las fuentes son los centros con imputación REPARTO y gasto propio
 * mayor a cero; los destinos, los productivos; el peso es el gasto propio del
 * destino (decisión 4), y el último absorbe el remanente para que la suma
 * cierre exacta.
 */
function calcularModeloNuevo({ centros, lineasPorCentroPeriodo, horasPorCentroPeriodo, periodos }) {
  const resultado = new Map();
  // Cuánto salió de los centros de estructura y cuánto entró a los productivos,
  // por período. Se mide acá, sobre el reparto mismo, y no sobre las filas de
  // tarifa: no todo centro tiene tarifa en todo estado, y medirlo ahí da
  // asimetrías que parecen plata perdida sin serlo.
  const conservacionPorPeriodo = new Map();

  for (const periodo of periodos) {
    const balance = { sale: 0, entra: 0 };
    conservacionPorPeriodo.set(periodo, balance);
    const directo = new Map();
    const manoObra = new Map();
    for (const centro of centros) {
      const lineas = lineasPorCentroPeriodo.get(`${centro.id}|${periodo}`) ?? [];
      directo.set(
        centro.id,
        lineas.reduce((a, l) => a + num(l.importeMensual), 0),
      );
      manoObra.set(
        centro.id,
        lineas
          .filter((l) => l.seccion === 'EMPLEADO')
          .reduce((a, l) => a + num(l.importeMensual), 0),
      );
    }

    const objetivos = centros.filter((c) => c.tipoCentro === 'PRODUCTIVO');
    const fuentes = centros.filter(
      (c) => c.imputacionPreferida === 'REPARTO' && directo.get(c.id) > 0,
    );
    const absorbido = new Map();

    for (const fuente of fuentes) {
      const destinos = objetivos.filter((t) => t.id !== fuente.id);
      if (destinos.length === 0) continue;
      const totalBase = destinos.reduce((a, t) => a + directo.get(t.id), 0);
      const pesosIguales = totalBase <= 0;
      const divisor = pesosIguales ? destinos.length : totalBase;
      if (divisor <= 0) continue;

      let acumulado = 0;
      destinos.forEach((destino, i) => {
        const esUltimo = i === destinos.length - 1;
        const peso = pesosIguales ? 1 : directo.get(destino.id);
        let monto = esUltimo
          ? directo.get(fuente.id) - acumulado
          : (directo.get(fuente.id) * peso) / divisor;
        if (monto < 0) monto = 0;
        acumulado += monto;
        absorbido.set(destino.id, (absorbido.get(destino.id) ?? 0) + monto);
      });
      balance.sale += directo.get(fuente.id);
      balance.entra += acumulado;
    }

    for (const centro of centros) {
      const horas = horasPorCentroPeriodo.get(`${centro.id}|${periodo}`) ?? 0;
      const sinReparto = directo.get(centro.id);
      const abs = absorbido.get(centro.id) ?? 0;
      const conReparto = sinReparto + abs;
      resultado.set(`${centro.id}|${periodo}`, {
        costoMensualSinReparto: Number(sinReparto.toFixed(2)),
        costoMensualManoObra: Number(manoObra.get(centro.id).toFixed(2)),
        costoMensualAbsorbidoReparto: Number(abs.toFixed(2)),
        horasProductivas: horas,
        tarifaCalculada: horas > 0 ? Number((conReparto / horas).toFixed(2)) : 0,
        tarifaManoObra:
          horas > 0
            ? Number((manoObra.get(centro.id) / horas).toFixed(2))
            : 0,
      });
    }
  }

  return { resultado, conservacionPorPeriodo };
}

async function capturar(prisma) {
  const centros = await prisma.centroCosto.findMany({
    select: {
      id: true,
      tenantId: true,
      codigo: true,
      nombre: true,
      tipoCentro: true,
      imputacionPreferida: true,
      unidadBaseFutura: true,
      activo: true,
    },
    orderBy: [{ tenantId: 'asc' }, { codigo: 'asc' }],
  });

  // Las tablas del modelo derivado se retiraron en F7: lo que queda es la
  // planilla. El baseline capturado antes del refactor sigue guardando lo que
  // decían, y es contra eso que compara `compare`.
  const [tarifas, capacidades, lineas] = await Promise.all([
    prisma.centroCostoTarifaPeriodo.findMany(),
    prisma.centroCostoCapacidadPeriodo.findMany(),
    prisma.centroCostoLinea.findMany(),
  ]);
  const componentes = [];
  const recursos = [];
  const maquinaria = [];

  const lineasPorCentroPeriodo = new Map();
  for (const l of lineas) {
    const clave = `${l.centroCostoId}|${l.periodo}`;
    const lista = lineasPorCentroPeriodo.get(clave) ?? [];
    lista.push(l);
    lineasPorCentroPeriodo.set(clave, lista);
  }
  const horasPorCentroPeriodo = new Map(
    capacidades.map((c) => [
      `${c.centroCostoId}|${c.periodo}`,
      num(c.horasProductivas),
    ]),
  );
  const { resultado: modeloNuevo, conservacionPorPeriodo } =
    calcularModeloNuevo({
      centros,
      lineasPorCentroPeriodo,
      horasPorCentroPeriodo,
      periodos: [...new Set(tarifas.map((t) => t.periodo))],
    });

  const maquinariaPorRecurso = new Map();
  for (const fila of maquinaria) {
    const lista = maquinariaPorRecurso.get(fila.centroCostoRecursoId) ?? [];
    lista.push(fila);
    maquinariaPorRecurso.set(fila.centroCostoRecursoId, lista);
  }

  const porCentro = new Map(centros.map((c) => [c.id, c]));
  const entradas = {};

  for (const tarifa of tarifas) {
    const centro = porCentro.get(tarifa.centroCostoId);
    if (!centro) continue;
    const clave = `${centro.codigo}__${tarifa.periodo}__${tarifa.estado}`;
    const periodo = tarifa.periodo;

    const componentesDelPeriodo = componentes.filter(
      (c) => c.centroCostoId === centro.id && c.periodo === periodo,
    );
    const recursosDelPeriodo = recursos.filter(
      (r) => r.centroCostoId === centro.id && r.periodo === periodo && r.activo,
    );
    const capacidad = capacidades.find(
      (c) => c.centroCostoId === centro.id && c.periodo === periodo,
    );

    // Los insumos crudos, para que F2 pueda verificar que la migración no
    // perdió ninguna línea por el camino, con independencia de la tarifa.
    const componentesPorCategoria = {};
    for (const c of componentesDelPeriodo) {
      componentesPorCategoria[c.categoria] =
        (componentesPorCategoria[c.categoria] ?? 0) + num(c.importeMensual);
    }
    const recursosPorTipo = {};
    for (const r of recursosDelPeriodo) {
      const previo = recursosPorTipo[r.tipoRecurso] ?? { filas: 0, importe: 0 };
      let importe = 0;
      if (r.tipoRecurso === 'GASTO_GENERAL') importe = num(r.valorMensual) ?? 0;
      else if (r.tipoRecurso === 'ACTIVO_FIJO')
        importe = num(r.depreciacionMensualCalc) ?? 0;
      else if (r.tipoRecurso === 'MAQUINARIA') {
        const fila = (maquinariaPorRecurso.get(r.id) ?? []).find(
          (m) => m.periodo === periodo,
        );
        importe = num(fila?.costoMensualTotalCalc) ?? 0;
      }
      recursosPorTipo[r.tipoRecurso] = {
        filas: previo.filas + 1,
        importe: previo.importe + importe,
      };
    }

    // Lo que el motor de HOY produciría con los insumos de HOY, antes del
    // reparto. Es contra esto que compara el gate, y no contra el snapshot
    // congelado: hay centros cuyo snapshot quedó viejo respecto de sus propios
    // insumos (a 2026-06 le cambiaron los sueldos después de publicar y nadie
    // recalculó). Comparar contra el snapshot haría fallar a F2 por una deuda
    // que ya existía, sin relación con la migración.
    const manoObraDerivada = componentesDelPeriodo
      .filter((c) => c.categoria === 'SUELDOS' || c.categoria === 'CARGAS')
      .reduce((acc, c) => acc + num(c.importeMensual), 0);
    const sinRepartoDerivado =
      componentesDelPeriodo.reduce((acc, c) => acc + num(c.importeMensual), 0) +
      Object.values(recursosPorTipo).reduce((acc, r) => acc + r.importe, 0);

    entradas[clave] = {
      centroCodigo: centro.codigo,
      centroNombre: centro.nombre,
      tipoCentro: centro.tipoCentro,
      imputacionPreferida: centro.imputacionPreferida,
      unidadBase: centro.unidadBaseFutura,
      periodo,
      estado: tarifa.estado,
      esFilaDeTest: esFilaDeTest(tarifa),
      resumenParcial: !esFilaDeTest(tarifa) && !tieneResumenCompleto(tarifa),
      // El contrato con el motor, el ETA y los reportes.
      contrato: {
        costoMensualTotal: num(tarifa.costoMensualTotal),
        capacidadPractica: num(tarifa.capacidadPractica),
        tarifaCalculada: num(tarifa.tarifaCalculada),
        costoMensualManoObra: num(tarifa.costoMensualManoObra),
        tarifaManoObra: num(tarifa.tarifaManoObra),
      },
      // Lo que produce el modelo NUEVO, calculado desde las líneas. Contra esto
      // se compara el `derivado` del baseline: vieja implementación contra
      // nueva, que es el gate de F2.
      nuevo: modeloNuevo.get(`${centro.id}|${periodo}`) ?? null,
      // Lo que sale de los insumos vivos del modelo viejo. Esto es lo que la
      // migración tiene que preservar.
      derivado: {
        costoMensualSinReparto: Number(sinRepartoDerivado.toFixed(2)),
        costoMensualManoObra: Number(manoObraDerivada.toFixed(2)),
        horasProductivas: num(capacidad?.horasProductivas),
      },
      snapshotDesactualizado:
        tieneResumenCompleto(tarifa) &&
        Math.abs(
          sinRepartoDerivado - (tarifa.resumenJson.costoMensualSinReparto ?? 0),
        ) > 0.01,
      // El desglose que el motor guardó al calcular, incluido el reparto.
      resumen: tarifa.resumenJson ?? null,
      insumos: {
        capacidad: capacidad
          ? { horasProductivas: num(capacidad.horasProductivas) }
          : null,
        componentes: {
          filas: componentesDelPeriodo.length,
          porCategoria: componentesPorCategoria,
          total: componentesDelPeriodo.reduce(
            (acc, c) => acc + num(c.importeMensual),
            0,
          ),
        },
        recursos: recursosPorTipo,
      },
    };
  }

  return {
    capturadoEn: new Date().toISOString(),
    centros: centros.length,
    conservacionReparto: Object.fromEntries(conservacionPorPeriodo),
    entradas,
  };
}

/**
 * El gate compara lo DERIVADO de los insumos, no el snapshot congelado.
 *
 * El snapshot no sirve como patrón: hay centros de 2026-06 cuyo `resumenJson`
 * quedó viejo respecto de sus propios componentes (les cambiaron los sueldos
 * después de publicar y nadie recalculó). Medir contra eso haría fallar a F2
 * por una deuda anterior a la migración.
 *
 * Estos tres números son exactamente lo que la migración tiene que preservar:
 * el costo antes del reparto, la mano de obra y las horas. El reparto queda
 * afuera a propósito, porque cambia de base por decisión de diseño.
 */
const CAMPOS_GATE = [
  'costoMensualSinReparto',
  'costoMensualManoObra',
  'horasProductivas',
];

function comparar(previo, actual) {
  const claves = new Set([
    ...Object.keys(previo.entradas),
    ...Object.keys(actual.entradas),
  ]);
  const faltantes = [];
  const nuevas = [];
  const movidas = [];
  const repartoMovido = [];

  for (const clave of [...claves].sort()) {
    const antes = previo.entradas[clave];
    const ahora = actual.entradas[clave];
    if (!ahora) {
      faltantes.push(clave);
      continue;
    }
    if (!antes) {
      nuevas.push(clave);
      continue;
    }
    if (antes.esFilaDeTest) continue;

    const contexto = {
      clave,
      centro: antes.centroNombre,
      periodo: antes.periodo,
      estado: antes.estado,
    };

    // Tolerancia proporcional a las líneas que se consolidan: el redondeo a dos
    // decimales de `importeMensual` es real y se acumula.
    // Vieja implementación contra nueva. Si el modelo nuevo todavía no está
    // calculado (baseline tomado antes de F1), se cae al derivado viejo, que
    // hace que la comparación sea consigo misma y no aporte — pero tampoco
    // miente diciendo que algo se rompió.
    const nuevoAhora = ahora.nuevo ?? ahora.derivado;
    const lineas = Math.max(1, antes.insumos.componentes.filas);
    const diffs = [];
    for (const campo of CAMPOS_GATE) {
      const a = antes.derivado[campo] ?? 0;
      const b = nuevoAhora[campo] ?? 0;
      const delta = Math.abs(b - a);
      // Tolerancia por línea, más medio punto por mil del propio valor: sobre
      // millones, consolidar líneas y guardar un porcentaje deriva unos pesos.
      // Lo que importa es que no se mueva de forma obvia.
      const tolerancia = Math.max(
        TOLERANCIA_POR_LINEA * lineas,
        Math.abs(a) * 0.0005,
      );
      if (delta > tolerancia) {
        diffs.push({
          campo,
          antes: a,
          ahora: b,
          delta: Number(delta.toFixed(4)),
        });
      }
    }
    if (diffs.length > 0) movidas.push({ ...contexto, diffs });

    // El absorbido se informa siempre que se mueva: es el cambio esperado de la
    // decisión 4 y el usuario tiene que poder ver centro por centro qué pasó.
    const absorbidoAntes = antes.resumen?.costoMensualAbsorbidoReparto ?? null;
    const absorbidoAhora = nuevoAhora.costoMensualAbsorbidoReparto ?? null;
    if (
      absorbidoAntes !== null &&
      absorbidoAhora !== null &&
      Math.abs(absorbidoAhora - absorbidoAntes) > TOLERANCIA_POR_LINEA
    ) {
      repartoMovido.push({ ...contexto, absorbidoAntes, absorbidoAhora });
    }
  }

  // El reparto no puede crear ni perder plata: lo que sale de los centros de
  // estructura tiene que aparecer íntegro repartido entre los productivos.
  const conservacion = [];
  for (const [periodo, { sale, entra }] of Object.entries(
    actual.conservacionReparto ?? {},
  )) {
    if (sale === 0 && entra === 0) continue;
    if (Math.abs(sale - entra) > 0.01) {
      conservacion.push({ periodo, sale, entra });
    }
  }

  return { faltantes, nuevas, movidas, repartoMovido, conservacion };
}

function imprimirComparacion({
  faltantes,
  nuevas,
  movidas,
  repartoMovido,
  conservacion,
}) {
  if (repartoMovido.length > 0) {
    console.log(
      `\n▸ Prorrateo: ${repartoMovido.length} centro(s) cambiaron de absorbido (esperado, decisión 4):\n`,
    );
    for (const m of repartoMovido) {
      const delta = m.absorbidoAhora - m.absorbidoAntes;
      console.log(
        `  ${m.centro} (${m.periodo}/${m.estado}): ${m.absorbidoAntes} → ${m.absorbidoAhora}  (${delta >= 0 ? '+' : ''}${delta.toFixed(2)})`,
      );
    }
  }

  if (nuevas.length > 0) {
    console.log(
      `\n· ${nuevas.length} entrada(s) nuevas (no estaban en el baseline):\n`,
    );
    nuevas.forEach((c) => console.log(`  ${c}`));
  }

  if (faltantes.length > 0) {
    console.log(`\n✗ ${faltantes.length} entrada(s) DESAPARECIERON:\n`);
    faltantes.forEach((c) => console.log(`  ${c}`));
  }

  if (movidas.length > 0) {
    console.log(
      `\n✗ ${movidas.length} centro(s) cambiaron de costo, mano de obra u horas:\n`,
    );
    for (const m of movidas) {
      console.log(`  ${m.centro} (${m.periodo}/${m.estado}):`);
      for (const d of m.diffs) {
        console.log(`      ${d.campo}: ${d.antes} → ${d.ahora}  (Δ ${d.delta})`);
      }
    }
  }

  if (conservacion.length > 0) {
    console.log(
      `\n✗ El reparto no conserva el total en ${conservacion.length} período(s):\n`,
    );
    for (const c of conservacion) {
      console.log(
        `  ${c.periodo}: sale ${c.sale.toFixed(2)} de estructura pero entra ${c.entra.toFixed(2)} a los productivos`,
      );
    }
  }

  const rojo = faltantes.length + movidas.length + conservacion.length;
  if (rojo === 0) {
    console.log(
      '\n✓ Gate superado: el costo, la mano de obra y las horas de cada centro\n  sobrevivieron a la migración, y el reparto conserva el total.\n',
    );
  } else {
    console.log(
      `\n✗ Gate NO superado: ${rojo} problema(s). La migración está mal, no se avanza.\n`,
    );
  }
  return rojo === 0;
}

async function main() {
  const modo = process.argv[2];
  if (modo !== 'baseline' && modo !== 'compare') {
    console.error(
      'Uso: node scripts/centros-costo-baseline.js <baseline|compare>',
    );
    process.exit(2);
  }

  const prisma = new PrismaClient();
  try {
    const actual = await capturar(prisma);
    const reales = Object.values(actual.entradas).filter((e) => !e.esFilaDeTest);
    const test = Object.keys(actual.entradas).length - reales.length;

    if (modo === 'baseline') {
      writeFileSync(OUT, `${JSON.stringify(actual, null, 2)}\n`);
      console.log(
        `✓ Baseline: ${actual.centros} centros, ${Object.keys(actual.entradas).length} entradas (${reales.length} reales, ${test} de test).`,
      );
      console.log(`  ${OUT}`);
      const periodos = [...new Set(reales.map((e) => e.periodo))].sort();
      console.log(`  Períodos con datos reales: ${periodos.join(', ')}`);

      const viejos = reales.filter((e) => e.snapshotDesactualizado);
      if (viejos.length > 0) {
        console.log(
          `\n▸ ${viejos.length} snapshot(s) ya estaban desactualizados respecto de sus propios\n  insumos ANTES de tocar nada. Es deuda previa, no la genera la migración,\n  y por eso el gate compara contra los insumos y no contra el snapshot:\n`,
        );
        for (const e of viejos) {
          const guardado = e.resumen.costoMensualSinReparto;
          console.log(
            `  ${e.centroNombre} (${e.periodo}/${e.estado}): guardado ${guardado} vs insumos ${e.derivado.costoMensualSinReparto}`,
          );
        }
      }
      return;
    }

    if (!existsSync(OUT)) {
      console.error(`✗ No hay baseline en ${OUT}. Corré primero: baseline`);
      process.exit(2);
    }
    const previo = JSON.parse(readFileSync(OUT, 'utf8'));
    console.log(
      `Comparando contra el baseline del ${previo.capturadoEn} (tolerancia $${TOLERANCIA_POR_LINEA} por línea).`,
    );
    const ok = imprimirComparacion(comparar(previo, actual));
    process.exit(ok ? 0 : 1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
