import { LayersIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { TableroItemData } from "@/lib/tablero-produccion";
import loteStyles from "./tablero-lotes.module.css";

export function EtiquetaLote({ item }: { item: TableroItemData }) {
  if (!item.loteEntrega) return null;
  return (
    <span className={loteStyles.etiqueta}>
      <Badge variant="outline">
        <LayersIcon data-icon="inline-start" />
        {item.loteEntrega.nombre}
      </Badge>
    </span>
  );
}

export function ContextoLote({ item }: { item: TableroItemData }) {
  const lote = item.loteEntrega;
  if (!lote) return null;
  return (
    <div className={loteStyles.contexto}>
      <span>
        <strong>
          {lote.cantidad.toLocaleString("es-AR")} {lote.unidad}
        </strong>{" "}
        · {lote.esProductoDelLote ? "Producto del lote" : "Componente del lote"}
      </span>
      {!lote.esProductoDelLote ? (
        <span className={loteStyles.producto} title={lote.productoNombre}>
          {lote.productoNombre}
        </span>
      ) : null}
    </div>
  );
}
