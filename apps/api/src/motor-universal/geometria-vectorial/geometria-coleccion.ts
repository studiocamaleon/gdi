import { createHash } from 'node:crypto';
import type { JobContext } from '../tipos';
import { analizarSvgFabricacion } from './svg-parser';
import {
  adjuntarOperacionesGuardadas,
  longitudOperacion,
} from './operaciones-vectoriales';
import type { GeometriaVectorialCanonica } from './tipos';

/** Las fuentes ya fueron rehidratadas por tenant. Mantiene seis identidades
 * aunque una de ellas demande cuatro piezas por conjunto. */
export function geometriaDeColeccion(
  ctx: JobContext,
): GeometriaVectorialCanonica {
  const disenos = ctx.disenosVectoriales!;
  const piezas = disenos.flatMap((d) => {
    const g = adjuntarOperacionesGuardadas(
      analizarSvgFabricacion({
        svg: d.fuente.svg,
        anchoFinalMm: d.fuente.anchoFinalMm,
        altoFinalMm: d.fuente.altoFinalMm,
      }).geometria,
      d.fuente,
    );
    return g.piezas.map((p) => ({
      ...p,
      id: `${d.id}__${p.id}`,
      cantidadPorUnidad: d.cantidadPorUnidad,
      propietario: {
        piezaNombre: d.nombre,
        archivoFuente: d.fuente.nombreArchivo,
        interpretacion: d.fuente.procedencia,
      },
    }));
  });
  if (!piezas.length)
    throw new Error('El componente no tiene piezas para fabricar.');
  ctx.piezaHendidoTotalM =
    (disenos.reduce(
      (s, d) =>
        s +
        d.fuente.operaciones
          .filter((o) => o.tipo === 'HENDIDO')
          .reduce((n, o) => n + longitudOperacion(o), 0) *
          d.cantidadPorUnidad,
      0,
    ) *
      ctx.cantidad) /
    1000;
  return {
    schemaVersion: 1,
    piezas,
    anchoMm: Math.max(...piezas.map((p) => p.anchoMm)),
    altoMm: Math.max(...piezas.map((p) => p.altoMm)),
    areaTotalMm2: piezas.reduce(
      (s, p) => s + p.areaMm2 * p.cantidadPorUnidad,
      0,
    ),
    perimetroTotalMm: piezas.reduce(
      (s, p) => s + p.perimetroMm * p.cantidadPorUnidad,
      0,
    ),
    hashFuente: createHash('sha256')
      .update(JSON.stringify(disenos))
      .digest('hex'),
  };
}
