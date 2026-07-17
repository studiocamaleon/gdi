import Link from "next/link";

import {
  ComprobanteEmisionView,
  type ClienteOpcion,
  type OrdenOpcion,
} from "@/components/administracion/comprobante-emision-view";
import type { Comprobante, ConfiguracionFiscal } from "@/lib/administracion";
import {
  getComprobante,
  getConfiguracionFiscal,
} from "@/lib/administracion-api";
import { getClientes } from "@/lib/clientes-api";
import { getOrdenesTrabajo } from "@/lib/ordenes-trabajo-api";
import type { CondicionFiscal } from "@/lib/clientes";

export const dynamic = "force-dynamic";

function SinConfig({ motivo, cta }: { motivo: string; cta: string }) {
  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "48px 28px" }}>
      <div style={{ maxWidth: 520, margin: "0 auto", textAlign: "center" }}>
        <h1 style={{ fontSize: 18, fontWeight: 650, marginBottom: 8 }}>
          Falta configurar la facturación
        </h1>
        <p style={{ color: "var(--muted-text)", fontSize: 13.5 }}>{motivo}</p>
        <Link
          href="/administracion/datos-fiscales"
          className="btn btn-primary"
          style={{ marginTop: 20, display: "inline-flex" }}
        >
          {cta}
        </Link>
      </div>
    </div>
  );
}

export default async function NuevoComprobantePage({
  searchParams,
}: {
  searchParams: Promise<{ origen?: string; ordenId?: string }>;
}) {
  const { origen: origenId } = await searchParams;

  let config: ConfiguracionFiscal | null = null;
  let clientes: ClienteOpcion[] = [];
  let ordenes: OrdenOpcion[] = [];
  let origen: Comprobante | null = null;

  try {
    config = await getConfiguracionFiscal();
  } catch {
    config = null;
  }

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

  try {
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
  } catch {
    clientes = [];
    ordenes = [];
  }

  if (origenId) {
    try {
      origen = await getComprobante(origenId);
    } catch {
      origen = null;
    }
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
