import { Helper, type DxfEntidad } from 'dxf';

export class DxfSeguroError extends Error {}

// Son presupuestos de trabajo antes de denormalizar, no límites del resultado
// visible: las capas ocultas y los bloques vacíos también consumen recursos.
const MAX_PROFUNDIDAD = 32;
const MAX_VISITAS = 10_000;
const MAX_PUNTOS = 100_000;
const MAX_BYTES_EXPANDIDOS = 8 * 1024 * 1024;
const MAX_TRABAJO_CURVAS = 5_000_000;
type Costo = {
  visitas: number;
  puntos: number;
  bytes: number;
  curvas: number;
  profundidad: number;
};
const vacio = (): Costo => ({
  visitas: 0,
  puntos: 0,
  bytes: 0,
  curvas: 0,
  profundidad: 0,
});

function invalido(): never {
  throw new DxfSeguroError(
    'El DXF contiene bloques o curvas inválidos. Revisá su exportación.',
  );
}
function complejo(): never {
  throw new DxfSeguroError(
    'El DXF supera el límite de complejidad. Simplificá sus bloques, repeticiones o curvas.',
  );
}
function comprobar(costo: Costo) {
  if (
    costo.visitas > MAX_VISITAS ||
    costo.puntos > MAX_PUNTOS ||
    costo.bytes > MAX_BYTES_EXPANDIDOS ||
    costo.curvas > MAX_TRABAJO_CURVAS ||
    costo.profundidad > MAX_PROFUNDIDAD ||
    Object.values(costo).some((valor) => !Number.isFinite(valor) || valor < 0)
  )
    complejo();
}

function costoCurva(e: DxfEntidad): { puntos: number; curvas: number } {
  let puntos = 0,
    curvas = 0;
  if (e.type === 'LINE') puntos = 2;
  if (['ARC', 'ELLIPSE'].includes(e.type)) {
    const inicio = e.startAngle,
      fin = e.endAngle;
    // El lector entrega ambos ángulos en radianes. Su interpolador recorre
    // el intervalo sin límite: no se le pasan vueltas enormes o infinitas.
    if (
      typeof inicio !== 'number' ||
      typeof fin !== 'number' ||
      !Number.isFinite(inicio) ||
      !Number.isFinite(fin) ||
      Math.abs(inicio) > 2 * Math.PI + 1e-6 ||
      Math.abs(fin) > 2 * Math.PI + 1e-6 ||
      Math.abs(fin - inicio) > 2 * Math.PI + 1e-6
    )
      invalido();
    puntos = 74;
  }
  if (e.type === 'CIRCLE') puntos = 74;
  if (['LWPOLYLINE', 'POLYLINE'].includes(e.type)) {
    const vertices = e.vertices ?? [];
    puntos = vertices.length + 1;
    for (const vertice of vertices) {
      if (vertice.bulge !== undefined && !Number.isFinite(vertice.bulge))
        invalido();
      if (vertice.bulge) puntos += 74;
    }
    if (e.polyfaceMesh) curvas = vertices.length ** 2;
  }
  if (e.type === 'SPLINE') {
    const n = e.controlPoints?.length ?? 0,
      grado = e.degree;
    const knots = e.knots ?? [];
    if (
      typeof grado !== 'number' ||
      !Number.isSafeInteger(grado) ||
      grado < 1 ||
      grado >= n ||
      knots.length !== n + grado + 1 ||
      knots.some(
        (k, i) => !Number.isFinite(k) || (i > 0 && k < knots[i - 1]),
      ) ||
      !(knots[n] > knots[grado])
    )
      invalido();
    let tramos = 0;
    for (let i = grado + 1; i < knots.length - grado; i++) {
      if (knots[i] !== knots[i - 1]) tramos++;
    }
    puntos = tramos * 26;
    // Cada muestra copia los controles y ejecuta una pirámide de grado².
    curvas = puntos * (n + knots.length + grado ** 2);
  }
  return { puntos, curvas };
}

/** Valida el grafo compacto sin expandir INSERT ni interpolar las curvas. */
export function crearHelperDxfSeguro(contenido: string): Helper {
  if (Buffer.byteLength(contenido, 'utf8') > 512 * 1024)
    throw new DxfSeguroError('El vector supera el máximo de 512 KB.');
  const helper = new Helper(contenido);
  let parsed: Helper['parsed'];
  try {
    parsed = helper.parsed;
  } catch {
    invalido();
  }
  const bloques = new Map(parsed.blocks.map((b) => [b.name, b]));
  const costos = new Map<string, Costo>();
  const activos = new Set<string>();

  function entidadesCosto(entidades: DxfEntidad[], nivel: number): Costo {
    if (nivel > MAX_PROFUNDIDAD) complejo();
    const total = vacio();
    for (const e of entidades) {
      const costo: Costo = {
        ...costoCurva(e),
        visitas: 1,
        bytes: Buffer.byteLength(JSON.stringify(e), 'utf8'),
        profundidad: 0,
      };
      if (e.type === 'INSERT') {
        const filas = e.rowCount ?? 1,
          columnas = e.columnCount ?? 1;
        if (
          !Number.isSafeInteger(filas) ||
          !Number.isSafeInteger(columnas) ||
          filas < 1 ||
          columnas < 1
        )
          invalido();
        const repeticiones = filas * columnas;
        if (!Number.isSafeInteger(repeticiones) || repeticiones > MAX_VISITAS)
          complejo();
        const nombre = e.block ?? '';
        const bloque = bloques.get(nombre);
        if (!bloque || activos.has(nombre)) invalido();
        let hijo = costos.get(nombre);
        if (!hijo) {
          activos.add(nombre);
          hijo = entidadesCosto(bloque.entities, nivel + 1);
          activos.delete(nombre);
          costos.set(nombre, hijo);
        }
        costo.visitas += repeticiones * (1 + hijo.visitas);
        costo.puntos += repeticiones * hijo.puntos;
        costo.bytes += repeticiones * hijo.bytes;
        costo.curvas += repeticiones * hijo.curvas;
        costo.profundidad = hijo.profundidad + 1;
        // Incluso un bloque ya calculado puede estar anidado más profundo.
        if (nivel + costo.profundidad > MAX_PROFUNDIDAD) complejo();
      }
      total.visitas += costo.visitas;
      total.puntos += costo.puntos;
      total.bytes += costo.bytes;
      total.curvas += costo.curvas;
      total.profundidad = Math.max(total.profundidad, costo.profundidad);
      comprobar(total);
    }
    return total;
  }
  entidadesCosto(parsed.entities, 0);
  return helper;
}
