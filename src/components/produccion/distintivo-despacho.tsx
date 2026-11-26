import { Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function DistintivoDespacho({
  localidad,
  soloIcono = false,
}: {
  localidad?: string | null;
  soloIcono?: boolean;
}) {
  if (!localidad) return null;
  if (soloIcono) {
    const destino = `Para despachar a ${localidad}`;
    return (
      <span
        role="img"
        aria-label={destino}
        title={destino}
        className="inline-flex shrink-0 align-middle text-accent-soft-foreground"
      >
        <Truck size={16} aria-hidden />
      </span>
    );
  }
  return (
    <Badge variant="secondary" title={`Despachar a ${localidad}`}>
      <Truck aria-hidden="true" data-icon="inline-start" />
      Para despachar
    </Badge>
  );
}
