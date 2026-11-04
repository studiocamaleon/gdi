// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { RegistroClientePublico } from "./registro-cliente-publico";

const api = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock("@/lib/api", () => api);

let root: Root, el: HTMLDivElement;
beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  el = document.createElement("div");
  document.body.append(el);
  root = createRoot(el);
  await act(async () =>
    root.render(
      <RegistroClientePublico
        token="enlace-ficticio"
        empresa="Taller ficticio"
        paisCodigo="CL"
      />,
    ),
  );
});
afterEach(async () => {
  await act(async () => root.unmount());
  el.remove();
  vi.unstubAllGlobals();
});
async function completar() {
  await act(async () => {
    for (const [name, value] of Object.entries({
      nombre: "Cliente ficticio",
      documentoNumero: "1.000.005-k",
      direccion: "Calle de prueba 123",
      ciudad: "Comuna ficticia",
    })) {
      el.querySelector<HTMLInputElement>(`input[name="${name}"]`)!.value =
        value;
    }
    const telefono = el.querySelector<HTMLInputElement>('input[type="tel"]')!;
    const pegado = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(pegado, "clipboardData", {
      value: { getData: () => "+56 9 8765 4321" },
    });
    telefono.focus();
    telefono.dispatchEvent(pegado);
  });
}
async function enviar() {
  await act(async () => {
    el.querySelector("form")!.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
  });
}
it("envía RUT y teléfono chileno, y muestra la confirmación de la solicitud", async () => {
  api.apiRequest.mockResolvedValue({ recibida: true });
  await completar();
  await enviar();
  expect(api.apiRequest, el.textContent ?? "").toHaveBeenCalledTimes(1);
  const [url, opciones, autenticacion] = api.apiRequest.mock.calls[0];
  expect(url).toBe("/registro-clientes/enlace-ficticio");
  const cuerpo = JSON.parse(opciones.body);
  expect(cuerpo).toMatchObject({
    documentoTipo: "RUT",
    documentoNumero: "1.000.005-k",
    telefono: "+56987654321",
  });
  expect(cuerpo).not.toHaveProperty("condicionFiscal");
  expect(cuerpo).not.toHaveProperty("tenantId");
  expect(autenticacion).toEqual({ auth: false });
  expect(el.textContent).toContain("Solicitud recibida");
  expect(el.querySelector("form")).toBeNull();
});
it("conserva los datos y muestra el rechazo del RUT para poder corregirlo", async () => {
  api.apiRequest.mockRejectedValue(
    new Error("Revisá el RUT y su dígito verificador."),
  );
  await completar();
  await enviar();
  expect(el.querySelector('[role="alert"]')?.textContent).toContain(
    "Revisá el RUT",
  );
  expect(
    el.querySelector<HTMLInputElement>('[name="documentoNumero"]')?.value,
  ).toBe("1.000.005-k");
});
