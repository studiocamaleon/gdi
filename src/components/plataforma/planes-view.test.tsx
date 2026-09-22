// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PlanesView } from "./planes-view";
import {
  CATALOGO_PLANES,
  GRUPOS_PLANES,
  PROPUESTA_PLANES,
} from "../../../apps/api/src/plataforma/planes/catalogo-planes";
import type { CatalogoPlanesRespuesta } from "@/lib/plataforma-planes-api";

const mocks = vi.hoisted(() => ({ request: vi.fn(), salida: vi.fn() }));
vi.mock("@/lib/api", () => ({ apiRequest: mocks.request }));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));
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
      <section role="dialog" aria-label={title}>
        {children}
      </section>
    ) : null,
}));
vi.mock("@/components/design-system/select-field", () => ({
  SelectField: ({
    value,
    disabled,
    onChange,
    options,
    "aria-label": label,
  }: {
    value: string;
    disabled: boolean;
    onChange: (s: string) => void;
    options: Array<{ value: string; label: string }>;
    "aria-label": string;
  }) => (
    <select
      aria-label={label}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  ),
}));

let root: Root, container: HTMLDivElement, datos: CatalogoPlanesRespuesta;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("PointerEvent", MouseEvent);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  datos = {
    catalogoVersion: 1,
    capacidades: CATALOGO_PLANES,
    grupos: GRUPOS_PLANES,
    borradores: PROPUESTA_PLANES.map((p, i) => ({
      ...structuredClone(p),
      id: String(i),
      revision: 1,
      catalogoVersion: 1,
      actualizadoEl: "2026-09-20T12:00:00Z",
    })),
  };
  mocks.request.mockResolvedValue(datos);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
const boton = (texto: string) =>
  [...container.querySelectorAll<HTMLButtonElement>("button")].find((b) =>
    b.textContent?.startsWith(texto),
  )!;
const checkbox = (nombre: string) =>
  container.querySelector<HTMLElement>(
    `[role="checkbox"][aria-label="${nombre}"]`,
  )!;
