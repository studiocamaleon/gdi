import { ProductosServiciosAdicionalesManager } from '@/components/productos-servicios/productos-servicios-adicionales-manager';
import { getCentrosCosto } from '@/lib/costos-api';
import { getMateriasPrimas } from '@/lib/materias-primas-api';
import { getAdicionalesCatalogo } from '@/lib/productos-servicios-api';

export const dynamic = 'force-dynamic';

export default async function AdicionalesPage() {
  const [adicionales, centrosCosto, materiasPrimas] = await Promise.all([
    getAdicionalesCatalogo(),
    getCentrosCosto(),
    getMateriasPrimas(),
  ]);

  return (
    <section className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <ProductosServiciosAdicionalesManager
        initialAdicionales={adicionales}
        centrosCosto={centrosCosto}
        materiasPrimas={materiasPrimas}
      />
    </section>
  );
}
