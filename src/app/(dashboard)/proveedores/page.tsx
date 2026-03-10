import { ProveedoresTable } from "@/components/proveedores/proveedores-table";
import { getProveedores } from "@/lib/proveedores-api";

export const dynamic = "force-dynamic";

export default async function ProveedoresPage() {
  const proveedores = await getProveedores();

  return <ProveedoresTable initialProveedores={proveedores} />;
}
