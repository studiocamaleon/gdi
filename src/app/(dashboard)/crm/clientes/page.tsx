import { Suspense } from "react";
import { ClientesTable } from "@/components/clientes/clientes-table";
import { ModulePageSkeleton } from "@/components/dashboard/module-page-skeleton";
import { listClientes } from "@/lib/clientes-api";
import { tienePermiso } from "@/lib/permisos-server";
export const dynamic = "force-dynamic";
export default function Page() { return <Suspense fallback={<ModulePageSkeleton variant="table" />}><Content /></Suspense>; }
async function Content() { const [response, canManage] = await Promise.all([listClientes({ page: 1, limit: 25 }), tienePermiso("crm.gestionar")]); return <ClientesTable initialResponse={response} canManage={canManage} />; }
