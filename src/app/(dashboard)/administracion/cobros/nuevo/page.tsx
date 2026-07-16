import Link from "next/link";

import {
  RegistrarCobroView,
  type OrdenContexto,
} from "@/components/administracion/registrar-cobro-view";
import type { CuentaFondosResumen, MetodoPago } from "@/lib/administracion";
import {
  getCobros,
  getCuentasFondos,
  getMetodosPago,
} from "@/lib/administracion-api";
import { getOrdenTrabajo } from "@/lib/ordenes-trabajo-api";

export const dynamic = "force-dynamic";

export default async function RegistrarCobroPage({
  searchParams,
}: {
  searchParams: Promise<{ ordenId?: string }>;
}) {
  const { ordenId } = await searchParams;

  let orden: OrdenContexto | null = null;
  let metodos: MetodoPago[] = [];
  let cuentas: CuentaFondosResumen[] = [];

  try {
    if (ordenId) {
      const [detalle, cobros, metodosData, cuentasData] = await Promise.all([
        getOrdenTrabajo(ordenId),
        getCobros({ ordenId }),
        getMetodosPago(),
        getCuentasFondos(),
      ]);
      orden = {
        id: detalle.id,
        numero: detalle.numero,
        clienteId: detalle.clienteId,
        clienteNombre: detalle.clienteNombre,
        resumen: detalle.resumen,
        total: detalle.total,
        cobradoBruto: cobros.reduce((s, c) => s + c.montoBruto, 0),
      };
      metodos = metodosData;
      cuentas = cuentasData;
    }
  } catch {
    orden = null;
  }

  if (!orden) {
    return (
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          padding: "48px 28px",
        }}
      >
        <div style={{ maxWidth: 520, margin: "0 auto", textAlign: "center" }}>
          <h1 style={{ fontSize: 18, fontWeight: 650, marginBottom: 8 }}>
            No se encontró la orden
          </h1>
          <p style={{ color: "var(--muted-text)", fontSize: 13.5 }}>
            Para registrar un cobro entrá desde la pestaña Pagos de una orden
            de trabajo.
          </p>
          <Link
            href="/produccion/ordenes"
            className="btn btn-primary"
            style={{ marginTop: 20, display: "inline-flex" }}
          >
            Ir a Órdenes de trabajo
          </Link>
        </div>
      </div>
    );
  }

  return (
    <RegistrarCobroView orden={orden} metodos={metodos} cuentas={cuentas} />
  );
}
