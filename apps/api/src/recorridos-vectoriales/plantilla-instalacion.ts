import * as polygonClipping from 'polygon-clipping';
import type {
  GeometriaVectorialCanonica,
  PuntoVectorial,
  UnionVectorial,
} from '../motor-universal/geometria-vectorial/tipos';

type MultiPolygon = polygonClipping.MultiPolygon;

export type ConfiguracionPlantillaInstalacion = {
  bordeMm?: number;
  anchoPanelMm?: number;
  altoPanelMm?: number;
  solapeMm?: number;
};

export type PanelPlantillaInstalacion = {
  indice: number;
  fila: number;
  columna: number;
  origenXmm: number;
  origenYmm: number;
  anchoMm: number;
  altoMm: number;
  svg: string;
  /** Anillos cerrados de corte, locales al panel. No se envían al frontend. */
  contornosCorte: PuntoVectorial[][];
};

export type PlantillaInstalacion = {
  schemaVersion: 1;
  anchoDisenoMm: number;
  altoDisenoMm: number;
  anchoPlantillaMm: number;
  altoPlantillaMm: number;
  bordeMm: number;
  cantidadPiezas: number;
  cantidadUniones: number;
  svg: string;
  /** Vista explicativa para pantalla. No debe enviarse a una maquina. */
  previewSvg: string;
  /** Anillos cerrados del negativo completo, en milímetros. */
  contornosCorte: PuntoVectorial[][];
  paneles: PanelPlantillaInstalacion[];
};

const DEFAULT_BORDER_MM = 50;
const DEFAULT_PANEL_WIDTH_MM = 1200;
const DEFAULT_PANEL_HEIGHT_MM = 600;
const DEFAULT_OVERLAP_MM = 20;

/**
 * Genera el negativo de instalación desde la composición canónica del SVG.
 * No usa placements del nesting: la posición final nunca depende de cómo se
 * hayan acomodado o segmentado las piezas para fabricarlas.
 */
export function crearPlantillaInstalacion(input: {
  geometria: GeometriaVectorialCanonica;
  nombre: string;
  uniones?: UnionVectorial[];
  configuracion?: ConfiguracionPlantillaInstalacion;
}): PlantillaInstalacion {
  const bordeMm = numeroPositivo(
    input.configuracion?.bordeMm,
    DEFAULT_BORDER_MM,
    0,
  );
  const anchoPanelMm = numeroPositivo(
    input.configuracion?.anchoPanelMm,
    DEFAULT_PANEL_WIDTH_MM,
    100,
  );
  const altoPanelMm = numeroPositivo(
    input.configuracion?.altoPanelMm,
    DEFAULT_PANEL_HEIGHT_MM,
    100,
  );
  const solapeMm = numeroPositivo(
    input.configuracion?.solapeMm,
    DEFAULT_OVERLAP_MM,
    0,
  );
  if (solapeMm >= anchoPanelMm || solapeMm >= altoPanelMm) {
    throw new Error('El solape debe ser menor que las medidas del panel.');
  }

  const anchoPlantillaMm = redondear(input.geometria.anchoMm + bordeMm * 2);
  const altoPlantillaMm = redondear(input.geometria.altoMm + bordeMm * 2);
  const vaciados = exterioresGlobales(input.geometria, bordeMm);
  const materialCompleto = negativoEnRectangulo(
    vaciados,
    0,
    0,
    anchoPlantillaMm,
    altoPlantillaMm,
  );
  const uniones = input.uniones ?? [];
  const svg = renderizarSvg({
    nombre: input.nombre,
    geometria: input.geometria,
    material: materialCompleto,
    anchoMm: anchoPlantillaMm,
    altoMm: altoPlantillaMm,
    origenXmm: 0,
    origenYmm: 0,
    bordeMm,
    uniones,
    panel: null,
  });

  const origenesX = origenesPaneles(anchoPlantillaMm, anchoPanelMm, solapeMm);
  const origenesY = origenesPaneles(altoPlantillaMm, altoPanelMm, solapeMm);
  const paneles: PanelPlantillaInstalacion[] = [];
  for (let fila = 0; fila < origenesY.length; fila += 1) {
    for (let columna = 0; columna < origenesX.length; columna += 1) {
      const origenXmm = origenesX[columna];
      const origenYmm = origenesY[fila];
      const anchoMm = Math.min(anchoPanelMm, anchoPlantillaMm - origenXmm);
      const altoMm = Math.min(altoPanelMm, altoPlantillaMm - origenYmm);
      const material = negativoEnRectangulo(
        vaciados,
        origenXmm,
        origenYmm,
        anchoMm,
        altoMm,
      );
      paneles.push({
        indice: paneles.length,
        fila,
        columna,
        origenXmm: redondear(origenXmm),
        origenYmm: redondear(origenYmm),
        anchoMm: redondear(anchoMm),
        altoMm: redondear(altoMm),
        contornosCorte: multiPolygonAContornos(material),
        svg: renderizarSvg({
          nombre: `${input.nombre} · panel ${paneles.length + 1}`,
          geometria: input.geometria,
          material,
          anchoMm,
          altoMm,
          origenXmm,
          origenYmm,
          bordeMm,
          uniones,
          panel: { fila, columna },
        }),
      });
    }
  }

  const previewSvg = renderizarVistaPreviaSvg({
    nombre: input.nombre,
    geometria: input.geometria,
    material: materialCompleto,
    anchoMm: anchoPlantillaMm,
    altoMm: altoPlantillaMm,
    bordeMm,
    paneles,
    uniones,
  });

  return {
    schemaVersion: 1,
    anchoDisenoMm: input.geometria.anchoMm,
    altoDisenoMm: input.geometria.altoMm,
    anchoPlantillaMm,
    altoPlantillaMm,
    bordeMm,
    cantidadPiezas: input.geometria.piezas.length,
    cantidadUniones: uniones.length,
    svg,
    previewSvg,
    contornosCorte: multiPolygonAContornos(materialCompleto),
    paneles,
  };
}

