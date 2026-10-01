import { SinPermiso } from "@/components/navigation/sin-permiso";
import { tieneSeccion } from "@/lib/permisos-server";
export default async function CrmLayout({ children }: { children: React.ReactNode }) { return (await tieneSeccion("crm")) ? <>{children}</> : <SinPermiso modulo="CRM" />; }
