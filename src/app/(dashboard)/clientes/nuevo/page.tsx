import dynamicImport from "next/dynamic";

import { createEmptyCliente } from "@/lib/clientes";
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

export default function NuevoClientePage() {
  return <ClienteFicha cliente={createEmptyCliente()} mode="create" />;
}
