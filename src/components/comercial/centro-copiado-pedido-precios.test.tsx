// @vitest-environment jsdom
import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CentroCopiadoPedidoPrecios } from "./centro-copiado-pedido-precios";
import { PermisosProvider } from "@/components/navigation/permisos-provider";
import type { RevisionCopiado } from "@/lib/centro-copiado-pedidos-api";
let root: Root, el: HTMLDivElement;
const revisar = vi.fn();
function revision(estado = "REQUIERE_AUTORIZACION"): RevisionCopiado {
  return {
    modalidad: "TARIFARIO",
    id: "calculo-demo",
    huella: "a".repeat(64),
    cotizacionId: "cotizacion-demo",
    nombre: "Mostrador ficticio",
    numero: 2,
    items: [],
    resumenPrecios: [
      {
        papel: "Obra · 80 g",
        detalle: "A4 · B/N · Doble faz",
        unidadPrecio: "HOJA",
        unidadRango: "HOJA",
        desde: "100",
        hasta: null,
        hastaExclusivo: false,
        cantidad: "100",
        totalImpresion: "12100",
        precioFinal: "121",
      },
    ],
    calculado: {
      estado: "CALCULADO",
      control: { estado, porcentaje: "8.00" },
      grupos: [
        { cantidad: "100", unidad: "HOJA", desde: "100", precio: "121" },
      ],
      terminaciones: [],
    },
  } as unknown as RevisionCopiado;
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
  opciones: Partial<ComponentProps<typeof CentroCopiadoPedidoPrecios>> = {},
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
          {...opciones}
        />
      </PermisosProvider>,
    ),
  );
}
const boton = (texto: string) =>
  [...document.querySelectorAll<HTMLButtonElement>("button")].find(
    (b) => b.textContent?.trim() === texto,
  );
it("muestra sólo papel, rango y precio final por hoja, sin el panel de autorización", async () => {
  await mostrar();
  expect(el.textContent).toContain("Obra · 80 g");
  expect(el.textContent).toContain("A4 · B/N · Doble faz");
  expect(el.textContent).toContain("100+");
  expect(el.textContent).toContain("121,00");
  expect(el.textContent).toContain("por hoja");
  expect(el.textContent).not.toMatch(
    /Mostrador|Contribución|Margen|listos para emitir|Precios revisados/,
  );
  expect(el.querySelector("button")).toBeNull();
});
it("el vendedor puede ver precios finales sin permiso de costos", async () => {
  await mostrar(revision(), true, ["comercial.copiado.gestionar"]);
  expect(el.textContent).toContain("121,00");
  expect(el.textContent).not.toContain("8.00");
});
it.each(["REQUIERE_AUTORIZACION", "BLOQUEADO", "NO_VERIFICABLE"])(
  "una revisión histórica %s no bloquea ni expone autorizaciones",
  async (estado) => {
    await mostrar(revision(estado));
    expect(el.querySelector("table")).not.toBeNull();
    expect(el.querySelector('[role="alert"]')).toBeNull();
    expect(el.textContent).not.toMatch(/autorizar|bloqueada|contribución/i);
  },
);
it("un cambio de pedido oculta los precios anteriores sin pedir una actualización manual", async () => {
  await mostrar(revision(), false);
  expect(el.querySelector("table")).toBeNull();
  expect(el.querySelector("button")).toBeNull();
  expect(el.querySelector('[role="alert"]')).toBeNull();
  expect(revisar).not.toHaveBeenCalled();
});
it("un precio ausente sigue pendiente aunque se retire el control de contribución", async () => {
  const r = revision();
  if (r.modalidad !== "TARIFARIO") throw new Error("fixture");
  r.calculado.estado = "PRECIO_PENDIENTE";
  await mostrar(r);
  expect(el.textContent).toContain("Falta un precio en el tarifario");
  expect(el.querySelector("table")).toBeNull();
});
it("distingue rangos por carilla y CAD del precio final por hoja o metro", async () => {
  const r = revision();
  if (r.modalidad !== "TARIFARIO") throw new Error("fixture");
  r.resumenPrecios![0].unidadRango = "CARILLA";
  r.resumenPrecios![0].hasta = "499";
  r.resumenPrecios!.push({
    ...r.resumenPrecios![0],
    papel: "Obra CAD",
    unidadPrecio: "ML",
    unidadRango: "ML",
    desde: "0",
    hasta: "10",
    hastaExclusivo: true,
    precioFinal: "0",
  });
  await mostrar(r);
  expect(el.textContent).toContain("100–499carillas");
  expect(el.textContent).toContain("0–<10metros");
  expect(el.textContent).toContain("por metro");
  expect(el.textContent).toContain("0,00");
});
it("un canal de motor revisado no agrega un bloque sin información", async () => {
  await mostrar({ modalidad: "MOTOR" });
  expect(el.textContent).toBe("");
});

it("mientras calcula sólo muestra el estado y no un botón", async () => {
  await mostrar(revision(), false, [], { ocupado: true });
  expect(el.querySelector('[role="status"]')?.textContent).toContain(
    "Actualizando precios",
  );
  expect(el.querySelector("button")).toBeNull();
  expect(el.querySelector("table")).toBeNull();
});
it("un error permite reintentar el cálculo", async () => {
  await mostrar(revision(), false, [], {
    error: "No se pudo conectar con el servidor.",
  });
  expect(el.querySelector('[role="alert"]')?.textContent).toContain(
    "No se pudo conectar",
  );
  expect(boton("Actualizar precios")).toBeUndefined();
  await act(async () => boton("Reintentar cálculo")!.click());
  expect(revisar).toHaveBeenCalledOnce();
});
it("un precio faltante permite reintentar después de corregir el tarifario", async () => {
  const r = revision();
  if (r.modalidad !== "TARIFARIO") throw new Error("fixture");
  r.calculado.estado = "PRECIO_PENDIENTE";
  await mostrar(r);
  await act(async () => boton("Reintentar cálculo")!.click());
  expect(revisar).toHaveBeenCalledOnce();
});
it("pedir el canal o consultar sin edición no ofrece reintentos", async () => {
  await mostrar(null, false, [], { faltaCanal: true });
  expect(el.textContent).toContain("Elegí un canal");
  expect(el.querySelector("button")).toBeNull();
  await mostrar(null, false, [], {
    editable: false,
    error: "Error de cálculo",
  });
  expect(el.querySelector("button")).toBeNull();
});
it("una revisión histórica sin desglose no ofrece otra acción de cálculo", async () => {
  const r = revision();
  if (r.modalidad !== "TARIFARIO") throw new Error("fixture");
  r.resumenPrecios = undefined;
  await mostrar(r);
  expect(el.textContent).toBe("");
});