function renderizarVistaPreviaSvg(input: {
  nombre: string;
  geometria: GeometriaVectorialCanonica;
  material: MultiPolygon;
  anchoMm: number;
  altoMm: number;
  bordeMm: number;
  paneles: PanelPlantillaInstalacion[];
  uniones: UnionVectorial[];
}) {
  const margen = Math.min(140, Math.max(55, input.anchoMm * 0.04));
  const anchoVista = input.anchoMm + margen * 2;
  const altoVista = input.altoMm + margen * 2;
  const fuente = Math.min(42, Math.max(18, input.anchoMm / 75));
  const fuentePanel = Math.min(34, Math.max(16, input.anchoMm / 95));
  const centroX = input.bordeMm + input.geometria.anchoMm / 2;
  const centroY = input.bordeMm + input.geometria.altoMm / 2;
  const paneles = input.paneles
    .map((panel) => {
      const etiqueta = `Panel ${panel.indice + 1}`;
      const etiquetaAncho = Math.max(105, etiqueta.length * fuentePanel * 0.62);
      return [
        `      <rect x="${num(panel.origenXmm)}" y="${num(panel.origenYmm)}" width="${num(panel.anchoMm)}" height="${num(panel.altoMm)}" fill="none" stroke="#2563eb" stroke-width="2" stroke-dasharray="10 7" vector-effect="non-scaling-stroke" />`,
        `      <rect x="${num(panel.origenXmm + 10)}" y="${num(panel.origenYmm + 10)}" width="${num(etiquetaAncho)}" height="${num(fuentePanel * 1.6)}" rx="${num(fuentePanel * 0.35)}" fill="#2563eb" />`,
        `      <text x="${num(panel.origenXmm + 10 + etiquetaAncho / 2)}" y="${num(panel.origenYmm + 10 + fuentePanel * 0.84)}" fill="#ffffff" font-size="${num(fuentePanel)}" text-anchor="middle" dominant-baseline="middle">${etiqueta}</text>`,
      ].join('\n');
    })
    .join('\n');
  const piezas = input.geometria.piezas
    .map((pieza, index) => {
      const x = input.bordeMm + (pieza.origenXmm ?? 0) + pieza.anchoMm / 2;
      const y = input.bordeMm + (pieza.origenYmm ?? 0) + pieza.altoMm / 2;
      const radio = fuente * 0.72;
      return [
        `      <circle cx="${num(x)}" cy="${num(y)}" r="${num(radio)}" fill="#0f172a" stroke="#ffffff" stroke-width="2" vector-effect="non-scaling-stroke" />`,
        `      <text x="${num(x)}" y="${num(y)}" fill="#ffffff" font-size="${num(fuente * 0.78)}" font-weight="700" text-anchor="middle" dominant-baseline="central">P${index + 1}</text>`,
      ].join('\n');
    })
    .join('\n');
  const uniones = guiasUnionesVistaPrevia(input);
  const dimensionY = margen * 0.42;
  const dimensionX = margen * 0.42;

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${num(anchoVista)}" height="${num(altoVista)}" viewBox="${num(-margen)} ${num(-margen)} ${num(anchoVista)} ${num(altoVista)}">`,
    `  <title>Vista previa de instalación · ${xml(input.nombre)}</title>`,
    '  <rect x="-100%" y="-100%" width="300%" height="300%" fill="#f8fafc" />',
    `  <g id="VISTA-EXPLICATIVA">`,
    `    <rect x="0" y="0" width="${num(input.anchoMm)}" height="${num(input.altoMm)}" rx="4" fill="#ffffff" stroke="#475569" stroke-width="2" vector-effect="non-scaling-stroke" />`,
    `    <path d="${multiPolygonAPath(input.material)}" fill="#cbd5e1" fill-rule="evenodd" stroke="#dc2626" stroke-width="2" stroke-linejoin="round" vector-effect="non-scaling-stroke" />`,
    '    <g id="PANELES">',
    paneles,
    '    </g>',
    '    <g id="EJES" fill="none" stroke="#0891b2" stroke-width="2" stroke-dasharray="14 9" vector-effect="non-scaling-stroke">',
    `      <line x1="${num(centroX)}" y1="0" x2="${num(centroX)}" y2="${num(input.altoMm)}" />`,
    `      <line x1="0" y1="${num(centroY)}" x2="${num(input.anchoMm)}" y2="${num(centroY)}" />`,
    '    </g>',
    '    <g id="UNIONES" fill="none" stroke="#f59e0b" stroke-width="3" stroke-dasharray="8 5" vector-effect="non-scaling-stroke">',
    uniones,
    '    </g>',
    '    <g id="PIEZAS" font-family="Arial, sans-serif">',
    piezas,
    '    </g>',
    '  </g>',
    '  <g id="COTAS" fill="none" stroke="#334155" stroke-width="2" vector-effect="non-scaling-stroke" font-family="Arial, sans-serif">',
    `    <line x1="0" y1="${num(-dimensionY)}" x2="${num(input.anchoMm)}" y2="${num(-dimensionY)}" />`,
    `    <line x1="0" y1="${num(-dimensionY - 12)}" x2="0" y2="${num(-dimensionY + 12)}" />`,
    `    <line x1="${num(input.anchoMm)}" y1="${num(-dimensionY - 12)}" x2="${num(input.anchoMm)}" y2="${num(-dimensionY + 12)}" />`,
    `    <text x="${num(input.anchoMm / 2)}" y="${num(-dimensionY - 10)}" fill="#0f172a" stroke="none" font-size="${num(fuente)}" font-weight="700" text-anchor="middle">${num(input.anchoMm)} mm</text>`,
    `    <line x1="${num(-dimensionX)}" y1="0" x2="${num(-dimensionX)}" y2="${num(input.altoMm)}" />`,
    `    <line x1="${num(-dimensionX - 12)}" y1="0" x2="${num(-dimensionX + 12)}" y2="0" />`,
    `    <line x1="${num(-dimensionX - 12)}" y1="${num(input.altoMm)}" x2="${num(-dimensionX + 12)}" y2="${num(input.altoMm)}" />`,
    `    <text x="${num(-dimensionX - 12)}" y="${num(input.altoMm / 2)}" transform="rotate(-90 ${num(-dimensionX - 12)} ${num(input.altoMm / 2)})" fill="#0f172a" stroke="none" font-size="${num(fuente)}" font-weight="700" text-anchor="middle">${num(input.altoMm)} mm</text>`,
    '  </g>',
    '</svg>',
  ].join('\n');
}

