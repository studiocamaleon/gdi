import { createHash } from 'node:crypto';
import { XMLParser } from 'fast-xml-parser';
import svgpath from 'svgpath';
import type {
  ContornoVectorial,
  DiagnosticoSvg,
  GeometriaVectorialCanonica,
  PiezaVectorial,
  PuntoVectorial,
} from './tipos';

const MAX_SVG_BYTES = 512 * 1024;
const MAX_CONTORNOS = 500;
const MAX_PUNTOS = 8_000;
const MAX_PUNTOS_CRUDOS = 100_000;
const TOLERANCIAS_SIMPLIFICACION_MM = [0.15, 0.25, 0.35, 0.5, 0.75, 1, 1.5];
const EPSILON = 1e-6;

type NodoXml = Record<string, unknown>;

export class SvgFabricacionError extends Error {
  constructor(
    message: string,
    readonly diagnosticos: DiagnosticoSvg[],
  ) {
    super(message);
  }
}

interface ContornoCrudo {
  puntos: PuntoVectorial[];
  areaFirmada: number;
  perimetro: number;
  profundidad: number;
}

interface ContornoFuente {
  puntos: PuntoVectorial[];
  grupo: number;
  objetoFuente: NonNullable<PiezaVectorial['objetoFuente']>;
}

