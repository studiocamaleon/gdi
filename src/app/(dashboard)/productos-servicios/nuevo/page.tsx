import { FuncionNoIncluida } from "@/components/navigation/funcion-no-incluida";
import { puedeConfigurar, tieneCapacidad } from "@/lib/capacidades-server";
import { DesignSystemProvider } from "@/components/design-system/appearance";
import { ProductoWizard } from "@/components/productos-servicios/producto-wizard";
import { SinPermiso } from "@/components/navigation/sin-permiso";

export const dynamic = "force-dynamic";

export default async function NuevoProductoPage() {
  if (!(await tieneCapacidad("productos"))) return <FuncionNoIncluida />;
  if (!(await puedeConfigurar("productos", "costos.gestionar"))) {
    return <SinPermiso modulo="Catálogo de productos" />;
  }
  return (
    <DesignSystemProvider theme="brand" appearance="light">
      <ProductoWizard modo="crear" />
    </DesignSystemProvider>
  );
}
