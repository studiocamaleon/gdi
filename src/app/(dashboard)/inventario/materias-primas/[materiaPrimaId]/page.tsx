import { Suspense } from "react";
import { notFound } from "next/navigation";

import { MateriaPrimaFicha } from "@/components/inventario/materia-prima-ficha";
import { ModulePageSkeleton } from "@/components/dashboard/module-page-skeleton";
import { getMaquinas } from "@/lib/maquinaria-api";
import { getMateriaPrimaById } from "@/lib/materias-primas-api";
import { getProveedores } from "@/lib/proveedores-api";

export const dynamic = "force-dynamic";

export default function MateriaPrimaDetallePage({
  params,
}: {
  params: Promise<{ materiaPrimaId: string }>;
}) {
  return (
    <Suspense fallback={<ModulePageSkeleton variant="detail" />}>
      <MateriaPrimaDetallePageContent params={params} />
    </Suspense>
  );
}

async function MateriaPrimaDetallePageContent({
  params,
}: {
  params: Promise<{ materiaPrimaId: string }>;
}) {
  const { materiaPrimaId } = await params;

  const [materiaPrima, proveedores, maquinas] = await Promise.all([
    getMateriaPrimaById(materiaPrimaId),
    getProveedores(),
    getMaquinas(),
  ]);

  if (!materiaPrima) {
    notFound();
  }

  return (
    <MateriaPrimaFicha
      materiaPrima={materiaPrima}
      proveedores={proveedores}
      maquinas={maquinas}
    />
  );
}