export function analizarSvgFabricacion(input: {
  svg: string;
  anchoFinalMm: number;
  altoFinalMm?: number | null;
  toleranciaCurvaMm?: number;
}): { geometria: GeometriaVectorialCanonica; diagnosticos: DiagnosticoSvg[] } {
  const diagnosticos: DiagnosticoSvg[] = [];
  validarFuenteSvg(input.svg, input.anchoFinalMm, input.altoFinalMm);

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    parseAttributeValue: false,
    trimValues: false,
  });
  let parsed: unknown;
  try {
    parsed = parser.parse(anotarOrdenElementosFabricables(input.svg));
  } catch {
    throw errorSvg('svg_invalido', 'El archivo no contiene un SVG válido.');
  }
  const parsedRecord = asRecord(parsed);
  const root = parsedRecord ? asRecord(parsedRecord.svg) : null;
  if (!root) {
    throw errorSvg(
      'svg_sin_raiz',
      'El archivo no contiene una etiqueta <svg>.',
    );
  }

  const viewBox = leerViewBox(root);
  const toleranceSource = Math.max(
    0.01,
    (input.toleranciaCurvaMm ?? 0.35) * (viewBox.width / input.anchoFinalMm),
  );
  const contornosFuente: ContornoFuente[] = [];
  recorrerNodo(
    root,
    [],
    [],
    undefined,
    contornosFuente,
    diagnosticos,
    toleranceSource,
    { value: 0 },
    { value: 0 },
  );

  if (contornosFuente.length === 0) {
    throw errorSvg(
      'svg_sin_contornos',
      'El SVG no contiene contornos cerrados que puedan fabricarse.',
    );
  }
  if (contornosFuente.length > MAX_CONTORNOS) {
    throw errorSvg(
      'demasiados_contornos',
      `El SVG contiene ${contornosFuente.length} contornos; el máximo inicial es ${MAX_CONTORNOS}.`,
    );
  }

  const totalPuntosCrudos = contornosFuente.reduce(
    (total, contorno) => total + contorno.puntos.length,
    0,
  );
  if (totalPuntosCrudos > MAX_PUNTOS_CRUDOS) {
    throw errorSvg(
      'demasiados_puntos',
      `El SVG genera ${totalPuntosCrudos} puntos; supera el límite de seguridad de ${MAX_PUNTOS_CRUDOS}. Simplificá el archivo antes de cotizar.`,
    );
  }

  const bounds = limites(
    contornosFuente.flatMap((contorno) => contorno.puntos),
  );
  if (bounds.width <= EPSILON || bounds.height <= EPSILON) {
    throw errorSvg(
      'svg_sin_medida',
      'Los contornos no tienen una medida válida.',
    );
  }
  const scale = input.anchoFinalMm / bounds.width;
  const altoCalculado = bounds.height * scale;
  if (
    input.altoFinalMm != null &&
    Math.abs(input.altoFinalMm - altoCalculado) >
      Math.max(1, altoCalculado * 0.01)
  ) {
    throw errorSvg(
      'proporcion_incompatible',
      `Con ${redondear(input.anchoFinalMm)} mm de ancho, el vector mide ${redondear(altoCalculado)} mm de alto. No se deforma el diseño automáticamente.`,
    );
  }

  let normalizados = contornosFuente.map((contorno) => ({
    grupo: contorno.grupo,
    objetoFuente: contorno.objetoFuente,
    puntos: limpiarContorno(
      contorno.puntos.map((p) => ({
        x: (p.x - bounds.minX) * scale,
        y: (p.y - bounds.minY) * scale,
      })),
    ),
  }));
  if (totalPuntosCrudos > MAX_PUNTOS) {
    const originales = normalizados;
    let toleranciaUsada = 0;
    for (const toleranciaMm of TOLERANCIAS_SIMPLIFICACION_MM) {
      const candidato = originales.map((contorno) => ({
        ...contorno,
        puntos: simplificarContornoCerrado(contorno.puntos, toleranciaMm),
      }));
      if (cantidadPuntos(candidato) <= MAX_PUNTOS) {
        normalizados = candidato;
        toleranciaUsada = toleranciaMm;
        break;
      }
    }
    const puntosSimplificados = cantidadPuntos(normalizados);
    if (puntosSimplificados > MAX_PUNTOS) {
      throw errorSvg(
        'demasiados_puntos',
        `El SVG genera ${totalPuntosCrudos} puntos y no puede reducirse de forma segura por debajo de ${MAX_PUNTOS}. Simplificá el vector antes de cotizar.`,
      );
    }
    const desviacionArea = desviacionRelativa(
      sumaAreaAbsoluta(originales),
      sumaAreaAbsoluta(normalizados),
    );
    const desviacionPerimetro = desviacionRelativa(
      sumaPerimetros(originales),
      sumaPerimetros(normalizados),
    );
    if (desviacionArea > 0.01 || desviacionPerimetro > 0.025) {
      throw errorSvg(
        'simplificacion_insegura',
        'El vector es demasiado complejo y simplificarlo alteraría su geometría. Reducí nodos en el programa de diseño antes de cotizar.',
      );
    }
    diagnosticos.push({
      codigo: 'vector_simplificado',
      mensaje: `Se optimizó el vector de ${totalPuntosCrudos} a ${puntosSimplificados} puntos (tolerancia ${toleranciaUsada} mm) sin alterar su medida de fabricación.`,
      severidad: 'WARNING',
    });
  }
  const piezas = construirPiezas(normalizados);
  if (piezas.length === 0) {
    throw errorSvg(
      'svg_sin_piezas',
      'No fue posible construir piezas cerradas.',
    );
  }

  const areaTotalMm2 = piezas.reduce((total, p) => total + p.areaMm2, 0);
  const perimetroTotalMm = piezas.reduce(
    (total, p) => total + p.perimetroMm,
    0,
  );
  if (
    normalizados.some((contorno) => Math.abs(areaFirmada(contorno.puntos)) < 1)
  ) {
    diagnosticos.push({
      codigo: 'contorno_muy_pequeno',
      mensaje: 'Hay contornos menores a 1 mm²; revisalos antes de producir.',
      severidad: 'WARNING',
    });
  }

  return {
    geometria: {
      schemaVersion: 1,
      anchoMm: redondear(input.anchoFinalMm),
      altoMm: redondear(altoCalculado),
      piezas,
      areaTotalMm2: redondear(areaTotalMm2),
      perimetroTotalMm: redondear(perimetroTotalMm),
      hashFuente: createHash('sha256').update(input.svg).digest('hex'),
    },
    diagnosticos,
  };
}

