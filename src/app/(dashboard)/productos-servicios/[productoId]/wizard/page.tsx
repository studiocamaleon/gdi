import { notFound } from "next/navigation";

import { ProductoWizard } from "@/components/productos-servicios/producto-wizard";
import { ApiError } from "@/lib/api";
import {
  getCargosDirectosCatalogo,
  getProductoById,
  getRutas,
} from "@/lib/productos-servicios-api";

export const dynamic = "force-dynamic";

export default async function ProductoWizardPage({
  params,
}: {
  params: Promise<{ productoId: string }>;
}) {
  const { productoId } = await params;
  try {
    const [producto, rutasDisponibles, catalogoCargos] = await Promise.all([
      getProductoById(productoId),
      getRutas(),
      getCargosDirectosCatalogo(true),
    ]);
    return (
      <ProductoWizard
        modo="editar"
        productoExistente={producto}
        rutasDisponibles={rutasDisponibles}
        catalogoCargos={catalogoCargos}
      />
    );
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      notFound();
    }
    throw err;
  }
}
