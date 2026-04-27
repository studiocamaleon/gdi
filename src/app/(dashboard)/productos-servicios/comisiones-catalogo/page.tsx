import { PercentIcon } from "lucide-react";

import { PrecioCatalogoManager } from "@/components/productos-servicios/precio-catalogo-manager";
import {
  actualizarComisionCatalogo,
  crearComisionCatalogo,
  eliminarComisionCatalogo,
  getComisionesCatalogo,
} from "@/lib/productos-servicios-api";

export const dynamic = "force-dynamic";

export default async function ComisionesCatalogoPage() {
  const items = await getComisionesCatalogo(false);
  return (
    <PrecioCatalogoManager
      initialItems={items}
      adapter={{
        entidadSingular: "comisión",
        entidadPlural: "Comisiones",
        articuloSingular: "la comisión",
        icono: PercentIcon,
        placeholderCodigo: "vendedor_5",
        placeholderNombre: "Comisión vendedor 5%",
        placeholderDetalleJson: '{"tipo": "vendedor", "empleadoId": null}',
        tooltipPorcentaje:
          "Porcentaje de la comisión que se aplica sobre el precio base. Las comisiones se suman al precio antes de calcular impuestos.",
        tooltipDetalleJson:
          "Metadata del esquema (tipo: 'vendedor' o 'financiera', empleadoId asignado, condiciones especiales, etc.). El motor no usa este campo directamente.",
        crear: crearComisionCatalogo,
        actualizar: actualizarComisionCatalogo,
        eliminar: eliminarComisionCatalogo,
      }}
    />
  );
}