function validarFuenteSvg(
  svg: string,
  anchoFinalMm: number,
  altoFinalMm?: number | null,
): void {
  if (typeof svg !== 'string' || svg.trim().length === 0) {
    throw errorSvg('svg_vacio', 'Seleccioná un archivo SVG.');
  }
  if (Buffer.byteLength(svg, 'utf8') > MAX_SVG_BYTES) {
    throw errorSvg(
      'svg_demasiado_grande',
      'El SVG supera 512 KB. Simplificá los contornos antes de cotizar.',
    );
  }
  if (!Number.isFinite(anchoFinalMm) || anchoFinalMm <= 0) {
    throw errorSvg('ancho_invalido', 'Indicá un ancho final mayor que cero.');
  }
  if (
    altoFinalMm != null &&
    (!Number.isFinite(altoFinalMm) || altoFinalMm <= 0)
  ) {
    throw errorSvg('alto_invalido', 'El alto final debe ser mayor que cero.');
  }
  if (/<!DOCTYPE|<!ENTITY/i.test(svg)) {
    throw errorSvg(
      'xml_no_permitido',
      'El SVG contiene declaraciones XML no permitidas.',
    );
  }
  if (/\bdata-gdi-source-order\s*=/i.test(svg)) {
    throw errorSvg(
      'atributo_reservado',
      'El SVG utiliza un atributo interno reservado. Volvé a exportar el archivo antes de cotizar.',
    );
  }
  const prohibidos = ['script', 'foreignObject', 'image', 'use', 'text'];
  const encontrado = prohibidos.find((tag) =>
    new RegExp(`<\\s*${tag}\\b`, 'i').test(svg),
  );
  if (encontrado) {
    const mensaje =
      encontrado === 'text'
        ? 'El SVG contiene texto editable. Convertí las tipografías a curvas.'
        : `El SVG contiene <${encontrado}>, que no se admite para fabricación.`;
    throw errorSvg(`elemento_${encontrado}_no_permitido`, mensaje);
  }
  if (/\b(?:href|xlink:href)\s*=\s*["']\s*(?:https?:|data:|\/\/)/i.test(svg)) {
    throw errorSvg(
      'recurso_externo',
      'El SVG referencia contenido externo o incrustado.',
    );
  }
}

function leerViewBox(root: NodoXml): { width: number; height: number } {
  const raw = texto(root['@_viewBox']) ?? '';
  const values = raw.split(/[\s,]+/).map(Number);
  if (
    values.length === 4 &&
    values.every(Number.isFinite) &&
    values[2] > 0 &&
    values[3] > 0
  ) {
    return { width: values[2], height: values[3] };
  }
  const width = numeroSvg(root['@_width']);
  const height = numeroSvg(root['@_height']);
  if (width && height) return { width, height };
  throw errorSvg(
    'svg_sin_viewbox',
    'El SVG debe declarar viewBox o dimensiones de ancho y alto.',
  );
}

function recorrerNodo(
  node: NodoXml,
  parentTransforms: string[],
  parentGroupPath: string[],
  inheritedFill: string | undefined,
  output: ContornoFuente[],
  diagnosticos: DiagnosticoSvg[],
  tolerance: number,
  groupCounter: { value: number },
  anonymousGroupCounter: { value: number },
): void {
  const ownTransform = texto(node['@_transform']);
  const transforms = ownTransform
    ? [...parentTransforms, ownTransform]
    : parentTransforms;

  for (const [tag, rawChild] of Object.entries(node)) {
    if (tag.startsWith('@_') || tag === '#text') continue;
    const children = Array.isArray(rawChild) ? rawChild : [rawChild];
    for (const childValue of children) {
      const child = asRecord(childValue);
      if (!child) continue;
      const childTransforms = texto(child['@_transform'])
        ? [...transforms, texto(child['@_transform']) as string]
        : transforms;
      const childFill = leerRelleno(child) ?? inheritedFill;
      const sourceOrder = numeroSvg(child['@_data-gdi-source-order']);
      const sourceId = texto(child['@_id'])?.trim();
      const sourceLabel =
        texto(child['@_inkscape:label'])?.trim() ||
        texto(child['@_aria-label'])?.trim() ||
        sourceId;
      const objetoFuente =
        sourceOrder == null
          ? null
          : {
              id: `objeto-${sourceOrder + 1}`,
              ...(sourceLabel ? { etiqueta: sourceLabel } : {}),
              grupoRuta: parentGroupPath,
              ...(childFill && childFill !== 'none'
                ? { colorRelleno: childFill }
                : {}),
              orden: sourceOrder,
            };
      if (tag === 'path') {
        const d = texto(child['@_d']);
        if (!d) continue;
        const grupo = groupCounter.value++;
        // SVG cierra implícitamente cada subtrazado al rellenarlo, aunque el
        // archivo no escriba `Z`. Es habitual en logos exportados (Puma es un
        // caso real). Los paths sólo de trazo sí deben seguir explícitamente
        // cerrados para considerarlos una pieza fabricable.
        const rellenoVisible = childFill !== 'none';
        output.push(
          ...contornosDePath(d, childTransforms, tolerance, rellenoVisible).map(
            (puntos) => ({
              puntos,
              grupo,
              objetoFuente: objetoFuente ?? objetoFuenteFallback(groupCounter.value),
            }),
          ),
        );
      } else if (tag === 'polygon' || tag === 'polyline') {
        const puntos = parsePoints(texto(child['@_points']) ?? '');
        if (tag === 'polyline' && !puntosIguales(puntos[0], puntos.at(-1))) {
          diagnosticos.push({
            codigo: 'trazado_abierto_ignorado',
            mensaje:
              'Se ignoró una polilínea abierta; cerrala para fabricarla.',
            severidad: 'WARNING',
          });
          continue;
        }
        output.push({
          puntos: aplicarTransformPuntos(puntos, childTransforms),
          grupo: groupCounter.value++,
          objetoFuente: objetoFuente ?? objetoFuenteFallback(groupCounter.value),
        });
      } else if (tag === 'rect') {
        const x = numeroSvg(child['@_x']) ?? 0;
        const y = numeroSvg(child['@_y']) ?? 0;
        const width = numeroSvg(child['@_width']) ?? 0;
        const height = numeroSvg(child['@_height']) ?? 0;
        if (width > 0 && height > 0) {
          output.push({
            puntos: aplicarTransformPuntos(
              [
                { x, y },
                { x: x + width, y },
                { x: x + width, y: y + height },
                { x, y: y + height },
              ],
              childTransforms,
            ),
            grupo: groupCounter.value++,
            objetoFuente: objetoFuente ?? objetoFuenteFallback(groupCounter.value),
          });
        }
      } else if (tag === 'circle' || tag === 'ellipse') {
        const cx = numeroSvg(child['@_cx']) ?? 0;
        const cy = numeroSvg(child['@_cy']) ?? 0;
        const rx =
          tag === 'circle'
            ? (numeroSvg(child['@_r']) ?? 0)
            : (numeroSvg(child['@_rx']) ?? 0);
        const ry = tag === 'circle' ? rx : (numeroSvg(child['@_ry']) ?? 0);
        if (rx > 0 && ry > 0) {
          output.push({
            puntos: aplicarTransformPuntos(
              Array.from({ length: 64 }, (_, index) => {
                const angle = (index / 64) * Math.PI * 2;
                return {
                  x: cx + Math.cos(angle) * rx,
                  y: cy + Math.sin(angle) * ry,
                };
              }),
              childTransforms,
            ),
            grupo: groupCounter.value++,
            objetoFuente: objetoFuente ?? objetoFuenteFallback(groupCounter.value),
          });
        }
      } else if (tag === 'line') {
        diagnosticos.push({
          codigo: 'linea_abierta_ignorada',
          mensaje:
            'Se ignoró una línea abierta; convertí los trazos a contornos.',
          severidad: 'WARNING',
        });
      } else {
        const nextGroupPath =
          tag === 'g'
            ? [
                ...parentGroupPath,
                sourceLabel || `grupo-${++anonymousGroupCounter.value}`,
              ]
            : parentGroupPath;
        recorrerNodo(
          child,
          transforms,
          nextGroupPath,
          childFill,
          output,
          diagnosticos,
          tolerance,
          groupCounter,
          anonymousGroupCounter,
        );
      }
    }
  }
}

function contornosDePath(
  d: string,
  transforms: string[],
  tolerance: number,
  cerrarSubtrazadosRellenos = false,
): PuntoVectorial[][] {
  let path = svgpath(d).unshort().unarc().abs();
  for (const transform of [...transforms].reverse())
    path = path.transform(transform);
  path = path.abs();
  const result: PuntoVectorial[][] = [];
  let contour: PuntoVectorial[] = [];
  let current: PuntoVectorial = { x: 0, y: 0 };
  let start: PuntoVectorial = current;
  let closed = false;

  const finish = () => {
    if ((closed || cerrarSubtrazadosRellenos) && contour.length >= 3)
      result.push(limpiarContorno(contour));
    contour = [];
    closed = false;
  };

  const segments: Array<[string, ...number[]]> = [];
  path.iterate((segment) => {
    segments.push(segment as [string, ...number[]]);
  });
  for (const segment of segments) {
    const command = segment[0].toUpperCase();
    const n = segment.slice(1).map(Number);
    if (command === 'M') {
      finish();
      current = { x: n[0], y: n[1] };
      start = current;
      contour = [current];
    } else if (command === 'L') {
      current = { x: n[0], y: n[1] };
      contour.push(current);
    } else if (command === 'H') {
      current = { x: n[0], y: current.y };
      contour.push(current);
    } else if (command === 'V') {
      current = { x: current.x, y: n[0] };
      contour.push(current);
    } else if (command === 'C') {
      const p0 = current;
      const p1 = { x: n[0], y: n[1] };
      const p2 = { x: n[2], y: n[3] };
      const p3 = { x: n[4], y: n[5] };
      const steps = pasosCurva([p0, p1, p2, p3], tolerance);
      for (let index = 1; index <= steps; index++) {
        const t = index / steps;
        const mt = 1 - t;
        contour.push({
          x:
            mt ** 3 * p0.x +
            3 * mt ** 2 * t * p1.x +
            3 * mt * t ** 2 * p2.x +
            t ** 3 * p3.x,
          y:
            mt ** 3 * p0.y +
            3 * mt ** 2 * t * p1.y +
            3 * mt * t ** 2 * p2.y +
            t ** 3 * p3.y,
        });
      }
      current = p3;
    } else if (command === 'Q') {
      const p0 = current;
      const p1 = { x: n[0], y: n[1] };
      const p2 = { x: n[2], y: n[3] };
      const steps = pasosCurva([p0, p1, p2], tolerance);
      for (let index = 1; index <= steps; index++) {
        const t = index / steps;
        const mt = 1 - t;
        contour.push({
          x: mt ** 2 * p0.x + 2 * mt * t * p1.x + t ** 2 * p2.x,
          y: mt ** 2 * p0.y + 2 * mt * t * p1.y + t ** 2 * p2.y,
        });
      }
      current = p2;
    } else if (command === 'Z') {
      current = start;
      closed = true;
      finish();
    }
  }
  finish();
  return result;
}

function aplicarTransformPuntos(
  points: PuntoVectorial[],
  transforms: string[],
): PuntoVectorial[] {
  if (transforms.length === 0) return points;
  const d = `M${points.map((p) => `${p.x},${p.y}`).join('L')}Z`;
  return contornosDePath(d, transforms, 0.1)[0] ?? [];
}

function construirPiezas(contornos: ContornoFuente[]): PiezaVectorial[] {
  const grupos = new Map<
    number,
    {
      puntos: PuntoVectorial[][];
      objetoFuente: NonNullable<PiezaVectorial['objetoFuente']>;
    }
  >();
  for (const contorno of contornos) {
    if (contorno.puntos.length < 3) continue;
    const grupo = grupos.get(contorno.grupo);
    grupos.set(contorno.grupo, {
      puntos: [...(grupo?.puntos ?? []), contorno.puntos],
      objetoFuente: grupo?.objetoFuente ?? contorno.objetoFuente,
    });
  }
  const piezasSinId: Omit<PiezaVectorial, 'id'>[] = [];
  for (const grupo of grupos.values()) {
    const raw: ContornoCrudo[] = grupo.puntos
      .map((points) => ({
        puntos: points,
        areaFirmada: areaFirmada(points),
        perimetro: perimetro(points),
        profundidad: 0,
      }))
      .sort((a, b) => Math.abs(b.areaFirmada) - Math.abs(a.areaFirmada));
    for (let index = 0; index < raw.length; index++) {
      raw[index].profundidad = raw
        .slice(0, index)
        .filter((candidate) =>
          puntoEnPoligono(raw[index].puntos[0], candidate.puntos),
        ).length;
    }
    const outers = raw.filter((item) => item.profundidad % 2 === 0);
    for (const outer of outers) {
      const holes = raw.filter(
        (candidate) =>
          candidate.profundidad === outer.profundidad + 1 &&
          puntoEnPoligono(candidate.puntos[0], outer.puntos),
      );
      const all = [outer, ...holes];
      const bounds = limites(outer.puntos);
      const offset = (points: PuntoVectorial[]) =>
        points.map((p) => ({
          x: redondear(p.x - bounds.minX),
          y: redondear(p.y - bounds.minY),
        }));
      const contornosPieza: ContornoVectorial[] = [
        { puntos: offset(outer.puntos), esHueco: false },
        ...holes.map((hole) => ({
          puntos: offset(hole.puntos),
          esHueco: true,
        })),
      ];
      piezasSinId.push({
        objetoFuente: grupo.objetoFuente,
        contornos: contornosPieza,
        origenXmm: redondear(bounds.minX),
        origenYmm: redondear(bounds.minY),
        anchoMm: redondear(bounds.width),
        altoMm: redondear(bounds.height),
        areaMm2: redondear(
          Math.abs(outer.areaFirmada) -
            holes.reduce((sum, h) => sum + Math.abs(h.areaFirmada), 0),
        ),
        perimetroMm: redondear(all.reduce((sum, c) => sum + c.perimetro, 0)),
      });
    }
  }
  return piezasSinId
    .sort(
      (a, b) =>
        (a.objetoFuente?.orden ?? 0) - (b.objetoFuente?.orden ?? 0) ||
        (a.origenYmm ?? 0) - (b.origenYmm ?? 0) ||
        (a.origenXmm ?? 0) - (b.origenXmm ?? 0),
    )
    .map((pieza, index) => ({ ...pieza, id: `pieza-${index + 1}` }));
}

function anotarOrdenElementosFabricables(svg: string): string {
  let order = 0;
  return svg.replace(
    /<(path|polygon|polyline|rect|circle|ellipse)\b/gi,
    (match) => `${match} data-gdi-source-order="${order++}"`,
  );
}

function leerRelleno(node: NodoXml): string | undefined {
  const directo = texto(node['@_fill'])?.trim().toLowerCase();
  if (directo) return directo;
  const style = texto(node['@_style']) ?? '';
  const match = /(?:^|;)\s*fill\s*:\s*([^;]+)/i.exec(style);
  return match?.[1]?.trim().toLowerCase();
}

function objetoFuenteFallback(
  index: number,
): NonNullable<PiezaVectorial['objetoFuente']> {
  return {
    id: `objeto-${index}`,
    grupoRuta: [],
    orden: index - 1,
  };
}

function pasosCurva(points: PuntoVectorial[], tolerance: number): number {
  let controlLength = 0;
  for (let index = 1; index < points.length; index++)
    controlLength += distancia(points[index - 1], points[index]);
  const chord = distancia(points[0], points[points.length - 1]);
  const curvature = Math.max(0, controlLength - chord);
  return Math.max(
    4,
    Math.min(
      64,
      Math.ceil(Math.sqrt(curvature / Math.max(tolerance, 0.001)) * 2),
    ),
  );
}

function limpiarContorno(points: PuntoVectorial[]): PuntoVectorial[] {
  const clean: PuntoVectorial[] = [];
  for (const p of points) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    if (!puntosIguales(clean.at(-1), p)) clean.push(p);
  }
  if (puntosIguales(clean[0], clean.at(-1))) clean.pop();
  return clean;
}

