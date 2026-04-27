import { ReceiptIcon } from "lucide-react";

import { PrecioCatalogoManager } from "@/components/productos-servicios/precio-catalogo-manager";
import {
  actualizarImpuestoCatalogo,
  crearImpuestoCatalogo,
  eliminarImpuestoCatalogo,
  getImpuestosCatalogo,
} from "@/lib/productos-servicios-api";

export const dynamic = "force-dynamic";

export default async function ImpuestosCatalogoPage() {
  const items = await getImpuestosCatalogo(false); // incluye inactivos
  return (
    <PrecioCatalogoManager
      initialItems={items}
      adapter={{
        entidadSingular: "impuesto",
        entidadPlural: "Impuestos",
        articuloSingular: "el impuesto",
        icono: ReceiptIcon,
        placeholderCodigo: "iva_21",
        placeholderNombre: "IVA 21%",
        placeholderDetalleJson: '{"jurisdiccion": "AR", "categoria": "general"}',
        tooltipPorcentaje:
          "Porcentaje del impuesto que se aplica sobre el subtotal (precio + comisiones).",
        tooltipDetalleJson:
          "Metadata adicional del impuesto (jurisdicción, categoría AFIP, código fiscal, etc.). El motor no usa este campo, queda como referencia para reportes y exportaciones.",
        crear: crearImpuestoCatalogo,
        actualizar: actualizarImpuestoCatalogo,
        eliminar: eliminarImpuestoCatalogo,
      }}
    />
  );
}
