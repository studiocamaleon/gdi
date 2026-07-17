import { SimuladorLaser } from "@/components/produccion/simulador-laser";
import { getSimuladorLaser, type SimuladorLaserData } from "@/lib/simulador-laser-api";

export const dynamic = "force-dynamic";

/**
 * El simulador láser consolida los pasos de impresión POR HOJA listos
 * para imprimir (frontera de órdenes vivas), agrupados en batches
 * "enviables juntos" (papel + pliego + color + faz). Si la API no
 * responde, arranca vacío y el polling del cliente lo levanta.
 */
export default async function SimuladorLaserPage() {
  let data: SimuladorLaserData = { jobs: [] };
  try {
    data = await getSimuladorLaser();
  } catch {
    // Estado vacío; el poll del cliente reintenta.
  }
  return <SimuladorLaser initialData={data} />;
}
