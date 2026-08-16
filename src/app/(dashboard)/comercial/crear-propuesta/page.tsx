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
  const [clientesResult, productosResult, cargosResult, usuarioResult] =
    await Promise.allSettled([
      getClientes({ limit: 30 }),
      getProductos(true),
      getCargosDirectosCatalogo(true),
      tryGetCurrentUser(),
    ]);
  const clientes: ClienteDetalle[] =
    clientesResult.status === "fulfilled" ? clientesResult.value : [];
  const productos: ProductoListItem[] =
    productosResult.status === "fulfilled" ? productosResult.value : [];
  const cargosDirectos: CargoDirectoCatalogo[] =
    cargosResult.status === "fulfilled" ? cargosResult.value : [];
  const currentUser: CurrentUser | null =
    usuarioResult.status === "fulfilled"
      ? (usuarioResult.value?.currentUser ?? null)
      : null;
  const initialLoadErrors = [
    clientesResult.status === "rejected" ? "clientes" : null,
    productosResult.status === "rejected" ? "productos" : null,
    cargosResult.status === "rejected" ? "cargos" : null,
    usuarioResult.status === "rejected" ? "usuario" : null,
  ].filter((value): value is string => value !== null);

  return (
    <PropuestaFicha
      initialClientes={clientes}
      initialProductos={productos}
      initialCargosDirectos={cargosDirectos}
      currentUser={currentUser}
      initialLoadErrors={initialLoadErrors}
    />
  );
}