function guiasUnionesVistaPrevia(input: {
  geometria: GeometriaVectorialCanonica;
  bordeMm: number;
  uniones: UnionVectorial[];
}) {
  return input.uniones
    .map((union) => {
      const pieza = input.geometria.piezas.find(
        (candidate) => candidate.id === union.piezaOrigenId,
      );
      if (!pieza) return '';
      const origenX = input.bordeMm + (pieza.origenXmm ?? 0);
      const origenY = input.bordeMm + (pieza.origenYmm ?? 0);
      const x1 = union.eje === 'vertical' ? origenX + union.posicionMm : origenX;
      const y1 = union.eje === 'horizontal' ? origenY + union.posicionMm : origenY;
      const x2 = union.eje === 'vertical' ? x1 : origenX + pieza.anchoMm;
      const y2 = union.eje === 'horizontal' ? y1 : origenY + pieza.altoMm;
      return `      <line x1="${num(x1)}" y1="${num(y1)}" x2="${num(x2)}" y2="${num(y2)}" />`;
    })
    .filter(Boolean)
    .join('\n');
}

function exterioresGlobales(
  geometria: GeometriaVectorialCanonica,
  bordeMm: number,
): MultiPolygon {
  return geometria.piezas.flatMap((pieza) => {
    const origenX = bordeMm + (pieza.origenXmm ?? 0);
    const origenY = bordeMm + (pieza.origenYmm ?? 0);
    return pieza.contornos
      .filter((contorno) => !contorno.esHueco && contorno.puntos.length >= 3)
      .map((contorno) => [
        cerrar(
          contorno.puntos.map((punto) => ({
            x: punto.x + origenX,
            y: punto.y + origenY,
          })),
        ),
      ]);
  });
}

