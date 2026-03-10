import { notFound } from "next/navigation";

import { ProveedorFicha } from "@/components/proveedores/proveedor-ficha";
import { getProveedorById } from "@/lib/proveedores-api";

export const dynamic = "force-dynamic";

export default async function ProveedorDetallePage({
  params,
}: {
  params: Promise<{ proveedorId: string }>;
}) {
  const { proveedorId } = await params;
  const proveedor = await getProveedorById(proveedorId);

  if (!proveedor) {
    notFound();
  }

  return <ProveedorFicha proveedor={proveedor} mode="edit" />;
}
