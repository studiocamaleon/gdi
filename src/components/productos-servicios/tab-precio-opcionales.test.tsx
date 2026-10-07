// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  TabPrecioEditor,
  normalizePrecioConfig,
  precioConfigKey,
  type TabPrecioConfig,
} from "./tab-precio-editor";
import { DesignSystemProvider } from "@/components/design-system/appearance";
import { ProductoVisualProvider } from "./producto-ui";

let container: HTMLDivElement, root: Root;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
async function render(config: TabPrecioConfig, change = vi.fn()) {
  function Editor() {
    const [value, setValue] = useState(config);
    return (
      <TabPrecioEditor
        value={value}
        onChange={(v) => {
          setValue(v);
          change(v);
        }}
      />
    );
  }
  await act(async () =>
    root.render(
      <DesignSystemProvider theme="brand" appearance="light">
        <ProductoVisualProvider>
          <Editor />
        </ProductoVisualProvider>
      </DesignSystemProvider>,
    ),
  );
  return change;
}
it("permite editar el margen sin perder precio, IVA ni estrategia compuesta", async () => {
  const config: TabPrecioConfig = {
    metodoCalculo: "precio_fijo",
    detalle: { price: 1210, precioIncluyeIva: true },
    compuesto: { version: 1, estrategia: "MIXTO" },
  };
  const change = await render(config);
  const input = container.querySelector<HTMLInputElement>(
    'input[id$="-margen-opcionales"]',
  )!;
  expect(input.value).toBe("0");
  expect(container.textContent).toContain(
    "El precio fijo incluye los pasos obligatorios",
  );
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, "25");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(change).toHaveBeenLastCalledWith({
    ...config,
    detalle: { ...config.detalle, margenOpcionalesPct: 25 },
  });
});
it.each([
  "precio_fijo",
  "precio_fijo_para_margen_minimo",
  "fijado_por_cantidad",
  "variable_por_cantidad",
] as const)("muestra el margen para %s", async (metodoCalculo) => {
  await render({
    metodoCalculo,
    detalle: {
      price: 100,
      minimumMarginPct: 10,
      tiers: [{ quantity: 10, quantityUntil: 10, price: 100 }],
      margenOpcionalesPct: 35,
    },
  });
  expect(
    container.querySelector<HTMLInputElement>('input[id$="-margen-opcionales"]')
      ?.value,
  ).toBe("35");
});
it.each(["por_margen", "margen_variable", "fijo_con_margen_variable"] as const)(
  "no ofrece otro margen para %s",
  async (metodoCalculo) => {
    await render({ metodoCalculo, detalle: { marginPct: 25, tiers: [] } });
    expect(
      container.querySelector('input[id$="-margen-opcionales"]'),
    ).toBeNull();
  },
);
it.each(["fijado_por_cantidad", "variable_por_cantidad"] as const)(
  "conserva el margen y el IVA de %s al normalizar o detectar cambios",
  (metodoCalculo) => {
    const config: TabPrecioConfig = {
      metodoCalculo,
      detalle: {
        tiers: [{ quantity: 10, quantityUntil: 10, price: 500 }],
        precioIncluyeIva: false,
        margenOpcionalesPct: 25,
      },
    };
    expect(normalizePrecioConfig(config).detalle).toMatchObject({
      precioIncluyeIva: false,
      margenOpcionalesPct: 25,
    });
    expect(precioConfigKey(config)).not.toBe(
      precioConfigKey({
        ...config,
        detalle: { ...config.detalle, margenOpcionalesPct: 35 },
      }),
    );
  },
);
