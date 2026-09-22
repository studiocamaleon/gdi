import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { MembershipRole } from "@/lib/auth";
import type { PresupuestoDetalle } from "@/lib/presupuestos-api";
import { PresupuestoDetalleView } from "./presupuesto-detalle-view";
import { CapacidadesProvider } from "@/components/navigation/capacidades-provider";
import { OrdenSaveActions } from "./orden-resumen-financiero";
import { funcionesCompatibles } from "@/lib/capacidades";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

const item: PresupuestoDetalle["items"][number] = {
  cotizacionItemId: "item-1",
  codigo: "CAT-1",
  nombre: "Producto de prueba",
  familia: "Impresión",
  cantidad: 500,
  cantidadUnidad: "u.",
  subtotal: 900,
  impuestos: 189,
  total: 1089,
  descuentoMonto: 100,
  descuentoPct: 10,
  totalLista: 1210,
  specs: [{ etiqueta: "Material", valor: "Papel ilustración 300 g" }],
  adicionales: ["Laminado mate"],
  conversion: null,
};
const inicial: PresupuestoDetalle = {
  id: "presupuesto-1",
  numero: "PRES-PRUEBA",
  estado: "enviado",
  cliente: { id: "cliente-1", nombre: "Cliente de prueba" },
  vendedor: null,
  proyectoCampana: null,
  canalVenta: "mostrador",
  fechaEmision: "2026-09-15",
  fechaValidez: "2026-09-30",
  fechaEnvio: null,
  fechaResuelto: null,
  primeraVistaEl: null,
  motivoPerdida: null,
  motivoPerdidaDetalle: null,
  aprobacionMotivos: [],
  aprobacionSolicitadaEl: null,
  aprobacionResueltaPor: null,
  observaciones: "Entregar embalado",
  senaSugeridaPct: 50,
  subtotal: 900,
  impuestos: 189,
  total: 1089,
  cargosDirectos: 0,
  fechaEntrega: "2026-10-01",
  publicToken: "token-de-prueba",
  ordenConvertida: null,
  ordenConvertidaId: null,
  ordenesConvertidas: [],
  descuentoTotal: 100,
  fidelizacion: {
    puntosEstimados: 20,
    canjePuntos: 0,
    canjeMonto: 0,
    estado: "pendiente",
  },
  items: [item],
  eventos: [],
};
const render = (
  overrides: Partial<PresupuestoDetalle> = {},
  rol: MembershipRole = "operador",
) =>
  renderToStaticMarkup(
    <PresupuestoDetalleView inicial={{ ...inicial, ...overrides }} rol={rol} />,
  );
const button = (html: string, label: string) =>
  [...html.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)].find(([markup]) =>
    markup.includes(label),
  )?.[0];

