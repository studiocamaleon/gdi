"use client";

import { useMemo, useState } from "react";
import {
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import type { PropuestaItem } from "@/lib/propuestas";
import { getItemOrderVisibleAmounts } from "@/lib/orden-productos-presentacion";

function columnasProductos(
  sinComprobante: boolean,
): ColumnDef<PropuestaItem>[] {
  return [
    {
      id: "producto",
      accessorFn: (item) =>
        [
          item.productoNombre,
          item.varianteNombre,
          item.productoCodigo,
          item.categoriaComercialNombre,
          item.subcategoriaComercialNombre,
        ]
          .filter(Boolean)
          .join(" "),
      header: "Producto",
    },
    { accessorKey: "cantidad", header: "Cantidad" },
    {
      id: "subtotal",
      accessorFn: (item) => getItemOrderVisibleAmounts(item).subtotal,
      header: "Subtotal",
    },
    {
      id: "impuestos",
      accessorFn: (item) => getItemOrderVisibleAmounts(item).impuestos,
      header: "Impuestos",
    },
    {
      id: "unitario",
      header: "Unitario",
      enableSorting: false,
    },
    {
      id: "total",
      accessorFn: (item) =>
        getItemOrderVisibleAmounts(item)[sinComprobante ? "subtotal" : "total"],
      header: "Total",
    },
    { id: "acciones", enableSorting: false },
  ];
}

/** Estado de tabla independiente del diseño y del estado comercial de la OT.
 * Los ítems ya están cargados para cotizar la orden completa; ordenar
 * sólo cambia la vista. Los totales se calculan con la colección comercial original.
 */
export function useOrdenProductosTable(
  items: PropuestaItem[],
  sinComprobante: boolean,
) {
  "use no memo"; // TanStack Table v8 expone una instancia mutable.
  const columns = useMemo(
    () => columnasProductos(sinComprobante),
    [sinComprobante],
  );
  const [sorting, setSorting] = useState<SortingState>([]);
  // eslint-disable-next-line react-hooks/incompatible-library -- v8 se mantiene fuera de React Compiler; no memoizar la instancia.
  return useReactTable({
    data: items,
    columns,
    getRowId: (item) => item.id,
    state: {
      sorting,
      columnVisibility: { impuestos: !sinComprobante },
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
}
