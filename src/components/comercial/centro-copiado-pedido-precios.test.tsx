// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CentroCopiadoPedidoPrecios } from "./centro-copiado-pedido-precios";
import { PermisosProvider } from "@/components/navigation/permisos-provider";
import {
  autorizarMargenCopiado,
  type RevisionCopiado,
} from "@/lib/centro-copiado-pedidos-api";
vi.mock("@/lib/centro-copiado-pedidos-api", () => ({
  autorizarMargenCopiado: vi.fn(),
}));
let root: Root, el: HTMLDivElement;
const revisar = vi.fn(),
  autorizado = vi.fn();
function revision(estado = "REQUIERE_AUTORIZACION"): RevisionCopiado {
  return {
    modalidad: "TARIFARIO",
    id: "calculo-demo",
    huella: "a".repeat(64),
    cotizacionId: "cotizacion-demo",
    nombre: "Mostrador ficticio",
    numero: 2,
    items: [],
    calculado: {
      estado: "CALCULADO",
      control: { estado, porcentaje: "8.00" },
      grupos: [
        { cantidad: "100", unidad: "HOJA", desde: "100", precio: "121" },
      ],
      terminaciones: [],
    },
  } as RevisionCopiado;
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }));
  el = document.createElement("div");
  document.body.append(el);
  root = createRoot(el);
});
afterEach(async () => {
  await act(async () => root.unmount());
  el.remove();
  vi.unstubAllGlobals();
});
async function mostrar(
  r: RevisionCopiado | null = revision(),
  vigente = true,
  permisos = ["finanzas.ver_margenes", "comercial.aprobar_descuento"],
) {
  await act(async () =>
    root.render(
      <PermisosProvider permisos={permisos}>
        <CentroCopiadoPedidoPrecios
          revision={r}
          vigente={vigente}
          ocupado={false}
          editable
          onRevisar={revisar}
          onAutorizado={autorizado}
        />
      </PermisosProvider>,
    ),
  );
}
const boton = (texto: string) =>
  [...document.querySelectorAll<HTMLButtonElement>("button")].find(
    (b) => b.textContent?.trim() === texto,
  );
it("muestra canal/versión y ofrece revisar y autorizar explícitamente", async () => {
  await mostrar();
  expect(el.textContent).toContain("Mostrador ficticio · v2");
  expect(el.textContent).toContain("Margen de impresión: 8.00%");
  await act(async () => boton("Actualizar precios de copiado")!.click());
  expect(revisar).toHaveBeenCalledOnce();
  expect(autorizarMargenCopiado).not.toHaveBeenCalled();
});
it("costos privados: sin permiso no muestra porcentaje ni autorización", async () => {
  await mostrar(revision(), true, ["comercial.copiado.gestionar"]);
  expect(el.textContent).not.toContain("8.00");
  expect(boton("Autorizar margen")).toBeUndefined();
});
it.each(["BLOQUEADO", "NO_VERIFICABLE"])(
  "no ofrece excepción para %s",
  async (estado) => {
    await mostrar(revision(estado));
    expect(el.textContent).toContain("Emisión bloqueada");
    expect(boton("Autorizar margen")).toBeUndefined();
  },
);
it("un cambio de pedido deja la autorización pendiente de una nueva revisión", async () => {
  await mostrar(revision(), false);
  expect(el.textContent).toContain("Pendiente de revisión");
  expect(boton("Autorizar margen")).toBeUndefined();
});
it("requiere motivo y envía la huella exacta, no emite la venta", async () => {
  await mostrar();
  await act(async () => boton("Autorizar margen")!.click());
  expect(boton("Confirmar autorización")!.disabled).toBe(true);
  const textarea = document.querySelector("textarea")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )!.set!.call(textarea, "Convenio comercial de prueba");
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });
  vi.mocked(autorizarMargenCopiado).mockResolvedValue(revision());
  await act(async () => boton("Confirmar autorización")!.click());
  expect(autorizarMargenCopiado).toHaveBeenCalledWith(
    "calculo-demo",
    "a".repeat(64),
    "Convenio comercial de prueba",
  );
  expect(autorizado).toHaveBeenCalledOnce();
});