describe("acciones y datos de la ficha de presupuesto", () => {
  const sinFunciones = (props: Partial<PresupuestoDetalle> = {}) =>
    renderToStaticMarkup(
      <CapacidadesProvider capacidades={{ funciones: {
        ...funcionesCompatibles, presupuestos: false, ordenes: false,
        aprobacion_presupuestos: false, documentos_pdf: false,
      } }}>
        <PresupuestoDetalleView inicial={{ ...inicial, ...props }} rol="administrador" />
      </CapacidadesProvider>,
    );

  it("preserva decisiones y enlaces previos al retirar la función; no ofrece generar PDF", () => {
    const html = sinFunciones({ pdfDisponible: false });
    expect(button(html, "Registrar aprobación")).not.toContain("disabled");
    expect(html).toContain("Copiar link");
    expect(html).not.toContain("/presupuesto-1/pdf");
    expect(html).toContain("Producto de prueba");
  });

  it("permite descargar un PDF guardado aunque la generación esté excluida", () => {
    expect(sinFunciones({ pdfDisponible: true })).toContain("/presupuesto-1/pdf");
  });

  it("deshabilita emisión y conversión pero conserva la consulta", () => {
    expect(button(sinFunciones({ estado: "borrador" }), "Enviar al cliente")).toContain("disabled");
    expect(button(sinFunciones({ estado: "aprobado" }), "Convertir en orden")).toContain("disabled");
  });

  it("sin enlace público explica cómo registrar la decisión por otro canal", () => {
    const html = sinFunciones({ publicToken: null });
    expect(html).toContain("Registrá la respuesta que recibiste del cliente.");
    expect(html).not.toContain("Compartile el link");
  });

  it.each(["orden", "presupuesto"] as const)("protege la acción comercial %s desde la cabecera", (tipo) => {
    const html = renderToStaticMarkup(
      <CapacidadesProvider capacidades={{ funciones: {
        ...funcionesCompatibles, [tipo === "orden" ? "ordenes" : "presupuestos"]: false,
      } }}>
        <OrdenSaveActions tipo={tipo} empty={false} clienteSeleccionado />
      </CapacidadesProvider>,
    );
    expect(button(html, tipo === "orden" ? "Emitir OT" : "Emitir presupuesto")).toContain("disabled");
    if (tipo === "orden") expect(button(html, "Guardar borrador")).toContain("disabled");
  });

  it("ofrece una única descarga con preparación asíncrona", () => {
    const html = render();
    expect(html).not.toContain("PDF piloto");
    expect(html).toContain('href="/comercial/presupuestos/presupuesto-1/pdf"');
  });
  it("mantiene el detalle comercial y los descuentos del snapshot", () => {
    const html = render();
    for (const value of [
      "Producto de prueba",
      "Papel ilustración 300 g",
      "Laminado mate",
      "Entregar embalado",
      "10%",
      "50%",
      "20 puntos",
    ]) {
      expect(html).toContain(value);
    }
    expect(html).toContain("1.089");
    expect(html).toContain("/comercial/presupuestos/presupuesto-1/pdf");
  });

  it("un enviado permite registrar la decisión del cliente y todavía no convertir", () => {
    const html = render();
    expect(button(html, "Registrar rechazo")).toBeDefined();
    expect(button(html, "Registrar aprobación")).toBeDefined();
    expect(button(html, "Convertir en orden")).toBeUndefined();
    expect(button(html, "Enviar al cliente")).toBeUndefined();
  });

  it.each([
    "borrador",
    "pendiente_aprobacion",
    "aprobado",
    "rechazado",
    "vencido",
    "convertido",
  ] as const)(
    "no ofrece registrar aprobación del cliente en estado %s",
    (estado) => {
      expect(
        button(render({ estado }), "Registrar aprobación"),
      ).toBeUndefined();
    },
  );

  it("la aprobación interna sólo ofrece acciones a administrador y supervisor", () => {
    const pendiente: Partial<PresupuestoDetalle> = {
      estado: "pendiente_aprobacion",
      aprobacionMotivos: [
        { regla: "monto", detalle: "Supera el monto permitido" },
      ],
    };
    const operador = render(pendiente);
    expect(operador).toContain("Supera el monto permitido");
    expect(button(operador, "Aprobar y enviar")).toBeUndefined();
    expect(button(operador, "Devolver")).toBeUndefined();
    for (const rol of ["administrador", "supervisor"] as const) {
      const html = render(pendiente, rol);
      expect(button(html, "Aprobar y enviar")).toBeDefined();
      expect(button(html, "Devolver")).toBeDefined();
    }
  });

  it("habilita convertir sólo con productos pendientes seleccionados", () => {
    const aprobado = render({ estado: "aprobado" });
    expect(button(aprobado, "Convertir en orden")).not.toMatch(
      / disabled(?:[=>\s])/,
    );
    const sinPendientes = render({
      estado: "aprobado",
      items: [{ ...item, conversion: { id: "ot-1", numero: "OT-1" } }],
    });
    expect(button(sinPendientes, "Convertir en orden")).toMatch(
      / disabled(?:[=>\s])/,
    );
  });

  it("conserva enlaces a todas las órdenes convertidas", () => {
    const html = render({
      estado: "convertido",
      ordenesConvertidas: [
        { id: "ot-1", numero: "OT-1" },
        { id: "ot-2", numero: "OT-2" },
      ],
    });
    expect(html).toContain('href="/produccion/ordenes/ot-1"');
    expect(html).toContain('href="/produccion/ordenes/ot-2"');
    expect(button(html, "Convertir en orden")).toBeUndefined();
  });

  it("sólo el borrador ofrece enviar al cliente", () => {
    expect(
      button(
        render({ estado: "borrador", publicToken: null }),
        "Enviar al cliente",
      ),
    ).toBeDefined();
    for (const estado of ["rechazado", "vencido"] as const) {
      const html = render({ estado });
      expect(button(html, "Enviar al cliente")).toBeUndefined();
      expect(button(html, "Convertir en orden")).toBeUndefined();
    }
  });
});
