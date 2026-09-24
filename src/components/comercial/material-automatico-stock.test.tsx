// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MaterialAutomaticoStock } from "./material-automatico-stock";
import { decisionesMaterialStock, hayDecisionMaterialStockPendiente } from "@/lib/seleccion-material-stock";
import type { CotizarResponse } from "@/lib/productos-servicios-api";

const candidatos = [{ materiaPrimaId: "vinilo", label: "Vinilo Ritrama", templateId: "sustrato_rollo_flexible_v1", defaultVarianteId: "v0", variantes: [1.06, 1.37, 1.52].map((ancho, i) => ({
  variantId: `v${i}`, sku: `V${i}`, label: `${ancho} m`, missingPrice: false,
  atributosVarianteJson: { ancho, largo: 50, acabado: "Brillante" },
})) }];
const resultado: CotizarResponse = { exitoso: false, errores: [{ codigo: "material_auto_sin_stock_suficiente", severidad: "ERROR", mensaje: "Falta stock", contexto: {
  configPasoId: "impresion", slotCodigo: "sustrato", recomendadoVarianteId: "v1", alternativas: [{ id: "v0" }, { id: "v1" }, { id: "v2" }],
} }] };
let el: HTMLDivElement;
let root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  el = document.createElement("div"); document.body.appendChild(el); root = createRoot(el);
});
afterEach(async () => { await act(async () => root.unmount()); el.remove(); vi.unstubAllGlobals(); });
async function render(response: CotizarResponse | null, selected = "", onSelect = vi.fn()) {
  const decision = decisionesMaterialStock(response).find((d) => d.configPasoId === "impresion" && d.slotCodigo === "sustrato");
  await act(async () => root.render(<MaterialAutomaticoStock etiqueta="Sustrato principal" candidatos={candidatos} decision={decision} contextoDecision="trabajo" selected={selected} onSelect={onSelect} />));
  return onSelect;
}

it("permanece oculto antes del cálculo y cuando la selección automática se resuelve", async () => {
  await render(null); expect(el.textContent).toBe("");
  await render({ exitoso: true, errores: [] }); expect(el.textContent).toBe("");
});
it("muestra anchos ilustrados y recomendación sin preseleccionar ni confirmar un faltante", async () => {
  const onSelect = await render(resultado);
  expect(el.querySelectorAll('button[role="radio"]')).toHaveLength(3);
  const recomendada = el.querySelector<HTMLButtonElement>('button[aria-label*="Recomendado por el sistema"]')!;
  expect(recomendada.textContent).toContain("1,37 m");
  expect(el.textContent).not.toContain("Predeterminado");
  expect(el.querySelectorAll('[aria-checked="true"]')).toHaveLength(0);
  expect(recomendada.querySelector('svg[viewBox="0 0 47 29"]')).not.toBeNull();
  expect(onSelect).not.toHaveBeenCalled();
  await act(async () => recomendada.click());
  expect(onSelect).toHaveBeenCalledWith("v1");
});
it("conserva una excepción manual al recalcular y permite volver a automático", async () => {
  const onSelect = await render({ exitoso: true, errores: [] }, "v1");
  expect(el.textContent).toContain("Material elegido manualmente");
  expect(el.querySelector('[aria-checked="true"]')?.textContent).toContain("1,37 m");
  await act(async () => [...el.querySelectorAll('button')].find((b) => b.textContent?.includes("Volver a selección automática"))!.click());
  expect(onSelect).toHaveBeenCalledWith("");
  await render({ exitoso: true, errores: [] }); expect(el.textContent).toBe("");
});
it("limita la elección a alternativas técnicamente viables y nunca mezcla slots de distintos pasos", async () => {
  const error = resultado.errores[0];
  await render({ ...resultado, errores: [{ ...error, contexto: { ...error.contexto, alternativas: [{ id: "v1" }] } }] });
  expect(el.querySelectorAll('button[role="radio"]')).toHaveLength(1);
  expect(el.querySelector('[aria-checked="true"]')).toBeNull();
  await render({ ...resultado, errores: [{ ...error, contexto: { ...error.contexto, configPasoId: "otro" } }] });
  expect(el.textContent).toBe("");
});
it("requiere confirmación también para el aviso con reposición; no bloquea la cotización común", () => {
  const conAviso = { ...resultado, exitoso: true, errores: resultado.errores.map((e) => ({ ...e, codigo: "material_auto_requiere_reposicion", severidad: "WARNING" })) };
  expect(hayDecisionMaterialStockPendiente(conAviso, {})).toBe(true);
  expect(hayDecisionMaterialStockPendiente(conAviso, { otro_sustrato: "v1" })).toBe(true);
  expect(hayDecisionMaterialStockPendiente(conAviso, { impresion_sustrato: "v1" })).toBe(false);
  expect(hayDecisionMaterialStockPendiente({ exitoso: true, errores: [] }, {})).toBe(false);
});

it("conserva la tarjeta recomendada si es la única alternativa viable y ya fue elegida", async () => {
  const error = resultado.errores[0];
  await render({ ...resultado, errores: [{ ...error, contexto: { ...error.contexto, alternativas: [{ id: "v1" }] } }] });
  await act(async () => el.querySelector<HTMLButtonElement>('button[role="radio"]')!.click());
  await render({ exitoso: true, errores: [] }, "v1");
  const tarjeta = el.querySelector('[aria-checked="true"]');
  expect(tarjeta?.textContent).toContain("1,37 m");
  expect(tarjeta?.textContent).toContain("Recomendado");
  expect(el.querySelectorAll('button[role="radio"]')).toHaveLength(1);
});
