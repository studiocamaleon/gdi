import { Skeleton } from "@/components/ui/skeleton";

export default function LoadingReportes() {
  return (
    <div className="grid gap-4" aria-label="Cargando reporte" aria-busy="true">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, indice) => (
          <div key={indice} className="rounded-xl border bg-card p-4">
            <Skeleton className="mb-4 h-3 w-24" />
            <Skeleton className="mb-2 h-7 w-32" />
            <Skeleton className="h-3 w-40" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </div>
  );
}
