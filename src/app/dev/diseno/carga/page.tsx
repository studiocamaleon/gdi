import { notFound } from "next/navigation";
import { NavigationLoading } from "@/components/navigation/navigation-loading";
import { ModulePageSkeleton } from "@/components/dashboard/module-page-skeleton";
import { GdiSpinner } from "@/components/brand/gdi-spinner";
import { ActionButton } from "@/components/design-system/action-button";
import theme from "@/components/design-system/theme.module.css";

export const metadata = { title: "Carga · Laboratorio Grafoprint" };

export default async function LoadingDesignPage({ searchParams }: { searchParams: Promise<{ modo?: string }> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const { modo } = await searchParams;
  if (modo === "modulo") return <main className="flex min-h-dvh"><ModulePageSkeleton /></main>;
  if (modo === "compacto") return <main data-ui="heroui" className={`${theme.theme} grid min-h-dvh place-items-center`}>
    <div className="flex flex-wrap items-center justify-center gap-4">
      <ActionButton isPending><GdiSpinner /> Guardando…</ActionButton>
      <ActionButton isPending variant="outline"><GdiSpinner /> Actualizando…</ActionButton>
      <span role="status" className="flex items-center gap-2"><GdiSpinner /> Consultando…</span>
    </div>
  </main>;
  return <NavigationLoading />;
}
