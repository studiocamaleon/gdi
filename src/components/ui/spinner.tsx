import type { SVGProps } from "react";
import { GdiSpinner } from "@/components/brand/gdi-spinner";

export function Spinner(props: SVGProps<SVGSVGElement>) {
  return <GdiSpinner data-slot="spinner" role="status" aria-label="Cargando" aria-hidden={undefined} {...props} />;
}
