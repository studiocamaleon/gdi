import { RutaFormView } from "@/components/productos-servicios/ruta-form-view";
import { getCatalogoFamilias } from "@/lib/productos-servicios-api";

export const dynamic = "force-dynamic";

export default async function NuevaRutaPage() {
  const catalogo = await getCatalogoFamilias();
  return <RutaFormView modo="crear" catalogoFamilias={catalogo} />;
}
