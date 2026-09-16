import type { SimulacionNestingCola } from "./colas-produccion";
import type { NestingViewerInput } from "./productos-servicios-api";

/** Adapta el resultado ya calculado. No elige algoritmos ni acomoda piezas. */
export function dibujoNestingCola(
  datos: SimulacionNestingCola,
  alternativa: SimulacionNestingCola["alternativas"][number],
): Pick<NestingViewerInput, "substrates" | "placements" | "visualConfig"> {
  const piezas = new Map(datos.piezas.map((p) => [p.id, p]));
  const { anchoMm, largoMm } = alternativa;
  return {
    substrates: [{ kind: "roll", widthMm: anchoMm, lengthMm: largoMm }],
    placements: alternativa.ubicaciones.map((u) => {
      const p = piezas.get(u.piezaId);
      const referencia = p
        ? datos.trabajos[p.trabajo]?.referencia.split(" · ")[0]
        : undefined;
      return {
        pieceId: u.piezaId,
        substrateIndex: 0,
        xMm: u.xMm,
        yMm: u.yMm,
        widthMm: u.anchoMm,
        heightMm: u.altoMm,
        rotated: u.rotada,
        panelIndex: p?.panel ?? undefined,
        panelCount: p?.paneles ?? undefined,
        overlapStartMm: p?.solapeInicioMm,
        overlapEndMm: p?.solapeFinMm,
        meta: { label: referencia ?? u.piezaId, title: p?.etiqueta },
      };
    }),
    visualConfig: {
      margins: {
        leftMm: datos.margenes.izquierda,
        rightMm: datos.margenes.derecha,
        topMm: datos.margenes.inicio,
        bottomMm: datos.margenes.fin,
      },
      spacing: {
        horizontalMm: datos.separacionMm,
        verticalMm: datos.separacionVerticalMm,
      },
      allowRotation: datos.piezas.every((p) => p.permiteRotar),
      centerPlacements: false,
      usableArea: {
        xMm: datos.margenes.izquierda,
        yMm: datos.margenes.inicio,
        widthMm: Math.max(
          0,
          anchoMm - datos.margenes.izquierda - datos.margenes.derecha,
        ),
        heightMm: Math.max(
          0,
          largoMm - datos.margenes.inicio - datos.margenes.fin,
        ),
      },
      maquina: {
        nombre: datos.maquina.nombre,
        anchoUtilMm: datos.maquina.anchoMaximoMm,
        tecnologia: null,
      },
    },
  };
}