function cantidadPuntos(contornos: ContornoFuente[]): number {
  return contornos.reduce(
    (total, contorno) => total + contorno.puntos.length,
    0,
  );
}

function sumaAreaAbsoluta(contornos: ContornoFuente[]): number {
  return contornos.reduce(
    (total, contorno) => total + Math.abs(areaFirmada(contorno.puntos)),
    0,
  );
}

function sumaPerimetros(contornos: ContornoFuente[]): number {
  return contornos.reduce(
    (total, contorno) => total + perimetro(contorno.puntos),
    0,
  );
}

function desviacionRelativa(original: number, simplificado: number): number {
  if (original <= EPSILON) return 0;
  return Math.abs(original - simplificado) / original;
}

/** Ramer–Douglas–Peucker para anillos. Se parte el contorno en dos cadenas
 * usando extremos distantes, evitando tratar el primer/último punto como un
 * segmento degenerado. */
function simplificarContornoCerrado(
  points: PuntoVectorial[],
  tolerance: number,
): PuntoVectorial[] {
  if (points.length <= 4 || tolerance <= 0) return points;
  let minX = 0;
  let maxX = 0;
  let minY = 0;
  let maxY = 0;
  for (let index = 1; index < points.length; index++) {
    if (points[index].x < points[minX].x) minX = index;
    if (points[index].x > points[maxX].x) maxX = index;
    if (points[index].y < points[minY].y) minY = index;
    if (points[index].y > points[maxY].y) maxY = index;
  }
  const horizontal = distancia(points[minX], points[maxX]);
  const vertical = distancia(points[minY], points[maxY]);
  const start = horizontal >= vertical ? minX : minY;
  const split = horizontal >= vertical ? maxX : maxY;
  if (start === split) return points;
  const first = cadenaCircular(points, start, split);
  const second = cadenaCircular(points, split, start);
  return limpiarContorno([
    ...simplificarCadena(first, tolerance).slice(0, -1),
    ...simplificarCadena(second, tolerance).slice(0, -1),
  ]);
}

