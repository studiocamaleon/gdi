// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { crearGruposLaminados } from "@/lib/selector-laminados";
import type { CandidatoMaterialVisual } from "@/lib/selectores-materiales";
import { MaterialSelectorLaminado } from "./material-selector-laminado";

const candidato: CandidatoMaterialVisual = {
  materiaPrimaId: "film", templateId: "laminado_film_v1", label: "Laminado BOPP", defaultVarianteId: "brillo",
  variantes: ["Brillante", "Mate"].map((acabado, i) => ({
    variantId: i === 0 ? "brillo" : "mate", sku: `BOPP-${i}`, missingPrice: i === 1,
    atributosVarianteJson: { acabado, ancho: 330, largo: 150, micrones: 25 },
  })),
};
let el: HTMLDivElement;
let root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  el = document.createElement("div"); document.body.appendChild(el); root = createRoot(el);
});
afterEach(async () => { await act(async () => root.unmount()); el.remove(); vi.unstubAllGlobals(); });
async function render(selected: string, onSelect = vi.fn(), material = candidato) {
  await act(async () => root.render(<MaterialSelectorLaminado etiquetaSlot="Film" grupos={crearGruposLaminados([material])!} selected={selected} onSelect={onSelect} sinTarjeta />));
  return onSelect;
}

it("muestra acabados reales, medidas comunes y devuelve el ID exacto de Mate", async () => {
  const onSelect = await render("brillo");
  expect(el.querySelectorAll('button[role="radio"]')).toHaveLength(2);
  expect(el.querySelector('[aria-checked="true"]')?.textContent).toContain("Brillante");
  expect(el.textContent?.match(/Rollo 330 mm × 150 m/g)).toHaveLength(1);
  await act(async () => el.querySelector<HTMLButtonElement>('button[aria-label*="· Mate ·"]')!.click());
  expect(onSelect).toHaveBeenCalledWith("mate");
  await render("mate", onSelect);
  expect(el.querySelector('[aria-checked="true"]')?.textContent).toContain("Mate");
  expect(el.textContent).toContain("Sin precio cargado");
});

it("activar un laminado sin selección pide un acabado y no crea una opción Sin laminado", async () => {
  const onSelect = await render("");
  expect(el.textContent).toContain("Elegí el acabado para este trabajo");
  expect(el.textContent).not.toContain("Sin laminado");
  expect(el.querySelector('[aria-checked="true"]')).toBeNull();
  expect(onSelect).not.toHaveBeenCalled();
  await render("variante-eliminada", onSelect);
  expect(el.textContent).toContain("La variante anterior no está disponible");
});

it("permite elegir con teclado, conserva una única selección y no recalcula al pulsarla otra vez", async () => {
  const onSelect = await render("brillo");
  const actual = el.querySelector<HTMLButtonElement>('[aria-checked="true"]')!;
  await act(async () => actual.click());
  expect(onSelect).not.toHaveBeenCalled();
  await act(async () => { actual.focus(); actual.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })); });
  const destino = document.activeElement!;
  expect(destino.getAttribute("aria-label")).toContain("Mate");
  await act(async () => {
    destino.dispatchEvent(new KeyboardEvent("keydown", { key: " ", code: "Space", bubbles: true }));
    destino.dispatchEvent(new KeyboardEvent("keyup", { key: " ", code: "Space", bubbles: true }));
  });
  expect(onSelect).toHaveBeenCalledWith("mate");
});

it("informa el espesor ambiguo únicamente cuando se elige esa variante", async () => {
  const material = { ...candidato, variantes: candidato.variantes.map((v, i) => ({ ...v, atributosVarianteJson: { ...v.atributosVarianteJson, ...(i ? { espesor: 75 } : {}) } })) };
  await render("brillo", vi.fn(), material);
  expect(el.querySelector('[aria-live="polite"]')?.textContent).not.toContain("confirmación");
  await render("mate", vi.fn(), material);
  expect(el.querySelector('[aria-live="polite"]')?.textContent).toContain("confirmación");
});
