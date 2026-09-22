// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { CapacidadesProvider } from "../navigation/capacidades-provider";
import { ImpresionDisponibleProvider } from "./impresion-disponible-provider";
import { seccionesConfigVisibles } from "../configuracion/configuracion-secciones";
const montado = vi.hoisted(() => vi.fn());
vi.mock("./documentos-impresion-provider", () => ({
  DocumentosImpresionProvider: ({ children }: { children: ReactNode }) => {
    montado();
    return <section data-cola>{children}</section>;
  },
}));
it("mantiene la aplicación sin montar impresión cuando falta la capacidad y la retira al revocarla", async () => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  const el = document.createElement("div"),
    root = createRoot(el);
  const render = async (habilitada?: boolean) =>
    act(async () =>
      root.render(
        <CapacidadesProvider capacidades={{ impresionDirecta: habilitada }}>
          <ImpresionDisponibleProvider tenantId="tenant">
            <p>Cotizar y emitir OT</p>
          </ImpresionDisponibleProvider>
        </CapacidadesProvider>,
      ),
    );
  try {
    await render();
    expect(montado).not.toHaveBeenCalled();
    expect(el.textContent).toBe("Cotizar y emitir OT");
    expect(
      seccionesConfigVisibles(() => true, "AR").some(
        (s) => s.key === "impresoras",
      ),
    ).toBe(false);
    await render(true);
    expect(el.querySelector("[data-cola]")).not.toBeNull();
    expect(
      seccionesConfigVisibles(() => true, "AR", true).some(
        (s) => s.key === "impresoras",
      ),
    ).toBe(true);
    await render(false);
    expect(el.querySelector("[data-cola]")).toBeNull();
    expect(el.textContent).toBe("Cotizar y emitir OT");
  } finally {
    await act(async () => root.unmount());
  }
});

it("el contrato de funciones prevalece sobre el indicador anterior y la conexión no obliga a montar colas", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const el = document.createElement("div"),
    root = createRoot(el);
  try {
    for (const [directa, colas, visible] of [
      [false, true, false],
      [true, false, false],
      [true, true, true],
    ]) {
      await act(async () =>
        root.render(
          <CapacidadesProvider
            capacidades={{
              impresionDirecta: true,
              funciones: { impresion_directa: directa, colas_impresion: colas },
            }}
          >
            <ImpresionDisponibleProvider tenantId="tenant">
              <p>Cotizar y emitir OT</p>
            </ImpresionDisponibleProvider>
          </CapacidadesProvider>,
        ),
      );
      expect(Boolean(el.querySelector("[data-cola]"))).toBe(visible);
      expect(el.textContent).toBe("Cotizar y emitir OT");
    }
  } finally {
    await act(async () => root.unmount());
  }
});