function cadenaCircular(
  points: PuntoVectorial[],
  start: number,
  end: number,
): PuntoVectorial[] {
  const result: PuntoVectorial[] = [points[start]];
  let index = start;
  while (index !== end) {
    index = (index + 1) % points.length;
    result.push(points[index]);
  }
  return result;
}

function simplificarCadena(
  points: PuntoVectorial[],
  tolerance: number,
): PuntoVectorial[] {
  if (points.length <= 2) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: Array<[number, number]> = [[0, points.length - 1]];
  const toleranceSq = tolerance * tolerance;
  while (stack.length > 0) {
    const [start, end] = stack.pop() as [number, number];
    let farthestIndex = -1;
    let farthestDistanceSq = toleranceSq;
    for (let index = start + 1; index < end; index++) {
      const distanceSq = distanciaSegmentoSq(
        points[index],
        points[start],
        points[end],
      );
      if (distanceSq > farthestDistanceSq) {
        farthestDistanceSq = distanceSq;
        farthestIndex = index;
      }
    }
    if (farthestIndex >= 0) {
      keep[farthestIndex] = 1;
      stack.push([start, farthestIndex], [farthestIndex, end]);
    }
  }
  return points.filter((_, index) => keep[index] === 1);
}

function distanciaSegmentoSq(
  point: PuntoVectorial,
  start: PuntoVectorial,
  end: PuntoVectorial,
): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (Math.abs(dx) <= EPSILON && Math.abs(dy) <= EPSILON) {
    return (point.x - start.x) ** 2 + (point.y - start.y) ** 2;
  }
  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.x - start.x) * dx + (point.y - start.y) * dy) /
        (dx * dx + dy * dy),
    ),
  );
  const projectedX = start.x + t * dx;
  const projectedY = start.y + t * dy;
  return (point.x - projectedX) ** 2 + (point.y - projectedY) ** 2;
}

