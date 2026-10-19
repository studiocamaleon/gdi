import type { Metadata } from "next";
import { DesignSystemProvider } from "@/components/design-system/appearance";
import { PantallaProduccion } from "@/components/produccion/pantalla-produccion";

export const metadata: Metadata = {
  title: "Producción en tiempo real · Grafo",
  robots: { index: false, follow: false },
};
export default function PaginaPantallaProduccion() {
  return (
    <DesignSystemProvider theme="brand" appearance="light">
      <PantallaProduccion />
    </DesignSystemProvider>
  );
}
