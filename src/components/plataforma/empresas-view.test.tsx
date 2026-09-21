// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AccionEmpresa, EmpresasView } from "./empresas-view";
import type { EmpresaPlataforma } from "@/lib/plataforma-api";

const mocks = vi.hoisted(() => ({
  params: new URLSearchParams(),
  push: vi.fn(),
  api: vi.fn(),
  bloquear: vi.fn(),
  reactivar: vi.fn(),
  plan: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
  useSearchParams: () => mocks.params,
}));
vi.mock("@/lib/api", () => ({ apiRequest: mocks.api }));
vi.mock("@/lib/plataforma-api", () => ({
  suspenderTenant: mocks.bloquear,
  reactivarTenant: mocks.reactivar,
  cambiarPlanTenant: mocks.plan,
}));
vi.mock("@/components/design-system/form-dialog", () => ({
  FormDialog: ({
    title,
    description,
    children,
  }: {
    title: ReactNode;
    description: ReactNode;
    children: ReactNode;
  }) => (
    <section>
      <h2>{title}</h2>
      <p>{description}</p>
      {children}
    </section>
  ),
}));

const empresa: EmpresaPlataforma = {
  id: "empresa-1",
  nombre: "Gráfica prueba",
  slug: "grafica-prueba",
  activo: false,
  creadoEl: "2026-09-20T12:00:00Z",
  origenAlta: "plataforma",
  bloqueo: { motivo: "Revisión administrativa", desde: "2026-09-20T12:00:00Z" },
  acceso: {
    modo: "bloqueado",
    codigo: "bloqueo_administrativo",
    descripcion: "Revisión administrativa",
  },
  usuariosHabilitados: 2,
  invitacionesPendientes: 0,
  storageBytes: 0,
  storageCuotaBytes: null,
  puedeAsignarPlanManual: false,
  suscripcion: {
    id: "suscripcion-1",
    planId: "plan-1",
    planNombre: "Producción",
    planCodigo: "estudio",
    proveedor: "paddle",
    estado: "baja",
    estadoProveedor: "canceled",
    referenciaExterna: "sub_prueba",
    desde: "2026-09-20T12:00:00Z",
    hasta: null,
    trialHasta: null,
    moraDesde: null,
    graciaHasta: null,
    proximoCobro: null,
    cambioProgramado: null,
    cambioProgramadoEl: null,
    ultimaSyncProveedorEl: null,
    ultimoEventoProveedorEl: null,
  },
  funciones: [],
  limites: { usuariosMax: 10, ordenesMesMax: null, storageGb: null },
};
let root: Root, container: HTMLDivElement;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.params = new URLSearchParams("vista=tenants");
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

it("solicita sólo la página filtrada del directorio y conserva los filtros al paginar", async () => {
  mocks.params = new URLSearchParams(
    "vista=tenants&q=taller&pagina=2&acceso=bloqueado",
  );
  mocks.api.mockResolvedValue({
    total: 60,
    pagina: 2,
    limite: 25,
    empresas: [],
  });
  await act(async () =>
    root.render(
      <EmpresasView
        esAdmin={false}
        planes={[]}
        version={0}
        onCrear={vi.fn()}
      />,
    ),
  );
  expect(mocks.api).toHaveBeenCalledWith(
    "/plataforma/empresas?pagina=2&limite=25&q=taller&acceso=bloqueado",
    { cache: "no-store" },
  );
  expect(container.textContent).not.toContain("Nueva empresa");
  await act(async () =>
    Array.from(container.querySelectorAll("button"))
      .find((b) => b.textContent === "Siguiente")!
      .click(),
  );
  const url = new URL(mocks.push.mock.calls[0][0], "http://localhost");
  expect(url.searchParams.get("q")).toBe("taller");
  expect(url.searchParams.get("pagina")).toBe("3");
  expect(url.searchParams.get("acceso")).toBe("bloqueado");
});

it("al cambiar de empresa descarta una respuesta anterior demorada y soporte no ve acciones", async () => {
  let resolver!: (value: EmpresaPlataforma) => void;
  mocks.params = new URLSearchParams("vista=tenants&empresa=empresa-anterior");
  mocks.api
    .mockReturnValueOnce(
      new Promise((r) => {
        resolver = r;
      }),
    )
    .mockResolvedValue(empresa);
  await act(async () =>
    root.render(
      <EmpresasView
        esAdmin={false}
        planes={[]}
        version={0}
        onCrear={vi.fn()}
      />,
    ),
  );
  mocks.params = new URLSearchParams("vista=tenants&empresa=empresa-1");
  await act(async () =>
    root.render(
      <EmpresasView
        esAdmin={false}
        planes={[]}
        version={0}
        onCrear={vi.fn()}
      />,
    ),
  );
  await act(async () => resolver({ ...empresa, nombre: "Empresa incorrecta" }));
  expect(container.textContent).toContain("Gráfica prueba");
  expect(container.textContent).not.toContain("Empresa incorrecta");
  expect(container.textContent).not.toContain("Levantar bloqueo");
  expect(container.textContent).toContain("Cancelada");
});

it("levantar bloqueo exige motivo, evita envíos duplicados y conserva el modal si falla", async () => {
  let rechazar!: (error: Error) => void;
  mocks.reactivar.mockReturnValue(
    new Promise((_, reject) => {
      rechazar = reject;
    }),
  );
  const completada = vi.fn();
  await act(async () =>
    root.render(
      <AccionEmpresa
        empresa={empresa}
        accion="reactivar"
        planes={[]}
        cerrar={vi.fn()}
        completada={completada}
      />,
    ),
  );
  expect(container.textContent).toContain("seguirá en solo lectura");
  const submit = async () =>
    act(async () => {
      container
        .querySelector("form")!
        .dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        );
    });
  await submit();
  expect(mocks.reactivar).not.toHaveBeenCalled();
  await act(async () => {
    const input = container.querySelector<HTMLInputElement>("#empresa-motivo")!;
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, "Revisión terminada");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await submit();
  await submit();
  expect(mocks.reactivar).toHaveBeenCalledOnce();
  expect(mocks.reactivar).toHaveBeenCalledWith(
    "empresa-1",
    "Revisión terminada",
  );
  await act(async () =>
    rechazar(new Error("La cuenta cambió. Actualizá la ficha.")),
  );
  expect(completada).not.toHaveBeenCalled();
  expect(container.textContent).toContain("La cuenta cambió");
  expect(
    container.querySelector<HTMLInputElement>("#empresa-motivo")!.disabled,
  ).toBe(false);
});
