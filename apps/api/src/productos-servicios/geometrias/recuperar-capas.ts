import { inspeccionarDxfNativo } from './dxf-nativo';
import {
  inspeccionarVector,
  interpretarVector,
  type FuenteGuardada,
} from './interpretar-vector';

type Punto = { x: number; y: number };

function distanciaSegmento(p: Punto, a: Punto, b: Punto) {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const largo2 = dx * dx + dy * dy;
  const t = largo2
    ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / largo2))
    : 0;
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}

/** Compara geometría en el documento original, nunca sólo medidas o nombre de capa. */
function coinciden(
  a: Punto[],
  b: Punto[],
  tolerancia: number,
  cerrada: boolean,
) {
  if (a.length < 2 || b.length < 2) return false;
  const dentro = (origen: Punto[], destino: Punto[], margen: number) =>
    origen.every((p) =>
      destino.some(
        (q, i) =>
          (cerrada || i < destino.length - 1) &&
          distanciaSegmento(p, q, destino[(i + 1) % destino.length]) <= margen,
      ),
    );
  // El lector anterior aproximaba las curvas con menos segmentos. Sus vértices
  // deben seguir sobre la curva nativa (0,05 mm); entre vértices admitimos hasta
  // 0,2 mm de discretización. Una coincidencia ambigua siempre se rechaza.
  return dentro(a, b, tolerancia) && dentro(b, a, tolerancia * 4);
}

/** Complementa una referencia histórica sólo en lectura: no cambia su silueta,
 * cantidad, operaciones costeadas ni revisión. No elige otra versión del archivo. */
export async function recuperarCapasGuardadas(
  fuente: FuenteGuardada,
  contenido: string,
  excluidas: string[] = [],
): Promise<FuenteGuardada> {
  if (
    fuente.fabricacion &&
    (fuente.formatoOrigen !== 'DXF' || fuente.fabricacion.dxfNativo)
  )
    return fuente;
  if (fuente.formatoOrigen === 'SVG') {
    const interpretada = interpretarVector(
      inspeccionarVector(contenido, fuente.nombreArchivo),
      {
        exteriorId: fuente.procedencia.exteriorId,
        unidad: fuente.unidadOrigen,
        cerrarExterior: fuente.procedencia.cierreConfirmado,
        operaciones: fuente.operaciones.map((op) => ({
          entidadId: op.entidadId,
          tipo: op.tipo,
        })),
        excluidas,
      },
      { ...fuente.procedencia, nombreArchivo: fuente.nombreArchivo },
    );
    if (interpretada.svg !== fuente.svg)
      throw new Error('La interpretación SVG ya no coincide con el plan.');
    return { ...fuente, fabricacion: interpretada.fabricacion };
  }
  const fallo = () =>
    new Error(
      `Revisá las capas de «${fuente.nombreArchivo}»: no se pudo recuperar su interpretación original con certeza.`,
    );
  const anterior = inspeccionarVector(contenido, fuente.nombreArchivo);
  const exterior = anterior.entidades.find(
    (e) => e.id === fuente.procedencia.exteriorId,
  );
  if (!exterior || !exterior.ancho) throw fallo();
  const factor = fuente.anchoFinalMm / exterior.ancho;
  if (
    !(factor > 0) ||
    Math.abs(exterior.alto * factor - fuente.altoFinalMm) > 0.01
  )
    throw fallo();
  const inspeccion = await inspeccionarDxfNativo(contenido);
  const tolerancia = 0.05 / factor;
  const buscar = (puntos: Punto[], cerrada: boolean) => {
    const candidatos = inspeccion.entidades.filter((e) =>
      coinciden(puntos, e.puntos, tolerancia, cerrada),
    );
    if (candidatos.length !== 1) throw fallo();
    return candidatos[0];
  };
  const elegido = buscar(
    exterior.puntos,
    exterior.cerrada || fuente.procedencia.cierreConfirmado,
  );
  const minX = Math.min(...exterior.puntos.map((p) => p.x));
  const minY = Math.min(...exterior.puntos.map((p) => p.y));
  const operaciones = fuente.operaciones.map((op) => ({
    entidadId: buscar(
      op.puntos.map((p) => ({
        x: p.x / factor + minX,
        y: p.y / factor + minY,
      })),
      op.cerrada,
    ).id,
    tipo: op.tipo,
  }));
  const excluidasNativas = [
    ...new Set([
      ...excluidas,
      ...(fuente.fabricacion?.entidades
        .filter((e) => !e.conservar)
        .map((e) => e.entidadId) ?? []),
    ]),
  ].map((id) => {
    const entidad = anterior.entidades.find((e) => e.id === id);
    if (!entidad) throw fallo();
    return buscar(entidad.puntos, entidad.cerrada).id;
  });
  const interpretada = interpretarVector(
    {
      ...inspeccion,
      // El origen y el exterior siguen siendo los que se usaron para cotizar.
      entidades: inspeccion.entidades.map((e) =>
        e.id === elegido.id
          ? {
              ...e,
              puntos: exterior.puntos,
              ancho: exterior.ancho,
              alto: exterior.alto,
              area: exterior.area,
              cerrada: exterior.cerrada,
              apertura: exterior.apertura,
            }
          : e,
      ),
    },
    {
      exteriorId: elegido.id,
      unidad: fuente.unidadOrigen,
      cerrarExterior: fuente.procedencia.cierreConfirmado,
      operaciones,
      excluidas: excluidasNativas,
    },
    {
      nombreArchivo: fuente.nombreArchivo,
      archivoId: fuente.procedencia.archivoId,
      geometriaId: fuente.procedencia.geometriaId,
      hash: fuente.procedencia.hash,
    },
  );
  if (
    Math.abs(interpretada.anchoFinalMm - fuente.anchoFinalMm) > 0.01 ||
    Math.abs(interpretada.altoFinalMm - fuente.altoFinalMm) > 0.01
  )
    throw fallo();
  return { ...fuente, fabricacion: interpretada.fabricacion };
}
