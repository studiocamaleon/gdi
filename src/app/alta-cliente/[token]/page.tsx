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
  try {
    const { empresa } = await apiRequest<{ empresa: string }>(
      `/registro-clientes/${encodeURIComponent(token)}`,
      undefined,
      { auth: false },
    );
    return <RegistroClientePublico token={token} empresa={empresa} />;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404)
      return (
        <RegistroClientePublico token={token} empresa="" disponible={false} />
      );
    throw error;
  }
}
