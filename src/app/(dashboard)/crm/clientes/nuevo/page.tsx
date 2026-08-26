import dynamicImport from "next/dynamic";
import { createEmptyCliente } from "@/lib/clientes";
import { SinPermiso } from "@/components/navigation/sin-permiso";
import { tienePermiso } from "@/lib/permisos-server";
import { ModulePageSkeleton } from "@/components/dashboard/module-page-skeleton";
const ClienteFicha = dynamicImport(() => import("@/components/clientes/cliente-ficha").then((m) => m.ClienteFicha), { loading: () => <ModulePageSkeleton variant="detail" /> });
export default async function Page() { if (!(await tienePermiso("crm.gestionar"))) return <SinPermiso modulo="Gestionar clientes" />; return <ClienteFicha cliente={createEmptyCliente()} mode="create" />; }
