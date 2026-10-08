// @vitest-environment jsdom
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { TelefonoField } from "./telefono-field";
vi.mock("@/components/ui/select-buscable", () => ({
  SelectBuscable: ({
    opciones: options,
    value,
    onChange,
    id,
  }: {
    opciones: { value: string; label: string }[];
    value: string;
    onChange: (v: string) => void;
    id: string;
  }) => (
    <select
      id={id}
      aria-label="País del teléfono"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  ),
}));
let root: Root, el: HTMLDivElement;
function Form({
  pais = "AR",
  codigo = "54",
}: {
  pais?: string;
  codigo?: string;
}) {
  const [tel, setTel] = React.useState({ codigo, numero: "" });
  return (
    <TelefonoField
      id="telefono"
      label="Teléfono"
      pais={pais}
      codigo={tel.codigo}
      numero={tel.numero}
      onChange={(codigo, numero) => setTel({ codigo, numero })}
    />
  );
}
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  el = document.createElement("div");
  document.body.append(el);
  root = createRoot(el);
});
afterEach(async () => {
  await act(async () => root.unmount());
  el.remove();
  vi.unstubAllGlobals();
});
function pegar(text: string) {
  const e = new Event("paste", { bubbles: true, cancelable: true });
  Object.defineProperty(e, "clipboardData", { value: { getData: () => text } });
  el.querySelector("input")!.dispatchEvent(e);
}
it("inicia con el país del tenant recibido y permite cambiarlo", async () => {
  await act(async () => root.render(<Form pais="UY" codigo="598" />));
  expect(el.querySelector("select")!.value).toBe("UY");
  await act(async () => {
    el.querySelector("select")!.value = "CL";
    el.querySelector("select")!.dispatchEvent(
      new Event("change", { bubbles: true }),
    );
  });
  expect(el.querySelector("select")!.value).toBe("CL");
});
it("pega un internacional con formato y muestra sólo el número nacional", async () => {
  await act(async () => root.render(<Form />));
  await act(async () => pegar("+54 9 341 555-1840"));
  expect(el.querySelector("input")!.value).toBe("93415551840");
  expect(el.textContent).toContain("Número completo: +54 9 341 555 1840");
});
it("detecta el país de un teléfono internacional extranjero", async () => {
  await act(async () => root.render(<Form />));
  await act(async () => pegar("+1 (415) 555-2671"));
  expect(el.querySelector("select")!.value).toBe("US");
  expect(el.querySelector("input")!.value).toBe("4155552671");
});
it("rechaza un pegado ambiguo sin transformarlo en otro número", async () => {
  await act(async () => root.render(<Form />));
  await act(async () => pegar("+54 +54 9 341 555-1840"));
  expect(el.querySelector("input")!.value).toBe("");
  expect(el.querySelector("input")!.getAttribute("aria-invalid")).toBe("true");
  expect(el.textContent).toContain("sin repetir el código de país");
});
