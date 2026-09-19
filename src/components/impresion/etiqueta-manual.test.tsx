// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { EtiquetaOrdenDialog } from "./etiqueta-orden-dialog";
import { CapacidadesProvider } from "../navigation/capacidades-provider";
const mocks = vi.hoisted(() => ({
  vista: vi.fn(),
  configuracion: vi.fn(),
  descargar: vi.fn(),
  qz: vi.fn(),
}));
vi.mock("@/lib/impresion-api", () => ({
  getVistaEtiqueta: mocks.vista,
  getConfiguracionImpresion: mocks.configuracion,
}));
vi.mock("@/lib/etiqueta-pdf", () => ({
  descargarEtiquetaPdf: mocks.descargar,
}));
vi.mock("@/lib/qz-impresion", () => {
  mocks.qz();
  return { imprimirOrden: vi.fn() };
});
vi.mock("@/components/design-system/appearance", () => ({
  DesignSystemProvider: ({ children }: { children: ReactNode }) => (
    <>{children}</>
  ),
}));
vi.mock("@/components/design-system/form-dialog", () => ({
  FormDialog: ({ title, children }: { title: string; children: ReactNode }) => (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  ),
}));
vi.mock("@/components/design-system/action-button", () => ({
  ActionButton: ({
    children,
    onPress,
    isDisabled,
  }: {
    children: ReactNode;
    onPress?: () => void;
    isDisabled?: boolean;
  }) => (
    <button onClick={onPress} disabled={isDisabled}>
      {children}
    </button>
  ),
}));
let root: Root, el: HTMLDivElement;
afterEach(async () => {
  await act(async () => root.unmount());
  el.remove();
  vi.clearAllMocks();
});
it("descarga la etiqueta sin consultar certificados, cargar QZ ni pedir una impresora", async () => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  const vista = { numero: "OT-0070", paginas: ["data:image/png;base64,AA=="] };
  mocks.vista.mockResolvedValue(vista);
  el = document.createElement("div");
  document.body.append(el);
  root = createRoot(el);
  await act(async () =>
    root.render(
      <CapacidadesProvider capacidades={{ impresionDirecta: false }}>
        <EtiquetaOrdenDialog ordenId="ot" onClose={() => {}} />
      </CapacidadesProvider>,
    ),
  );
  expect(mocks.vista).toHaveBeenCalledWith("ot");
  expect(mocks.configuracion).not.toHaveBeenCalled();
  expect(mocks.qz).not.toHaveBeenCalled();
  expect(el.textContent).not.toContain("Imprimir etiqueta");
  expect(el.textContent).not.toContain("Copias de cada etiqueta");
  const boton = [...el.querySelectorAll("button")].find(
    (b) => b.textContent === "Descargar PDF",
  )!;
  await act(async () => boton.click());
  expect(mocks.descargar).toHaveBeenCalledWith(vista);
});
