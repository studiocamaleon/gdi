// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { crearGruposColores } from "@/lib/selector-colores";
import { crearGruposPapeles } from "@/lib/selector-papeles";
import type { CandidatoMaterialVisual } from "@/lib/selectores-materiales";
import { MaterialSelectorColor } from "./material-selector-color";
import { MaterialSelectorPapel } from "./material-selector-papel";

const candidato: CandidatoMaterialVisual = {
  materiaPrimaId: "acrilico", templateId: "sustrato_rigido_v1", label: "Acrílico", defaultVarianteId: "blanco-3",
  variantes: [
    { variantId: "blanco-3", sku: "B", missingPrice: false, atributosVarianteJson: { colorBase: "Blanco", espesor: 3, ancho: 1.22, alto: 2.44 } },
    ...[3, 5].map((espesor) => ({ variantId: `negro-${espesor}`, sku: `N-${espesor}`, missingPrice: espesor === 5, atributosVarianteJson: { colorBase: "Negro", espesor, ancho: 1.22, alto: 2.44 } })),
  ],
};
let el: HTMLDivElement;
let root: Root;
beforeEach(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} }); el = document.createElement("div"); document.body.appendChild(el); root = createRoot(el); });
afterEach(async () => { await act(async () => root.unmount()); el.remove(); vi.unstubAllGlobals(); });
const btn = (label: string) => el.querySelector<HTMLButtonElement>(`button[aria-label*="${label}"]`)!;

it("cambiar color invalida la variante y sólo ofrece los espesores de ese color", async () => {
  const onSelect = vi.fn();
  function Controlado() { const [selected, setSelected] = useState("blanco-3"); return <MaterialSelectorColor etiquetaSlot="Sustrato" grupos={crearGruposColores([candidato])!} selected={selected} onSelect={(id) => { onSelect(id); setSelected(id); }} />; }
  await act(async () => root.render(<Controlado />));
  await act(async () => btn("Color del material: Negro").click());
  expect(onSelect).toHaveBeenLastCalledWith("");
  expect(el.textContent).toContain("Elegí el espesor para este trabajo");
  expect(el.querySelectorAll('[aria-checked="true"]')).toHaveLength(1);
  await act(async () => btn("5 mm").click());
  expect(onSelect).toHaveBeenLastCalledWith("negro-5");
  expect(el.textContent).toContain("Sin precio cargado");
});

it("restaura selección; un ID obsoleto no elige otro color; admite teclado", async () => {
  const onSelect = vi.fn();
  const render = async (selected: string) => act(async () => root.render(<MaterialSelectorColor etiquetaSlot="Sustrato" grupos={crearGruposColores([candidato])!} selected={selected} onSelect={onSelect} />));
  await render("negro-5");
  expect(btn("Color del material: Negro").getAttribute("aria-checked")).toBe("true");
  expect(btn("5 mm").getAttribute("aria-checked")).toBe("true");
  await render("obsoleto");
  expect(el.querySelector('[aria-checked="true"]')).toBeNull();
  expect(el.textContent).toContain("La variante anterior no está disponible");
  const blanco = btn("Color del material: Blanco");
  await act(async () => { blanco.focus(); blanco.dispatchEvent(new KeyboardEvent("keydown", { key: " ", code: "Space", bubbles: true })); blanco.dispatchEvent(new KeyboardEvent("keyup", { key: " ", code: "Space", bubbles: true })); });
  expect(onSelect).toHaveBeenCalledWith("blanco-3");
});

it("un tono personalizado mantiene texto y muestra neutral sin perder otras características", async () => {
  const c = { ...candidato, variantes: [{ ...candidato.variantes[0], atributosVarianteJson: { ...candidato.variantes[0].atributosVarianteJson, colorBase: "Pantone 186 C" } }] };
  await act(async () => root.render(<MaterialSelectorColor etiquetaSlot="Sustrato" grupos={crearGruposColores([c])!} selected="blanco-3" onSelect={vi.fn()} />));
  expect(el.textContent).toContain("Pantone 186 C");
  expect(el.textContent).toContain("sin muestra de tono");
  expect(el.textContent).toContain("3 mm");
  expect(el.querySelectorAll('svg[aria-hidden="true"]')).not.toHaveLength(0);
});

it("cambiar color de papel conserva el papel activo mientras se elige el gramaje", async () => {
  const papel: CandidatoMaterialVisual = { ...candidato, materiaPrimaId: "papel", templateId: "sustrato_hoja_v1", label: "Cartulina", variantes: candidato.variantes.map((v, i) => ({ ...v, atributosVarianteJson: { color: i ? "Crema" : "Blanco", gramaje: i === 2 ? 210 : 180, ancho: 65, alto: 95 } })) };
  const segundo = { ...papel, materiaPrimaId: "otro", label: "Otro papel", variantes: [{ ...papel.variantes[0], variantId: "otro" }] };
  const onSelect = vi.fn();
  function Controlado() { const [selected, setSelected] = useState("blanco-3"); return <MaterialSelectorPapel etiquetaSlot="Papel" grupos={crearGruposPapeles([papel, segundo])!} selected={selected} onSelect={(id) => { onSelect(id); setSelected(id); }} />; }
  await act(async () => root.render(<Controlado />));
  await act(async () => btn("Color del papel: Crema").click());
  expect(onSelect).toHaveBeenLastCalledWith("");
  expect(btn("Cartulina").getAttribute("aria-checked")).toBe("true");
  expect(btn("210 g/m²")).not.toBeNull();
  await act(async () => btn("210 g/m²").click());
  expect(onSelect).toHaveBeenLastCalledWith("negro-5");
});

