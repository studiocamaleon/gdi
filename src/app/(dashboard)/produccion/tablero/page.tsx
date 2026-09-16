import { TableroProduccion } from "@/components/produccion/tablero-produccion";
import { cargarDatosTableroProduccion } from "@/lib/tablero-produccion-server";
import { DesignSystemProvider } from "@/components/design-system/appearance";

export const dynamic = "force-dynamic";

export default async function TableroProduccionPage() {
  const datos = await cargarDatosTableroProduccion({ soloPendientes: true });
  return (
    <DesignSystemProvider theme="brand" appearance="light">
      <TableroProduccion {...datos} />
    </DesignSystemProvider>
  );
}
