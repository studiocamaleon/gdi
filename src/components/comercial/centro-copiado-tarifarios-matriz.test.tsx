// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { EditorMatriz } from "./centro-copiado-tarifarios-matriz";
import {
  contenidoInicial,
  filasOferta,
  type MatrizHojas,
} from "@/lib/centro-copiado-tarifarios-editor";
import { configTarifarios } from "@/lib/__fixtures__/tarifarios";
import { toast } from "sonner";
// El selector Base UI necesita geometría real; se verifica aparte en navegador.
vi.mock("./centro-copiado-tarifarios-controles", async (original) => ({
  ...(await original<object>()),
  Elegir: ({
    etiqueta,
    valor,
    opciones,
    onChange,
  }: {
    etiqueta: string;
    valor: string;
    opciones: { value: string; label: string }[];
    onChange: (v: string) => void;
  }) => (
    <label>
      {etiqueta}
      <select value={valor} onChange={(e) => onChange(e.target.value)}>
        {opciones.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  ),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
let root: Root, el: HTMLDivElement, ultima: MatrizHojas;
beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(globalThis, {
    IS_REACT_ACT_ENVIRONMENT: true,
    ResizeObserver: class {
      observe() {}
      disconnect() {}
      unobserve() {}
    },
  });
  el = document.createElement("div");
  document.body.appendChild(el);
  root = createRoot(el);
});
afterEach(async () => {
  await act(async () => root.unmount());
  el.remove();
});
function Harness({
  inicial,
  disabled = false,
}: {
  inicial: MatrizHojas;
  disabled?: boolean;
}) {
  const [m, setM] = useState(inicial);
  return (
    <EditorMatriz
      matriz={m}
      nombres={{
        [configTarifarios.disponibles.papeles[0].materiaPrimaId]:
          "Obra ficticia",
      }}
      disabled={disabled}
      onChange={(v) => {
        ultima = v as MatrizHojas;
        setM(ultima);
      }}
      onGenerar={() => {}}
    />
  );
}
async function render(disabled = false) {
  const m = contenidoInicial("ARS").hojas!;
  m.reglas.cobertura = "DIFERENCIADA";
  m.filas = filasOferta(configTarifarios, m);
  m.filas.forEach((f) =>
    f.precios.forEach((p) => {
      p.precioUnitario = "100";
    }),
  );
  ultima = m;
  await act(async () =>
    root.render(<Harness inicial={m} disabled={disabled} />),
  );
}
async function click(texto: string) {
  const b = [...document.querySelectorAll<HTMLButtonElement>("button")].find(
    (b) => b.textContent === texto,
  )!;
  expect(b).toBeTruthy();
  await act(async () => b.click());
}
async function escribir(input: HTMLInputElement, texto: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, texto);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
const precios = () => [
  ...el.querySelectorAll<HTMLInputElement>('input[placeholder="Pendiente"]'),
];
it("cambiar color y cobertura conserva los precios en su combinación exacta", async () => {
  await render();
  const etiqueta = precios()[0].getAttribute("aria-label")!;
  expect(etiqueta).toContain("CMYK");
  expect(etiqueta).toContain("normal");
  await escribir(precios()[0], "321,12");
  await click("Alta");
  expect(
    precios().every(
      (p) =>
        p.getAttribute("aria-label")!.includes("alta") && p.value === "100",
    ),
  ).toBe(true);
  await click("Blanco y negro · K");
  expect(
    precios().every((p) => p.getAttribute("aria-label")!.includes(" · K · ")),
  ).toBe(true);
  await click("Color · CMYK");
  await click("Normal");
  expect(
    precios().find((p) => p.getAttribute("aria-label") === etiqueta)!.value,
  ).toBe("321,12");
  expect(
    ultima.filas
      .flatMap((f) => f.precios)
      .filter((p) => p.precioUnitario === "321,12"),
  ).toHaveLength(1);
});
it("el ajuste masivo usa todos los tramos del color, cobertura y búsqueda elegidos", async () => {
  await render();
  await click("Alta");
  await escribir(
    el.querySelector<HTMLInputElement>(
      'input[placeholder="Papel, gramaje, tamaño, faz o cobertura"]',
    )!,
    "150 g",
  );
  await click("Ajustar precios");
  const label = [...document.querySelectorAll("label")].find(
    (l) => l.textContent === "Porcentaje de ajuste",
  )!;
  await escribir(
    document.getElementById(label.htmlFor) as HTMLInputElement,
    "10",
  );
  await click("Revisar ajuste");
  expect(document.body.textContent).toContain("Revisar 6 celdas");
  await click("Aplicar al borrador");
  ultima.filas.forEach((f) => {
    const objetivo =
      f.combinacion.color === "COLOR" &&
      f.combinacion.cobertura === "alta" &&
      f.combinacion.gramaje === 150;
    expect(
      f.precios.every((p) => p.precioUnitario === (objetivo ? "110" : "100")),
    ).toBe(true);
  });
});
it("el pegado muestra revisión y aplica simple/doble del mismo tramo", async () => {
  await render();
  const input = precios()[0];
  await act(async () => {
    const evento = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(evento, "clipboardData", {
      value: { getData: () => "123\t456" },
    });
    input.dispatchEvent(evento);
  });
  expect(document.body.textContent).toContain("Revisar 2 celdas");
  expect(precios()[0].value).toBe("100");
  await click("Aplicar al borrador");
  expect(
    precios()
      .slice(0, 3)
      .map((p) => p.value),
  ).toEqual(["123", "456", "100"]);
  expect(toast.error).not.toHaveBeenCalled();
});
it("las versiones de consulta permiten cambiar de vista pero no modificar sus celdas", async () => {
  await render(true);
  await click("Alta");
  await click("Blanco y negro · K");
  expect(precios().length).toBeGreaterThan(0);
  expect(precios().every((p) => p.disabled)).toBe(true);
});
