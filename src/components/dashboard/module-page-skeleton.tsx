import { GdiSpinner } from "@/components/brand/gdi-spinner";
import { Skeleton } from "@/components/ui/skeleton";

type ModulePageSkeletonProps = {
  variant?: "table" | "workspace" | "detail";
};

export function ModulePageSkeleton({
  variant = "table",
}: ModulePageSkeletonProps) {
  if (variant === "detail") {
    return (
      <section className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <GdiSpinner className="size-4" />
          Cargando detalle...
        </div>
        <div className="space-y-3">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-4 w-52" />
        </div>
        <Skeleton className="h-11 w-full rounded-xl" />
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <Skeleton className="min-h-[28rem] rounded-2xl" />
          <div className="space-y-6">
            <Skeleton className="h-48 rounded-2xl" />
            <Skeleton className="h-64 rounded-2xl" />
          </div>
        </div>
      </section>
    );
  }

  if (variant === "workspace") {
    return (
      <section className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <GdiSpinner className="size-4" />
          Cargando módulo...
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-52" />
            <Skeleton className="h-4 w-72" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-36" />
          </div>
        </div>
        <Skeleton className="h-12 w-full rounded-xl" />
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <Skeleton className="min-h-[24rem] rounded-2xl" />
          <Skeleton className="min-h-[24rem] rounded-2xl" />
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
        <GdiSpinner className="size-4" />
        Cargando módulo...
      </div>
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-32" />
        </div>
      </div>
      <Skeleton className="h-12 w-full rounded-xl" />
      <Skeleton className="h-[26rem] rounded-2xl" />
    </section>
  );
}
