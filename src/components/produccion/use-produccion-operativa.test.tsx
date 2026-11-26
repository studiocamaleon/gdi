// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import type { ItemView } from "@/lib/produccion-item-view";
import type { TableroItemData } from "@/lib/tablero-produccion";
import {
  accionPasoProduccion,
  getTableroProduccion,
} from "@/lib/ordenes-trabajo-api";
import { useProduccionOperativa } from "./use-produccion-operativa";

vi.mock("@/components/navigation/permisos-provider", () => ({
  usePuede: () => true,
}));
vi.mock("@/components/notificaciones/notificaciones-provider", () => ({
  useNotificaciones: () => ({ estado: "respaldo" }),
  useCambiosSistema: () => {},
}));
vi.mock("@/lib/ordenes-trabajo-api", () => ({
  accionPasoProduccion: vi.fn(),
  getTableroProduccion: vi.fn(),
}));

it("confirma el paso y libera el botón mientras el tablero sigue actualizándose", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const root = createRoot(document.createElement("div"));
  const item = {
    id: "trabajo",
    ordenId: "orden",
    pasos: [{ id: "paso", estado: "pendiente" }],
  } as TableroItemData;
  const confirmado = {
    ...item,
    pasos: [{ ...item.pasos[0], estado: "hecho" as const }],
  };
  const meta = {
    alcance: "completo" as const,
    puedeGestionar: true,
    estacionIdsEjecutables: null,
    vendedorSinVinculo: false,
  };
  const lectura =
    Promise.withResolvers<Awaited<ReturnType<typeof getTableroProduccion>>>();
  const guardado =
    Promise.withResolvers<Awaited<ReturnType<typeof accionPasoProduccion>>>();
  vi.mocked(accionPasoProduccion).mockReturnValue(guardado.promise);
  vi.mocked(getTableroProduccion).mockReturnValue(lectura.promise);
  let operacion!: ReturnType<typeof useProduccionOperativa>;
  function Tablero() {
    operacion = useProduccionOperativa({
      initialItems: [item],
      initialMeta: meta,
    });
    return null;
  }
  try {
    await act(async () => root.render(<Tablero />));
    const vista = { id: item.id, data: item } as ItemView;
    const fin = vi.fn();
    await act(async () => {
      void operacion.handleAccion(vista, item.pasos[0], "completar").then(fin);
      void operacion.handleAccion(vista, item.pasos[0], "completar");
    });
    expect(operacion.busy).toBe(true);
    expect(accionPasoProduccion).toHaveBeenCalledTimes(1);
    expect(operacion.items[0].pasos[0].estado).toBe("pendiente");
    await act(async () => guardado.resolve(confirmado));
    expect(getTableroProduccion).toHaveBeenCalledOnce();
    expect(fin).toHaveBeenCalledWith(confirmado);
    expect(operacion.busy).toBe(false);
    expect(operacion.items[0].pasos[0].estado).toBe("hecho");
    await act(async () => lectura.resolve({ ...meta, items: [] }));
    expect(operacion.items).toEqual([]);
  } finally {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
  }
});
