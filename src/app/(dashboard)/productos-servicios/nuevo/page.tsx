import { ProductoFormView } from "@/components/productos-servicios/producto-form-view";

export const dynamic = "force-dynamic";

export default function NuevoProductoPage() {
  return <ProductoFormView modo="crear" />;
}
