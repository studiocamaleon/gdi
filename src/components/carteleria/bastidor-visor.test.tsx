// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { BastidorVisor } from "./bastidor-visor";
import type { EstructuraBastidor } from "@/lib/estructura-bastidor-api";

// La prueba cubre la elección de geometría; el portal de Base UI y WebGL
// se comprueban por separado del DOM de prueba.
vi.mock("@/components/ui/select", () => ({
  Select: ({
    items,
    value,
    onValueChange,
  }: {
    items: Array<{ value: string; label: string }>;
    value: string;
    onValueChange: (value: string) => void;
  }) => (
    <select value={value} onChange={(e) => onValueChange(e.target.value)}>
      {items.map((item) => (
        <option key={item.value} value={item.value}>
          {item.label}
        </option>
      ))}
    </select>
  ),
  SelectContent: () => null,
  SelectGroup: () => null,
  SelectItem: () => null,
  SelectTrigger: () => null,
  SelectValue: () => null,
}));
vi.mock("./viewport-3d", () => ({
  CarteleriaViewport: ({
    vista,
  }: {
    vista: { width: number; height: number };
  }) => (
    <div data-testid="geometria">
      {vista.width} × {vista.height}
    </div>
  ),
}));

it("cambia la geometría y el despiece por medida conservando la compra total", async () => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;

  const primera: EstructuraBastidor & { cantidad: number } = {
    cantidad: 1,
    tipoBastidor: "simple",
    anchoM: 0.25,
    altoM: 0.35,
    profundidadM: 0,
    sepRefuerzoVcm: 100,
    sepRefuerzoHcm: 0,
    refuerzosV: 0,
    refuerzosH: 0,
    puntosSoldadura: 4,
    despieceMm: [250, 250, 300, 300],
  };
  const segunda = {
    ...primera,
    cantidad: 2,
    anchoM: 0.45,
    altoM: 0.55,
    despieceMm: [450, 450, 500, 500],
  };
  const estructura = {
    ...primera,
    variantes: [primera, segunda],
    barras: {
      cantidad: 2,
      largoM: 3,
      metrosComerciales: 6,
      metrosUtiles: 4.9,
      sobranteM: 1.04,
    },
  };
  const el = document.createElement("div");
  document.body.appendChild(el);
  const root = createRoot(el);
  try {
    await act(async () => {
      root.render(
        <BastidorVisor itemId="prueba" estructuraLocal={estructura} />,
      );
    });
    expect(el.querySelector('[data-testid="geometria"]')?.textContent).toBe(
      "0.25 × 0.35",
    );
    const select = el.querySelector("select")!;
    expect(select.options).toHaveLength(2);
    await act(async () => {
      select.value = "1";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(el.querySelector('[data-testid="geometria"]')?.textContent).toBe(
      "0.45 × 0.55",
    );
    expect(el.textContent).toContain("500 mm");
    expect(el.textContent).not.toContain("300 mm");
    expect(el.textContent).toContain("2 barras de 3 m");
    expect(el.textContent).toContain("por bastidor");
  } finally {
    await act(async () => root.unmount());
    el.remove();
  }
});
