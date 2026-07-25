import {
  ComprobanteNoEncontrado,
  ComprobantePublicoView,
} from "@/components/administracion/comprobante-publico";
import {
  getComprobantePublico,
  type ComprobantePublico,
} from "@/lib/comprobantes-publicos";

export const dynamic = "force-dynamic";

/**
 * Comprobante fiscal PÚBLICO por link privado (sin login). El token de la URL
 * es la credencial; la data llega de un endpoint @Public() del API.
 * Fuera del grupo (dashboard): no exige sesión ni tiene chrome interno.
 */
export default async function ComprobantePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  let datos: ComprobantePublico | null = null;
  try {
    datos = await getComprobantePublico(token);
  } catch {
    datos = null;
  }

  if (!datos) return <ComprobanteNoEncontrado />;

  // El logo se pide por el endpoint del token —un 302 a URL firmada, no infla
  // el HTML—, pero sólo si el tenant tiene uno: acá no hay `onError` que valga
  // y una imagen rota se ve peor que las iniciales.
  return (
    <ComprobantePublicoView
      token={token}
      datos={datos}
      tieneLogo={datos.tieneLogo}
    />
  );
}