function negativoEnRectangulo(
  vaciados: MultiPolygon,
  x: number,
  y: number,
  ancho: number,
  alto: number,
): MultiPolygon {
  const rectangulo: MultiPolygon = [
    [
      [
        [x, y],
        [x + ancho, y],
        [x + ancho, y + alto],
        [x, y + alto],
        [x, y],
      ],
    ],
  ];
  if (vaciados.length === 0) return trasladarMultiPolygon(rectangulo, -x, -y);
  const resultado = polygonClipping.difference(rectangulo, vaciados);
  return trasladarMultiPolygon(resultado, -x, -y);
}

function renderizarSvg(input: {
  nombre: string;
  geometria: GeometriaVectorialCanonica;
  material: MultiPolygon;
  anchoMm: number;
  altoMm: number;
  origenXmm: number;
  origenYmm: number;
  bordeMm: number;
  uniones: UnionVectorial[];
  panel: { fila: number; columna: number } | null;
}) {
  const materialPath = multiPolygonAPath(input.material);
  const guides = guiasSvg(input);
  const labels = rotulosSvg(input);
  const panelLabel = input.panel
    ? ` · fila ${input.panel.fila + 1}, columna ${input.panel.columna + 1}`
    : '';
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${num(input.anchoMm)}mm" height="${num(input.altoMm)}mm" viewBox="0 0 ${num(input.anchoMm)} ${num(input.altoMm)}">`,
    `  <title>${xml(input.nombre)}${panelLabel}</title>`,
    '  <g id="CORTE" fill="none" stroke="#ff0000" stroke-width="0.1" stroke-linejoin="miter" vector-effect="non-scaling-stroke">',
    `    <path id="negativo-instalacion" d="${materialPath}" fill="#e5e7eb" fill-rule="evenodd" />`,
    '  </g>',
    '  <g id="GUIAS-NO-CORTAR" fill="none" stroke="#0066cc" stroke-width="0.2" stroke-dasharray="4 3" vector-effect="non-scaling-stroke">',
    guides,
    '  </g>',
    '  <g id="ROTULOS-NO-CORTAR" fill="#0066cc" stroke="none" font-family="sans-serif" font-size="10">',
    labels,
    '  </g>',
    '</svg>',
  ].join('\n');
}

function rotulosSvg(input: {
  geometria: GeometriaVectorialCanonica;
  anchoMm: number;
  altoMm: number;
  origenXmm: number;
  origenYmm: number;
  bordeMm: number;
  panel: { fila: number; columna: number } | null;
}) {
  const labels: string[] = [];
  if (input.anchoMm >= 140 && input.altoMm >= 35) {
    labels.push('    <text x="45" y="14">Control 100 mm</text>');
  }
  if (input.panel) {
    labels.push(
      `    <text x="${num(input.anchoMm - 10)}" y="15" text-anchor="end">F${input.panel.fila + 1} · C${input.panel.columna + 1}</text>`,
    );
  }
  for (const pieza of input.geometria.piezas) {
    const x =
      input.bordeMm +
      (pieza.origenXmm ?? 0) +
      pieza.anchoMm / 2 -
      input.origenXmm;
    const y =
      input.bordeMm +
      (pieza.origenYmm ?? 0) +
      pieza.altoMm / 2 -
      input.origenYmm;
    if (x < 0 || x > input.anchoMm || y < 0 || y > input.altoMm) continue;
    labels.push(
      `    <text id="rotulo-${xml(pieza.id)}" x="${num(x)}" y="${num(y)}" text-anchor="middle">${xml(pieza.id)}</text>`,
    );
  }
  return labels.join('\n');
}