it("los patrones de transparencia no comparten IDs entre selectores", async () => {
  const grupos = crearGruposColores([{ ...candidato, variantes: candidato.variantes.map((v) => ({ ...v, atributosVarianteJson: { ...v.atributosVarianteJson, colorBase: "Cristal" } })) }])!;
  await act(async () => root.render(<><MaterialSelectorColor etiquetaSlot="Frente" grupos={grupos} selected="blanco-3" onSelect={vi.fn()} /><MaterialSelectorColor etiquetaSlot="Dorso" grupos={grupos} selected="negro-5" onSelect={vi.fn()} /></>));
  const ids = [...el.querySelectorAll('svg [id]')].map((e) => e.id);
  expect(new Set(ids).size).toBe(ids.length);
});

it("permite corregir una variante obsoleta aunque haya un único color", async () => {
  const onSelect = vi.fn();
  const grupos = crearGruposColores([{ ...candidato, variantes: [candidato.variantes[0]] }])!;
  await act(async () => root.render(<MaterialSelectorColor etiquetaSlot="Sustrato" grupos={grupos} selected="eliminada" onSelect={onSelect} />));
  expect(el.textContent).toContain("La variante anterior no está disponible");
  await act(async () => btn("3 mm").click());
  expect(onSelect).toHaveBeenCalledWith("blanco-3");
});

it("buscar entre muchos colores conserva la selección visible", async () => {
  const colores = ["Blanco", "Negro", "Rojo", "Azul", "Verde", "Amarillo", "Cristal", "Dorado"];
  const grupos = crearGruposColores([{ ...candidato, variantes: colores.map((color, i) => ({ ...candidato.variantes[0], variantId: `color-${i}`, atributosVarianteJson: { ...candidato.variantes[0].atributosVarianteJson, colorBase: color } })) }])!;
  await act(async () => root.render(<MaterialSelectorColor etiquetaSlot="Sustrato" grupos={grupos} selected="color-1" onSelect={vi.fn()} />));
  const input = el.querySelector<HTMLInputElement>('input')!;
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "Cristal"); input.dispatchEvent(new Event("input", { bubbles: true })); });
  expect(btn("Color del material: Negro").getAttribute("aria-checked")).toBe("true");
  expect(btn("Color del material: Cristal")).not.toBeNull();
  expect(btn("Color del material: Rojo")).toBeNull();
});

it("el color tiñe la placa de espesor sin reemplazarla por una muestra ni repetir el rótulo", async () => {
  const colores = ["Blanco", "Negro", "Rojo", "#123456", "Cristal"];
  const grupos = crearGruposColores([{ ...candidato, variantes: colores.flatMap((color, i) => [20, 30].map((espesor) => ({
    ...candidato.variantes[0], variantId: `${i}-${espesor}`, atributosVarianteJson: { colorBase: color, espesor, ancho: 1.2, alto: .6 },
  }))) }])!;
  for (const [i, fill] of ["#ffffff", "#181a1b", "#cf3537", "#123456", "transparente"].entries()) {
    await act(async () => root.render(<MaterialSelectorColor etiquetaSlot="Sustrato" grupos={grupos} selected={`${i}-20`} onSelect={vi.fn()} />));
    const card = btn("20 mm");
    expect(card.textContent).toBe("20 mm");
    expect(el.textContent).not.toContain("Espesor:");
    expect([...el.querySelectorAll("header span")].some((e) => e.textContent === "Espesor")).toBe(true);
    const placa = card.querySelector("svg > g")!;
    expect(placa.querySelectorAll("path")).toHaveLength(3);
    expect(placa.querySelector("rect")).toBeNull();
    expect(placa.getAttribute("fill")).toContain(fill);
    // La faceta Color sí conserva su muestra rectangular.
    expect(btn(`Color del material: ${colores[i]}`).querySelector("svg > rect")).not.toBeNull();
  }
});

it("conserva formatos e IDs distintos cuando el mismo color tiene un único espesor", async () => {
  const grupos = crearGruposColores([{ ...candidato, variantes: [1.2, 2.4].map((alto, i) => ({
    ...candidato.variantes[0], variantId: `formato-${i}`, atributosVarianteJson: { colorBase: "Negro", espesor: 20, ancho: .6, alto },
  })) }])!;
  const onSelect = vi.fn();
  await act(async () => root.render(<MaterialSelectorColor etiquetaSlot="Sustrato" grupos={grupos} selected="" onSelect={onSelect} />));
  expect(btn("60 × 120 cm").textContent).toContain("20 mm");
  expect(btn("60 × 240 cm").textContent).toContain("20 mm");
  await act(async () => btn("60 × 240 cm").click());
  expect(onSelect).toHaveBeenCalledWith("formato-1");
});
