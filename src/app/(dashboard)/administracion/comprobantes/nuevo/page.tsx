import { ComprobantesSetup as SinConfig } from "@/components/administracion/comprobantes-setup";
import { tienePermiso } from "@/lib/permisos-server";
import { SinPermiso } from "@/components/navigation/sin-permiso";

import {
  ComprobanteEmisionView,
  type ClienteOpcion,
  type OrdenOpcion,
} from "@/components/administracion/comprobante-emision-view";
import type { Comprobante } from "@/lib/administracion";
import {
  getComprobante,
  getConfiguracionFiscal,
} from "@/lib/administracion-api";
import { getClientes } from "@/lib/clientes-api";
import { getOrdenesTrabajo } from "@/lib/ordenes-trabajo-api";
import type { CondicionFiscal } from "@/lib/clientes";

export const dynamic = "force-dynamic";

export default async function NuevoComprobantePage({
  searchParams,
}: {
  searchParams: Promise<{ origen?: string; ordenId?: string }>;
}) {
  if (!(await tienePermiso("administracion.gestionar")))
    return <SinPermiso modulo="Emisión de comprobantes" />;
  const { origen: origenId } = await searchParams;

  const config = await getConfiguracionFiscal();
  let clientes: ClienteOpcion[] = [];
  let ordenes: OrdenOpcion[] = [];
  let origen: Comprobante | null = null;

  if (!config) {
    return (
      <SinConfig
        motivo="Todavía no cargaste los datos fiscales del emisor. Sin razón social, CUIT y condición fiscal no se puede decidir la letra de ningún comprobante."
        cta="Cargar datos fiscales"
      />
    );
  }

  if (config.puntosVenta.filter((p) => p.activo).length === 0) {
    return (
      <SinConfig
        motivo="No tenés ningún punto de venta activo. La numeración de los comprobantes va por punto de venta, así que necesitás al menos uno."
        cta="Agregar punto de venta"
      />
    );
  }

  {
    const [cs, os] = await Promise.all([
      getClientes({ limit: 200 }),
      getOrdenesTrabajo({ limit: 50 }),
    ]);
    clientes = cs.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      cuit: c.cuit,
      condicionFiscal: c.condicionFiscal as CondicionFiscal,
    }));
    ordenes = os.data
      .filter((o) => o.estado !== "borrador")
      .map((o) => ({
        id: o.id,
        numero: o.numero,
        clienteId: o.clienteId,
        clienteNombre: o.clienteNombre,
        itemsCount: o.itemsCount,
      }));
  }

  if (origenId) {
    origen = await getComprobante(origenId);
  }

  return (
    <ComprobanteEmisionView
      config={config}
      clientes={clientes}
      ordenes={ordenes}
      origen={origen}
    />
  );
}
