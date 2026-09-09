import { BadRequestException } from '@nestjs/common';
import { analizarSvgFabricacion } from '../motor-universal/geometria-vectorial/svg-parser';
import { geometriaDeColeccion } from '../motor-universal/geometria-vectorial/geometria-coleccion';
import type { JobContext } from '../motor-universal/tipos';

/** Una plantilla por archivo original. Las cantidades de fabricación no
 * replican ni reordenan su composición de instalación. */
export function fuentesInstalacion(context: Record<string, unknown>) {
  const disenos =
    context.disenosVectoriales as JobContext['disenosVectoriales'];
  if (Array.isArray(disenos) && disenos.length) {
    const grupos = new Map<string, NonNullable<typeof disenos>>();
    for (const diseno of disenos) {
      const fuente = diseno.fuente;
      const id = fuente.procedencia?.archivoId ?? diseno.id;
      const actuales = grupos.get(id) ?? [];
      // Una pieza repetida para fabricar conserva una sola ubicación original.
      if (
        !actuales.some(
          (d) =>
            d.fuente.procedencia?.geometriaId &&
            d.fuente.procedencia.geometriaId ===
              fuente.procedencia?.geometriaId,
        )
      ) {
        actuales.push(diseno);
      }
      grupos.set(id, actuales);
    }
    return [...grupos].map(([id, grupo]) => {
      const geometria = geometriaDeColeccion({
        cantidad: 1,
        disenosVectoriales: grupo,
      } as JobContext);
      for (const pieza of geometria.piezas) {
        const diseno = grupo.find((d) => pieza.id.startsWith(`${d.id}__`))!;
        const origen = diseno.fuente.fabricacion?.origen;
        if (grupo.length > 1 && !origen) {
          throw new BadRequestException(
            'Las piezas no conservan su posición original para la plantilla de instalación.',
          );
        }
        pieza.origenXmm =
          (pieza.origenXmm ?? 0) + (origen ? origen.minX * origen.factorMm : 0);
        pieza.origenYmm =
          (pieza.origenYmm ?? 0) + (origen ? origen.minY * origen.factorMm : 0);
        for (const op of pieza.operaciones ?? []) {
          if (op.tipo === 'CORTE_INTERIOR' && op.cerrada)
            pieza.contornos.push({ esHueco: true, puntos: op.puntos });
        }
      }
      const minX = Math.min(...geometria.piezas.map((p) => p.origenXmm!));
      const minY = Math.min(...geometria.piezas.map((p) => p.origenYmm!));
      geometria.anchoMm =
        Math.max(...geometria.piezas.map((p) => p.origenXmm! + p.anchoMm)) -
        minX;
      geometria.altoMm =
        Math.max(...geometria.piezas.map((p) => p.origenYmm! + p.altoMm)) -
        minY;
      geometria.piezas.forEach((p) => {
        p.origenXmm! -= minX;
        p.origenYmm! -= minY;
      });
      return { id, nombre: grupo[0].fuente.nombreArchivo, geometria };
    });
  }
  const fuente =
    context.disenoVectorialFuente as JobContext['disenoVectorialFuente'];
  if (!fuente?.svg || !(Number(fuente.anchoFinalMm) > 0)) {
    throw new BadRequestException(
      'El item no contiene una fuente vectorial original válida para generar la plantilla.',
    );
  }
  return [
    {
      id: 'principal',
      nombre: fuente.nombreArchivo,
      geometria: analizarSvgFabricacion({
        svg: fuente.svg,
        anchoFinalMm: fuente.anchoFinalMm,
        altoFinalMm: fuente.altoFinalMm,
      }).geometria,
    },
  ];
}
