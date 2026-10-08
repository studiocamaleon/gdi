import type { Metadata } from "next";
import { apiRequest, ApiError } from "@/lib/api";
import { RegistroClientePublico } from "@/components/clientes/registro-cliente-publico";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Alta de cliente · Grafoprint",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  let datos: { empresa: string; paisCodigo: string } | null = null;
  try {
    datos = await apiRequest<{ empresa: string; paisCodigo: string }>(
      `/registro-clientes/${encodeURIComponent(token)}`,
      undefined,
      { auth: false },
    );
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 404)) throw error;
  }
  return (
    <RegistroClientePublico
      token={token}
      empresa={datos?.empresa ?? ""}
      paisCodigo={datos?.paisCodigo}
      disponible={Boolean(datos)}
    />
  );
}
