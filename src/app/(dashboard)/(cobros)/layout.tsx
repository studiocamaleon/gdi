import { SinPermiso } from "@/components/navigation/sin-permiso";
import { tienePermiso } from "@/lib/permisos-server";

/** Mismo URL y dashboard, sin heredar el permiso general de Administración. */
export default async function CobrosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [cobrar, gestionar] = await Promise.all([
    tienePermiso("administracion.cobrar"),
    tienePermiso("administracion.cobrar.gestionar"),
  ]);
  return cobrar || gestionar ? (
    <>{children}</>
  ) : (
    <SinPermiso modulo="registrar cobros" />
  );
}
