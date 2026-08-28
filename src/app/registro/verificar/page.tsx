import { tryGetCurrentUser } from "@/lib/auth";
import { leerEstadoRegistro } from "@/lib/registro-api";
import { VerificarRegistro } from "@/components/registro/verificar-registro";

export default async function VerificarPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const token = (await searchParams).token ?? "";
  const [estado, usuario] = await Promise.all([
    leerEstadoRegistro(token).catch(() => ({
      valido: false,
      vencido: true,
      completado: false,
      requiereLogin: false,
      email: "—",
      empresa: "tu empresa",
      plan: "—",
    })),
    tryGetCurrentUser(),
  ]);
  return <main className="grid min-h-screen place-items-center bg-muted/40 p-5"><VerificarRegistro token={token} estado={estado} autenticado={Boolean(usuario)} /></main>;
}
