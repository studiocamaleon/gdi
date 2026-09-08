import { Helper } from 'dxf';
import type { FabricacionVectorial } from '../../motor-universal/geometria-vectorial/fabricacion-vectorial';
import { analizarSvgFabricacion } from '../../motor-universal/geometria-vectorial/svg-parser';

export const UNIDADES_VECTOR: Record<string, number> = {
  mm: 1,
  cm: 10,
  m: 1000,
  pulgadas: 25.4,
  pies: 304.8,
  pt: 25.4 / 72,
  px: 25.4 / 96,
  dm: 100,
  micrones: 0.001,
  mil: 0.0254,
};
type Punto = { x: number; y: number };
export type EntidadInspeccion = {
  id: string;
  tipoEntidad?: string;
  color?: string;
  tipoLinea?: string;
  exportable?: boolean;
  motivoNoCompatible?: string;
  longitud?: number | null;
  precisionLongitud?: 'EXACTA' | 'APROXIMADA' | null;
  texto?: {
    contenido: string;
    x: number;
    y: number;
    altura: number;
    rotacion: number;
  };
  capa: string;
  puntos: Punto[];
  cerrada: boolean;
  apertura: number;
  area: number;
  ancho: number;
  alto: number;
};
export type InspeccionVector = {
  formato: 'DXF' | 'SVG';
  dxfNativo?: boolean;
  unidadDeclarada: string | null;
  entidades: EntidadInspeccion[];
  sugeridaId: string;
  avisos: string[];
};
export type SeleccionVector = {
  exteriorId: string;
  unidad: string;
  cerrarExterior: boolean;
  excluidas?: string[];
  operaciones: Array<{ entidadId: string; tipo: 'CORTE_INTERIOR' | 'HENDIDO' }>;
};
export type FuenteGuardada = {
  schemaVersion: 2;
  fabricacion?: FabricacionVectorial;
  nombreArchivo: string;
  svg: string;
  anchoFinalMm: number;
  altoFinalMm: number;
  relacionAltoAncho: number;
  formatoOrigen: 'DXF' | 'SVG';
  unidadOrigen: string;
  procedencia: {
    version: 1;
    geometriaId: string;
    archivoId: string;
    hash: string;
    capa: string;
    exteriorId: string;
    unidadDeclarada: string | null;
    cierreConfirmado: boolean;
    aperturaOriginalMm: number;
  };
  operaciones: Array<{
    entidadId: string;
    capa: string;
    tipo: 'CORTE_INTERIOR' | 'HENDIDO';
    puntos: Punto[];
    cerrada: boolean;
  }>;
};

function entidad(
  id: string,
  capa: string,
  puntos: Punto[],
  cerrada: boolean,
): EntidadInspeccion {
  if (
    puntos.length < 2 ||
    puntos.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))
  )
    throw new Error('El archivo contiene coordenadas inválidas.');
  const xs = puntos.map((p) => p.x),
    ys = puntos.map((p) => p.y);
  const apertura = Math.hypot(
    puntos[0].x - puntos.at(-1)!.x,
    puntos[0].y - puntos.at(-1)!.y,
  );
  const area = Math.abs(
    puntos.reduce((a, p, i) => {
      const q = puntos[(i + 1) % puntos.length];
      return a + p.x * q.y - q.x * p.y;
    }, 0) / 2,
  );
  return {
    id,
    capa,
    puntos,
    cerrada: cerrada || apertura < 1e-7,
    apertura,
    area,
    ancho: Math.max(...xs) - Math.min(...xs),
    alto: Math.max(...ys) - Math.min(...ys),
  };
}

