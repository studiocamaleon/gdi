import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { PanelGeneralView, saludoSegunMomento } from "./panel-general-view";
import type { PanelGeneralData } from "@/lib/panel-general-api";

const base: PanelGeneralData = {
  generadoEl: "2026-08-18T15:00:00.000Z",
  fechaLocal: "2026-08-18",
  kpis: [],
  atencion: [],
  atencionTotal: 0,
  entregas: {
    hoy: { items: [], total: 0 },
    atrasada: { items: [], total: 0 },
    proxima: { items: [], total: 0 },
  },
  taller: null,
  accionesRapidas: [],
};
const render = (data: PanelGeneralData = base) =>
  renderToStaticMarkup(
    <PanelGeneralView initialData={data} nombreUsuario="Lucas" />,
  );

describe("Panel general único", () => {
  it("usa el diseño de Administrador sin depender del rol y elimina los controles de vista y actualización", () => {
    const html = render();
    expect(html).toContain('data-panel-vista="administrador"');
    expect(html).toContain("Tu operación, de un vistazo");
    expect(html).toContain("Entregas a priorizar");
    expect(html).not.toContain("Vista del Panel general");
    expect(html).not.toContain("Actualizar");
    expect(html).not.toContain("Estás previsualizando");
    expect(html).not.toContain("Mi mesa");
    expect(html).not.toContain("Actividad reciente"); // El resumen empresarial no vino autorizado.
  });

  it("no expone acciones o bloques que la API no autorizó", () => {
    const html = render({
      ...base,
      entregas: null,
      administrador: null,
      accionesRapidas: [
        {
          id: "mi-mesa",
          etiqueta: "Abrir mi mesa",
          href: "/produccion/tablero",
          icono: "produccion",
        },
      ],
    });
    expect(html).toContain('data-panel-vista="administrador"');
    expect(html).toContain("Abrir mi mesa");
    expect(html).not.toContain("Crear orden");
    expect(html).not.toContain("Ver órdenes");
    expect(html).not.toContain("Estado de planta");
    expect(html).not.toContain("Ver toda");
  });

  it("presenta métricas reales y actividad autorizada sin confundir ítems con órdenes", () => {
    const html = render({
      ...base,
      taller: {
        itemsActivos: 26,
        pasosEnCurso: 1,
        pasosBloqueados: 2,
        cuelloBotella: null,
      },
      administrador: {
        pasosCompletadosHoy: 8,
        documentacionPendiente: { total: 0, ordenes: [] },
        actividad: {
          siguienteCursor: null,
          items: [
            {
              id: "orden:1",
              fecha: base.generadoEl,
              tipo: "orden.emision",
              titulo: "OT-001 emitida",
              detalle: "Al taller",
              actor: "Lucas",
              href: "/produccion/ordenes/1",
            },
          ],
        },
      },
    });
    expect(html).toContain("Ítems activos");
    expect(html).toContain("Pasos completados hoy");
    expect(html).toContain("OT-001 emitida");
    expect(html).toContain('href="/produccion/ordenes/1"');
    expect(html).not.toContain("Órdenes activas");
  });

  it("conserva los indicadores y acciones administrativos en el mismo diseño", () => {
    const html = render({
      ...base,
      entregas: null,
      kpis: [
        {
          id: "deuda-vencida",
          etiqueta: "Cobros vencidos",
          valor: 3,
          formato: "cantidad",
          tono: "critico",
          detalle: "$ 120.000",
          href: "/administracion/deudores",
        },
      ],
      atencion: [
        {
          id: "egresos-vencidos",
          dominio: "administracion",
          severidad: "critico",
          titulo: "Pagos vencidos",
          detalle: "$ 30.000 pendientes de pago.",
          cantidad: 2,
          href: "/administracion/cuentas-por-pagar",
        },
      ],
      atencionTotal: 1,
      accionesRapidas: [
        {
          id: "egreso",
          etiqueta: "Registrar egreso",
          href: "/administracion/egresos?accion=nuevo",
          icono: "egreso",
        },
      ],
    });
    expect(html).toContain('data-panel-vista="administrador"');
    expect(html).toContain("Cobros vencidos");
    expect(html).toContain("Pagos vencidos");
    expect(html).toContain('href="/administracion/deudores"');
    expect(html).toContain('href="/administracion/cuentas-por-pagar"');
    expect(html).toContain('href="/administracion/egresos?accion=nuevo"');
  });

  it("adapta el saludo a la hora del tenant", () => {
    const zona = "America/Argentina/Buenos_Aires";
    expect(saludoSegunMomento("2026-08-18T14:59:00Z", zona)).toBe("Buen día");
    expect(saludoSegunMomento("2026-08-18T15:00:00Z", zona)).toBe(
      "Buenas tardes",
    );
    expect(saludoSegunMomento("2026-08-18T22:59:00Z", zona)).toBe(
      "Buenas tardes",
    );
    expect(saludoSegunMomento("2026-08-18T23:00:00Z", zona)).toBe(
      "Buenas noches",
    );
  });

  it("conserva los estados de carga y vacío sin reintroducir el botón Actualizar", () => {
    const carga = renderToStaticMarkup(
      <PanelGeneralView initialData={null} nombreUsuario="Lucas" />,
    );
    expect(carga).toContain("Cargando Panel general");
    expect(carga).not.toContain("Actualizar");
    const vacio = render();
    expect(vacio).toContain("Todo bajo control");
    expect(vacio).toContain("Sin entregas para hoy");
  });
});
