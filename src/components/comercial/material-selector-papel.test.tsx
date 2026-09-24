// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { crearGruposPapeles } from "@/lib/selector-papeles";
import type { CandidatoMaterialVisual } from "@/lib/selectores-materiales";
import { MaterialSelectorPapel } from "./material-selector-papel";

const candidatos: CandidatoMaterialVisual[] = [
  { materiaPrimaId: "ilustracion", templateId: "sustrato_hoja_v1", label: "Ilustración", defaultVarianteId: "ilu-150", variantes: [150, 250].map((gramaje) => ({ variantId: `ilu-${gramaje}`, sku: `ILU-${gramaje}`, missingPrice: false, atributosVarianteJson: { gramaje, ancho: 32.5, alto: 47.5 } })) },
  { materiaPrimaId: "opalina", templateId: "sustrato_hoja_v1", label: "Opalina", variantes: [180, 210].map((gramaje) => ({ variantId: `opa-${gramaje}`, sku: `OPA-${gramaje}`, missingPrice: gramaje === 210, atributosVarianteJson: { gramaje, ancho: 65, alto: 95 } })) },
];
const grupos = crearGruposPapeles(candidatos)!;
let el: HTMLDivElement;
let root: Root;
beforeEach(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} }); el = document.createElement("div"); document.body.appendChild(el); root = createRoot(el); });
afterEach(async () => { await act(async () => root.unmount()); el.remove(); vi.unstubAllGlobals(); });
const radio = (label: string) => el.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
const variante = (texto: string) => el.querySelector<HTMLButtonElement>(`button[aria-label*="${texto}"]`)!;

it("cambiar papel invalida la variante anterior y exige un gramaje del papel elegido", async () => {
  const onSelect = vi.fn();
  function Controlado() { const [selected, setSelected] = useState("ilu-150"); return <MaterialSelectorPapel etiquetaSlot="Sustrato" grupos={grupos} selected={selected} onSelect={(id) => { onSelect(id); setSelected(id); }} />; }
  await act(async () => root.render(<Controlado />));
  expect(radio("Ilustración").getAttribute("aria-checked")).toBe("true");
  await act(async () => radio("Opalina").click());
  expect(onSelect).toHaveBeenLastCalledWith("");
  expect(radio("Opalina").getAttribute("aria-checked")).toBe("true");
  expect(el.textContent).toContain("Elegí el gramaje y formato para cotizar");
  expect(variante("150 g/m²")).toBeNull();
  await act(async () => variante("210 g/m²").click());
  expect(onSelect).toHaveBeenLastCalledWith("opa-210");
  expect(el.textContent).toContain("Sin precio cargado");
  expect(el.querySelectorAll('[aria-checked="true"]')).toHaveLength(2); // papel + variante
});

it("restaura papel y variante guardados al editar; no reemplaza una variante obsoleta", async () => {
  const onSelect = vi.fn();
  const render = async (selected: string) => act(async () => root.render(<MaterialSelectorPapel etiquetaSlot="Interior" grupos={grupos} selected={selected} onSelect={onSelect} />));
  await render("opa-210");
  expect(radio("Opalina").getAttribute("aria-checked")).toBe("true");
  expect(variante("210 g/m²").getAttribute("aria-checked")).toBe("true");
  await render("eliminada");
  expect(el.querySelector('[aria-checked="true"]')).toBeNull();
  expect(el.textContent).toContain("La variante anterior no está disponible");
  expect(onSelect).not.toHaveBeenCalled();
});

it("distingue dos formatos del mismo gramaje y permite elegir la variante exacta por teclado", async () => {
  const papel = { ...candidatos[0], variantes: [candidatos[0].variantes[0], { ...candidatos[0].variantes[0], variantId: "a4", atributosVarianteJson: { gramaje: 150, ancho: 21, alto: 29.7, formatoComercial: "A4" } }] };
  const onSelect = vi.fn();
  await act(async () => root.render(<MaterialSelectorPapel etiquetaSlot="Interior" grupos={crearGruposPapeles([papel])!} selected="ilu-150" onSelect={onSelect} />));
  expect(el.querySelectorAll('button[role="radio"]')).toHaveLength(2);
  const objetivo = variante("A4");
  await act(async () => { objetivo.focus(); objetivo.dispatchEvent(new KeyboardEvent("keydown", { key: " ", code: "Space", bubbles: true })); objetivo.dispatchEvent(new KeyboardEvent("keyup", { key: " ", code: "Space", bubbles: true })); });
  expect(onSelect).toHaveBeenCalledWith("a4");
  expect(el.textContent).toContain("32,5 × 47,5 cm");
});

