// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { RevisionRecetaCotizacion } from "@/lib/productos-servicios-api";
import { ComponentesFabricadosCotizacion } from "./componentes-fabricados-cotizacion";

const materiales = [
  {
    materiaPrimaId: "bicapa",
    templateId: "sustrato_rigido_v1",
    label: "Laminado bicapa de prueba",
    variantes: ["Oro", "Plata"].map((color) => ({
      variantId: color.toLowerCase(),
      sku: `PLACA-${color}`,
      missingPrice: false,
      atributosVarianteJson: {
        espesor: 2,
        ancho: 1.2,
        alto: 0.6,
        colorBase: color,
      },
    })),
  },
];
const revision = {
  componentes: [
    {
      id: "frente",
      codigo: "FRENTE",
      nombre: "Frente",
      cantidad: 1,
      formula: "por_unidad",
      configuracionJson: {
        version: 2,
        bindings: [
          {
            clave: "slotMateriales.corte_sustrato",
            tipoDato: "material",
            etiqueta: "Placa del frente",
            origen: "COTIZACION",
            opciones: [
              { valor: "oro", etiqueta: "Oro" },
              { valor: "plata", etiqueta: "Plata" },
            ],
            materiales,
          },
        ],
      },
    },
  ],
} satisfies RevisionRecetaCotizacion;
let el: HTMLDivElement;
let root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  el = document.createElement("div");
  document.body.appendChild(el);
  root = createRoot(el);
});
afterEach(async () => {
  await act(async () => root.unmount());
  el.remove();
  vi.unstubAllGlobals();
});

it("muestra placas del catálogo y conserva el ID elegido dentro del componente", async () => {
  const onChange = vi.fn();
  function Ensayo() {
    const [value, setValue] = useState<Record<string, Record<string, unknown>>>(
      {
        FRENTE: {
          slotMateriales: { corte_sustrato: "oro" },
          datoConservado: 7,
        },
      },
    );
    return (
      <ComponentesFabricadosCotizacion
        revision={revision}
        cantidadProductos={1}
        values={value}
        onChange={(next) => {
          onChange(next);
          setValue(next);
        }}
      />
    );
  }
  await act(async () => root.render(<Ensayo />));
  expect(el.querySelector("select")).toBeNull();
  expect(el.textContent).toContain("120 × 60 cm");
  expect(el.textContent).toContain("2 mm");
  expect(el.querySelector('svg[viewBox="0 0 47 29"]')).not.toBeNull();
  await act(async () =>
    el
      .querySelector<HTMLButtonElement>(
        'button[aria-label*="Color del material: Plata"]',
      )!
      .click(),
  );
  expect(onChange).toHaveBeenLastCalledWith({
    FRENTE: { slotMateriales: { corte_sustrato: "plata" }, datoConservado: 7 },
  });
  expect(
    el.querySelector('[aria-checked="true"]')?.getAttribute("aria-label"),
  ).toContain("Plata");
  expect(el.querySelector('svg[viewBox="0 0 47 29"]')).not.toBeNull();
});

it("no sustituye por otra variante una selección retirada del catálogo", async () => {
  const onChange = vi.fn();
  await act(async () =>
    root.render(
      <ComponentesFabricadosCotizacion
        revision={revision}
        values={{ FRENTE: { slotMateriales: { corte_sustrato: "retirada" } } }}
        onChange={onChange}
      />,
    ),
  );
  expect(el.textContent).toContain("La variante anterior no está disponible");
  expect(el.querySelector('[aria-checked="true"]')).toBeNull();
  expect(onChange).not.toHaveBeenCalled();
});
