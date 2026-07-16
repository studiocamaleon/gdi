import { notFound } from "next/navigation";

import { PropuestaFicha } from "@/components/comercial/propuesta-ficha";
import { ApiError } from "@/lib/api";
import { getClientes } from "@/lib/clientes-api";
import type { ClienteDetalle } from "@/lib/clientes";
import { getOrdenTrabajo } from "@/lib/ordenes-trabajo-api";
import { getProductos } from "@/lib/productos-servicios-api";
import type { ProductoListItem } from "@/lib/productos-servicios";

export const dynamic = "force-dynamic";

export default async function OrdenTrabajoDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ ordenId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { ordenId } = await params;
  const { emitida } = await searchParams;

  let detalle;
  try {
    detalle = await getOrdenTrabajo(ordenId);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  // Clientes para el combobox del modo edición y catálogo de productos
  // para agregar/editar items (mientras la orden esté en borrador/pendiente).
  let clientes: ClienteDetalle[] = [];
  let productos: ProductoListItem[] = [];
  try {
    clientes = await getClientes({ limit: 30 });
  } catch {
    clientes = [];
  }
  try {
    productos = await getProductos(true);
  } catch {
    productos = [];
  }

  // La OT se ve con la MISMA ficha de creación (consistencia total),
  // rehidratada desde la persistencia; editable según su estado.
  return (
    <PropuestaFicha
      orden={detalle}
      initialClientes={clientes}
      initialProductos={productos}
      recienEmitida={emitida === "1"}
    />
  );
}
