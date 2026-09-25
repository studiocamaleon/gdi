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
  reenviar: vi.fn(),
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
  reenviarInvitacionEmpresa: mocks.reenviar,
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
const empresaPendiente: EmpresaPlataforma = {
  ...empresa,
  activo: true,
  invitacionAdministrador: {
    id: "invitacion-1",
    email: "admin@empresa.example.invalid",
    venceEl: "2030-10-01T12:00:00Z",
    aceptadaEl: null,
    correoEstado: "error",
    ultimoIntentoEl: "2020-01-01T12:00:00Z",
    enviadoEl: null,
  },
};
let root: Root, container: HTMLDivElement;
const clipboardOriginal = Object.getOwnPropertyDescriptor(navigator, "clipboard");
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
  if (clipboardOriginal) {
    Object.defineProperty(navigator, "clipboard", clipboardOriginal);
  } else {
    Reflect.deleteProperty(navigator, "clipboard");
  }
  vi.unstubAllGlobals();
});

const boton = (texto: string) =>
  Array.from(container.querySelectorAll("button")).find(
    (b) => b.textContent === texto,
  )!;

async function verFicha(id = "empresa-1", esAdmin = true) {
  mocks.params = new URLSearchParams(`vista=tenants&empresa=${id}`);
  await act(async () =>
    root.render(
      <EmpresasView
        esAdmin={esAdmin}
        planes={[]}
        version={0}
        onCrear={vi.fn()}
      />,
    ),
  );
}

it("conserva y permite copiar el enlace después del reenvío y de actualizar la ficha, aunque falle el correo", async () => {
  const enlace = "https://grafo.test/aceptar-invitacion?token=sintetico";
  const copiar = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: copiar },
  });
  let detalle = empresaPendiente;
  mocks.api.mockImplementation(async () => detalle);
  mocks.reenviar.mockImplementation(async () => {
    detalle = {
      ...detalle,
      invitacionAdministrador: {
        ...detalle.invitacionAdministrador!,
        ultimoIntentoEl: "2020-01-02T12:00:00Z",
      },
    };
    return {
      tenantId: detalle.id,
      invitacion: detalle.invitacionAdministrador,
      invitacionUrl: enlace,
    };
  });
  await verFicha();
  expect(container.textContent).not.toContain("Compartir el enlace manualmente");
  await act(async () => boton("Reenviar invitación").click());
  expect(mocks.reenviar).toHaveBeenCalledWith("empresa-1");
  expect(container.textContent).toContain("Empresa creada · correo sin confirmar");
  expect(container.textContent).toContain(enlace);
  await act(async () => boton("Actualizar").click());
  expect(container.textContent).toContain(enlace);
  await act(async () => boton("Copiar enlace").click());
  expect(copiar).toHaveBeenCalledWith(enlace);

  // Una renovación desde otra sesión vuelve obsoleto el enlace que conservamos.
  detalle = {
    ...detalle,
    invitacionAdministrador: {
      ...detalle.invitacionAdministrador!,
      ultimoIntentoEl: "2020-01-03T12:00:00Z",
    },
  };
  await act(async () => boton("Actualizar").click());
  expect(container.textContent).not.toContain(enlace);
  expect(container.textContent).not.toContain("Copiar enlace");
});

it("reemplaza el enlace al renovar y lo retira si el servidor no devuelve uno vigente", async () => {
  mocks.api.mockResolvedValue(empresaPendiente);
  mocks.reenviar
    .mockResolvedValueOnce({
      tenantId: empresaPendiente.id,
      invitacion: empresaPendiente.invitacionAdministrador,
      invitacionUrl: "https://grafo.test/aceptar-invitacion?token=anterior",
    })
    .mockResolvedValueOnce({
      tenantId: empresaPendiente.id,
      invitacion: empresaPendiente.invitacionAdministrador,
      invitacionUrl: "https://grafo.test/aceptar-invitacion?token=nuevo",
    })
    .mockResolvedValueOnce({
      tenantId: empresaPendiente.id,
      invitacion: empresaPendiente.invitacionAdministrador,
    });
  await verFicha();
  await act(async () => boton("Reenviar invitación").click());
  expect(container.textContent).toContain("token=anterior");
  await act(async () => boton("Reenviar invitación").click());
  expect(container.textContent).toContain("token=nuevo");
  expect(container.textContent).not.toContain("token=anterior");
  await act(async () => boton("Reenviar invitación").click());
  expect(container.textContent).not.toContain("Copiar enlace");
});

it("no muestra enlaces a soporte ni conserva el de una empresa al cambiar de ficha", async () => {
  const enlace = "https://grafo.test/aceptar-invitacion?token=empresa-1";
  mocks.api.mockImplementation(async (url: string) => ({
    ...empresaPendiente,
    id: url.endsWith("empresa-2") ? "empresa-2" : "empresa-1",
  }));
  mocks.reenviar.mockResolvedValue({
    tenantId: empresaPendiente.id,
    invitacion: empresaPendiente.invitacionAdministrador,
    invitacionUrl: enlace,
  });
  await verFicha();
  await act(async () => boton("Reenviar invitación").click());
  expect(container.textContent).toContain(enlace);
  await verFicha("empresa-1", false);
  expect(container.textContent).not.toContain(enlace);
  expect(container.textContent).not.toContain("Reenviar invitación");
  await verFicha("empresa-2");
  expect(container.textContent).not.toContain(enlace);
  await verFicha("empresa-1");
  expect(container.textContent).not.toContain(enlace);
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
