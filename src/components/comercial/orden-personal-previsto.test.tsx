// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { OrdenPersonalPrevisto } from "./orden-personal-previsto";
import { OrdenAccionesMenus } from "./orden-acciones-menus";
const api = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api", () => ({ apiRequest: api }));
let el: HTMLDivElement, root: Root;
const producto = {
  id: "p1",
  nombre: "Documento ficticio",
  cotizacionItemId: "q1",
  asignacionesPersonal: [{ nodoClave: "imprimir", empleadoIds: ["ana"] }],
};
const resultado = {
  zona: "America/Argentina/Rio_Gallegos",
  items: [
    {
      cotizacionItemId: "q1",
      aviso: null,
      pasos: [
        {
          nodoClave: "imprimir",
          nombre: "Impresión",
          estacion: "Copiado",
          maquina: "Equipo 1",
          personasNecesarias: 1,
          motivo: null,
          candidatos: [
            {
              id: "ana",
              nombre: "Ana",
              tieneHorario: true,
              asignacionAutomatica: false,
            },
          ],
          finElegido: "2026-10-05T13:00:00Z",
          finAutomatico: "2026-10-05T12:00:00Z",
        },
      ],
    },
  ],
};
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  el = document.createElement("div");
  document.body.appendChild(el);
  root = createRoot(el);
  api.mockReset().mockResolvedValue(resultado);
});
afterEach(async () => {
  await act(async () => root.unmount());
  el.remove();
  vi.unstubAllGlobals();
});
const boton = (texto: string) =>
  [...document.querySelectorAll<HTMLButtonElement>("button")].find(
    (b) => b.textContent?.trim() === texto,
  )!;
const click = async (texto: string) => act(async () => boton(texto).click());
it("consulta al abrir, exige revisar y aplica sin guardar por su cuenta", async () => {
  const preparar = vi.fn().mockResolvedValue([producto]),
    onChange = vi.fn();
  await act(async () =>
    root.render(
      <OrdenPersonalPrevisto
        productos={[producto]}
        preparar={preparar}
        onChange={onChange}
      />,
    ),
  );
  expect(api).not.toHaveBeenCalled();
  await click("Elegir operadores");
  expect(preparar).toHaveBeenCalledOnce();
  expect(boton("Aplicar elección").disabled).toBe(true);
  await click("Revisar disponibilidad");
  expect(boton("Aplicar elección").disabled).toBe(false);
  await click("Aplicar elección");
  expect(onChange.mock.calls[0][0].get("p1")).toEqual(
    producto.asignacionesPersonal,
  );
  expect(
    api.mock.calls.every(([url]) =>
      String(url).endsWith("/personal-previsto/revisar"),
    ),
  ).toBe(true);
});
it("si cambia la cotización con el panel abierto, impide aplicar la selección anterior", async () => {
  const props = { preparar: async () => [producto], onChange: vi.fn() };
  await act(async () =>
    root.render(<OrdenPersonalPrevisto {...props} productos={[producto]} />),
  );
  await click("Elegir operadores");
  await click("Revisar disponibilidad");
  await act(async () =>
    root.render(
      <OrdenPersonalPrevisto
        {...props}
        productos={[{ ...producto, cotizacionItemId: "q2" }]}
      />,
    ),
  );
  expect(boton("Aplicar elección").disabled).toBe(true);
  expect(el.textContent).toContain("Cambió un producto");
});
it("sin edición no abre ni solicita información de personal", async () => {
  const preparar = vi.fn();
  await act(async () =>
    root.render(
      <OrdenPersonalPrevisto
        productos={[producto]}
        preparar={preparar}
        onChange={vi.fn()}
        disabled
      />,
    ),
  );
  await click("Elegir operadores");
  expect(preparar).not.toHaveBeenCalled();
  expect(api).not.toHaveBeenCalled();
});
it("sin acciones de impresión conserva un solo acceso a Seguimiento", async () => {
  await act(async () => root.render(<OrdenAccionesMenus qr={vi.fn()} />));
  expect(document.querySelector('button[aria-label="Imprimir"]')).toBeNull();
  expect(
    document.querySelectorAll('button[aria-label="Seguimiento"]'),
  ).toHaveLength(1);
});