/** Inspección sin cierres ni selección destructiva; los ids se conservan entre lecturas. */
export function inspeccionarVector(
  contenido: string,
  nombre: string,
): InspeccionVector {
  if (Buffer.byteLength(contenido) > 524288)
    throw new Error('El vector supera el máximo de 512 KB.');
  let entidades: EntidadInspeccion[],
    unidadDeclarada: string | null = null;
  const avisos: string[] = [];
  const formato = nombre.toLowerCase().endsWith('.dxf')
    ? 'DXF'
    : nombre.toLowerCase().endsWith('.svg')
      ? 'SVG'
      : null;
  if (!formato) throw new Error('Elegí un archivo DXF o SVG.');
  if (formato === 'DXF') {
    const helper = new Helper(contenido);
    const unidades: Record<number, string> = {
      1: 'pulgadas',
      2: 'pies',
      4: 'mm',
      5: 'cm',
      6: 'm',
      9: 'mil',
      13: 'micrones',
      14: 'dm',
    };
    unidadDeclarada = unidades[Number(helper.parsed.header?.insUnits)] ?? null;
    const originales = helper.denormalised;
    entidades = helper.toPolylines().polylines.flatMap((p, i) => {
      if (
        (p.layer?.flags ?? 0) & 1 ||
        (p.layer?.colorNumber ?? 0) < 0 ||
        originales[i]?.visible === false ||
        p.vertices.length < 2
      )
        return [];
      const original = originales[i];
      return [
        entidad(
          `${original?.handle ?? 'entidad'}_${i}`,
          p.layer?.name ?? original?.layer ?? '0',
          p.vertices.map(([x, y]) => ({ x, y: -y })),
          original?.closed === true,
        ),
      ];
    });
    if (!unidadDeclarada)
      avisos.push(
        'El DXF no declara unidades. Confirmá la unidad o corregí la exportación antes de guardar.',
      );
  } else {
    // La inspección SVG usa unidades de viewBox. La dimensión física se confirma
    // igual que en DXF; no se convierte automáticamente px a mm.
    const root = contenido.match(/<svg\b[^>]*>/i)?.[0] ?? '';
    const vb = root
      .match(/viewBox\s*=\s*["']([^"']+)["']/i)?.[1]
      ?.trim()
      .split(/[\s,]+/)
      .map(Number);
    const ancho = vb?.[2];
    if (!ancho || !Number.isFinite(ancho))
      throw new Error('El SVG debe incluir un viewBox con medidas válidas.');
    const analisis = analizarSvgFabricacion({
      svg: contenido,
      anchoFinalMm: ancho,
    });
    const escalaFuente = analisis.medidasFuente.ancho / ancho;
    entidades = analisis.geometria.piezas.flatMap((p, i) =>
      p.contornos.map((c, j) =>
        entidad(
          `${p.id}_${i}_${j}`,
          p.objetoFuente?.grupoRuta.join(' / ') || 'SVG',
          c.puntos.map((v) => ({
            x: (v.x + (p.origenXmm ?? 0)) * escalaFuente,
            y: (v.y + (p.origenYmm ?? 0)) * escalaFuente,
          })),
          true,
        ),
      ),
    );
    avisos.push(
      'Confirmá la unidad de las coordenadas del SVG. Los contornos interiores se seleccionan como operaciones.',
    );
    avisos.push(...analisis.diagnosticos.map((d) => d.mensaje));
  }
  if (
    !entidades.length ||
    entidades.length > 1000 ||
    entidades.reduce((n, e) => n + e.puntos.length, 0) > 50000
  )
    throw new Error(
      'El archivo debe contener entre 1 y 1000 contornos y hasta 50.000 puntos.',
    );
  const candidatas = entidades
    .filter((e) => e.area > 1e-8)
    .sort((a, b) => b.area - a.area);
  if (!candidatas.length)
    throw new Error('No se encontró una silueta con superficie.');
  if (entidades.length > 1)
    avisos.push(
      'La selección naranja será la única silueta de nesting de esta pieza. Las demás capas visibles se conservan. Podés asignarles una operación o excluirlas de la exportación.',
    );
  return {
    formato,
    unidadDeclarada,
    entidades,
    sugeridaId: candidatas[0].id,
    avisos,
  };
}