it("tapa e interior mantienen selecciones independientes", async () => {
  const tapa = vi.fn(); const interior = vi.fn();
  await act(async () => root.render(<><MaterialSelectorPapel etiquetaSlot="Tapa" grupos={grupos} selected="ilu-150" onSelect={tapa} /><MaterialSelectorPapel etiquetaSlot="Interior" grupos={grupos} selected="opa-210" onSelect={interior} /></>));
  await act(async () => el.querySelector<HTMLButtonElement>('[aria-label="Tapa: Tipo de papel"] button[aria-label="Opalina"]')!.click());
  expect(tapa).toHaveBeenCalledWith("");
  expect(interior).not.toHaveBeenCalled();
  expect(el.querySelector('[aria-label="Interior: Tipo de papel"] [aria-checked="true"]')?.textContent).toContain("Opalina");
});

it("un único papel permite reemplazar una variante obsoleta", async () => {
  const onSelect = vi.fn();
  await act(async () => root.render(<MaterialSelectorPapel etiquetaSlot="Papel" grupos={[grupos[0]]} selected="borrada" onSelect={onSelect} />));
  expect(el.textContent).toContain("La variante anterior no está disponible");
  await act(async () => variante("250 g/m²").click());
  expect(onSelect).toHaveBeenCalledWith("ilu-250");
});

it("conserva la tarjeta de gramaje con formato y predeterminado aunque sea la única opción", async () => {
  const papel = { ...candidatos[0], variantes: [{ ...candidatos[0].variantes[0], atributosVarianteJson: { gramaje: 150, ancho: 32.5, alto: 47.5, formatoComercial: "SRA3", color: "Blanco" } }] };
  await act(async () => root.render(<MaterialSelectorPapel etiquetaSlot="Sustrato" grupos={crearGruposPapeles([papel])!} selected="ilu-150" onSelect={vi.fn()} />));
  const card = variante("150 g/m²");
  expect(card.getAttribute("aria-checked")).toBe("true");
  expect(card.textContent).toContain("SRA3 · 32,5 × 47,5 cm");
  expect(card.textContent).toContain("Predeterminado");
  expect(card.querySelector("svg path[fill='#ffffff']")).not.toBeNull();
});

it("mantiene tarjetas de gramaje al filtrar por color sin ofrecer variantes de otro color", async () => {
  const papel = { ...candidatos[0], variantes: [
    { ...candidatos[0].variantes[0], atributosVarianteJson: { gramaje: 150, ancho: 32.5, alto: 47.5, color: "Blanco" } },
    ...[180, 250].map((gramaje) => ({ variantId: `azul-${gramaje}`, sku: `AZUL-${gramaje}`, missingPrice: false, atributosVarianteJson: { gramaje, ancho: 21, alto: 29.7, color: "Azul" } })),
  ] };
  const onSelect = vi.fn();
  function Controlado() { const [selected, setSelected] = useState("ilu-150"); return <MaterialSelectorPapel etiquetaSlot="Sustrato" grupos={crearGruposPapeles([papel])!} selected={selected} onSelect={(id) => { onSelect(id); setSelected(id); }} />; }
  await act(async () => root.render(<Controlado />));
  expect(variante("150 g/m²").getAttribute("aria-checked")).toBe("true");
  await act(async () => radio("Ilustración · Color del papel: Azul").click());
  expect(onSelect).toHaveBeenLastCalledWith("");
  expect(variante("150 g/m²")).toBeNull();
  expect(variante("180 g/m²").querySelector("svg path[fill='#326dc1']")).not.toBeNull();
  await act(async () => variante("250 g/m²").click());
  expect(onSelect).toHaveBeenLastCalledWith("azul-250");
  expect(variante("250 g/m²").getAttribute("aria-checked")).toBe("true");
});
