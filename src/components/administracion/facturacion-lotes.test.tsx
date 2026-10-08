// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { FacturacionLotes } from "./facturacion-lotes";
import type { LoteFacturacion } from "@/lib/administracion-api";
const api = vi.hoisted(() => ({
  listar: vi.fn(),
  obtener: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("@/lib/administracion-api", () => ({
  listarLotesFacturacion: api.listar,
  obtenerLoteFacturacion: api.obtener,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: api.refresh }),
}));
let root: Root, el: HTMLDivElement;
const lote = (): LoteFacturacion => ({
  id: "lote",
  estado: "esperando_envios",
  createdAt: "2026-10-08T18:00:00Z",
  items: [
    {
      id: "item",
      ordenIds: ["ot"],
      numeros: ["OT-123"],
      estado: "emitida",
      comprobanteId: "factura",
      error: null,
      avisoEstado: "pendiente",
      avisoDetalle: null,
      pdfEstado: "listo",
    },
  ],
});
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  el = document.createElement("div");
  document.body.append(el);
  root = createRoot(el);
});
afterEach(async () => {
  await act(async () => root.unmount());
  el.remove();
  window.history.replaceState({}, "", "/");
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it("recupera el lote al entrar y distingue factura emitida de envío confirmado", async () => {
  api.listar.mockResolvedValue([lote()]);
  await act(async () => root.render(<FacturacionLotes revision={0} />));
  expect(el.textContent).toContain("Esperando confirmación de los envíos");
  expect(el.textContent).toContain("Factura emitida");
  expect(el.textContent).toContain("Aviso pendiente");
  expect(el.querySelector("a")?.getAttribute("href")).toBe(
    "/administracion/comprobantes/factura",
  );
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  const final = lote();
  final.estado = "completado";
  final.items[0].avisoEstado = "enviada";
  api.listar.mockResolvedValue([final]);
  await act(async () => vi.advanceTimersByTimeAsync(5_000));
  expect(el.textContent).toContain("Facturas y envíos completados");
  expect(api.refresh).toHaveBeenCalledTimes(1);
});
it("conserva el último avance si falla una consulta y recupera la conexión", async () => {
  api.listar
    .mockResolvedValueOnce([lote()])
    .mockRejectedValueOnce(new Error("Sin red"))
    .mockResolvedValue([lote()]);
  await act(async () => root.render(<FacturacionLotes revision={0} />));
  await act(async () => vi.advanceTimersByTimeAsync(5_000));
  expect(el.textContent).toContain("No pudimos actualizar el avance");
  expect(el.textContent).toContain("OT-123");
  await act(async () => vi.advanceTimersByTimeAsync(15_000));
  expect(el.textContent).not.toContain("No pudimos actualizar el avance");
  expect(el.textContent).toContain("OT-123");
});

it("abre desde la campanita un lote anterior a los veinte más recientes", async () => {
  const anterior = lote();
  anterior.id = "11111111-1111-4111-8111-111111111111";
  anterior.estado = "con_observaciones";
  window.history.replaceState({}, "", `/?lote=${anterior.id}`);
  api.listar.mockResolvedValue([]);
  api.obtener.mockResolvedValue(anterior);
  await act(async () => root.render(<FacturacionLotes revision={0} />));
  expect(api.obtener).toHaveBeenCalledWith(anterior.id);
  expect(el.querySelector("details")?.open).toBe(true);
  expect(el.textContent).toContain("Terminado con observaciones");
});
