import Link from "next/link";
import { notFound } from "next/navigation";

import {
  RegistrarCobroView,
  type ClienteCobroContexto,
  type OrdenContexto,
} from "@/components/administracion/registrar-cobro-view";
import type { CuentaFondosResumen, MetodoPago } from "@/lib/administracion";
import {
  getCobros,
  getCuentaCorriente,
  getCuentasFondos,
  getMetodosPago,
} from "@/lib/administracion-api";
import { getOrdenTrabajo } from "@/lib/ordenes-trabajo-api";
import { ApiError } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function RegistrarCobroPage({
  searchParams,
}: {
  searchParams: Promise<{ ordenId?: string; clienteId?: string }>;
}) {
  const { ordenId, clienteId } = await searchParams;

  let contexto: OrdenContexto | ClienteCobroContexto | null = null;

  try {
    const [metodos, cuentas] = await Promise.all([
      getMetodosPago(),
      getCuentasFondos(),
    ]);
    if (ordenId) {
      const [detalle, cobros] = await Promise.all([
        getOrdenTrabajo(ordenId),
        getCobros({ ordenId }),
      ]);
      contexto = {
        tipo: "orden",
        id: detalle.id,
        numero: detalle.numero,
        clienteId: detalle.clienteId,
        clienteNombre: detalle.clienteNombre,
        resumen: detalle.resumen,
        total: detalle.total,
        cobradoBruto: cobros.reduce((s, c) => s + c.montoBruto, 0),
      };
    } else if (clienteId) {
      const cc = await getCuentaCorriente(clienteId);
      contexto = {
        tipo: "cliente",
        id: cc.cliente.id,
        nombre: cc.cliente.nombre,
        saldo: cc.saldo,
      };
    }
    if (contexto) {
      return (
        <RegistrarCobroView
          contexto={contexto}
          metodos={metodos}
          cuentas={cuentas}
        />
      );
    }
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

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
          Falta indicar qué cobro querés registrar
        </h1>
        <p style={{ color: "var(--muted-text)", fontSize: 13.5 }}>
          Entrá desde una orden de trabajo o desde la cuenta corriente de un
          cliente.
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
