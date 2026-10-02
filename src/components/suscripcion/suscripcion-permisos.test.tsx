// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SuscripcionView } from "./suscripcion-view";
import { PermisosProvider } from "@/components/navigation/permisos-provider";
import {
  contratacionPendiente,
  type EstadoSuscripcion,
} from "@/lib/suscripcion-api";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@paddle/paddle-js", () => ({
  initializePaddle: vi.fn(async () => undefined),
}));
vi.mock("@/lib/suscripcion-api", async (original) => ({
  ...(await original<typeof import("@/lib/suscripcion-api")>()),
  contratacionPendiente: vi.fn(async () => null),
}));

let container: HTMLDivElement, root: Root;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubEnv("NEXT_PUBLIC_PADDLE_CLIENT_TOKEN", "test_publico_ficticio");
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const inicial: EstadoSuscripcion = {
  actual: null,
  planes: [
    {
      codigo: "demo",
      nombre: "Plan de prueba",
      descripcion: null,
      precioMensual: 10,
      moneda: "USD",
      features: {},
      priceId: "precio-ficticio",
      esActual: false,
      anual: null,
    },
  ],
  checkout: { tenantId: "empresa-ficticia", email: "admin@example.invalid" },
  facturas: [],
  tarjeta: null,
  puedePortal: true,
  puedeCambiarSinPago: false,
  prueba: { enPrueba: false, diasRestantes: null, hasta: null, vencida: false },
};

it("lectura de Suscripción no consulta contrataciones restringidas ni ofrece activar un plan", async () => {
  await act(async () =>
    root.render(
      <PermisosProvider
        permisos={["acceso.por_vista", "configuracion.suscripcion.ver"]}
      >
        <SuscripcionView inicial={inicial} />
      </PermisosProvider>,
    ),
  );
  expect(contratacionPendiente).not.toHaveBeenCalled();
  const activar = [...container.querySelectorAll("button")].filter((b) =>
    /Activar|Contratar|Elegir|medio de pago|facturación|Cancelar suscripción/i.test(
      b.textContent ?? "",
    ),
  );
  expect(activar.length).toBeGreaterThan(0);
  for (const boton of activar)
    expect(
      boton.disabled || boton.getAttribute("aria-disabled") === "true",
    ).toBe(true);
});

it("gestión de Suscripción conserva la consulta de contrataciones pendientes", async () => {
  await act(async () =>
    root.render(
      <PermisosProvider
        permisos={["acceso.por_vista", "configuracion.suscripcion.gestionar"]}
      >
        <SuscripcionView inicial={inicial} />
      </PermisosProvider>,
    ),
  );
  expect(contratacionPendiente).toHaveBeenCalledOnce();
});
