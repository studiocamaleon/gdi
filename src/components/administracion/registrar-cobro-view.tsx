"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { toast } from "sonner";

import {
  CobroFormulario,
  type CobroDraft,
} from "@/components/administracion/cobro-formulario";
import type { CuentaFondosResumen, MetodoPago } from "@/lib/administracion";
import { crearCobro } from "@/lib/administracion-api";
import { useConfigRegional } from "@/components/navigation/config-regional-provider";
import { formatearMoneda } from "@/lib/moneda";

export type OrdenContexto = {
  tipo: "orden";
  id: string;
  numero: string;
  clienteId: string | null;
  clienteNombre: string;
  resumen: string;
  total: number;
  cobradoBruto: number;
};

export type ClienteCobroContexto = {
  tipo: "cliente";
  id: string;
  nombre: string;
  saldo: number;
};

export function RegistrarCobroView({
  contexto,
  metodos,
  cuentas,
}: {
  contexto: OrdenContexto | ClienteCobroContexto;
  metodos: MetodoPago[];
  cuentas: CuentaFondosResumen[];
}) {
  const router = useRouter();
  const { moneda } = useConfigRegional();
  const fmt = (n: number) => formatearMoneda(n, moneda, { decimales: 0 });
  const esOrden = contexto.tipo === "orden";
  const saldo = Math.max(
    0,
    esOrden ? contexto.total - contexto.cobradoBruto : contexto.saldo,
  );
  const [guardando, setGuardando] = React.useState(false);

  const submit = async (draft: CobroDraft) => {
    setGuardando(true);
    try {
      await crearCobro({
        ...draft.payload,
        ...(esOrden ? { ordenId: contexto.id } : {}),
        clienteId: esOrden ? (contexto.clienteId ?? undefined) : contexto.id,
      });
      toast.success(
        draft.payload.valor
          ? "Valor en cartera registrado."
          : `Cobro de ${fmt(draft.payload.montoBruto)} registrado.`,
      );
      router.push(
        esOrden
          ? `/produccion/ordenes/${contexto.id}`
          : `/clientes/${contexto.id}/cuenta-corriente`,
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo registrar el cobro.",
      );
      setGuardando(false);
    }
  };

  return (
    <div
      className="arc-page"
      style={{
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
        padding: "32px 28px 80px",
      }}
    >
      <div className="arc-wrap">
        <Link
          className="arc-crumb"
          href={
            esOrden
              ? `/produccion/ordenes/${contexto.id}`
              : `/clientes/${contexto.id}/cuenta-corriente`
          }
        >
          <ArrowLeftIcon />
          {esOrden
            ? `Volver a ${contexto.numero}`
            : "Volver a cuenta corriente"}
        </Link>
        <div className="arc-head">
          <h1>Registrar cobro</h1>
          <div className="sub">
            {esOrden
              ? "Imputá un pago a la orden. El método define comisión, acreditación y retenciones."
              : "Registrá el pago del cliente. Se aplicará primero a las órdenes vencidas más antiguas y el excedente quedará a cuenta."}
          </div>
        </div>

        <div className="arc-ot-ctx">
          <div className="blk">
            <span className="l">{esOrden ? "Orden" : "Cliente"}</span>
            <span className="id">
              {esOrden ? contexto.numero : contexto.nombre}
            </span>
          </div>
          <div className="sep" />
          <div className="blk">
            <span className="cli">
              {esOrden
                ? `${contexto.clienteNombre}${contexto.resumen ? ` · ${contexto.resumen}` : ""}`
                : "Cobro general de cuenta corriente"}
            </span>
          </div>
          <div className="spacer" />
          <div className="blk">
            <span className="l">
              {esOrden ? "Saldo pendiente" : "Saldo deudor"}
            </span>
            <span className="v warn">{fmt(saldo)}</span>
          </div>
        </div>

        <CobroFormulario
          saldo={saldo}
          metodos={metodos}
          cuentas={cuentas}
          guardando={guardando}
          onSubmit={(draft) => void submit(draft)}
          cancelHref={
            esOrden
              ? `/produccion/ordenes/${contexto.id}`
              : `/clientes/${contexto.id}/cuenta-corriente`
          }
        />
      </div>
    </div>
  );
}
