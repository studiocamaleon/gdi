import { SinPermiso } from "@/components/navigation/sin-permiso";
import { tienePermiso } from "@/lib/permisos-server";
import { notFound } from "next/navigation";

import { PropuestaFicha } from "@/components/comercial/propuesta-ficha";
import { ApiError } from "@/lib/api";
import { getClientes } from "@/lib/clientes-api";
import { getOrdenTrabajo } from "@/lib/ordenes-trabajo-api";
import { getCargosDirectosCatalogo, getProductos } from "@/lib/productos-servicios-api";
import { getEstadoDocumentalOrden } from "@/lib/desarrollo-documental-api";

export const dynamic = "force-dynamic";

export default async function OrdenTrabajoDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ ordenId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!(await tienePermiso("comercial.ordenes.ver", { exigirConfirmacion: true }))) {
    return <SinPermiso modulo="Órdenes de trabajo" />;
  }
  const { ordenId } = await params;
  const { emitida, convertida } = await searchParams;

  let detalle;
  try {
    detalle = await getOrdenTrabajo(ordenId);
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) return <SinPermiso modulo="Órdenes de trabajo" />;
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  // El catálogo recorre todas sus páginas. Al abrir la OT recién emitida,
  // la ficha ya puede mostrar sus productos y pide los selectores al editar.
  if (emitida === "1") {
    const documentos = await getEstadoDocumentalOrden(ordenId).catch(() => null);
    return <PropuestaFicha orden={detalle} recienEmitida initialDocumentos={documentos} />;
  }

  // Clientes para el combobox del modo edición y catálogo de productos
  // para agregar/editar items (mientras la orden esté en borrador/pendiente).
  const [cargos, documentos, clientes, productos] = await Promise.all([
    getCargosDirectosCatalogo(true, true).catch(() => []),
    getEstadoDocumentalOrden(ordenId).catch(() => null),
    getClientes({ limit: 30 }, true).catch(() => []),
    getProductos(true, true).catch(() => []),
  ]);

  // La OT se ve con la MISMA ficha de creación (consistencia total),
  // rehidratada desde la persistencia; editable según su estado.
  return (
    <PropuestaFicha
      orden={detalle}
      initialClientes={clientes}
      initialProductos={productos}
      initialCargosDirectos={cargos}
      recienConvertida={convertida === "1"}
      initialDocumentos={documentos}
    />
  );
}
