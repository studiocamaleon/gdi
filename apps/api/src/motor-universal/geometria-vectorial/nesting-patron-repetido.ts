import type {
  NestingResult,
  Placement,
  SheetSubstrate,
} from '../../productos-servicios/nesting/types';
import type {
  ContornoVectorial,
  PiezaVectorial,
  PuntoVectorial,
} from './tipos';

type Orientacion = {
  grados: number;
  ancho: number;
  alto: number;
  origen: PuntoVectorial;
  contornos: ContornoVectorial[];
  cortesInternos: ContornoVectorial[];
};

export type MetadataPatron = {
  sourcePieceId: string;
  rotacionGrados: number;
  copyIndex: number;
  contornos: ContornoVectorial[];
  cortesInternos: ContornoVectorial[];
  traslacion: PuntoVectorial;
  patron: 'filas-repetidas-v1';
};

type Perfil = { inferiores: number[]; superiores: number[]; paso: number };
type Pose = { orientacion: Orientacion; x: number; y: number };

/** Candidato periódico para una silueta repetida. Compara filas/columnas,
 * uniformes y alternadas 180°. No sustituye la búsqueda general ni cambia
 * escala: aporta una alternativa que un packer rectangular no puede expresar.
 *
 * El perfil cubre conservadoramente toda la silueta con bandas verticales;
 * cada banda guarda sus extremos reales, sin muestrear ni simplificar curvas.
 * Los huecos se consideran ocupados. Con separación, se reserva un cuadrado
 * alrededor del perfil (más conservador que la distancia euclídea exigida).
 */
