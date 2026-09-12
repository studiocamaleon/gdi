import { ColasProduccion } from '@/components/produccion/colas-produccion';
import { getResumenColas, type ResumenColas } from '@/lib/colas-produccion';

export const dynamic = 'force-dynamic';

export default async function ColasProduccionPage({ searchParams }: { searchParams: Promise<{ maquina?: string }> }) {
  let resumen: ResumenColas = { maquinas: [], sinMaquina: 0 };
  let error: string | null = null;
  try { resumen = await getResumenColas(); }
  catch (e) { error = e instanceof Error ? e.message : 'No se pudieron cargar las colas.'; }
  const { maquina } = await searchParams;
  return <ColasProduccion initialResumen={resumen} initialError={error}
    initialMaquinaId={resumen.maquinas.some(m => m.id === maquina) ? maquina : undefined} />;
}
