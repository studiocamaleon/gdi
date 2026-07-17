import { SimuladorImpresion } from "@/components/produccion/simulador-impresion";
import { getSimuladorImpresion, type SimuladorData } from "@/lib/simulador-impresion-api";

export const dynamic = "force-dynamic";

/**
 * El simulador consolida los pasos de impresión POR ÁREA listos para
 * imprimir (frontera de órdenes vivas) y sugiere el ancho de rollo óptimo
 * con su costo. Si la API no responde, arranca vacío y el polling del
 * cliente lo levanta después.
 */
export default async function SimuladorImpresionPage() {
  let data: SimuladorData = { jobs: [], materiales: [] };
  try {
    data = await getSimuladorImpresion();
  } catch {
    // Estado vacío; el poll del cliente reintenta.
  }
  return <SimuladorImpresion initialData={data} />;
}
