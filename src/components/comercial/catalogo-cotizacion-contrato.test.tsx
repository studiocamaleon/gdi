import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { productoParaCotizacion } from "../../../apps/api/src/productos-servicios/producto-cotizacion-publico";
import type { ProductoListItem } from "@/lib/productos-servicios";
import { AgregarProductoSheet } from "./agregar-producto-sheet";

vi.mock("./tipo-cambio-documento", () => ({
  useMotorConTipoCambio: () => ({ cotizar: vi.fn(), cotizarEnSegundoPlano: vi.fn() }),
}));

describe("contrato entre el catálogo comercial y Crear propuesta", () => {
  it.each([{ esquema: [] }, { esquema: [{ key: "detalle", label: "Detalle", tipo: "text", visible: true, orden: 10 }] }])(
    "renderiza la pantalla inicial con productos proyectados y esquema %j",
    ({ esquema: atributosSchemaJson }) => {
      const producto = JSON.parse(JSON.stringify(productoParaCotizacion({
        id: "producto-ficticio", codigo: "PRUEBA", nombre: "Producto ficticio",
        estructuraProducto: "SIMPLE", unidadComercial: "unidad", modoMedidas: "FIJA",
        atributosComercialesJson: {}, medidasPredefinidasJson: [], rutasAlternativas: [],
        subcategoriaComercial: {
          codigo: "papeleria", nombre: "Papelería", atributosSchemaJson,
          categoria: { codigo: "impresos", nombre: "Impresos" },
        },
      }))) as ProductoListItem;

      // El selector está cerrado al cargar la página, pero prepara el catálogo
      // durante el render del servidor. Un campo perdido rompe toda la página.
      expect(() => renderToStaticMarkup(<AgregarProductoSheet
        open={false} onOpenChange={() => {}} productos={[producto]}
        fechaEntregaDefault="" onAddItem={() => {}}
      />)).not.toThrow();
      expect(producto.subcategoriaComercial.atributosSchemaJson).toEqual(atributosSchemaJson);
    },
  );
});
