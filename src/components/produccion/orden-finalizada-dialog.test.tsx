import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { OrdenFinalizadaDialog } from "./orden-finalizada-dialog";
import type { AvisoFinalizacionOrden } from "@/lib/ordenes-trabajo-api";

// El portal se comprueba en navegador; acá verificamos el contenido y las acciones.
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
const aviso: AvisoFinalizacionOrden = {
  ordenId: "ot-1",
  ordenNumero: "OT-2026-0060",
  clienteNombre: "Cliente de prueba",
  finalizadaEl: "2026-09-17T22:00:00Z",
  fechaEntrega: "2026-09-23",
  trabajos: [
    { id: "a", nombre: "Vinilo impreso", cantidad: 1.2, unidad: "m²" },
    { id: "b", nombre: "Tarjetas", cantidad: 500, unidad: "u" },
  ],
};

describe("aviso de finalización de una OT", () => {
  it("identifica la OT completa, el cliente y sus productos, con cantidades decimales", () => {
    const html = renderToStaticMarkup(
      <OrdenFinalizadaDialog aviso={aviso} puedeVerOrden onClose={() => {}} />,
    );
    for (const texto of [
      "Producción finalizada",
      "OT-2026-0060",
      "Cliente de prueba",
      "Vinilo impreso",
      "1,2",
      "m²",
      "Tarjetas",
      "500",
      "Entendido",
      "Descargar etiqueta",
    ])
      expect(html).toContain(texto);
    expect(html).toContain('href="/produccion/ordenes/ot-1"');
    expect(html).toContain("Mié 23 sep 2026");
    expect(html).not.toContain("Mar 22");
    expect(html).not.toContain("Marcar como entregada");
  });
  it("omite fecha ausente y acceso a la OT sin permiso", () => {
    const html = renderToStaticMarkup(
      <OrdenFinalizadaDialog
        aviso={{ ...aviso, fechaEntrega: null }}
        puedeVerOrden={false}
        onClose={() => {}}
      />,
    );
    expect(html).not.toContain("Entrega comprometida");
    expect(html).not.toContain("Ver OT");
    expect(html).not.toContain("href=");
    expect(html).toContain("Entendido");
  });
});
