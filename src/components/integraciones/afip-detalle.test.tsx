// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AfipDetalle } from "./afip-detalle";
import { PermisosProvider } from "@/components/navigation/permisos-provider";
import {
  activarAfip,
  desactivarAfip,
  verificarAfip,
  getAfip,
  type AfipIntegracion,
} from "@/lib/integraciones-api";

vi.mock("@/lib/integraciones-api", () => ({
  activarAfip: vi.fn(),
  desactivarAfip: vi.fn(),
  verificarAfip: vi.fn(),
  getAfip: vi.fn(),
}));
vi.mock("@/components/navigation/config-regional-provider", () => ({
  useFecha: () => ({ fechaNumerica: (v: string) => v, hora: (v: string) => v }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const inicial: AfipIntegracion = {
  estado: "DESCONECTADA",
  ambiente: "dev",
  representanteCuit: null,
  esCuitPropio: false,
  planPermiteAfip: true,
  puedeOperarAfip: true,
  puedeDesactivarAfip: true,
  restriccionAfip: null,
  emisor: {
    cuit: "30000000015",
    razonSocial: "Empresa de ensayo",
    condicionFiscal: "RI",
    domicilioFiscal: "Calle 1",
    puntosVenta: [{ numero: 1, numeroFormateado: "0001" }],
  },
  ultimoChequeoEl: null,
  ultimoErrorTexto: null,
  conectadaEl: null,
};
let container: HTMLDivElement, root: Root;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  vi.mocked(getAfip).mockResolvedValue(inicial);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
async function mostrar(
  datos = inicial,
  permisos = ["administracion.gestionar"],
) {
  await act(async () =>
    root.render(
      <PermisosProvider permisos={permisos}>
        <AfipDetalle inicial={datos} onVolver={() => {}} />
      </PermisosProvider>,
    ),
  );
}
const verificar = () =>
  [...container.querySelectorAll("button")].find((b) =>
    b.textContent?.includes("Verificar delegación"),
  )!;
const interruptor = () =>
  container.querySelector<HTMLButtonElement>('[role="switch"]');

it("al retirar ARCA conserva la consulta y permite desconectar una conexión anterior", async () => {
  const datos: AfipIntegracion = {
    ...inicial,
    estado: "CONECTADA",
    planPermiteAfip: false,
    puedeOperarAfip: false,
    restriccionAfip: "Tu plan no incluye facturación electrónica.",
  };
  vi.mocked(desactivarAfip).mockResolvedValue({
    ...datos,
    estado: "DESCONECTADA",
  });
  await mostrar(datos);
  expect(container.textContent).toContain("Empresa de ensayo");
  expect(container.textContent).toContain(datos.restriccionAfip);
  expect(verificar().disabled).toBe(true);
  expect(interruptor()?.disabled).toBe(false);
  await act(async () => interruptor()!.click());
  expect(desactivarAfip).toHaveBeenCalledTimes(1);
  expect(activarAfip).not.toHaveBeenCalled();
  expect(interruptor()).toBeNull();
});

it("en sólo lectura mantiene visible la conexión y deshabilita sus cambios", async () => {
  await mostrar({
    ...inicial,
    estado: "CONECTADA",
    puedeOperarAfip: false,
    puedeDesactivarAfip: false,
    restriccionAfip: "La suscripción está dada de baja.",
  });
  expect(verificar().disabled).toBe(true);
  expect(interruptor()?.disabled).toBe(true);
  expect(container.textContent).toContain("dada de baja");
});

it("un lector ve el estado sin controles operativos aunque el plan incluya la función", async () => {
  await mostrar(inicial, ["administracion.ver"]);
  expect(verificar().disabled).toBe(true);
  expect(interruptor()?.disabled).toBe(true);
  expect(activarAfip).not.toHaveBeenCalled();
});

it("verificar no activa la integración y evita lanzar otra operación mientras responde", async () => {
  let terminar!: (r: Awaited<ReturnType<typeof verificarAfip>>) => void;
  vi.mocked(verificarAfip).mockReturnValue(
    new Promise((resolve) => {
      terminar = resolve;
    }),
  );
  await mostrar();
  await act(async () => {
    verificar().click();
    verificar().click();
  });
  expect(interruptor()?.disabled).toBe(true);
  expect(verificarAfip).toHaveBeenCalledTimes(1);
  await act(async () =>
    terminar({
      ok: true,
      cuit: inicial.emisor.cuit,
      puntoVenta: 1,
      ultimoNumero: 7,
      motivo: null,
    }),
  );
  expect(activarAfip).not.toHaveBeenCalled();
  expect(interruptor()?.getAttribute("aria-checked")).toBe("false");
});

it("si el plan cambia mientras activa, refresca la restricción devuelta por el servidor", async () => {
  vi.mocked(activarAfip).mockRejectedValue(new Error("Función no disponible"));
  vi.mocked(getAfip).mockResolvedValue({
    ...inicial,
    planPermiteAfip: false,
    puedeOperarAfip: false,
    restriccionAfip: "La función fue retirada del plan.",
  });
  await mostrar();
  await act(async () => interruptor()!.click());
  expect(verificar().disabled).toBe(true);
  expect(interruptor()).toBeNull();
  expect(container.textContent).toContain("retirada del plan");
});
