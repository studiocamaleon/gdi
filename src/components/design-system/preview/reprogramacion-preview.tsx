"use client";
import { useState } from "react";
import { ReprogramacionSheet } from "@/components/produccion/reprogramacion-sheet";
import { DesignSystemProvider } from "../appearance";
import { ActionButton } from "../action-button";
import { claveFechaEnZona, instanteDe, sumarDiasAClave } from "@/lib/zona";
import type {
  SolicitudReprogramacion,
  RevisionReprogramacion,
} from "@/lib/reprogramacion-api";
import brand from "../brand-workspace-theme.module.css";
import layout from "../list-page.module.css";
const zona = "America/Argentina/Buenos_Aires";
const simular = async (
  _id: string,
  s: SolicitudReprogramacion,
): Promise<RevisionReprogramacion> => {
  const inicio = instanteDe(s.fecha, s.hora ?? "09:00", zona);
  const fin = new Date(inicio.getTime() + 90 * 60_000);
  return {
    token: "muestra-local",
    venceEl: new Date(Date.now() + 120000).toISOString(),
    zona,
    viable: true,
    motivos: [],
    alcance:
      s.alcance === "paso" ? "Impresión digital" : "Folletos institucionales",
    solicitado: s.tipo === "produccion" ? inicio.toISOString() : s.fecha,
    advertencias: [
      s.tipo === "produccion"
        ? "La entrega comprometida se conserva. El inicio solicitado es un límite: el calendario y las dependencias pueden ubicar el trabajo más tarde."
        : "Se cambia el compromiso del ítem o lote. La entrega final de la OT refleja el último compromiso cuando todos sus productos tienen fecha.",
    ],
    pasos: [
      {
        id: "paso-qa",
        orden: "OT-QA-001",
        trabajo: "Folletos institucionales",
        paso: "Impresión digital",
        inicioActual: new Date(inicio.getTime() - 86400000).toISOString(),
        finActual: new Date(fin.getTime() - 86400000).toISOString(),
        inicioPropuesto: inicio.toISOString(),
        finPropuesto: fin.toISOString(),
        seGuarda: s.tipo === "produccion",
      },
    ],
    entregaOrden: { actual: s.fecha, propuesta: s.fecha },
    entregas: [
      {
        id: "item-qa",
        orden: "OT-QA-001",
        trabajo: "Folletos institucionales",
        actual: s.fecha,
        propuesta: s.fecha,
        finPropuesto: fin.toISOString(),
        enRiesgo: false,
      },
    ],
  };
};
/** Laboratorio con datos ficticios: no llama a la API ni modifica órdenes. */
export function ReprogramacionPreview() {
  const [tipo, setTipo] = useState<"produccion" | "entrega" | null>(
    "produccion",
  );
  const [guardado, setGuardado] = useState(false);
  const dia = sumarDiasAClave(claveFechaEnZona(new Date(), zona), 3);
  return (
    <DesignSystemProvider theme="brand" appearance="light">
      <main
        data-ui="heroui"
        data-appearance="light"
        className={`${brand.theme} ${layout.page}`}
      >
        <h1>Planificación · Reprogramación</h1>
        <p>Muestra local con una orden ficticia.</p>
        <ActionButton onPress={() => setTipo("produccion")}>
          Reprogramar producción
        </ActionButton>
        <ActionButton variant="outline" onPress={() => setTipo("entrega")}>
          Cambiar entrega
        </ActionButton>
        {guardado && <p role="status">Cambio confirmado en la muestra.</p>}
        {tipo && (
          <ReprogramacionSheet
            key={tipo}
            pasoId="paso-qa"
            paso="Impresión digital"
            trabajo="OT-QA-001 · Folletos institucionales"
            zona={zona}
            inicio={instanteDe(dia, "10:00", zona)}
            entrega={dia}
            tipo={tipo}
            onClose={() => setTipo(null)}
            onSaved={() => {
              setGuardado(true);
              setTipo(null);
            }}
            acciones={{
              simular,
              confirmar: async () => ({ confirmado: true }),
            }}
          />
        )}
      </main>
    </DesignSystemProvider>
  );
}
