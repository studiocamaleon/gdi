import { FuncionNoIncluida } from "@/components/navigation/funcion-no-incluida";
import { puedeConfigurar, tieneCapacidad } from "@/lib/capacidades-server";
import { DesignSystemProvider } from "@/components/design-system/appearance";
import dynamicImport from "next/dynamic";
import { createEmptyCliente } from "@/lib/clientes";
import { SinPermiso } from "@/components/navigation/sin-permiso";
import { ModulePageSkeleton } from "@/components/dashboard/module-page-skeleton";
const ClienteFicha = dynamicImport(
  () =>
    import("@/components/clientes/cliente-ficha").then((m) => m.ClienteFicha),
  { loading: () => <ModulePageSkeleton variant="detail" /> },
);
export default async function Page() {
  if (!(await tieneCapacidad("clientes"))) return <FuncionNoIncluida />;
  if (!(await puedeConfigurar("clientes", "crm.gestionar")))
    return <SinPermiso modulo="Gestionar clientes" />;
  return (
    <DesignSystemProvider theme="brand" appearance="light">
      <ClienteFicha cliente={createEmptyCliente()} mode="create" />
    </DesignSystemProvider>
  );
}