function limites(points: PuntoVectorial[]) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
}

function areaFirmada(points: PuntoVectorial[]): number {
  let sum = 0;
  for (let index = 0; index < points.length; index++) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    sum += current.x * next.y - next.x * current.y;
  }
  return sum / 2;
}

function perimetro(points: PuntoVectorial[]): number {
  return points.reduce(
    (sum, point, index) =>
      sum + distancia(point, points[(index + 1) % points.length]),
    0,
  );
}

function puntoEnPoligono(
  point: PuntoVectorial,
  polygon: PuntoVectorial[],
): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    const intersects =
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

function parsePoints(value: string): PuntoVectorial[] {
  const numbers = value
    .trim()
    .split(/[\s,]+/)
    .map(Number)
    .filter(Number.isFinite);
  const result: PuntoVectorial[] = [];
  for (let index = 0; index + 1 < numbers.length; index += 2)
    result.push({ x: numbers[index], y: numbers[index + 1] });
  return result;
}

function distancia(a: PuntoVectorial, b: PuntoVectorial): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function puntosIguales(a?: PuntoVectorial, b?: PuntoVectorial): boolean {
  return Boolean(
    a && b && Math.abs(a.x - b.x) < EPSILON && Math.abs(a.y - b.y) < EPSILON,
  );
}

function numeroSvg(value: unknown): number | null {
  const match = texto(value)?.match(/^-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function asRecord(value: unknown): NodoXml | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as NodoXml)
    : null;
}

function texto(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function redondear(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function errorSvg(codigo: string, mensaje: string): SvgFabricacionError {
  return new SvgFabricacionError(mensaje, [
    { codigo, mensaje, severidad: 'ERROR' },
  ]);
}
