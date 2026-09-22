// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PlanesComparacion } from "./planes-comparacion";
import { PROPUESTA_PLANES } from "../../../apps/api/src/plataforma/planes/catalogo-planes";
import type { ComparacionPlanes } from "@/lib/plataforma-planes-api";
const mocks = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("@/lib/api", () => ({ apiRequest: mocks.request }));
let root: Root, container: HTMLDivElement;
const planes = PROPUESTA_PLANES.map((p) => p.contenido);
const empresa = {
  id: "empresa-1",
  nombre: "Imprenta de prueba",
  slug: "prueba",
  plan: "Founder",
};
const informe: ComparacionPlanes = {
  calculadoEl: "2026-09-21T03:00:00Z",
  empresa,
  accesoActual: {
    modo: "operativo",
    codigo: "habilitado",
    descripcion: "Puede operar.",
  },
  usuariosOcupados: 4,
  uso: {
    usuarios: { activos: 3, invitacionesPendientes: 1, adicionalesVigentes: 0 },
    archivos: {
      guardadosBytes: "2048",
      reservadosBytes: "1024",
      cargasPendientes: 1,
    },
  },
  almacenamientoAjustadoBytes: null,
  actual: {
    nombre: "Founder",
    limites: {
      usuariosMax: null,
      ordenesMesMax: null,
      almacenamiento: { modo: "ilimitado", gb: null },
    },
  },
  propuestas: [
    {
      nombre: "Grafo Esencial",
      limites: {
        usuariosMax: 3,
        ordenesMesMax: null,
        almacenamiento: { modo: "pendiente", gb: null },
      },
      adicionalesPermitidos: true,
      usuariosSobreIncluidos: 1,
      diagnostico: {
        estado: "resolver",
        usuariosCupoResultante: 3,
        usuariosExcedidos: 1,
        almacenamientoCupoBytes: null,
        almacenamientoExcedidoBytes: "0",
        funcionesAgregadas: 0,
        funcionesRetiradas: 1,
        hallazgos: [
          {
            codigo: "reservas",
            nivel: "revisar",
            titulo: "Reservas vigentes",
            detalle: "Hay reservas pendientes.",
            cantidad: 2,
          },
        ],
      },
      diferencias: [
        {
          clave: "reservas",
          nombre: "Reservas",
          actual: true,
          propuesta: false,
          cobertura: "pendiente",
        },
      ],
      advertencias: ["Hay reservas pendientes."],
    },
  ],
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  mocks.request.mockImplementation((url: string) =>
    Promise.resolve(
      url.includes("/empresas?")
        ? { empresas: [empresa], total: 1, pagina: 1, limite: 20 }
        : informe,
    ),
  );
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
const render = async (contenido = planes) =>
  act(async () =>
    root.render(
      <PlanesComparacion
        planes={contenido}
        catalogoVersion={1}
        invalida={false}
      />,
    ),
  );
async function buscar() {
  await act(async () =>
    container
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
}
async function comparar() {
  await act(async () =>
    container
      .querySelector<HTMLButtonElement>(
        '[aria-label="Comparar Imprenta de prueba"]',
      )!
      .click(),
  );
}
it("consulta sólo por pedido, compara la edición actual y muestra excedentes sin ofrecer asignar", async () => {
  await render();
  expect(mocks.request).not.toHaveBeenCalled();
  await buscar();
  await comparar();
  const envio = mocks.request.mock.calls.find(([url]) =>
    url.includes("/comparar"),
  )!;
  expect(JSON.parse(envio[1].body)).toEqual({
    tenantId: empresa.id,
    catalogoVersion: 1,
    planes,
  });
  expect(container.textContent).toContain("Falta 1 lugar");
  expect(container.textContent).toContain("Hay reservas pendientes.");
  expect(container.textContent).toContain("Las versiones se publican y asignan");
  expect(
    [...container.querySelectorAll("button")].some((b) =>
      b.textContent?.includes("Asignar"),
    ),
  ).toBe(false);
});
it("invalida el informe al cambiar la propuesta", async () => {
  await render();
  await buscar();
  await comparar();
  const editado = structuredClone(planes);
  editado[0].usuariosIncluidos = 5;
  await render(editado);
  expect(container.textContent).toContain("La propuesta cambió");
  expect(container.textContent).not.toContain("Falta 1 lugar");
});
it("descarta respuestas tardías de una propuesta anterior", async () => {
  await render();
  await buscar();
  let resolver!: (v: ComparacionPlanes) => void;
  mocks.request.mockReturnValueOnce(
    new Promise((r) => {
      resolver = r;
    }),
  );
  await comparar();
  const editado = structuredClone(planes);
  editado[0].usuariosIncluidos = 5;
  await render(editado);
  await act(async () => resolver(informe));
  expect(container.textContent).not.toContain("Falta 1 lugar");
});
it("muestra errores de consulta y permite volver a intentar", async () => {
  await render();
  await buscar();
  mocks.request.mockRejectedValueOnce(
    new Error("La versión del catálogo no coincide."),
  );
  await comparar();
  expect(container.querySelector('[role="alert"]')?.textContent).toContain(
    "versión",
  );
  await comparar();
  expect(container.querySelector('[role="alert"]')).toBeNull();
  expect(container.textContent).toContain("Hay reservas pendientes.");
});

it("distingue accesos de invitaciones, muestra cargas y permite actualizar la foto", async () => {
  await render();
  await buscar();
  await comparar();
  expect(container.textContent).toContain(
    "3 accesos activos · 1 invitación pendiente",
  );
  expect(container.textContent).toContain("1 KB reservados");
  expect(container.textContent).toContain("Continuidad y revisión · 1");
  const antes = mocks.request.mock.calls.length;
  await act(async () =>
    [...container.querySelectorAll("button")]
      .find((b) => b.textContent === "Actualizar diagnóstico")!
      .click(),
  );
  expect(mocks.request).toHaveBeenCalledTimes(antes + 1);
  expect(container.textContent).toContain("Reservas vigentes · 2");
});
