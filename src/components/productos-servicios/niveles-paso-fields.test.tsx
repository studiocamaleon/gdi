// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NivelesPasoFields } from "./niveles-paso-fields";
import { nivelesDesdePerfiles } from "@/lib/niveles-paso";
vi.mock("./nodos-ui", () => ({
  Input: (props: any) => <input {...props} />,
  NativeButton: (props: any) => <button {...props} />,
  HumanSelect: ({ onValueChange, options, ...props }: any) => (
    <select {...props} onChange={(e) => onValueChange(e.target.value)}>
      {options.map((o: any) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  ),
}));
const maquina = {
  id: "plotter",
  nombre: "Plotter de prueba",
  perfilDefaultId: "simple",
  perfiles: [
    {
      id: "simple",
      nombre: "Simple",
      productivityValue: 8,
      productivityUnit: "m²/h",
    },
    {
      id: "complejo",
      nombre: "Complejo",
      productivityValue: 4,
      productivityUnit: "m²/h",
    },
  ],
};
let root: Root, el: HTMLDivElement;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  el = document.createElement("div");
  document.body.appendChild(el);
  root = createRoot(el);
});
afterEach(async () => {
  await act(async () => root.unmount());
  el.remove();
});
function Caso({
  manual = false,
  anterior = false,
}: {
  manual?: boolean;
  anterior?: boolean;
}) {
  const [params, setParams] = useState<Record<string, unknown>>({});
  return (
    <>
      <NivelesPasoFields
        params={params}
        dotacionDelPaso={1}
        maquinas={manual ? [] : [maquina]}
        tiempoDeMaquina={!manual}
        nivelesAnteriores={anterior ? nivelesDesdePerfiles(maquina) : null}
        onChange={(p) => setParams((a) => ({ ...a, ...p }))}
      />
      <output>{JSON.stringify(params)}</output>
    </>
  );
}
const click = async (text: string) =>
  act(async () => {
    const b = [...el.querySelectorAll("button")].find(
      (b) =>
        b.textContent?.includes(text) || b.getAttribute("aria-label") === text,
    );
    expect(b).toBeDefined();
    b!.click();
  });
it("crea niveles de perfiles y permite cambiarlos sin mostrar el ritmo manual", async () => {
  await act(async () => root.render(<Caso />));
  await click("Crear niveles con los perfiles");
  await click("Editar Complejo");
  const select = el.querySelector("select")!;
  expect(select.value).toBe("complejo");
  expect(el.textContent).not.toContain("Ritmo (por hora)");
  await act(async () => {
    select.value = "simple";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  const params = JSON.parse(el.querySelector("output")!.textContent!);
  expect(params.niveles.opciones[1].overrides.perfilesPorMaquina).toEqual({
    plotter: "simple",
  });
  await click("Quitar los niveles");
  expect(el.textContent).not.toContain("Editar Complejo");
  expect(
    JSON.parse(el.querySelector("output")!.textContent!).nivelesUnificados,
  ).toBe(true);
});
it("conserva controles manuales sin ofrecer un perfil inexistente", async () => {
  await act(async () => root.render(<Caso manual />));
  await click("Este paso viene en niveles");
  await click("Editar Nivel 2");
  expect(el.textContent).toContain("Ritmo (por hora)");
  expect(el.textContent).toContain("Trabajo (min)");
  expect(el.querySelector("select")).toBeNull();
});
it("adapta complejidad anterior sin escribir nada hasta que se modifica", async () => {
  await act(async () => root.render(<Caso anterior />));
  expect(el.querySelector("output")!.textContent).toBe("{}");
  await click("Editar Complejo");
  const select = el.querySelector("select")!;
  expect(select.value).toBe("complejo");
  await act(async () => {
    select.value = "simple";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(
    JSON.parse(el.querySelector("output")!.textContent!).niveles.opciones[1]
      .codigo,
  ).toBe("perfil_complejo");
});
it("la conversión conserva los perfiles expuestos y su predeterminado", () => {
  expect(
    nivelesDesdePerfiles(
      {
        ...maquina,
        perfiles: [
          ...maquina.perfiles,
          { id: "oculto", nombre: "Oculto", productivityValue: 1 },
        ],
      },
      ["complejo"],
    )?.opciones.map((o) => o.codigo),
  ).toEqual(["perfil_simple", "perfil_complejo"]);
});
