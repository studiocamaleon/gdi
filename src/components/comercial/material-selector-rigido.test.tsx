// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { crearGruposRigidos, type CandidatoRigido } from "@/lib/selector-rigidos";
import { MaterialSelectorRigido } from "./material-selector-rigido";

const candidato: CandidatoRigido = {
  materiaPrimaId: "pvc",
  templateId: "sustrato_rigido_v1",
  label: "PVC espumado",
  defaultVarianteId: "pvc-3",
  variantes: [3, 5, 10].map((espesor) => ({
    variantId: `pvc-${espesor}`,
    sku: `PVC-${espesor}`,
    missingPrice: espesor === 10,
    atributosVarianteJson: { espesor, ancho: 1.22, alto: 2.44, colorBase: "Blanco" },
  })),
};
let el: HTMLDivElement;
let root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  el = document.createElement("div");
  document.body.appendChild(el);
  root = createRoot(el);
});
afterEach(async () => {
  await act(async () => root.unmount());
  el.remove();
  vi.unstubAllGlobals();
});

async function render(selected: string, onSelect = vi.fn(), candidatos = [candidato]) {
  await act(async () => root.render(<MaterialSelectorRigido etiquetaSlot="Sustrato principal" grupos={crearGruposRigidos(candidatos)!} selected={selected} onSelect={onSelect} />));
  return onSelect;
}

it("recupera la variante guardada y al cambiar devuelve su ID exacto", async () => {
  const onSelect = await render("pvc-5");
  expect(el.querySelectorAll('[aria-checked="true"]')).toHaveLength(1);
  expect(el.querySelector('[aria-checked="true"]')?.textContent).toContain("5 mm");
  const boton = el.querySelector<HTMLButtonElement>('button[aria-label*="10 mm"]')!;
  await act(async () => boton.click());
  expect(onSelect).toHaveBeenCalledWith("pvc-10");
  await render("pvc-10", onSelect);
  expect(el.querySelector('[aria-live="polite"]')?.textContent).toContain("Sin precio cargado");
  expect(boton.disabled).toBe(false);
});

it("no presenta una variante vieja como si fuera la primera disponible", async () => {
  const onSelect = await render("eliminada");
  expect(el.querySelectorAll('[aria-checked="true"]')).toHaveLength(0);
  expect(el.textContent).toContain("La variante anterior no está disponible");
  expect(onSelect).not.toHaveBeenCalled();
});

it("la selección es única entre colores/materiales y no se puede desmarcar", async () => {
  const segundo = { ...candidato, materiaPrimaId: "acrilico", label: "Acrílico", variantes: candidato.variantes.map((v) => ({ ...v, variantId: `acrilico-${v.variantId}` })) };
  const onSelect = await render("pvc-3", vi.fn(), [candidato, segundo]);
  await act(async () => el.querySelector<HTMLButtonElement>('[aria-checked="true"]')!.click());
  expect(onSelect).not.toHaveBeenCalled();
  await act(async () => el.querySelector<HTMLButtonElement>('button[aria-label*="Acrílico"][aria-label*="5 mm"]')!.click());
  expect(onSelect).toHaveBeenCalledWith("acrilico-pvc-5");
  await render("acrilico-pvc-5", onSelect, [candidato, segundo]);
  expect(el.querySelectorAll('[aria-checked="true"]')).toHaveLength(1);
});

it("una única variante resuelta se muestra como dato, y una pendiente requiere elección", async () => {
  const unico = { ...candidato, variantes: [candidato.variantes[0]] };
  await render("pvc-3", vi.fn(), [unico]);
  expect(el.querySelectorAll("button")).toHaveLength(0);
  expect(el.textContent).toContain("122 × 244 cm");
  await render("obsoleta", vi.fn(), [unico]);
  expect(el.querySelectorAll("button")).toHaveLength(1);
  expect(el.querySelector('[aria-checked="true"]')).toBeNull();
});

it("permite recorrer con flechas y elegir con la barra espaciadora", async () => {
  const onSelect = await render("pvc-3");
  const boton = el.querySelector<HTMLButtonElement>('[aria-checked="true"]')!;
  await act(async () => {
    boton.focus();
    boton.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
  });
  const enfocado = document.activeElement!;
  expect(enfocado.getAttribute("aria-label")).toContain("5 mm");
  await act(async () => {
    enfocado.dispatchEvent(new KeyboardEvent("keydown", { key: " ", code: "Space", bubbles: true }));
    enfocado.dispatchEvent(new KeyboardEvent("keyup", { key: " ", code: "Space", bubbles: true }));
  });
  expect(onSelect).toHaveBeenCalledWith("pvc-5");
});

it("filtra catálogos largos conservando la selección visible y su ID", async () => {
  const muchos = { ...candidato, variantes: Array.from({ length: 9 }, (_, i) => ({
    ...candidato.variantes[0], variantId: `pvc-${i + 1}`,
    atributosVarianteJson: { ...candidato.variantes[0].atributosVarianteJson, espesor: i + 1 },
  })) };
  const onSelect = await render("pvc-3", vi.fn(), [muchos]);
  const input = el.querySelector("input")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "9 mm");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(el.querySelectorAll('button[role="radio"]')).toHaveLength(2);
  expect(el.querySelector('[aria-checked="true"]')?.textContent).toContain("3 mm");
  expect(el.querySelector('button[aria-label*="9 mm"]')).not.toBeNull();
  expect(onSelect).not.toHaveBeenCalled();
});
