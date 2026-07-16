import { notFound } from "next/navigation";

import { CuentaCorrienteView } from "@/components/administracion/cuenta-corriente-view";
import type { CuentaCorriente } from "@/lib/administracion";
import { getCuentaCorriente } from "@/lib/administracion-api";

export const dynamic = "force-dynamic";

export default async function CuentaCorrientePage({
  params,
}: {
  params: Promise<{ clienteId: string }>;
}) {
  const { clienteId } = await params;

  let cc: CuentaCorriente | null = null;
  try {
    cc = await getCuentaCorriente(clienteId);
  } catch {
    cc = null;
  }

  if (!cc) notFound();

  return <CuentaCorrienteView cc={cc} />;
}