export function nestearPatronRepetido(input: {
  pieza: PiezaVectorial;
  cantidad: number;
  sustrato: SheetSubstrate;
  angulosPermitidos: number[];
  separacionMm?: number;
}): NestingResult<MetadataPatron> | null {
  const { pieza, sustrato } = input;
  const cantidad = Math.ceil(input.cantidad);
  const gap = input.separacionMm ?? 0;
  const m = sustrato.margins ?? {};
  const left = m.leftMm ?? 0,
    right = m.rightMm ?? left;
  const top = m.topMm ?? 0,
    bottom = m.bottomMm ?? top;
  const anchoUtil = sustrato.widthMm - left - right;
  const altoUtil = sustrato.heightMm - top - bottom;
  if (
    ![
      cantidad,
      gap,
      left,
      right,
      top,
      bottom,
      anchoUtil,
      altoUtil,
      pieza.areaMm2,
    ].every(Number.isFinite) ||
    cantidad < 1 ||
    cantidad > 10_000 ||
    gap < 0 ||
    Math.min(left, right, top, bottom) < 0 ||
    anchoUtil <= 0 ||
    altoUtil <= 0 ||
    pieza.areaMm2 <= 0
  )
    return null;
  const puntos = pieza.contornos.flatMap((c) => c.puntos);
  if (
    puntos.length < 3 ||
    puntos.length > 25_000 ||
    puntos.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))
  )
    return null;
  const orientaciones = [0, 90, 180, 270]
    .filter((angulo) => input.angulosPermitidos.includes(angulo))
    .map((angulo) => orientar(pieza, angulo))
    .filter(
      (o) =>
        o.ancho > 0 && o.alto > 0 && o.ancho <= anchoUtil && o.alto <= altoUtil,
    );
  let mejor: { poses: Pose[]; capacidad: number; consumo: number } | null =
    null;

  for (const eje of ['x', 'y'] as const) {
    const largoUtil = eje === 'y' ? altoUtil : anchoUtil;
    const anchoFila = eje === 'y' ? anchoUtil : altoUtil;
    const perfiles = new Map(
      orientaciones.map((o) => [o.grados, perfil(o, eje)]),
    );
    const distancias = new Map<string, number>();
    const distancia = (a: Orientacion, b: Orientacion) => {
      const key = `${a.grados}:${b.grados}`;
      if (!distancias.has(key))
        distancias.set(
          key,
          separar(perfiles.get(a.grados)!, perfiles.get(b.grados)!, gap),
        );
      return distancias.get(key)!;
    };
    for (const primera of orientaciones) {
      const opuesta = orientaciones.find(
        (o) => o.grados === (primera.grados + 180) % 360,
      );
      for (const alternar of opuesta ? [false, true] : [false]) {
        const ancho = eje === 'y' ? primera.ancho : primera.alto;
        const largo = eje === 'y' ? primera.alto : primera.ancho;
        const columnas = Math.min(
          cantidad,
          Math.floor((anchoFila + gap) / (ancho + gap)),
        );
        if (!columnas) continue;
        const filas: Array<{ o: Orientacion; y: number }> = [];
        const poses: Pose[] = [];
        // Todas las filas anteriores participan: no basta con comprobar la
        // vecina si una silueta muy cóncava permite pasos menores a su altura.
        const ultimoPorAngulo = new Map<
          number,
          { o: Orientacion; y: number }
        >();
        for (let fila = 0; poses.length < cantidad; fila++) {
          const o = alternar && fila % 2 ? opuesta! : primera;
          let y = 0;
          for (const anterior of ultimoPorAngulo.values())
            y = Math.max(y, anterior.y + distancia(anterior.o, o));
          if (
            !Number.isFinite(y) ||
            y + largo > largoUtil + 1e-7 ||
            (fila > 0 && y <= filas[filas.length - 1].y)
          )
            break;
          filas.push({ o, y });
          ultimoPorAngulo.set(o.grados, { o, y });
          for (let col = 0; col < columnas && poses.length < cantidad; col++) {
            const x = col * (ancho + gap);
            poses.push({
              orientacion: o,
              x: left + (eje === 'y' ? x : y),
              y: top + (eje === 'y' ? y : x),
            });
          }
        }
        if (!poses.length) continue;
        const placas = Math.ceil(cantidad / poses.length);
        const consumoPlaca = (slice: Pose[]) =>
          Math.max(
            ...slice.map((p) =>
              sustrato.widthMm > sustrato.heightMm
                ? p.x + p.orientacion.ancho + right
                : p.y + p.orientacion.alto + bottom,
            ),
          );
        const resto = cantidad % poses.length || poses.length;
        const consumo =
          (placas - 1) * consumoPlaca(poses) +
          consumoPlaca(poses.slice(0, resto));
        if (
          !mejor ||
          placas < Math.ceil(cantidad / mejor.capacidad) ||
          (placas === Math.ceil(cantidad / mejor.capacidad) &&
            consumo < mejor.consumo - 1e-6)
        ) {
          mejor = { poses, capacidad: poses.length, consumo };
        }
      }
    }
  }
  if (!mejor) return null;
  const placements: Placement<MetadataPatron>[] = Array.from(
    { length: cantidad },
    (_, copyIndex) => {
      const pose = mejor.poses[copyIndex % mejor.capacidad];
      const o = pose.orientacion;
      const mover = (contornos: ContornoVectorial[]) =>
        contornos.map((c) => ({
          ...c,
          puntos: c.puntos.map((p) => ({ x: p.x + pose.x, y: p.y + pose.y })),
        }));
      return {
        pieceId: pieza.id,
        substrateIndex: Math.floor(copyIndex / mejor.capacidad),
        xMm: pose.x,
        yMm: pose.y,
        widthMm: o.ancho,
        heightMm: o.alto,
        rotated: o.grados % 180 !== 0,
        meta: {
          sourcePieceId: pieza.id,
          copyIndex,
          rotacionGrados: o.grados,
          traslacion: { x: pose.x - o.origen.x, y: pose.y - o.origen.y },
          contornos: mover(o.contornos),
          cortesInternos: mover(o.cortesInternos),
          patron: 'filas-repetidas-v1',
        },
      };
    },
  );
  const placas = Math.ceil(cantidad / mejor.capacidad);
  const perSubstrate = Array.from({ length: placas }, () => ({
    areaUtilMm2: 0,
    consumedLengthMm: 0,
  }));
  for (const p of placements) {
    const metricas = perSubstrate[p.substrateIndex!];
    metricas.areaUtilMm2 += pieza.areaMm2;
    metricas.consumedLengthMm = Math.max(
      metricas.consumedLengthMm,
      sustrato.widthMm > sustrato.heightMm
        ? p.xMm + p.widthMm + right
        : p.yMm + p.heightMm + bottom,
    );
  }
  const areaUtilMm2 = pieza.areaMm2 * cantidad;
  const areaTotalMm2 = placas * sustrato.widthMm * sustrato.heightMm;
  return {
    algorithm: 'irregular-2d-bottom-left-v1',
    substrates: Array.from({ length: placas }, () => ({
      kind: 'sheet',
      count: 1,
      widthMm: sustrato.widthMm,
      heightMm: sustrato.heightMm,
    })),
    placements,
    metrics: {
      areaUtilMm2,
      areaTotalMm2,
      aprovechamientoPct: (areaUtilMm2 / areaTotalMm2) * 100,
      perSubstrate,
      piezasPorSustrato: mejor.capacidad,
      estrategiaDisposicion: 'nesting_optimizado',
    },
  };
}

