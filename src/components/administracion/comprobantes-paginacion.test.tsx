// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { ComprobantesView } from "./comprobantes-view";
import { DesignSystemProvider } from "@/components/design-system/appearance";
import { PermisosProvider } from "@/components/navigation/permisos-provider";
const mocks = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
}));
it("pagina en el servidor conservando filtros y muestra totales globales con página vacía", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  const div = document.createElement("div");
  document.body.append(div);
  const root = createRoot(div);
  try {
    await act(async () =>
      root.render(
        <DesignSystemProvider theme="brand" appearance="light">
          <PermisosProvider permisos={["administracion.ver"]}>
            <ComprobantesView
              initialComprobantes={[]}
              initialFiltros={{ q: "Árbol", estado: "cae", tipo: "factura" }}
              paginacion={{
                items: [],
                total: 60,
                pagina: 2,
                tamanoPagina: 25,
                resumen: {
                  facturado: 987654,
                  pendiente: 123456,
                  facturasMes: 42,
                  notasMes: 7,
                },
              }}
            />
          </PermisosProvider>
        </DesignSystemProvider>,
      ),
    );
    expect(div.textContent).toContain("987.654");
    expect(div.textContent).toContain("42");
    await act(async () =>
      div
        .querySelector<HTMLButtonElement>('[aria-label="Página siguiente"]')!
        .click(),
    );
    expect(mocks.replace).toHaveBeenLastCalledWith(
      "/administracion/comprobantes?pagina=3&q=%C3%81rbol&estado=cae&tipo=factura",
      { scroll: false },
    );
    const input = div.querySelector<HTMLInputElement>('input[type="search"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )!.set!.call(input, "Histórico");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () =>
      [...div.querySelectorAll("button")]
        .find((b) => b.textContent?.trim() === "Buscar")!
        .click(),
    );
    expect(mocks.replace).toHaveBeenLastCalledWith(
      "/administracion/comprobantes?pagina=1&q=Hist%C3%B3rico&estado=cae&tipo=factura",
      { scroll: false },
    );
    expect(div.textContent).toContain(
      "No encontramos comprobantes con estos filtros",
    );
  } finally {
    await act(async () => root.unmount());
    div.remove();
    vi.unstubAllGlobals();
  }
});
