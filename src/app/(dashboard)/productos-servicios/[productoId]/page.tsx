import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ModulePageSkeleton } from "@/components/dashboard/module-page-skeleton";
import { ProductoDetalleView } from "@/components/productos-servicios/producto-detalle-view";
import { ApiError } from "@/lib/api";
import { getProductoById } from "@/lib/productos-servicios-api";

export const dynamic = "force-dynamic";

export default async function ProductoDetallePage({
  params,
}: {
  params: Promise<{ productoId: string }>;
}) {
  return (
    <Suspense fallback={<ModulePageSkeleton variant="detail" />}>
      <ProductoDetalleContent params={params} />
    </Suspense>
  );
}

async function ProductoDetalleContent({
  params,
}: {
  params: Promise<{ productoId: string }>;
}) {
  const { productoId } = await params;
  try {
    const producto = await getProductoById(productoId);
    return <ProductoDetalleView producto={producto} />;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      notFound();
    }
    throw err;
  }
}