async function render(esAdmin = true) {
  await act(async () =>
    root.render(
      <PlanesView
        esAdmin={esAdmin}
        planesActuales={<p>Catálogo vigente</p>}
        onSalidaChange={mocks.salida}
      />,
    ),
  );
}
async function click(el: HTMLElement) {
  expect(el).toBeTruthy();
  await act(async () => el.click());
}
async function escribir(selector: string, valor: string) {
  await act(async () => {
    const el = container.querySelector<HTMLInputElement>(selector)!;
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(el, valor);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

it("presenta los tres planes con la distribución acordada y guardado deshabilitado inicialmente", async () => {
  await render();
  expect(container.textContent).toContain("Grafo Esencial");
  expect(container.textContent).toContain("Grafo Pro");
  expect(container.textContent).toContain("Grafo Avanzado");
  expect(
    checkbox("Compras y abastecimiento · Grafo Esencial").getAttribute(
      "aria-checked",
    ),
  ).toBe("false");
  expect(
    checkbox("Compras y abastecimiento · Grafo Pro").getAttribute(
      "aria-checked",
    ),
  ).toBe("true");
  expect(
    checkbox("Escenarios y reprogramación · Grafo Avanzado").getAttribute(
      "aria-checked",
    ),
  ).toBe("true");
  expect(checkbox("Impresión conectada · Grafo Pro")).toBeNull();
  expect(container.textContent).toContain("Sólo Founder");
  expect(boton("Guardar borradores").disabled).toBe(true);
});
it("soporte puede comparar pero no modificar ni guardar", async () => {
  await render(false);
  const c = checkbox("Cupones · Grafo Pro");
  expect(
    c.hasAttribute("disabled") || c.getAttribute("aria-disabled") === "true",
  ).toBe(true);
  expect(boton("Guardar borradores")).toBeUndefined();
});
it("guarda sólo el plan modificado con su revisión y limpia los cambios al confirmar la API", async () => {
  await render();
  await click(checkbox("Cupones · Grafo Pro"));
  expect(boton("Guardar borradores").disabled).toBe(false);
  mocks.request.mockImplementation(async (_path, init) => {
    const { cambios } = JSON.parse(init.body);
    return {
      borradores: cambios.map((c: { id: string; contenido: unknown }) => ({
        ...datos.borradores.find((p) => p.id === c.id),
        ...c,
        revision: 2,
      })),
    };
  });
  await click(boton("Guardar borradores"));
  const args = JSON.parse(mocks.request.mock.calls.at(-1)![1].body);
  expect(args.cambios).toHaveLength(1);
  expect(args.cambios[0]).toMatchObject({
    id: "1",
    revision: 1,
    contenido: { funciones: { cupones: false } },
  });
  expect(boton("Guardar borradores").disabled).toBe(true);
  expect(mocks.salida.mock.calls.at(-1)![0].cambios).toBe(0);
});
it("señala dependencias al quitar centro de copiado, sin deshabilitar funciones a escondidas", async () => {
  await render();
  await click(checkbox("Centro de copiado: documentos · Grafo Esencial"));
  expect(container.textContent).toContain(
    "Cotización de planos CAD requiere Centro de copiado",
  );
  expect(
    checkbox("Cotización de planos CAD · Grafo Esencial").getAttribute(
      "aria-checked",
    ),
  ).toBe("true");
  expect(boton("Guardar borradores").disabled).toBe(true);
});
it("busca por nombre y muestra sólo las diferencias entre planes", async () => {
  await render();
  await escribir("#buscar-funcion", "CAD");
  expect(checkbox("Cotización de planos CAD · Grafo Esencial")).not.toBeNull();
  expect(checkbox("Cotizador completo · Grafo Esencial")).toBeNull();
  await click(container.querySelector<HTMLElement>("#solo-diferencias")!);
  expect(container.textContent).toContain("No hay funciones que coincidan");
});
it("conserva funciones, recursos y precios al cambiar de pestaña", async () => {
  await render();
  await click(checkbox("Cupones · Grafo Pro"));
  await click(boton("Usuarios y oferta"));
  await escribir("#usuarios-1", "21");
  expect(container.textContent).toContain("Precios en USD");
  await escribir('[aria-label="Plan mensual · Grafo Pro"]', "290");
  await escribir('[aria-label="Usuario adicional mensual · Grafo Pro"]', "15");
  await click(boton("Planes actuales"));
  expect(container.textContent).toContain("Catálogo vigente");
  await click(boton("Funciones"));
  expect(checkbox("Cupones · Grafo Pro").getAttribute("aria-checked")).toBe(
    "false",
  );
  expect(boton("Guardar borradores").disabled).toBe(false);
  await click(boton("Guardar borradores"));
  const guardado = mocks.request.mock.calls.find(
    ([url, options]) =>
      url === "/plataforma/planes-borradores" && options?.method === "PUT",
  )!;
  const body = JSON.parse(guardado[1].body);
  expect(
    body.cambios.find((c: { id: string }) => c.id === "1").contenido.precios,
  ).toMatchObject({
    mensual: 290,
    usuarioMensual: 15,
    anual: null,
    moneda: "USD",
  });
});
it("un conflicto conserva la edición y pide descartar antes de recargar", async () => {
  await render();
  await click(checkbox("Cupones · Grafo Pro"));
  mocks.request.mockRejectedValueOnce(
    new Error("Otro integrante actualizó estos planes."),
  );
  await click(boton("Guardar borradores"));
  expect(container.textContent).toContain("Tus cambios siguen en pantalla");
  expect(checkbox("Cupones · Grafo Pro").getAttribute("aria-checked")).toBe(
    "false",
  );
  await click(boton("Recargar planes"));
  expect(container.querySelector('[role="dialog"]')).not.toBeNull();
  await click(boton("Seguir editando"));
  expect(boton("Guardar borradores").disabled).toBe(false);
});
it("la revisión explica las validaciones comerciales pendientes", async () => {
  await render();
  await click(boton("Revisión"));
  expect(container.textContent).toContain(
    "Los cambios del borrador no modifican las ofertas ni los planes ya asignados.",
  );
  expect(container.textContent).toContain("la oferta y los precios vinculados a Paddle");
  expect(boton("Publicar")).toBeUndefined();
});

it("exige almacenamiento definido y cambios guardados antes de revisar la publicación", async () => {
  await render();
  mocks.request.mockResolvedValue({ versiones: [], siguiente: null });
  await click(boton("Versiones"));
  expect(container.textContent).toContain("Definí el almacenamiento incluido");
  expect(boton("Revisar publicación").disabled).toBe(true);
  await click(boton("Funciones"));
  await click(checkbox("Cupones · Grafo Esencial"));
  await click(boton("Versiones"));
  expect(container.textContent).toContain("Guardá los cambios de este plan");
  expect(boton("Revisar publicación").disabled).toBe(true);
});

it("publica la revisión guardada tras revisarla y muestra el snapshot devuelto", async () => {
  datos.borradores[0].contenido.almacenamientoModo = "limitado";
  datos.borradores[0].contenido.almacenamientoGb = 10;
  await render();
  const version = {
    ...datos.borradores[0],
    numero: 1,
    revisionBorrador: 1,
    publicadoEl: "2026-09-21T12:00:00Z",
    publicadoPorNombre: "Admin de prueba",
    motivo: "Primera propuesta",
    catalogoSnapshot: { capacidades: CATALOGO_PLANES, grupos: GRUPOS_PLANES },
  };
  let publicada = false;
  mocks.request.mockImplementation(async (_path, init) => {
    if (init?.method === "POST") {
      publicada = true;
      return version;
    }
    return { versiones: publicada ? [version] : [], siguiente: null };
  });
  await click(boton("Versiones"));
  await click(boton("Revisar publicación"));
  expect(container.querySelector('[role="dialog"]')?.textContent).toContain(
    "10 GB",
  );
  expect(boton("Publicar versión").disabled).toBe(true);
  await escribir("#motivo-publicacion", "Primera propuesta");
  const publicar = boton("Publicar versión");
  await act(async () => {
    publicar.click();
    publicar.click();
  });
  expect(
    mocks.request.mock.calls.filter(([, init]) => init?.method === "POST"),
  ).toHaveLength(1);
  const envio = mocks.request.mock.calls.find(
    ([, init]) => init?.method === "POST",
  )!;
  expect(envio[0]).toContain("/borrador/0");
  expect(JSON.parse(envio[1].body)).toEqual({
    revision: 1,
    catalogoVersion: 1,
    motivo: "Primera propuesta",
  });
  expect(container.textContent).toContain("Versión 1");
  expect(container.querySelector('[role="dialog"]')?.textContent).toContain(
    "Admin de prueba",
  );
  expect(boton("Revisión publicada").disabled).toBe(true);
});

it("un conflicto de publicación conserva la revisión y el motivo para revisarlos", async () => {
  datos.borradores[0].contenido.almacenamientoModo = "ilimitado";
  await render();
  mocks.request.mockImplementation(async (_path, init) => {
    if (init?.method === "POST")
      throw new Error(
        "El borrador cambió. Recargá y revisá su contenido antes de publicar.",
      );
    return { versiones: [], siguiente: null };
  });
  await click(boton("Versiones"));
  await click(boton("Revisar publicación"));
  await escribir("#motivo-publicacion", "Primera propuesta");
  await click(boton("Publicar versión"));
  expect(container.textContent).toContain("El borrador cambió");
  expect(
    container.querySelector<HTMLInputElement>("#motivo-publicacion")?.value,
  ).toBe("Primera propuesta");
  expect(container.querySelector('[role="dialog"]')).not.toBeNull();
  mocks.request.mockImplementation(async (path) =>
    path === "/plataforma/planes-borradores"
      ? datos
      : { versiones: [], siguiente: null },
  );
  await click(boton("Recargar borradores"));
  expect(container.querySelector('[role="dialog"]')).toBeNull();
  expect(boton("Revisar publicación").disabled).toBe(false);
});

it("soporte consulta el historial sin controles de publicación", async () => {
  await render(false);
  mocks.request.mockResolvedValue({ versiones: [], siguiente: null });
  await click(boton("Versiones"));
  expect(container.textContent).toContain("Historial de versiones");
  expect(boton("Revisar publicación")).toBeUndefined();
});

it("un error al cargar el historial bloquea publicar y permite reintentar", async () => {
  datos.borradores[0].contenido.almacenamientoModo = "ilimitado";
  await render();
  mocks.request.mockRejectedValueOnce(new Error("Sesión vencida"));
  await click(boton("Versiones"));
  expect(container.textContent).toContain("Sesión vencida");
  expect(boton("Revisar publicación").disabled).toBe(true);
  mocks.request.mockResolvedValue({ versiones: [], siguiente: null });
  await click(boton("Actualizar historial"));
  expect(boton("Revisar publicación").disabled).toBe(false);
});
