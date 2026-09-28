// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { CentroCosto } from "@/lib/costos";
import { MaquinaEditorIdentidad } from "./maquina-editor-form";
import type { MaquinaEditorState } from "./use-maquina-editor";

// El alta de plantas tiene sus propias pruebas y requiere permisos de sesión.
vi.mock("../planta-selector", () => ({ PlantaSelector: () => null }));

const centro: CentroCosto = {
  id: "centro-uv",
  plantaId: "planta-1",
  plantaNombre: "Taller",
  codigo: "UV",
  nombre: "Impresión UV",
  descripcion: "",
  updatedAt: "2026-09-25T17:00:00Z",
  tipoCentro: "productivo",
  activo: true,
  estadoConfiguracion: "borrador_pendiente",
  ultimoPeriodoConfigurado: "2026-10",
  ultimaTarifaPublicada: 15000,
  ultimaTarifaBase: 0,
  ultimaTarifaAbsorbida: 0,
  ultimaTarifaTotal: 0,
  ultimaCapacidadPractica: 0,
};

function tarifaVisible(
  cambios: Partial<CentroCosto> = {},
  centroCostoPrincipalId: string | undefined = centro.id,
) {
  const editor = {
    form: {
      nombre: "Impresora UV",
      plantilla: "impresora_gran_formato_por_area",
      plantaId: "planta-1",
      centroCostoPrincipalId,
      estado: "activa",
    },
    setForm: vi.fn(),
  } as unknown as MaquinaEditorState;
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(
    <MaquinaEditorIdentidad
      editor={editor}
      plantas={[]}
      centrosCosto={[{ ...centro, ...cambios }]}
    />,
  );
  const input = container.querySelector<HTMLInputElement>(
    "#maquina-tarifa-hora",
  )!;
  expect(input.disabled).toBe(true);
  return input.value.replaceAll("\u00a0", " ");
}

describe("Tarifa del centro en la ficha de máquina", () => {
  it("muestra la tarifa publicada aunque haya un borrador posterior en cero", () => {
    expect(tarifaVisible()).toBe("$ 15.000,00");
  });

  it("no presenta un borrador calculado como una tarifa publicada", () => {
    expect(
      tarifaVisible({ ultimaTarifaPublicada: null, ultimaTarifaTotal: 18000 }),
    ).toBe("Sin tarifa publicada");
  });

  it("no toma la tarifa de otro centro cuando la máquina no tiene uno asignado", () => {
    expect(tarifaVisible({}, "")).toBe("Sin tarifa publicada");
  });

  it("distingue una tarifa publicada de cero de la ausencia de publicación", () => {
    expect(tarifaVisible({ ultimaTarifaPublicada: 0 })).toBe("$ 0,00");
  });
});
