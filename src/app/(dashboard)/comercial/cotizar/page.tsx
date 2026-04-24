import { Suspense } from "react";

import { ModulePageSkeleton } from "@/components/dashboard/module-page-skeleton";
import { CotizadorView } from "@/components/comercial/cotizador-view";
import { getProductos } from "@/lib/productos-servicios-api";

export const dynamic = "force-dynamic";

export default function CotizarPage() {
  return (
    <Suspense fallback={<ModulePageSkeleton variant="detail" />}>
      <CotizarPageContent />
    </Suspense>
  );
}

async function CotizarPageContent() {
  const productos = await getProductos(true);
  return <CotizadorView productos={productos} />;
}