function orientar(pieza: PiezaVectorial, grados: number): Orientacion {
  const transformar = (p: PuntoVectorial): PuntoVectorial =>
    grados === 0
      ? { ...p }
      : grados === 90
        ? { x: -p.y, y: p.x }
        : grados === 180
          ? { x: -p.x, y: -p.y }
          : { x: p.y, y: -p.x };
  const puntos = pieza.contornos.flatMap((c) => c.puntos.map(transformar));
  const minX = Math.min(...puntos.map((p) => p.x)),
    minY = Math.min(...puntos.map((p) => p.y));
  const convertir = (contornos: ContornoVectorial[]) =>
    contornos.map((c) => ({
      ...c,
      puntos: c.puntos.map((p) => {
        const r = transformar(p);
        return { x: r.x - minX, y: r.y - minY };
      }),
    }));
  return {
    grados,
    ancho: Math.max(...puntos.map((p) => p.x)) - minX,
    alto: Math.max(...puntos.map((p) => p.y)) - minY,
    origen: { x: minX, y: minY },
    contornos: convertir(pieza.contornos),
    cortesInternos: convertir(pieza.cortesInternos ?? []),
  };
}

function perfil(o: Orientacion, eje: 'x' | 'y'): Perfil {
  const ancho = eje === 'y' ? o.ancho : o.alto;
  const paso = Math.max(0.05, ancho / 2048);
  const n = Math.ceil(ancho / paso) + 1;
  const inferiores = Array<number>(n).fill(Infinity),
    superiores = Array<number>(n).fill(-Infinity);
  for (const c of o.contornos.filter((c) => !c.esHueco)) {
    const puntos = c.puntos.map((p) => (eje === 'y' ? p : { x: p.y, y: p.x }));
    for (let i = 0; i < puntos.length; i++) {
      const a = puntos[i],
        b = puntos[(i + 1) % puntos.length];
      const min = Math.min(a.x, b.x),
        max = Math.max(a.x, b.x);
      for (
        let j = Math.max(0, Math.floor(min / paso));
        j <= Math.min(n - 1, Math.floor(max / paso));
        j++
      ) {
        const vertical = max - min < 1e-10;
        const y = (x: number) => a.y + ((x - a.x) * (b.y - a.y)) / (b.x - a.x);
        const y1 = vertical ? a.y : y(Math.max(min, j * paso));
        const y2 = vertical ? b.y : y(Math.min(max, (j + 1) * paso));
        inferiores[j] = Math.min(inferiores[j], y1, y2);
        superiores[j] = Math.max(superiores[j], y1, y2);
      }
    }
  }
  return { inferiores, superiores, paso };
}

function separar(a: Perfil, b: Perfil, gap: number): number {
  let distancia = 0;
  const vecinos = gap > 0 ? Math.ceil(gap / a.paso) + 1 : 0;
  for (let i = 0; i < a.superiores.length; i++) {
    for (
      let j = Math.max(0, i - vecinos);
      j <= Math.min(b.inferiores.length - 1, i + vecinos);
      j++
    ) {
      distancia = Math.max(distancia, a.superiores[i] - b.inferiores[j] + gap);
    }
  }
  // Reserva numérica submilimétrica; no agrega el gap comercial cuando es 0.
  return distancia + 0.00001;
}
