import dynamicImport from "next/dynamic";

import { createEmptyCliente } from "@/lib/clientes";
import { SinPermiso } from "@/components/navigation/sin-permiso";
import { tienePermiso } from "@/lib/permisos-server";
import { ModulePageSkeleton } from "@/components/dashboard/module-page-skeleton";

const ClienteFicha = dynamicImport(
  () =>
    import("@/components/clientes/cliente-ficha").then(
      (module) => module.ClienteFicha,
    ),
  {
    loading: () => <ModulePageSkeleton variant="detail" />,
  },
);

export default async function NuevoClientePage() {
  if (!(await tienePermiso("registros.gestionar"))) {
    return <SinPermiso modulo="Gestionar clientes" />;
  }
  return <ClienteFicha cliente={createEmptyCliente()} mode="create" />;
}