function guiasSvg(input: {
  geometria: GeometriaVectorialCanonica;
  anchoMm: number;
  altoMm: number;
  origenXmm: number;
  origenYmm: number;
  bordeMm: number;
  uniones: UnionVectorial[];
}) {
  const lineas: string[] = [];
  const centroGlobalX = input.bordeMm + input.geometria.anchoMm / 2;
  const centroGlobalY = input.bordeMm + input.geometria.altoMm / 2;
  const localX = centroGlobalX - input.origenXmm;
  const localY = centroGlobalY - input.origenYmm;
  if (localX >= 0 && localX <= input.anchoMm) {
    lineas.push(
      `    <line id="eje-vertical" x1="${num(localX)}" y1="0" x2="${num(localX)}" y2="${num(input.altoMm)}" />`,
    );
  }
  if (localY >= 0 && localY <= input.altoMm) {
    lineas.push(
      `    <line id="nivel-horizontal" x1="0" y1="${num(localY)}" x2="${num(input.anchoMm)}" y2="${num(localY)}" />`,
    );
  }
  if (input.anchoMm >= 140 && input.altoMm >= 35) {
    lineas.push(
      '    <path id="control-100mm" d="M20 20 H120 M20 15 V25 M120 15 V25" />',
    );
  }
  for (const union of input.uniones) {
    const pieza = input.geometria.piezas.find(
      (candidate) => candidate.id === union.piezaOrigenId,
    );
    if (!pieza) continue;
    const origenPiezaX = input.bordeMm + (pieza.origenXmm ?? 0);
    const origenPiezaY = input.bordeMm + (pieza.origenYmm ?? 0);
    const x1Global =
      union.eje === 'vertical' ? origenPiezaX + union.posicionMm : origenPiezaX;
    const y1Global =
      union.eje === 'horizontal'
        ? origenPiezaY + union.posicionMm
        : origenPiezaY;
    const x2Global =
      union.eje === 'vertical' ? x1Global : origenPiezaX + pieza.anchoMm;
    const y2Global =
      union.eje === 'horizontal' ? y1Global : origenPiezaY + pieza.altoMm;
    const x1 = x1Global - input.origenXmm;
    const y1 = y1Global - input.origenYmm;
    const x2 = x2Global - input.origenXmm;
    const y2 = y2Global - input.origenYmm;
    if (
      Math.max(x1, x2) < 0 ||
      Math.min(x1, x2) > input.anchoMm ||
      Math.max(y1, y2) < 0 ||
      Math.min(y1, y2) > input.altoMm
    )
      continue;
    lineas.push(
      `    <line id="union-${xml(union.id)}" x1="${num(x1)}" y1="${num(y1)}" x2="${num(x2)}" y2="${num(y2)}" stroke="#ff9900" />`,
    );
  }
  return lineas.join('\n');
}

function origenesPaneles(total: number, maximo: number, solape: number) {
  if (total <= maximo) return [0];
  const paso = maximo - solape;
  const cantidad = Math.ceil((total - solape) / paso);
  return Array.from({ length: cantidad }, (_, index) =>
    redondear(index * paso),
  );
}

function trasladarMultiPolygon(
  value: MultiPolygon,
  dx: number,
  dy: number,
): MultiPolygon {
  return value.map((polygon) =>
    polygon.map((ring) => ring.map(([x, y]) => [x + dx, y + dy])),
  );
}

function multiPolygonAPath(value: MultiPolygon) {
  return value
    .flatMap((polygon) =>
      polygon.map((ring) =>
        ring
          .slice(0, -1)
          .map(
            ([x, y], index) => `${index === 0 ? 'M' : 'L'}${num(x)} ${num(y)}`,
          )
          .join(' '),
      ),
    )
    .filter(Boolean)
    .map((path) => `${path} Z`)
    .join(' ');
}

function multiPolygonAContornos(value: MultiPolygon): PuntoVectorial[][] {
  return value.flatMap((polygon) =>
    polygon.map((ring) =>
      ring.slice(0, -1).map(([x, y]) => ({
        x: redondear(x),
        y: redondear(y),
      })),
    ),
  );
}

function cerrar(points: PuntoVectorial[]): polygonClipping.Ring {
  const result = points.map((point) => [point.x, point.y] as [number, number]);
  if (
    result.length > 0 &&
    (result[0][0] !== result.at(-1)?.[0] || result[0][1] !== result.at(-1)?.[1])
  ) {
    result.push([...result[0]] as [number, number]);
  }
  return result;
}

function numeroPositivo(value: unknown, fallback: number, minimo: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= minimo ? parsed : fallback;
}

function redondear(value: number) {
  return Math.round(value * 1000) / 1000;
}

function num(value: number) {
  return String(redondear(value));
}

function xml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => {
    const chars: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&apos;',
      '"': '&quot;',
    };
    return chars[character];
  });
}
