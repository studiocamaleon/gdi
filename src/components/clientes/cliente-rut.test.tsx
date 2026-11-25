// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { ClienteFicha } from "./cliente-ficha";
import { ConfigRegionalProvider } from "@/components/navigation/config-regional-provider";
import type { ClienteDetalle } from "@/lib/clientes";

const api = vi.hoisted(() => ({
  updateCliente: vi.fn(),
  createCliente: vi.fn(),
}));
vi.mock("@/lib/clientes-api", () => api);
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const cliente: ClienteDetalle = {
  id: "cliente-ficticio",
  nombre: "Cliente de prueba",
  razonSocial: "",
  cuit: "",
  rut: "12345678-5",
  condicionFiscal: "consumidor_final",
  activo: true,
  updatedAt: "2026-11-04T02:00:00Z",
  limiteCredito: null,
  plazoCuentaCorrienteDias: null,
  contacto: "",
  email: "",
  ciudad: "",
  pais: "CL",
  telefonoCodigo: "1",
  telefonoNumero: "2025550199",
  aceptaWhatsapp: null,
  aceptaWhatsappEl: null,
  documentoNumero: null,
  origenAlta: "autoregistro",
  contactos: [],
  direcciones: [],
  eventos: [],
};
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
  vi.stubGlobal("CSS", { escape: (v: string) => v });
  el = document.createElement("div");
  document.body.append(el);
  root = createRoot(el);
  await act(async () =>
    root.render(
      <ConfigRegionalProvider
        regional={{
          monedaCodigo: "CLP",
          zonaHoraria: "America/Santiago",
          redondeoPrecio: "moneda",
          paisCodigo: "CL",
        }}
      >
        <ClienteFicha cliente={cliente} mode="edit" />
      </ConfigRegionalProvider>,
    ),
  );
});
afterEach(async () => {
  await act(async () => root.unmount());
  el.remove();
  vi.unstubAllGlobals();
});
async function cambiarRut(rut: string) {
  await act(async () => {
    const input = el.querySelector<HTMLInputElement>("#cliente-rut")!;
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, rut);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function guardar() {
  await act(async () =>
    el
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
}
it("muestra RUT, permite editarlo y lo incluye al guardar la ficha", async () => {
  expect(el.querySelector<HTMLInputElement>("#cliente-rut")?.value).toBe(
    "12345678-5",
  );
  expect(el.querySelector("#cliente-cuit")).toBeNull();
  expect(el.querySelector("#cliente-documento")).toBeNull();
  expect(el.querySelector("#cliente-condicion-fiscal")).toBeNull();
  api.updateCliente.mockResolvedValue({ ...cliente, rut: "1000005-K" });
  await cambiarRut("1.000.005-k");
  await guardar();
  expect(api.updateCliente).toHaveBeenCalledWith(
    cliente.id,
    expect.objectContaining({ rut: "1.000.005-k", pais: "CL" }),
    cliente.updatedAt,
  );
});
it("muestra el error del verificador antes de guardar", async () => {
  await cambiarRut("12345678-9");
  await guardar();
  expect(api.updateCliente).not.toHaveBeenCalled();
  expect(el.querySelector("#cliente-rut")?.getAttribute("aria-invalid")).toBe(
    "true",
  );
  expect(el.textContent).toContain("Revisá el RUT y su dígito verificador.");
});
