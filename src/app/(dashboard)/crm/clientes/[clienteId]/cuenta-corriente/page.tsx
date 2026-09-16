import { DesignSystemProvider } from "@/components/design-system/appearance";
import { notFound } from "next/navigation";
import { CuentaCorrienteView } from "@/components/administracion/cuenta-corriente-view";
import { getCuentaCorriente } from "@/lib/administracion-api";
import { ApiError } from "@/lib/api";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ clienteId: string }>;
}) {
  const { clienteId } = await params;
  let cuenta;
  try {
    cuenta = await getCuentaCorriente(clienteId);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  return (
    <DesignSystemProvider theme="brand" appearance="light">
      <CuentaCorrienteView cc={cuenta} />
    </DesignSystemProvider>
  );
}
