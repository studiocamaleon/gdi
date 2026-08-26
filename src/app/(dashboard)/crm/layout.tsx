import { SinPermiso } from "@/components/navigation/sin-permiso";
import { tienePermiso } from "@/lib/permisos-server";
export default async function CrmLayout({ children }: { children: React.ReactNode }) { return (await tienePermiso("crm.ver")) ? <>{children}</> : <SinPermiso modulo="CRM" />; }
