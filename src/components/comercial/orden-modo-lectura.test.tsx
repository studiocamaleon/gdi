import { renderToStaticMarkup } from "react-dom/server";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { ArchivoUploader } from "@/components/archivos/archivo-uploader";
import { PagosTab } from "@/components/produccion/orden-trabajo-detalle-view";
import { ComprobantesOrdenTab } from "@/components/administracion/facturacion-orden";
import {
  getMockOrdenDetalle,
  type OrdenTrabajoEstado,
} from "@/lib/ordenes-trabajo";
import type { Archivo } from "@/lib/archivos";
import { NotificacionesProvider } from "@/components/notificaciones/notificaciones-provider";
import { PropuestaFicha } from "./propuesta-ficha";

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof React>()),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

const archivo: Archivo = {
  id: "arte-1",
  scope: "ORDEN_ITEM",
  nombre: "Arte final.pdf",
  mimeType: "application/pdf",
  bytes: 1500,
  publico: false,
  descripcion: null,
  autogeneradoPor: null,
  esImagen: false,
  createdAt: "2026-09-15",
  subidoPor: "Diseño",
};

describe("una OT se abre en modo consulta", () => {
  it.each<OrdenTrabajoEstado>([
    "borrador",
    "pendiente",
    "produccion",
    "finalizada",
    "entregada",
  ])(
    "%s: ofrece entrar en edición, pero no modificar ni ejecutar transiciones",
    (estado) => {
      const orden = { ...getMockOrdenDetalle("mock-0184")!, estado };
      const html = renderToStaticMarkup(
        <NotificacionesProvider>
          <PropuestaFicha orden={orden} />
        </NotificacionesProvider>,
      );
      expect(html).toContain("Editar orden");
      expect(html).not.toContain(
        'aria-label="Sin comprobante fiscal en el sistema"',
      );
      expect(html).not.toContain("Cancelar orden</");
      expect(html).not.toContain("Emitir OT</");
      expect(html).not.toContain("Registrar la entrega al cliente");
      expect(html).not.toContain('aria-label="Ver datos de entrega"');
    },
  );

  it("una orden cancelada mantiene la ficha cerrada a edición", () => {
    const orden = {
      ...getMockOrdenDetalle("mock-0184")!,
      estado: "cancelada" as const,
    };
    expect(
      renderToStaticMarkup(
        <NotificacionesProvider>
          <PropuestaFicha orden={orden} />
        </NotificacionesProvider>,
      ),
    ).not.toContain("Editar orden");
  });
});

describe("controles que respetan el modo consulta de la OT", () => {
  it("archivos permite descargar, pero no subir, cambiar visibilidad ni borrar", () => {
    const html = renderToStaticMarkup(
      <ArchivoUploader
        scope="ORDEN_ITEM"
        archivos={[archivo]}
        onCambio={vi.fn()}
        permitirPublico
        soloLectura
      />,
    );
    expect(html).toContain("Arte final.pdf");
    expect(html).toContain("/api/backend/archivos/arte-1/contenido");
    expect(html).not.toContain('type="file"');
    expect(html).not.toContain('title="Eliminar"');
    expect(html).not.toContain('type="checkbox"');
  });

  it("en edición el uploader vuelve a ofrecer subida y eliminación", () => {
    const html = renderToStaticMarkup(
      <ArchivoUploader
        scope="ORDEN_ITEM"
        archivos={[archivo]}
        onCambio={vi.fn()}
        permitirPublico
        soloLectura={false}
      />,
    );
    expect(html).toContain('type="file"');
    expect(html).toContain('title="Eliminar"');
    expect(html).toContain('type="checkbox"');
  });

  it("no muestra saldos ni permite cobrar mientras consulta los cobros", () => {
    const html = renderToStaticMarkup(
      <PagosTab ordenId="ot-1" pago={null} total={1000} soloLectura={false} />,
    );
    expect(html).toContain("Cargando cobros");
    expect(html).not.toContain("Saldo pendiente");
    expect(html).not.toContain("/administracion/cobros/nuevo");
  });

  it("con los cobros cargados, el acceso requiere edición y además una OT emitida", () => {
    const render = (soloLectura: boolean, puedeCobrar = true) => {
      // SSR no ejecuta efectos: simula una consulta terminada sin cobros.
      const estadoCobros = vi
        .spyOn(React, "useState")
        .mockImplementationOnce(() => [[], vi.fn()]);
      try {
        return renderToStaticMarkup(
          <PagosTab
            ordenId="ot-1"
            pago={null}
            total={1000}
            soloLectura={soloLectura}
            puedeCobrar={puedeCobrar}
          />,
        );
      } finally {
        estadoCobros.mockRestore();
      }
    };
    expect(render(true)).not.toContain("/administracion/cobros/nuevo");
    expect(render(false)).toContain("/administracion/cobros/nuevo");
    expect(render(false, false)).not.toContain("/administracion/cobros/nuevo");
  });

  it("Comprobantes tampoco ofrece registrar cobros fuera de edición", () => {
    const render = (soloLectura: boolean) =>
      renderToStaticMarkup(
        <ComprobantesOrdenTab
          ordenId="ot-1"
          numero="OT-1"
          total={1000}
          facturadoInicial={0}
          cobradoInicial={0}
          puedeFacturar
          soloLectura={soloLectura}
        />,
      );
    expect(render(true)).not.toContain("/administracion/cobros/nuevo");
    expect(render(false)).toContain("/administracion/cobros/nuevo");
  });
});
