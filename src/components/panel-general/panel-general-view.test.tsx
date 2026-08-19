import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import { PanelGeneralView, saludoSegunMomento } from "./panel-general-view";
import type { PanelGeneralData } from "@/lib/panel-general-api";

const base: PanelGeneralData = {
  generadoEl: "2026-08-18T15:00:00.000Z",
  fechaLocal: "2026-08-18",
  vistaActual: "actual",
  previsualizando: false,
  vistasDisponibles: [
    {
      id: "actual",
      etiqueta: "Mi vista · Administrador",
      descripcion: "Tus permisos efectivos",
    },
  ],
  kpis: [],
  atencion: [],
  atencionTotal: 0,
  proximasEntregas: [],
  proximasEntregasTotal: 0,
  trabajoPersonal: { tareas: [], total: 0 },
  taller: null,
  administracion: null,
  vendedorSinVinculo: false,
  accionesRapidas: [],
};

describe("PanelGeneralView", () => {
  it("adapta el saludo a la hora local del tenant", () => {
    const zona = "America/Argentina/Buenos_Aires";

    expect(saludoSegunMomento("2026-08-18T14:59:00.000Z", zona)).toBe(
      "Buen día",
    );
    expect(saludoSegunMomento("2026-08-18T15:00:00.000Z", zona)).toBe(
      "Buenas tardes",
    );
    expect(saludoSegunMomento("2026-08-18T22:59:00.000Z", zona)).toBe(
      "Buenas tardes",
    );
    expect(saludoSegunMomento("2026-08-18T23:00:00.000Z", zona)).toBe(
      "Buenas noches",
    );
  });

  it("renderiza KPIs, alertas y enlaces administrativos accionables", () => {
    const data: PanelGeneralData = {
      ...base,
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
      administracion: {
        cobrosVencidos: 3,
        porFacturar: 1,
        pagosVencidos: 2,
        acreditacionesPendientes: 4,
      },
      accionesRapidas: [
        {
          id: "cobro",
          etiqueta: "Registrar cobro",
          href: "/administracion/cobros/nuevo",
          icono: "cobro",
        },
      ],
    };

    const html = renderToStaticMarkup(
      <PanelGeneralView initialData={data} nombreUsuario="Lucía Gómez" />,
    );

    expect(html).toContain("Buenas tardes, Lucía");
    expect(html).toContain("Cobros vencidos");
    expect(html).toContain("Pagos vencidos");
    expect(html).toContain("Pendientes administrativos");
    expect(html).toContain('href="/administracion/deudores"');
    expect(html).toContain('href="/administracion/cuentas-por-pagar"');
    expect(html).toContain('href="/administracion/cobros/nuevo"');
    expect(html).not.toMatch(/margen|punto de equilibrio|ventas del período/i);
  });

  it("ofrece al administrador las vistas previsualizables", () => {
    const data: PanelGeneralData = {
      ...base,
      vistaActual: "operario",
      previsualizando: true,
      vistasDisponibles: [
        ...base.vistasDisponibles,
        {
          id: "jefe_produccion",
          etiqueta: "Jefe de producción",
          descripcion: "Taller, entregas y carga",
        },
        {
          id: "vendedor",
          etiqueta: "Vendedor",
          descripcion: "Sus presupuestos y órdenes",
        },
        {
          id: "administrativo",
          etiqueta: "Administrativo",
          descripcion: "Cobros, facturación y egresos",
        },
        {
          id: "operario",
          etiqueta: "Operario",
          descripcion: "Su mesa y bloqueos propios",
        },
      ],
    };

    const html = renderToStaticMarkup(
      <PanelGeneralView initialData={data} nombreUsuario="Lucas" />,
    );

    expect(html).toContain('aria-label="Vista del Panel general"');
    expect(html).toContain("Jefe de producción");
    expect(html).toContain("Vendedor");
    expect(html).toContain("Administrativo");
    expect(html).toContain("Operario");
    expect(html).toContain("Tus permisos no cambiaron");
  });

  it("muestra únicamente la mesa propia en la variante de operario", () => {
    const data: PanelGeneralData = {
      ...base,
      trabajoPersonal: {
        total: 1,
        tareas: [
          {
            pasoId: "paso-1",
            ordenId: "ot-1",
            ordenNumero: "OT-0042",
            itemNombre: "Banner",
            pasoNombre: "Impresión",
            estado: "en_curso",
            motivoBloqueo: null,
            activa: true,
            href: "/produccion/tablero",
          },
        ],
      },
      accionesRapidas: [
        {
          id: "mi-mesa",
          etiqueta: "Abrir mi mesa",
          href: "/produccion/tablero",
          icono: "produccion",
        },
      ],
    };

    const html = renderToStaticMarkup(
      <PanelGeneralView initialData={data} nombreUsuario="Operario Uno" />,
    );

    expect(html).toContain("Mi mesa");
    expect(html).toContain("OT-0042");
    expect(html).toContain("Impresión");
    expect(html).toContain("Ahora");
    expect(html).not.toContain("Estado del taller");
    expect(html).not.toContain("Pendientes administrativos");
  });

  it("incluye el estado vacío completo cuando no hay pendientes ni entregas", () => {
    const html = renderToStaticMarkup(
      <PanelGeneralView initialData={base} nombreUsuario="" />,
    );

    expect(html).toContain("Todo bajo control");
    expect(html).toContain("Tu mesa está libre");
    expect(html).toContain("Sin entregas próximas");
    expect(html).toContain("Actualizar");
  });
});
