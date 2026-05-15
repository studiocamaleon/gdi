import { Suspense } from "react";

import { PropuestaFicha } from "@/components/comercial/propuesta-ficha";
import { ModulePageSkeleton } from "@/components/dashboard/module-page-skeleton";
import { getClientes } from "@/lib/clientes-api";
import type { ClienteDetalle } from "@/lib/clientes";
import { getProductos } from "@/lib/productos-servicios-api";
import type { ProductoListItem } from "@/lib/productos-servicios";

export const dynamic = "force-dynamic";

export default function CrearPropuestaPage() {
  return (
    <Suspense fallback={<ModulePageSkeleton variant="workspace" />}>
      <CrearPropuestaContent />
    </Suspense>
  );
}

async function CrearPropuestaContent() {
  let clientes: ClienteDetalle[] = [];
  let productos: ProductoListItem[] = [];

  try {
    clientes = await getClientes();
  } catch {
    clientes = [];
  }

  try {
    productos = await getProductos(true);
  } catch {
    productos = [];
  }

  return <PropuestaFicha initialClientes={clientes} initialProductos={productos} />;
}
