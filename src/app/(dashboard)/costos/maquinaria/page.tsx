import dynamicImport from "next/dynamic";
import { Suspense } from "react";

import { getPlantas } from "@/lib/costos-api";
import { getMaquinasPage } from "@/lib/maquinaria-api";
import type {
  EstadoConfiguracionMaquina,
  EstadoMaquina,
  PlantillaMaquinaria,
} from "@/lib/maquinaria";
import { tienePermiso } from "@/lib/permisos-server";
import { ModulePageSkeleton } from "@/components/dashboard/module-page-skeleton";

const MaquinariaPanel = dynamicImport(
  () =>
    import("@/components/costos/maquinaria-panel").then(
      (module) => module.MaquinariaPanel,
    ),
  {
    loading: () => <ModulePageSkeleton variant="workspace" />,
  },
);

export const dynamic = "force-dynamic";

export default function MaquinariaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<ModulePageSkeleton variant="workspace" />}>
      <MaquinariaPageContent searchParams={searchParams} />
    </Suspense>
  );
}

async function MaquinariaPageContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const value = (key: string) => {
    const raw = params[key];
    return typeof raw === "string" ? raw : undefined;
  };
  const page = Math.max(1, Number(value("page")) || 1);
  const search = value("search")?.trim() || undefined;
  const plantilla = value("plantilla") as PlantillaMaquinaria | undefined;
  const estado = value("estado") as EstadoMaquina | undefined;
  const estadoConfiguracion = value("config") as
    EstadoConfiguracionMaquina | undefined;
  const [maquinasPage, plantas, puedeGestionar] = await Promise.all([
    getMaquinasPage({
      page,
      limit: 50,
      search,
      plantilla,
      estado,
      estadoConfiguracion,
    }),
    getPlantas(),
    tienePermiso("costos.gestionar"),
  ]);

  return (
    <MaquinariaPanel
      initialPage={maquinasPage}
      plantas={plantas}
      puedeGestionar={puedeGestionar}
      initialFilters={{ search, plantilla, estado, estadoConfiguracion }}
    />
  );
}
