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
import type {
  CuentaFondosResumen,
  MetodoPago,
} from "@/lib/administracion";
import { crearCobro, imputarCobro } from "@/lib/administracion-api";

const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-AR");

export type OrdenContexto = {
  id: string;
  numero: string;
  clienteId: string | null;
  clienteNombre: string;
  resumen: string;
  total: number;
  cobradoBruto: number;
};

export function RegistrarCobroView({
  orden,
  metodos,
  cuentas,
}: {
  orden: OrdenContexto;
  metodos: MetodoPago[];
  cuentas: CuentaFondosResumen[];
}) {
  const router = useRouter();
  const saldo = Math.max(0, orden.total - orden.cobradoBruto);
  const [guardando, setGuardando] = React.useState(false);

  const submit = async (draft: CobroDraft) => {
    setGuardando(true);
    try {
      const cobro = await crearCobro({
        ...draft.payload,
        ordenId: orden.id,
        clienteId: orden.clienteId ?? undefined,
      });

      // El cobro ya existe: si una imputación falla, se avisa cuál en vez de
      // dejar el cobro a medio aplicar en silencio.
      const fallidas: string[] = [];
      for (const imp of draft.imputaciones) {
        try {
          await imputarCobro(cobro.id, imp);
        } catch (error) {
          fallidas.push(
            error instanceof Error ? error.message : "error desconocido",
          );
        }
      }
      if (fallidas.length > 0) {
        toast.error(
          `El cobro se registró, pero ${fallidas.length} imputación${fallidas.length === 1 ? "" : "es"} falló: ${fallidas.join(" · ")}. Aplicalo desde la cuenta corriente.`,
          { duration: 10000 },
        );
      } else {
        toast.success(
          draft.payload.valor
            ? "Valor en cartera registrado."
            : `Cobro de ${fmt(draft.payload.montoBruto)} registrado.`,
        );
      }
      router.push(`/produccion/ordenes/${orden.id}`);
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
        <Link className="arc-crumb" href={`/produccion/ordenes/${orden.id}`}>
          <ArrowLeftIcon />
          Volver a {orden.numero}
        </Link>
        <div className="arc-head">
          <h1>Registrar cobro</h1>
          <div className="sub">
            Imputá un pago a la orden. El método define comisión, acreditación
            y retenciones.
          </div>
        </div>

        <div className="arc-ot-ctx">
          <div className="blk">
            <span className="l">Orden</span>
            <span className="id">{orden.numero}</span>
          </div>
          <div className="sep" />
          <div className="blk">
            <span className="cli">
              {orden.clienteNombre}
              {orden.resumen ? ` · ${orden.resumen}` : ""}
            </span>
          </div>
          <div className="spacer" />
          <div className="blk">
            <span className="l">Saldo pendiente</span>
            <span className="v warn">{fmt(saldo)}</span>
          </div>
        </div>

        <CobroFormulario
          saldo={saldo}
          metodos={metodos}
          cuentas={cuentas}
          guardando={guardando}
          onSubmit={(draft) => void submit(draft)}
          cancelHref={`/produccion/ordenes/${orden.id}`}
        />
      </div>
    </div>
  );
}
