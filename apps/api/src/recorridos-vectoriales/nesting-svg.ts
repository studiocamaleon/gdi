import { BadRequestException } from '@nestjs/common';

export type PuntoNestingVectorial = { x: number; y: number };
export type ContornoNestingVectorial = {
  esHueco?: boolean;
  puntos: PuntoNestingVectorial[];
};
export type NestingVectorialParaRecorrido = {
  algorithm?: string;
  estrategiaDisposicion?: 'composicion_original' | 'nesting_optimizado';
  visualConfig?: {
    margins?: {
      leftMm?: number;
      rightMm?: number;
      topMm?: number;
      bottomMm?: number;
    };
  };
  substrates?: Array<{
    kind?: string;
    widthMm?: number;
    heightMm?: number;
  }>;
  placements?: Array<{
    pieceId?: string;
    substrateIndex?: number;
    meta?: { contornos?: ContornoNestingVectorial[] };
  }>;
};

/** Contrato único entre el nesting y cualquier motor de recorrido CORTE. */
export function crearSvgPlacaDesdeNesting(
  nesting: NestingVectorialParaRecorrido,
  plateIndex: number,
) {
  const substrate = nesting.substrates?.[plateIndex];
  if (
    substrate?.kind !== 'sheet' ||
    !(Number(substrate.widthMm) > 0) ||
    !(Number(substrate.heightMm) > 0)
  ) {
    throw new BadRequestException('La placa del nesting no es válida.');
  }
  const paths = (nesting.placements ?? [])
    .filter((placement) => (placement.substrateIndex ?? 0) === plateIndex)
    .map((placement, placementIndex) => {
      // Todos los contornos de una pieza deben viajar en un único `path`.
      // Separarlos convertía los huecos interiores en piezas independientes y
      // hacía imposible que el motor TAP construyera una red de conexiones
      // válida en letras como P, U o A.
      const subpaths = (placement.meta?.contornos ?? [])
        .filter((contour) => contour.puntos.length >= 3)
        .map((contour) =>
          contour.puntos
            .map(
              (point, index) =>
                `${index === 0 ? 'M' : 'L'}${num(point.x)} ${num(point.y)}`,
            )
            .join(' '),
        );
      if (subpaths.length === 0) return null;
      const placementId = `${placement.pieceId ?? 'pieza'}-${placementIndex + 1}`;
      // En una composición original los placements pueden ser subcontornos
      // contenidos entre sí (por ejemplo el círculo y la R del símbolo ®).
      // Agruparlos permite reconstruir la jerarquía outer/hole/island del arte
      // completo. En nesting optimizado siguen siendo piezas independientes.
      const pieceId =
        nesting.estrategiaDisposicion === 'composicion_original'
          ? `composicion-placa-${plateIndex + 1}`
          : placementId;
      return `<path id="${xml(placementId)}" data-piece-id="${xml(pieceId)}" d="${subpaths.join(' Z ')} Z" fill-rule="evenodd" />`;
    })
    .filter((path): path is string => path !== null);
  if (paths.length === 0) {
    throw new BadRequestException(
      'La placa no contiene contornos vectoriales exportables.',
    );
  }
  const width = Number(substrate.widthMm);
  const height = Number(substrate.heightMm);
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${num(width)}mm" height="${num(height)}mm" viewBox="0 0 ${num(width)} ${num(height)}">`,
    '<g id="corte" fill="none" stroke="#000" stroke-width="0.1">',
    ...paths,
    '</g>',
    '</svg>',
  ].join('\n');
}

function num(value: number) {
  return String(Math.round(value * 1000) / 1000);
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
