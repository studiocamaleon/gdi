import { Suspense } from "react";

import { PropuestaFicha } from "@/components/comercial/propuesta-ficha";
import { ModulePageSkeleton } from "@/components/dashboard/module-page-skeleton";
import { getClientes } from "@/lib/clientes-api";
import type { ClienteDetalle } from "@/lib/clientes";
import { tryGetCurrentUser, type CurrentUser } from "@/lib/auth";
import { getCargosDirectosCatalogo, getProductos } from "@/lib/productos-servicios-api";
import type { CargoDirectoCatalogo, ProductoListItem } from "@/lib/productos-servicios";

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
  let cargosDirectos: CargoDirectoCatalogo[] = [];
  let currentUser: CurrentUser | null = null;

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

  try {
    cargosDirectos = await getCargosDirectosCatalogo(true);
  } catch {
    cargosDirectos = [];
  }

  try {
    currentUser = (await tryGetCurrentUser())?.currentUser ?? null;
  } catch {
    currentUser = null;
  }

  return (
    <PropuestaFicha
      initialClientes={clientes}
      initialProductos={productos}
      initialCargosDirectos={cargosDirectos}
      currentUser={currentUser}
    />
  );
}
