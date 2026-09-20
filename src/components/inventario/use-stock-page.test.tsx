// @vitest-environment jsdom
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useInventoryPage } from "./use-stock-page";
import { notifyInventoryChanged } from "@/lib/inventario-navigation";

vi.mock("@/lib/inventario-stock-api", () => ({ getStockPage: vi.fn() }));
type Data = { cantidad: number };
type Params = { varianteId: string };
type Request = {
  signal?: AbortSignal;
  resolve: (data: Data) => void;
  reject: (error: Error) => void;
};
let root: Root;
let container: HTMLDivElement;
let requests: Request[];
let state: ReturnType<typeof useInventoryPage<Data, Params>>;
const load = vi.fn(
  (_params: Params, signal?: AbortSignal) =>
    new Promise<Data>((resolve, reject) => {
      requests.push({ signal, resolve, reject });
    }),
);
function Probe({ varianteId }: Params) {
  const snapshot = useInventoryPage(load, { varianteId });
  useEffect(() => {
    state = snapshot;
  }, [snapshot]);
  return null;
}
async function render(varianteId: string) {
  await act(async () => {
    root.render(<Probe varianteId={varianteId} />);
  });
  await act(async () => {
    vi.advanceTimersByTimeAsync(200);
  });
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  requests = [];
  load.mockClear();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("consultas de inventario al cambiar filtros", () => {
  it("descarta una respuesta tardía de otra variante y no mezcla saldos", async () => {
    await render("placa");
    await render("tinta");
    expect(requests[0].signal?.aborted).toBe(true);
    await act(async () => {
      requests[1].resolve({ cantidad: 250 });
    });
    await act(async () => {
      requests[0].resolve({ cantidad: 10 });
    });
    expect(state.result).toEqual({ cantidad: 250 });
    await act(async () => {
      root.render(<Probe varianteId="papel" />);
    });
    expect(state.result).toBeNull();
    expect(state.loading).toBe(true);
  });

  it("distingue un fallo de consulta de una existencia cero", async () => {
    await render("placa");
    await act(async () => {
      requests[0].reject(new Error("Sin conexión"));
    });
    expect(state).toMatchObject({
      result: null,
      loading: false,
      error: "Sin conexión",
    });
    await act(async () => {
      state.refresh();
    });
    await act(async () => {
      vi.advanceTimersByTimeAsync(200);
    });
    await act(async () => {
      requests[1].resolve({ cantidad: 0 });
    });
    expect(state).toMatchObject({
      result: { cantidad: 0 },
      loading: false,
      error: null,
    });
  });

  it("actualiza después de un movimiento conservando el saldo mientras consulta", async () => {
    await render("placa");
    await act(async () => {
      requests[0].resolve({ cantidad: 10 });
    });
    await act(async () => {
      notifyInventoryChanged();
    });
    expect(state).toMatchObject({ result: { cantidad: 10 }, loading: false });
    await act(async () => {
      vi.advanceTimersByTimeAsync(200);
    });
    await act(async () => {
      requests[1].resolve({ cantidad: 12 });
    });
    expect(state.result).toEqual({ cantidad: 12 });
  });
});
