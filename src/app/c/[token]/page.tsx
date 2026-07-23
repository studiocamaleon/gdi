import {
  ReciboNoEncontrado,
  ReciboPublicoView,
} from "@/components/administracion/recibo-publico";
import { getReciboPublico, type ReciboPublico } from "@/lib/recibos";

export const dynamic = "force-dynamic";

/**
 * Recibo de pago PÚBLICO por link privado (sin login). El token de la URL es
 * la credencial; la data llega de un endpoint @Public() del API.
 * Fuera del grupo (dashboard): no exige sesión ni tiene chrome interno.
 * Ver docs/recibos-pago-diseno.md
 */
export default async function ReciboPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  let datos: ReciboPublico | null = null;
  try {
    datos = await getReciboPublico(token);
  } catch {
    datos = null;
  }

  if (!datos) return <ReciboNoEncontrado />;

  // El logo se pide por el endpoint del token, no por el data-uri que trae la
  // proyección: en la web es un 302 a una URL firmada y no infla el HTML.
  return (
    <ReciboPublicoView
      token={token}
      datos={datos}
      tieneLogo={Boolean(datos.logoDataUri)}
    />
  );
}
