import type { PiezaVectorialCotizacion } from "./piezas-vectoriales-cotizacion";

type Colecciones = {
  disenosVectoriales: PiezaVectorialCotizacion[] | null;
  coleccionesVectoriales: Record<string, PiezaVectorialCotizacion[]>;
};

/** El nombre es una etiqueta. El archivo, sus capas, medidas, identidad y
 * cantidades siguen formando parte de la clave que invalida el cálculo. */
export function claveCalculoPiezas<T extends Colecciones>(config: T): string {
  const sinNombres = (piezas: PiezaVectorialCotizacion[]) =>
    piezas.map((p) => ({ ...p, nombre: undefined }));
  return JSON.stringify({
    ...config,
    disenosVectoriales: config.disenosVectoriales?.length
      ? sinNombres(config.disenosVectoriales)
      : config.disenosVectoriales,
    coleccionesVectoriales: Object.fromEntries(
      Object.entries(config.coleccionesVectoriales).map(([id, piezas]) => [
        id,
        sinNombres(piezas),
      ]),
    ),
  });
}

export function todasLasPiezas(config: Colecciones) {
  return [
    ...(config.disenosVectoriales ?? []),
    ...Object.values(config.coleccionesVectoriales).flat(),
  ];
}

/** Mientras se escribe un nombre, el cálculo puede usar su identidad estable.
 * El formulario valida el nombre antes de guardar el ítem. */
export function completarNombresPiezas<T extends Colecciones>(config: T): T {
  const completar = (piezas: PiezaVectorialCotizacion[]) =>
    piezas.map((p) => (p.nombre.trim() ? p : { ...p, nombre: p.id }));
  return {
    ...config,
    disenosVectoriales:
      config.disenosVectoriales && completar(config.disenosVectoriales),
    coleccionesVectoriales: Object.fromEntries(
      Object.entries(config.coleccionesVectoriales).map(([id, piezas]) => [
        id,
        completar(piezas),
      ]),
    ),
  };
}

function registro(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/** Proyecta las etiquetas actuales sobre la respuesta, incluso si el usuario
 * renombró mientras se calculaba. Conserva precios, posiciones y el contrato
 * de la solución original: no modifica geometrías ni hashes del nesting. */
export function actualizarNombresPiezasCotizadas<T>(
  resultado: T,
  config: Colecciones,
): T {
  const piezas = todasLasPiezas(config);
  if (!piezas.length) return resultado;

  const buscar = (id: unknown, geometriaId?: unknown) => {
    if (typeof id !== "string") return;
    const candidatas = piezas.filter(
      (p) =>
        (id === p.id || id.startsWith(`${p.id}__`)) &&
        (!geometriaId ||
          registro(p.fuente.procedencia)?.geometriaId === geometriaId),
    );
    // Una identidad compartida con nombres distintos requiere su propia
    // referencia de archivo; nunca se adivina por posición o por medidas.
    return candidatas.length &&
      candidatas.every((p) => p.nombre === candidatas[0].nombre)
      ? candidatas[0]
      : undefined;
  };
  const conservar = new Set([
    "fuente",
    "solucionNesting",
    "geometriaVectorial",
    "contornos",
    "cortesInternos",
    "operaciones",
    "fabricacion",
    "puntos",
  ]);
  const recorrer = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      const items = value.map(recorrer);
      return items.some((item, i) => item !== value[i]) ? items : value;
    }
    const obj = registro(value);
    if (!obj) return value;
    let nuevo = obj;
    const asignar = (key: string, item: unknown) => {
      if (item === nuevo[key]) return;
      if (nuevo === obj) nuevo = { ...obj };
      nuevo[key] = item;
    };
    for (const [key, item] of Object.entries(obj)) {
      if (!conservar.has(key)) asignar(key, recorrer(item));
    }
    if (obj.fuente && typeof obj.nombre === "string") {
      const fuente = registro(obj.fuente);
      const pieza = buscar(obj.id, registro(fuente?.procedencia)?.geometriaId);
      if (pieza) asignar("nombre", pieza.nombre);
    }
    const meta = registro(obj.meta);
    if (meta && typeof obj.pieceId === "string") {
      const propietario = registro(meta.propietario);
      const segmento = registro(meta.segmentacion);
      const pieza = buscar(
        segmento?.piezaOrigenId ?? obj.pieceId,
        registro(propietario?.interpretacion)?.geometriaId,
      );
      if (pieza) {
        const label = segmento
          ? `${pieza.nombre} · parte ${segmento.indice}/${segmento.total}`
          : pieza.nombre;
        if (meta.label !== label || propietario?.piezaNombre !== pieza.nombre) {
          asignar("meta", {
            ...meta,
            label,
            propietario: { ...propietario, piezaNombre: pieza.nombre },
          });
        }
      }
    }
    return nuevo;
  };
  return recorrer(resultado) as T;
}
