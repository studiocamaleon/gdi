// @vitest-environment jsdom
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ClienteLista, type ClienteOpcion } from "./cliente-selector-orden";
import { useClientesOrden } from "./use-clientes-orden";
import { OrdenSummaryDetails } from "./orden-summary-details";

const api = vi.hoisted(() => ({ listClientes: vi.fn() }));
vi.mock("@/lib/clientes-api", () => api);
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const cliente: ClienteOpcion = { id: "cliente-fuera-de-pagina", nombre: "Zeta ficticio", razonSocial: "", email: "" };
const primeraPagina = Array.from({ length: 30 }, (_, i) => ({ ...cliente, id: `cliente-${i}`, nombre: `Cliente ficticio ${i}` }));
let el: HTMLDivElement, root: Root;
let selector: ReturnType<typeof useClientesOrden>;
function Ficha({ clientes = primeraPagina }: { clientes?: ClienteOpcion[] }) {
  const result = useClientesOrden(clientes, cliente);
  useEffect(() => { selector = result; });
  return <ClienteLista value={cliente.id} onChange={vi.fn()} {...result} />;
}
beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.stubGlobal("CSS", { escape: (value: string) => value });
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  api.listClientes.mockResolvedValue({ data: [] });
  el = document.createElement("div"); document.body.appendChild(el); root = createRoot(el);
});
afterEach(async () => { await act(async () => root.unmount()); el.remove(); vi.unstubAllGlobals(); });

it("muestra el cliente asignado aunque no esté entre los primeros 30", async () => {
  await act(async () => root.render(<Ficha />));
  expect(el.textContent).toContain("Zeta ficticio");
  expect(selector.options).toHaveLength(31);
  expect(api.listClientes).not.toHaveBeenCalled();
});
it("mantiene la selección si falla el listado; consultar no exige abrir CRM", async () => {
  api.listClientes.mockRejectedValue(new Error("Sin acceso al listado"));
  await act(async () => root.render(<Ficha clientes={[]} />));
  await act(async () => selector.onOpenChange(true));
  expect(el.textContent).toContain("Zeta ficticio");
  expect(selector.error).toContain("No se pudieron cargar clientes");
});
it("una búsqueda actualiza los datos sin duplicar ni perder el cliente seleccionado", async () => {
  api.listClientes.mockResolvedValue({ data: [{ ...cliente, nombre: "Zeta actualizado", telefonoCodigo: "+1", telefonoNumero: "2025550142" }] });
  await act(async () => root.render(<Ficha />));
  await act(async () => selector.onOpenChange(true));
  expect(selector.options.filter(c => c.id === cliente.id)).toHaveLength(1);
  expect(el.textContent).toContain("Zeta actualizado");
});
it("copia el teléfono desde el resumen de lectura, sin controles de edición", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  await act(async () => root.render(<OrdenSummaryDetails cliente="Zeta ficticio" clienteTelefono="+1 202 555 0142" fecha="06/10/2026" vendedor="Vendedora ficticia">{null}</OrdenSummaryDetails>));
  await act(async () => el.querySelector<HTMLButtonElement>('button[aria-label="Copiar teléfono del cliente"]')!.click());
  expect(writeText).toHaveBeenCalledWith("+1 202 555 0142");
  expect(el.textContent).not.toContain("Editar orden");
});
it("explica cuando el cliente no tiene teléfono", async () => {
  await act(async () => root.render(<OrdenSummaryDetails cliente="Zeta ficticio" clienteTelefono={null} fecha="06/10/2026" vendedor="Vendedora ficticia">{null}</OrdenSummaryDetails>));
  expect(el.textContent).toContain("Sin teléfono");
  expect(el.querySelector('button[aria-label="Copiar teléfono del cliente"]')).toBeNull();
});

it("el buscador visible acepta nombres y razón social sin sus tildes", async () => {
  const clientes = [{ ...cliente, id: "maria", nombre: "María Núñez", razonSocial: "Diseño Ágil" }, { ...cliente, id: "otro", nombre: "Otro cliente" }];
  await act(async () => root.render(<ClienteLista value="" onChange={vi.fn()} options={clientes} />));
  await act(async () => el.querySelector<HTMLButtonElement>('button')!.click());
  const input = document.querySelector<HTMLInputElement>('input[placeholder="Buscar cliente…"]')!;
  for (const texto of ["maria", "nunez", "diseno agil"]) {
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, texto);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const opciones = [...document.querySelectorAll('[role="option"]')].map((o) => o.textContent);
    expect(opciones.some((o) => o?.includes("María Núñez"))).toBe(true);
    expect(opciones.some((o) => o?.includes("Otro cliente"))).toBe(false);
  }
});
