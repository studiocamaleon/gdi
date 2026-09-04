import { Helper } from 'dxf';
import type { DiagnosticoSvg } from './tipos';
import { analizarSvgFabricacion, SvgFabricacionError } from './svg-parser';

export type FormatoFuenteVectorial = 'SVG' | 'DXF';

export type FuenteVectorialNormalizada = {
  formatoOrigen: FormatoFuenteVectorial;
  svg: string;
  relacionAltoAncho: number;
  anchoSugeridoMm: number;
  altoSugeridoMm: number;
  unidadDetectada: string | null;
  diagnosticos: DiagnosticoSvg[];
};

export class FuenteVectorialError extends Error {
  constructor(
    message: string,
    readonly diagnosticos: DiagnosticoSvg[],
  ) {
    super(message);
  }
}

const ENTIDADES_DXF_FABRICABLES = new Set([
  'ARC',
  'CIRCLE',
  'ELLIPSE',
  'LINE',
  'LWPOLYLINE',
  'POLYLINE',
  'SPLINE',
]);

const UNIDADES_DXF = new Map<number, { nombre: string; factorMm: number }>([
  [1, { nombre: 'pulgadas', factorMm: 25.4 }],
  [2, { nombre: 'pies', factorMm: 304.8 }],
  [4, { nombre: 'mm', factorMm: 1 }],
  [5, { nombre: 'cm', factorMm: 10 }],
  [6, { nombre: 'm', factorMm: 1_000 }],
  [9, { nombre: 'milésimas de pulgada', factorMm: 0.0254 }],
  [13, { nombre: 'micrones', factorMm: 0.001 }],
  [14, { nombre: 'dm', factorMm: 100 }],
]);

export function detectarFormatoFuenteVectorial(input: {
  nombreArchivo: string;
  formato?: FormatoFuenteVectorial;
}): FormatoFuenteVectorial {
  if (input.formato) return input.formato;
  const nombre = input.nombreArchivo.trim().toLowerCase();
  if (nombre.endsWith('.svg')) return 'SVG';
  if (nombre.endsWith('.dxf')) return 'DXF';
  throw new FuenteVectorialError('El archivo debe tener extensión SVG o DXF.', [
    {
      codigo: 'formato_vectorial_no_admitido',
      mensaje: 'GrafoNest admite archivos SVG y DXF.',
      severidad: 'ERROR',
    },
  ]);
}

export function normalizarFuenteVectorial(input: {
  contenido: string;
  nombreArchivo: string;
  formato?: FormatoFuenteVectorial;
}): FuenteVectorialNormalizada {
  const formatoOrigen = detectarFormatoFuenteVectorial(input);
  if (formatoOrigen === 'SVG') {
    const analisis = analizarSvgFabricacion({
      svg: input.contenido,
      anchoFinalMm: 1_000,
    });
    return {
      formatoOrigen,
      svg: input.contenido,
      relacionAltoAncho: analisis.geometria.altoMm / analisis.geometria.anchoMm,
      anchoSugeridoMm: 1_000,
      altoSugeridoMm: analisis.geometria.altoMm,
      unidadDetectada: null,
      diagnosticos: analisis.diagnosticos,
    };
  }
  return normalizarDxf(input.contenido);
}

