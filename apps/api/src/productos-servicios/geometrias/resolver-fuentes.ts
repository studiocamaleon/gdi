import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import type { JobContext } from '../../motor-universal/tipos';
import { leerGeometriasComerciales } from '../geometrias-comerciales';
import {
  esFuenteGuardadaOReferencia,
  procedenciaGeometriaValida,
  referenciaGeometriaValida,
} from './referencia-geometria';

const registro = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};

/** Respeta las fuentes de la revisión publicada y las referencias históricas de
 * la cotización. Relee referencias en servidor para no confiar en SVG del cliente. */
export async function resolverFuentesProducto(
  prisma: PrismaService,
  tenantId: string,
  atributos: unknown,
  contexto: JobContext,
): Promise<JobContext> {
  const config = leerGeometriasComerciales(atributos);
  // Las fuentes predeterminadas son sólo para la modalidad con archivo. Al
  // volver a medidas o estimar placas no deben reemplazar la elección actual.
  const sinArchivo = contexto.modoCotizacionVectorial === 'medidas' ||
    contexto.modoCotizacionVectorial === 'placas';
  contexto = { ...contexto };
  if (sinArchivo) {
    for (const key of ['disenoVectorialFuente', 'disenoVectorialCacheKey', 'geometriaVectorial',
      'geometriasVectoriales', 'disenosVectoriales', 'coleccionesVectoriales']) delete contexto[key];
  }
  if (contexto.modoCotizacionVectorial && contexto.modoCotizacionVectorial !== 'placas') {
    delete contexto.placasVectorialesManuales;
    delete contexto.metrosCortePorPlacaVectorial;
    delete contexto.entradasCortePorPlacaVectorial;
  }
  const configuradas = sinArchivo ? [] : config.fuentes;
  const fuentes = { ...registro(contexto.geometriasVectoriales) };
  const verificarFija = (fuente: unknown, nombre: string) => {
    // Una cotización histórica puede referenciar una interpretación anterior.
    // El reemplazo libre exige permiso; una interpretación guardada se rehidrata.
    const recibida = registro(registro(fuente).procedencia).geometriaId;
    if (!recibida)
      throw new BadRequestException(
        `El diseño de ${nombre} tiene medidas fijas. Habilitá su personalización en el producto para reemplazarlo.`,
      );
  };
  for (const f of configuradas) {
    if (!fuentes[f.id] && f.predeterminada) fuentes[f.id] = f.predeterminada;
    if (fuentes[f.id] && f.predeterminada && !f.permitirReemplazo)
      verificarFija(fuentes[f.id], f.nombre);
  }
  const unica = configuradas.length === 1 ? configuradas[0] : undefined;
  const principal =
    contexto.disenoVectorialFuente ?? (unica ? fuentes[unica.id] : undefined);
  if (unica?.predeterminada && !unica.permitirReemplazo && principal)
    verificarFija(principal, unica.nombre);
  const preparado = {
    ...contexto,
    ...(Object.keys(fuentes).length ? { geometriasVectoriales: fuentes } : {}),
    ...(principal ? { disenoVectorialFuente: principal } : {}),
  };

  // Incluye overrides y ocurrencias: sus bindings necesitan la fuente completa
  // antes de derivar las dimensiones del componente hijo.
  const ids = new Set<string>();
  const visitados = new WeakSet<object>();
  const recopilar = (v: unknown): void => {
    if (!v || typeof v !== 'object' || visitados.has(v)) return;
    visitados.add(v);
    if (esFuenteGuardadaOReferencia(v)) {
      if (
        !procedenciaGeometriaValida(v.procedencia) ||
        (v.tipo === 'REFERENCIA_GEOMETRIA' && !referenciaGeometriaValida(v))
      )
        throw new BadRequestException(
          'La referencia de la interpretación del archivo no es válida.',
        );
      ids.add(registro(v.procedencia).geometriaId as string);
      return;
    }
    Object.values(v).forEach(recopilar);
  };
  recopilar(preparado);
  const guardadas = ids.size
    ? await prisma.geometriaProducto.findMany({
        where: { tenantId, id: { in: [...ids] } },
      })
    : [];
  const porId = new Map(guardadas.map((g) => [g.id, g]));
  const resueltos = new WeakMap<object, unknown>();
  const resolver = (v: unknown): unknown => {
    if (!v || typeof v !== 'object') return v;
    if (resueltos.has(v)) return resueltos.get(v);
    if (esFuenteGuardadaOReferencia(v)) {
      const p = registro(v.procedencia);
      const g = porId.get(p.geometriaId as string);
      if (!g)
        throw new BadRequestException(
          'No se encontró una geometría guardada de esta cuenta.',
        );
      if (g.archivoId !== p.archivoId || g.hash !== p.hash)
        throw new BadRequestException(
          'La referencia no corresponde al archivo de la geometría guardada.',
        );
      resueltos.set(v, g.fuenteJson);
      return g.fuenteJson;
    }
    const copia: unknown[] | Record<string, unknown> = Array.isArray(v)
      ? []
      : {};
    resueltos.set(v, copia);
    for (const [k, child] of Object.entries(v))
      (copia as Record<string, unknown>)[k] = resolver(child);
    return copia;
  };
  return resolver(preparado) as JobContext;
}

export function atributosDeRevision(
  snapshot: unknown,
  actuales: unknown,
): unknown {
  const producto = registro(registro(snapshot).producto);
  return Object.prototype.hasOwnProperty.call(
    producto,
    'atributosComercialesJson',
  )
    ? producto.atributosComercialesJson
    : actuales;
}
