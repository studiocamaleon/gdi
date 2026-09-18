// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  DocumentosImpresionProvider,
  useImpresionDocumentos,
} from "./documentos-impresion-provider";
import type { EnvioDocumento, VistaDocumentos } from "@/lib/impresion-api";

const mocks = vi.hoisted(() => ({
  vista: vi.fn(),
  estado: vi.fn(),
  imprimir: vi.fn(),
  escuchar: vi.fn(),
  cerrar: vi.fn(),
}));
vi.mock("@/lib/impresion-api", () => ({
  getDocumentosOrden: mocks.vista,
  registrarEstadoDocumento: mocks.estado,
}));
vi.mock("@/lib/qz-impresion", () => ({
  imprimirDocumentoOrden: mocks.imprimir,
  escucharImpresora: mocks.escuchar,
}));
vi.mock("@/lib/impresora-puesto", () => ({
  leerImpresora: () => ({ host: "localhost", impresora: "RICOH" }),
}));
vi.mock("@/components/design-system/appearance", () => ({
  DesignSystemProvider: ({ children }: { children: ReactNode }) => (
    <>{children}</>
  ),
}));
vi.mock("@/components/design-system/form-dialog", () => ({
  FormDialog: ({
    isOpen,
    title,
    children,
  }: {
    isOpen: boolean;
    title: string;
    children: ReactNode;
  }) =>
    isOpen ? (
      <section>
        <h2>{title}</h2>
        {children}
      </section>
    ) : null,
}));
vi.mock("@/components/design-system/action-button", () => ({
  ActionButton: ({
    onPress,
    isDisabled,
    children,
  }: {
    onPress: () => void;
    isDisabled?: boolean;
    children: ReactNode;
  }) => (
    <button disabled={isDisabled} onClick={onPress}>
      {children}
    </button>
  ),
}));
vi.mock("./impresora-puesto-form", () => ({ ImpresoraPuestoForm: () => null }));
function Abrir() {
  const impresion = useImpresionDocumentos();
  return <button onClick={() => impresion.abrir("ot", true)}>Emitida</button>;
}
let root: Root;
let el: HTMLDivElement;
let vista: VistaDocumentos;
const base: EnvioDocumento = {
  id: "envio",
  itemId: "item",
  nombre: "Documento.pdf",
  copias: 2,
  paginas: 3,
  hojas: 4,
  faz: 2,
  host: "localhost",
  impresora: "RICOH",
  jobName: "Grafo OT-1 envio",
  estado: "PREPARADO",
  fecha: new Date().toISOString(),
  actualizadoEl: new Date().toISOString(),
  usuario: "Operario",
  eventos: [],
};
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.clearAllMocks();
  el = document.createElement("div");
  document.body.appendChild(el);
  root = createRoot(el);
  vista = {
    ordenId: "ot",
    numero: "OT-1",
    estado: "pendiente",
    documentos: [
      {
        itemId: "item",
        nombre: base.nombre,
        copias: 2,
        paginas: 3,
        hojas: 4,
        faz: 2,
        motivo: null,
        archivos: ["archivo"],
        documentos: 1,
      },
    ],
    historial: [],
  };
  mocks.vista.mockImplementation(async () => structuredClone(vista));
  mocks.estado.mockResolvedValue(base);
  mocks.escuchar.mockResolvedValue({
    cerrar: mocks.cerrar,
    consultar: vi.fn(),
  });
  mocks.imprimir.mockImplementation(
    async (_tenant, _config, _orden, _item, _intento, _anterior, preparado) => {
      preparado(base);
      return base;
    },
  );
});
afterEach(async () => {
  await act(async () => root.unmount());
  el.remove();
});
async function click(text: string) {
  const button = Array.from(el.querySelectorAll("button")).find(
    (b) => b.textContent === text,
  );
  expect(button, text).toBeDefined();
  await act(async () => button!.click());
}
async function montar() {
  await act(async () =>
    root.render(
      <DocumentosImpresionProvider tenantId="tenant">
        <Abrir />
      </DocumentosImpresionProvider>,
    ),
  );
}
it("sigue recibiendo eventos al minimizar y conserva COMPLETE después del ACK/DELETED", async () => {
  await montar();
  await click("Emitida");
  expect(mocks.imprimir).toHaveBeenCalledTimes(1);
  expect(el.textContent).toContain("Enviado a Windows");
  await click("Minimizar");
  expect(mocks.cerrar).not.toHaveBeenCalled();
  const recibir = mocks.escuchar.mock.calls[0][2];
  await act(async () => {
    recibir({
      printerName: "RICOH",
      eventType: "JOB",
      jobName: base.jobName,
      statusText: "COMPLETE",
    });
    recibir({
      printerName: "RICOH",
      eventType: "JOB",
      jobName: base.jobName,
      statusText: "DELETED",
    });
  });
  await click("Impresión · OT-1");
  expect(el.textContent).toContain("Finalizado según la cola");
  expect(mocks.estado).toHaveBeenCalledWith(
    "ot",
    "envio",
    "COMPLETE",
    "Finalizado según la cola",
  );
  expect(mocks.imprimir).toHaveBeenCalledTimes(1);
});
it("reabrir una OT con un envío previo no imprime automáticamente", async () => {
  vista.historial = [{ ...base, estado: "SIN_CONFIRMAR" }];
  await montar();
  await click("Emitida");
  expect(mocks.imprimir).not.toHaveBeenCalled();
  expect(el.textContent).toContain("Envío sin confirmar");
  await click("Reimprimir");
  expect(mocks.imprimir).not.toHaveBeenCalled();
  await click("Confirmar reimpresión");
  expect(mocks.imprimir.mock.calls[0][5]).toBe("envio");
});
it("se detiene si un envío falla; conserva el historial y la OT", async () => {
  vista.documentos.push({ ...vista.documentos[0], itemId: "otro" });
  mocks.imprimir.mockImplementation(
    async (_t, _c, _o, _i, _id, _r, preparado) => {
      preparado(base);
      vista.historial = [{ ...base, estado: "SIN_CONFIRMAR" }];
      throw new Error("Se cortó QZ");
    },
  );
  await montar();
  await click("Emitida");
  expect(mocks.imprimir).toHaveBeenCalledTimes(1);
  expect(el.textContent).toContain("La OT está guardada");
  expect(el.textContent).toContain("Envío sin confirmar");
  expect(el.textContent).toContain("Enviar pendientes (1)");
});