function normalizarDxf(contenido: string): FuenteVectorialNormalizada {
  let helper: Helper;
  try {
    helper = new Helper(contenido);
    void helper.parsed;
  } catch {
    throw new FuenteVectorialError('El archivo no contiene un DXF válido.', [
      {
        codigo: 'dxf_invalido',
        mensaje: 'No se pudo interpretar la estructura del archivo DXF.',
        severidad: 'ERROR',
      },
    ]);
  }

  const diagnosticos: DiagnosticoSvg[] = [];
  const ignoradas = Array.from(
    new Set(
      helper.denormalised
        .map((entidad) => String(entidad.type ?? '').toUpperCase())
        .filter((tipo) => tipo && !ENTIDADES_DXF_FABRICABLES.has(tipo)),
    ),
  );
  if (ignoradas.length > 0) {
    diagnosticos.push({
      codigo: 'dxf_entidades_ignoradas',
      mensaje: `Se ignoraron entidades no fabricables: ${ignoradas.join(', ')}.`,
      severidad: 'WARNING',
    });
  }

  let svg: string;
  let bbox: ReturnType<Helper['toPolylines']>['bbox'];
  try {
    const conversion = helper.toPolylines();
    bbox = conversion.bbox;
    svg = svgDesdePolilineasDxf(
      conversion,
      helper.denormalised.map((entidad) => entidad.layer),
    );
  } catch {
    throw new FuenteVectorialError(
      'El DXF contiene entidades que no se pudieron convertir en contornos.',
      [
        {
          codigo: 'dxf_sin_geometria_compatible',
          mensaje:
            'Convertí textos a curvas y verificá que las piezas sean contornos 2D cerrados.',
          severidad: 'ERROR',
        },
      ],
    );
  }
  if (!bbox.valid) {
    throw new FuenteVectorialError(
      'El DXF no contiene geometría 2D fabricable.',
      [
        {
          codigo: 'dxf_sin_contornos',
          mensaje:
            'No se encontraron líneas o curvas compatibles con GrafoNest.',
          severidad: 'ERROR',
        },
      ],
    );
  }

  const codigoUnidad = Number(helper.parsed.header?.insUnits ?? 0);
  const unidad = UNIDADES_DXF.get(codigoUnidad);
  if (!unidad) {
    diagnosticos.push({
      codigo: 'dxf_unidad_no_declarada',
      mensaje:
        'El DXF no declara una unidad compatible. Se conserva la proporción y el usuario define la medida final.',
      severidad: 'WARNING',
    });
  }
  const anchoFuente = bbox.max.x - bbox.min.x;
  const altoFuente = bbox.max.y - bbox.min.y;
  if (!(anchoFuente > 0) || !(altoFuente > 0)) {
    throw new FuenteVectorialError('El DXF no tiene ancho y alto válidos.', [
      {
        codigo: 'dxf_dimensiones_invalidas',
        mensaje:
          'La caja geométrica del DXF debe tener ancho y alto mayores a cero.',
        severidad: 'ERROR',
      },
    ]);
  }

  const factorMm = unidad?.factorMm ?? 1;
  const anchoSugeridoMm = anchoFuente * factorMm;
  const altoSugeridoMm = altoFuente * factorMm;
  try {
    const analisis = analizarSvgFabricacion({
      svg,
      anchoFinalMm: Math.max(1, anchoSugeridoMm),
    });
    return {
      formatoOrigen: 'DXF',
      svg,
      relacionAltoAncho: analisis.geometria.altoMm / analisis.geometria.anchoMm,
      anchoSugeridoMm,
      altoSugeridoMm,
      unidadDetectada: unidad?.nombre ?? null,
      diagnosticos: [...diagnosticos, ...analisis.diagnosticos],
    };
  } catch (error) {
    if (error instanceof SvgFabricacionError) {
      throw new FuenteVectorialError(error.message, [
        ...diagnosticos,
        ...error.diagnosticos.map((diagnostico) => ({
          ...diagnostico,
          codigo: diagnostico.codigo.replace(/^svg_/, 'dxf_'),
        })),
      ]);
    }
    throw error;
  }
}

function svgDesdePolilineasDxf(
  conversion: ReturnType<Helper['toPolylines']>,
  capas: Array<string | undefined>,
): string {
  if (!conversion.bbox.valid) return '<svg viewBox="0 0 0 0" />';
  const { min, max } = conversion.bbox;
  const toleranciaConexion = Math.max(
    1e-7,
    Math.hypot(max.x - min.x, max.y - min.y) * 1e-8,
  );
  const contornos = unirSegmentosConectados(
    conversion.polylines.map((polilinea, index) => ({
      capa: capas[index] || `entidad_${index + 1}`,
      puntos: polilinea.vertices.filter(
        ([x, y]) => Number.isFinite(x) && Number.isFinite(y),
      ),
    })),
    toleranciaConexion,
  );
  const paths = contornos.flatMap(({ puntos, capa }, index) => {
    if (puntos.length < 2) return [];
    const [primeroX, primeroY] = puntos[0];
    const [ultimoX, ultimoY] = puntos[puntos.length - 1];
    const cerrado =
      Math.hypot(primeroX - ultimoX, primeroY - ultimoY) <= toleranciaConexion;
    const efectivos = cerrado ? puntos.slice(0, -1) : puntos;
    const d = efectivos
      .map(([x, y], puntoIndex) => `${puntoIndex === 0 ? 'M' : 'L'}${x},${y}`)
      .join('');
    const id = escapeXml(`${capa}_${index + 1}`);
    return [`<g id="${id}"><path d="${d}${cerrado ? 'Z' : ''}" /></g>`];
  });
  return [
    '<svg xmlns="http://www.w3.org/2000/svg"',
    ` viewBox="${min.x} ${min.y} ${max.x - min.x} ${max.y - min.y}"`,
    ' fill="none" stroke="#000">',
    ...paths,
    '</svg>',
  ].join('');
}

