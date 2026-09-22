// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AlmacenamientoView } from "./almacenamiento-view";
const mocks = vi.hoisted(() => ({ uso: vi.fn() }));
vi.mock("@/lib/archivos-api", () => ({ getUsoAlmacenamiento: mocks.uso }));
vi.mock("@/components/configuracion/configuracion-workspace", () => ({
  ConfiguracionPage: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  ConfiguracionHeader: () => <h1>Almacenamiento</h1>,
}));
let container: HTMLDivElement, root: Root;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  root = createRoot(container);
  document.body.append(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
const uso = {
  bytes: 1024,
  bytesReservados: 512,
  bytesComprometidos: 1536,
  cargasPendientes: 2,
  cuotaBytes: 2048,
  cuotaOrigen: "ajuste",
  porcentaje: 75,
  restanteBytes: 512,
  excedidoBytes: 0,
  porScope: [],
  papelera: { bytes: 0, cantidad: 0 },
  plan: null,
};
it("distingue archivos guardados, reservas y espacio realmente libre", async () => {
  mocks.uso.mockResolvedValue(uso);
  await act(async () => root.render(<AlmacenamientoView />));
  expect(container.textContent).toContain("guardados");
  expect(container.textContent).toContain("reservados en 2 cargas en curso");
  expect(container.textContent).toContain("75% usado");
});
it("explica el exceso sin sugerir que se pierde acceso a los archivos", async () => {
  mocks.uso.mockResolvedValue({
    ...uso,
    cuotaBytes: 1024,
    porcentaje: 100,
    restanteBytes: 0,
    excedidoBytes: 512,
  });
  await act(async () => root.render(<AlmacenamientoView />));
  expect(container.textContent).toContain("Superaste el cupo");
  expect(container.textContent).toContain(
    "Tus archivos guardados siguen disponibles",
  );
});
