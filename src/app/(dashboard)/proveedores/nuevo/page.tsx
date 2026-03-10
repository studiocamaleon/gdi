import { ProveedorFicha } from "@/components/proveedores/proveedor-ficha";
import { createEmptyProveedor } from "@/lib/proveedores";

export default function NuevoProveedorPage() {
  return <ProveedorFicha proveedor={createEmptyProveedor()} mode="create" />;
}