type SegmentoDxf = {
  capa: string;
  puntos: Array<[number, number]>;
};

/**
 * Los CAD suelen exportar un contorno como varias entidades LINE. Las unimos
 * por sus extremos antes de validar el SVG; nunca se mezclan capas distintas.
 */
function unirSegmentosConectados(
  segmentos: SegmentoDxf[],
  tolerancia: number,
): SegmentoDxf[] {
  const pendientes = segmentos
    .map((segmento) => ({
      ...segmento,
      puntos: quitarPuntosConsecutivosRepetidos(segmento.puntos, tolerancia),
    }))
    .filter((segmento) => segmento.puntos.length >= 2);
  const unidos: SegmentoDxf[] = [];

  while (pendientes.length > 0) {
    const actual = pendientes.shift();
    if (!actual) break;
    let cambio = true;
    while (cambio && !estaCerrado(actual.puntos, tolerancia)) {
      cambio = false;
      for (let index = 0; index < pendientes.length; index += 1) {
        const candidato = pendientes[index];
        if (candidato.capa !== actual.capa) continue;
        const union = unirPorExtremos(
          actual.puntos,
          candidato.puntos,
          tolerancia,
        );
        if (!union) continue;
        actual.puntos = union;
        pendientes.splice(index, 1);
        cambio = true;
        break;
      }
    }
    unidos.push(actual);
  }
  return unidos;
}

function unirPorExtremos(
  izquierda: Array<[number, number]>,
  derecha: Array<[number, number]>,
  tolerancia: number,
): Array<[number, number]> | null {
  const izquierdaInicio = izquierda[0];
  const izquierdaFin = izquierda[izquierda.length - 1];
  const derechaInicio = derecha[0];
  const derechaFin = derecha[derecha.length - 1];
  if (coinciden(izquierdaFin, derechaInicio, tolerancia)) {
    return [...izquierda, ...derecha.slice(1)];
  }
  if (coinciden(izquierdaFin, derechaFin, tolerancia)) {
    return [...izquierda, ...derecha.slice(0, -1).reverse()];
  }
  if (coinciden(izquierdaInicio, derechaFin, tolerancia)) {
    return [...derecha.slice(0, -1), ...izquierda];
  }
  if (coinciden(izquierdaInicio, derechaInicio, tolerancia)) {
    return [...derecha.slice(1).reverse(), ...izquierda];
  }
  return null;
}

function quitarPuntosConsecutivosRepetidos(
  puntos: Array<[number, number]>,
  tolerancia: number,
): Array<[number, number]> {
  return puntos.filter(
    (punto, index) =>
      index === 0 || !coinciden(punto, puntos[index - 1], tolerancia),
  );
}

function estaCerrado(
  puntos: Array<[number, number]>,
  tolerancia: number,
): boolean {
  return puntos.length >= 3 && coinciden(puntos[0], puntos.at(-1)!, tolerancia);
}

function coinciden(
  a: [number, number],
  b: [number, number],
  tolerancia: number,
): boolean {
  return Math.hypot(a[0] - b[0], a[1] - b[1]) <= tolerancia;
}

function escapeXml(value: string): string {
  return value.replace(
    /[&<>'"]/g,
    (char) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&apos;',
        '"': '&quot;',
      })[char] ?? char,
  );
}
