// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { HistorialImpresionDialog } from "./historial-impresion-dialog";
import { PermisosProvider } from "@/components/navigation/permisos-provider";
import type { EnvioDocumento, HistorialImpresion } from "@/lib/impresion-api";

const api = vi.hoisted(() => ({ historial: vi.fn(), confirmar: vi.fn() }));
vi.mock("@/lib/impresion-api", () => ({
  getHistorialImpresion: api.historial,
  confirmarDocumentosImpresos: api.confirmar,
}));
// Si la consulta histórica empieza a importar el transporte, la suite falla.
vi.mock("@/lib/qz-impresion", () => {
  throw new Error("El historial no debe cargar QZ");
});
vi.mock("@/components/design-system/form-dialog", () => ({
  FormDialog: ({
    title,
    children,
  }: {
    title: ReactNode;
    children: ReactNode;
  }) => (
    <section role="dialog">
      <h2>{title}</h2>
      {children}
    </section>
  ),
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
    <button onClick={onPress} disabled={isDisabled}>
      {children}
    </button>
  ),
}));

const base: EnvioDocumento = {
  id: "a",
  itemId: "item",
  nombre: "Plano A.pdf",
  copias: 2,
  paginas: 1,
  hojas: 2,
  faz: 1,
  host: "localhost",
  impresora: "HP",
  jobName: "Grafo OT-1",
  estado: "ENVIADO",
  fecha: "2026-09-22T12:00:00Z",
  actualizadoEl: "2026-09-22T12:00:00Z",
  usuario: "Operario",
  eventos: [],
};
let root: Root, el: HTMLDivElement, vista: HistorialImpresion;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.resetAllMocks();
  vi.stubGlobal(
    "PointerEvent",
    class extends MouseEvent {
      pointerType = "mouse";
    },
  );
  el = document.createElement("div");
  document.body.append(el);
  root = createRoot(el);
  vista = {
    ordenId: "ot",
    numero: "OT-1",
    estado: "pendiente",
    total: 4,
    siguiente: null,
    pendientesSinEnvio: 1,
    puedeConfirmar: true,
    envios: [
      { ...base, vigente: true },
      {
        ...base,
        id: "b",
        itemId: "item-b",
        nombre: "Documento B.pdf",
        vigente: true,
      },
      {
        ...base,
        id: "anterior",
        nombre: "Versión anterior.pdf",
        vigente: false,
      },
      {
        ...base,
        id: "verificado",
        nombre: "Verificado.pdf",
        vigente: true,
        confirmacion: {
          fecha: base.fecha,
          usuario: "Ventas",
          usuarioId: "ventas",
        },
      },
    ],
  };
  api.historial.mockImplementation(async () => structuredClone(vista));
  api.confirmar.mockResolvedValue({ ok: true });
});
afterEach(async () => {
  await act(() => root.unmount());
  el.remove();
  vi.unstubAllGlobals();
});
async function abrir(permisos = ["comercial.ver", "comercial.gestionar"]) {
  await act(async () => {
    root.render(
      <PermisosProvider permisos={permisos}>
        <HistorialImpresionDialog ordenId="ot" onClose={vi.fn()} />
      </PermisosProvider>,
    );
  });
}
async function boton(texto: string) {
  const b = [...el.querySelectorAll("button")].find((b) =>
    b.textContent?.includes(texto),
  );
  expect(b).toBeTruthy();
  await act(async () => b!.click());
}
async function seleccionar() {
  const checkboxes = [...el.querySelectorAll<HTMLElement>('[role="checkbox"]')];
  expect(checkboxes).toHaveLength(2);
  for (const checkbox of checkboxes) await act(async () => checkbox.click());
}

it("muestra el historial y pendientes, y verifica sólo las salidas seleccionadas con una confirmación explícita", async () => {
  await abrir();
  expect(api.historial).toHaveBeenCalledWith("ot", 0);
  expect(el.textContent).toContain(
    "trabajo(s) solicitado(s) sin un envío registrado",
  );
  expect(el.textContent).toContain("Hay un envío posterior");
  await seleccionar();
  await boton("Verificar selección (2)");
  expect(api.confirmar).not.toHaveBeenCalled();
  await boton("Confirmar salida correcta");
  expect(api.confirmar).toHaveBeenCalledExactlyOnceWith("ot", ["a", "b"]);
  expect(api.historial).toHaveBeenCalledTimes(2);
});

it.each(["sin permiso", "sólo lectura"])(
  "%s permite consultar pero oculta la confirmación",
  async (modo) => {
    vista.puedeConfirmar = modo !== "sólo lectura";
    await abrir(
      modo === "sin permiso" ? ["comercial.ver"] : ["produccion.ejecutar"],
    );
    expect(el.textContent).toContain("Plano A.pdf");
    expect(el.querySelectorAll('[role="checkbox"]')).toHaveLength(0);
    expect(el.textContent).not.toContain("Verificar selección");
    expect(api.confirmar).not.toHaveBeenCalled();
  },
);

it("conserva el resultado y selección si falla la verificación, sin informar éxito", async () => {
  api.confirmar.mockRejectedValue(
    new Error("Los envíos cambiaron. Actualizá el panel."),
  );
  await abrir();
  await seleccionar();
  await boton("Verificar selección (2)");
  await boton("Confirmar salida correcta");
  expect(el.textContent).toContain("Los envíos cambiaron");
  expect(el.textContent).toContain("Plano A.pdf");
  expect(api.historial).toHaveBeenCalledTimes(1);
});

it("al fallar una nueva página elimina la selección anterior y permite volver a consultar", async () => {
  vista.total = 60;
  vista.siguiente = 50;
  await abrir();
  await seleccionar();
  api.historial.mockRejectedValueOnce(new Error("No disponible"));
  await boton("Siguiente");
  expect(api.historial).toHaveBeenLastCalledWith("ot", 50);
  expect(el.textContent).toContain("No disponible");
  expect(el.textContent).not.toContain("Plano A.pdf");
  expect(el.textContent).not.toContain("Verificar selección");
  await boton("Anterior");
  expect(api.historial).toHaveBeenLastCalledWith("ot", 0);
  expect(el.textContent).toContain("Plano A.pdf");
});
