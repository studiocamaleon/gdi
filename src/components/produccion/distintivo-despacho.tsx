import { Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function DistintivoDespacho({
  localidad,
}: {
  localidad?: string | null;
}) {
  if (!localidad) return null;
  return (
    <Badge variant="secondary" title={`Despachar a ${localidad}`}>
      <Truck aria-hidden="true" data-icon="inline-start" />
      Para despachar
    </Badge>
  );
}
