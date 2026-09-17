import type { Prisma } from '@prisma/client';
import type {
  LoteNestingCompuestoSnapshot,
  PasoEjecutado,
} from '../motor-universal/tipos';

export type ItemSnapshotProduccion = {
  jobContextSnapshotJson?: Prisma.JsonValue;
  trazabilidadSnapshotJson?: Prisma.JsonValue;
  cotizacionItem: {
    jobContextJson: Prisma.JsonValue;
    trazabilidadJson: Prisma.JsonValue;
  } | null;
};
export type PasoSnapshotProduccion = {
  rutaPasoId: string | null;
  nestingLoteRol?: string | null;
  nestingLoteSnapshotJson?: Prisma.JsonValue;
};
const registro = (valor: unknown): Record<string, unknown> | null =>
  valor && typeof valor === 'object' && !Array.isArray(valor)
    ? (valor as Record<string, unknown>)
    : null;

/** Contexto/cálculo del ámbito que se ejecuta. El lote manda sobre la parte
 * económica asignada al miembro operativo: representa la tanda completa. */
export function snapshotPasoProduccion(
  item: ItemSnapshotProduccion,
  paso: PasoSnapshotProduccion,
): {
  jobContext: Record<string, unknown> | null;
  traza: Record<string, unknown> | null;
  paso: PasoEjecutado | null;
  lote: LoteNestingCompuestoSnapshot | null;
} {
  const jobContext = registro(
    item.jobContextSnapshotJson ?? item.cotizacionItem?.jobContextJson,
  );
  const traza = registro(
    item.trazabilidadSnapshotJson ?? item.cotizacionItem?.trazabilidadJson,
  );
  const pasos = Array.isArray(traza?.pasos)
    ? (traza.pasos as PasoEjecutado[])
    : [];
  const original = pasos.find((p) => p.rutaPasoId === paso.rutaPasoId) ?? null;
  const lote =
    paso.nestingLoteRol === 'OPERATIVO'
      ? (registro(
          paso.nestingLoteSnapshotJson,
        ) as unknown as LoteNestingCompuestoSnapshot | null)
      : null;
  if (!lote?.nestingResult)
    return { jobContext, traza, paso: original, lote: null };
  const n = lote.nestingResult;
  const material = original?.materiales?.find(
    (m) => m.tipoLineaCosto === 'MATERIAL',
  );
  const sustrato = {
    ...material,
    tipoLineaCosto: 'MATERIAL',
    materialVarianteId: lote.materialVarianteId,
    materiaPrimaNombre: lote.materialNombre,
    atributosVarianteJson: {
      ...registro(material?.atributosVarianteJson),
      anchoMm: n.substrates[0]?.widthMm,
    },
  };
  const hoja = n.substrates[0];
  const efectivo = {
    ...original,
    rutaPasoId: paso.rutaPasoId,
    nestingResult: n,
    materiales: [
      sustrato,
      ...(original?.materiales ?? []).filter(
        (m) => m.tipoLineaCosto !== 'MATERIAL',
      ),
    ],
    outputsCanonicos: {
      ...original?.outputsCanonicos,
      ...(hoja?.kind === 'sheet'
        ? {
            pliegos_impresos: n.cantidadCalculada,
            pliego_impresion_ancho_mm: hoja.widthMm,
            pliego_impresion_alto_mm: hoja.heightMm,
          }
        : {}),
    },
  } as PasoEjecutado;
  return {
    jobContext: {
      ...jobContext,
      ...(n.tecnologia ? { tecnologia: n.tecnologia } : {}),
      ...(n.modoColor ? { modoColor: n.modoColor } : {}),
      ...(n.carasProcesadas ? { caras: n.carasProcesadas } : {}),
      ...(original?.configPasoId && n.maquina
        ? { [`maquinaSeleccionada_${original.configPasoId}`]: n.maquina.id }
        : {}),
      ...(original?.configPasoId && n.modoColor
        ? {
            modoColorPorPaso: {
              ...registro(jobContext?.modoColorPorPaso),
              [original.configPasoId]: n.modoColor,
            },
          }
        : {}),
    },
    traza: { ...traza, pasos: [efectivo] },
    paso: efectivo,
    lote,
  };
}