export function interpretarVector(
  inspeccion: InspeccionVector,
  seleccion: SeleccionVector,
  origen: {
    nombreArchivo: string;
    archivoId: string;
    geometriaId: string;
    hash: string;
  },
): FuenteGuardada {
  const e = inspeccion.entidades.find((e) => e.id === seleccion.exteriorId);
  const factor = UNIDADES_VECTOR[seleccion.unidad];
  if (!e || !(e.area > 0) || !factor)
    throw new Error('Elegí la silueta exterior y confirmá su unidad.');
  if (!e.cerrada && !seleccion.cerrarExterior)
    throw new Error(
      `El exterior está abierto (${(e.apertura * factor).toFixed(3)} mm). Corregí el original o confirmá su cierre recto.`,
    );
  const minX = Math.min(...e.puntos.map((p) => p.x)),
    minY = Math.min(...e.puntos.map((p) => p.y));
  const transformar = (p: Punto): Punto => ({
    x: (p.x - minX) * factor,
    y: (p.y - minY) * factor,
  });
  const puntos = e.puntos.map(transformar);
  const anchoFinalMm = e.ancho * factor,
    altoFinalMm = e.alto * factor;
  if (
    !(anchoFinalMm > 0 && altoFinalMm > 0) ||
    Math.max(anchoFinalMm, altoFinalMm) > 100000
  )
    throw new Error('Las medidas de fabricación no son válidas.');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${anchoFinalMm} ${altoFinalMm}"><path id="exterior" d="M${puntos.map((p) => `${p.x},${p.y}`).join(' L')} Z"/></svg>`;
  const validacion = analizarSvgFabricacion({ svg, anchoFinalMm, altoFinalMm });
  if (
    validacion.geometria.piezas.length !== 1 ||
    validacion.diagnosticos.some((d) => d.severidad === 'ERROR')
  )
    throw new Error('La selección debe producir una sola pieza válida.');
  const excluidas = new Set(seleccion.excluidas ?? []);
  if (
    excluidas.has(e.id) ||
    excluidas.size !== (seleccion.excluidas ?? []).length ||
    [...excluidas].some((id) => !inspeccion.entidades.some((v) => v.id === id))
  )
    throw new Error(
      'La exclusión contiene entidades inválidas o el exterior seleccionado.',
    );
  const incompatible = inspeccion.entidades.find(
    (v) => !excluidas.has(v.id) && v.exportable === false,
  );
  if (incompatible)
    throw new Error(
      incompatible.motivoNoCompatible ??
        `No se puede conservar la entidad ${incompatible.id}.`,
    );
  const usados = new Set([e.id]);
  const operaciones = seleccion.operaciones.map((op) => {
    const original = inspeccion.entidades.find((e) => e.id === op.entidadId);
    if (
      !original ||
      excluidas.has(op.entidadId) ||
      original.puntos.length < 2 ||
      usados.has(op.entidadId) ||
      !['CORTE_INTERIOR', 'HENDIDO'].includes(op.tipo)
    )
      throw new Error(
        'Las operaciones no son válidas o tienen entidades repetidas.',
      );
    usados.add(op.entidadId);
    return {
      ...op,
      capa: original.capa,
      puntos: original.puntos.map(transformar),
      cerrada: original.cerrada,
    };
  });
  return {
    schemaVersion: 2,
    nombreArchivo: origen.nombreArchivo,
    svg,
    anchoFinalMm,
    altoFinalMm,
    relacionAltoAncho: altoFinalMm / anchoFinalMm,
    formatoOrigen: inspeccion.formato,
    unidadOrigen: seleccion.unidad,
    procedencia: {
      version: 1,
      geometriaId: origen.geometriaId,
      archivoId: origen.archivoId,
      hash: origen.hash,
      capa: e.capa,
      exteriorId: e.id,
      unidadDeclarada: inspeccion.unidadDeclarada,
      cierreConfirmado: !e.cerrada,
      aperturaOriginalMm: e.cerrada ? 0 : e.apertura * factor,
    },
    operaciones,
    fabricacion: {
      version: 1,
      geometriaId: origen.geometriaId,
      archivoHash: origen.hash,
      formato: inspeccion.formato,
      ...(inspeccion.dxfNativo ? { dxfNativo: true } : {}),
      origen: { minX, minY, factorMm: factor },
      transformacion: [1, 0, 0, 1, 0, 0],
      entidades: inspeccion.entidades.map((original) => {
        const ps = original.puntos.map(transformar);
        const rol =
          original.id === e.id
            ? ('CORTE_EXTERIOR' as const)
            : (seleccion.operaciones.find((o) => o.entidadId === original.id)
                ?.tipo ?? null);
        const cerrada =
          original.cerrada ||
          (original.id === e.id && seleccion.cerrarExterior);
        const longitudAproximada =
          ps.length < 2
            ? null
            : ps.reduce((s, p, i) => {
                if (i === ps.length - 1 && !cerrada) return s;
                const q = ps[(i + 1) % ps.length];
                return s + Math.hypot(q.x - p.x, q.y - p.y);
              }, 0);
        const cierreMm =
          original.id === e.id && !original.cerrada
            ? original.apertura * factor
            : 0;
        return {
          entidadId: original.id,
          capa: original.capa,
          tipoEntidad: original.tipoEntidad ?? 'POLILINEA',
          rol,
          conservar: !excluidas.has(original.id),
          color: original.color,
          tipoLinea: original.tipoLinea,
          puntos: ps,
          cerrada,
          longitudMm:
            original.longitud != null
              ? original.longitud * factor + cierreMm
              : longitudAproximada,
          precisionLongitud:
            original.precisionLongitud ??
            (longitudAproximada == null ? null : 'APROXIMADA'),
          ...(original.texto
            ? {
                texto: {
                  ...original.texto,
                  ...transformar(original.texto),
                  altura: original.texto.altura * factor,
                },
              }
            : {}),
        };
      }),
    },
  };
}
