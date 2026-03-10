import { notFound } from "next/navigation";

import { ClienteFicha } from "@/components/clientes/cliente-ficha";
import { getClienteById } from "@/lib/clientes-api";

export const dynamic = "force-dynamic";

export default async function ClienteDetallePage({
  params,
}: {
  params: Promise<{ clienteId: string }>;
}) {
  const { clienteId } = await params;
  const cliente = await getClienteById(clienteId);

  if (!cliente) {
    notFound();
  }

  return <ClienteFicha cliente={cliente} mode="edit" />;
}
