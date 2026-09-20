// @vitest-environment jsdom
import { act, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { usePrevisionMateriales } from "./use-prevision-materiales";
import {
  consultarPrevisionMateriales,
  type PrevisionMateriales,
} from "@/lib/prevision-materiales";
import type { PropuestaItem } from "@/lib/propuestas";
vi.mock("@/lib/prevision-materiales", () => ({
  consultarPrevisionMateriales: vi.fn(),
  solicitudPrevisionMateriales: (items: PropuestaItem[]) => ({
    materiales: items.map((i) => ({ varianteId: i.id })),
    pendientes: 0,
  }),
}));
let root: ReturnType<typeof createRoot>, container: HTMLDivElement;
let vista: ReturnType<typeof usePrevisionMateriales>;
function Panel({
  items,
  enabled = true,
}: {
  items: PropuestaItem[];
  enabled?: boolean;
}) {
  const actual = usePrevisionMateriales(items, enabled);
  useEffect(() => {
    vista = actual;
  }, [actual]);
  return (
    <span>
      {actual.data?.estado ?? (actual.loading ? "consultando" : "sin datos")}
    </span>
  );
}
const items = (id: string) => [{ id }] as PropuestaItem[];
beforeEach(() => {
  vi.useFakeTimers();
  vi.resetAllMocks();
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  vi.useRealTimers();
});
it("una respuesta vieja no valida los materiales de una cotización nueva", async () => {
  const pendientes: Array<(data: PrevisionMateriales) => void> = [];
  vi.mocked(consultarPrevisionMateriales).mockImplementation(
    () => new Promise((resolve) => pendientes.push(resolve)),
  );
  await act(async () => root.render(<Panel items={items("a")} />));
  await act(async () => vi.advanceTimersByTime(200));
  await act(async () => root.render(<Panel items={items("b")} />));
  expect(vista.data).toBeNull();
  expect(
    vi.mocked(consultarPrevisionMateriales).mock.calls[0][1]?.aborted,
  ).toBe(true);
  await act(async () => vi.advanceTimersByTime(200));
  await act(async () =>
    pendientes[1]({ estado: "por_confirmar" } as PrevisionMateriales),
  );
  await act(async () =>
    pendientes[0]({ estado: "disponible" } as PrevisionMateriales),
  );
  expect(vista.data?.estado).toBe("por_confirmar");
});
it("no consulta ni reutiliza previsiones al abrir una OT ya emitida", async () => {
  await act(async () =>
    root.render(<Panel items={items("a")} enabled={false} />),
  );
  await act(async () => vi.advanceTimersByTime(61000));
  expect(consultarPrevisionMateriales).not.toHaveBeenCalled();
  expect(vista.data).toBeNull();
});
