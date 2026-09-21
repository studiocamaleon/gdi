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
it("conserva los cambios al cambiar de pestaña y deja los precios como pendientes", async () => {
  await render();
  await click(checkbox("Cupones · Grafo Pro"));
  await click(boton("Usuarios y oferta"));
  await escribir("#usuarios-1", "21");
  expect(container.textContent).toContain("Precio del plan y de adicionales");
  await click(boton("Planes actuales"));
  expect(container.textContent).toContain("Catálogo vigente");
  await click(boton("Funciones"));
  expect(checkbox("Cupones · Grafo Pro").getAttribute("aria-checked")).toBe(
    "false",
  );
  expect(boton("Guardar borradores").disabled).toBe(false);
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
it("no ofrece publicar borradores y explica las validaciones pendientes", async () => {
  await render();
  await click(boton("Revisión"));
  expect(container.textContent).toContain(
    "Las empresas conservan su plan actual",
  );
  expect(container.textContent).toContain("Vincular precios");
  expect(boton("Publicar")).toBeUndefined();
});
