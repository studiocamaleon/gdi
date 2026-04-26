import { ProductoWizard } from "@/components/productos-servicios/producto-wizard";

export const dynamic = "force-dynamic";

export default function NuevoProductoPage() {
  return <ProductoWizard modo="crear" />;
}
