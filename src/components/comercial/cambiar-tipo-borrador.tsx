"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight } from "lucide-react";
import { toast } from "sonner";
import { ActionButton } from "@/components/design-system/action-button";
import { usePuede } from "@/components/navigation/permisos-provider";
import { useCapacidad } from "@/components/navigation/capacidades-provider";
import { apiRequest } from "@/lib/api";

export function CambiarTipoBorrador({ id, tipo, version, disabled = false, motivoBloqueo, onPendienteChange }: {
  id: string;
  tipo: "orden" | "presupuesto";
  version: string;
  disabled?: boolean;
  motivoBloqueo?: string;
  onPendienteChange?: (pendiente: boolean) => void;
}) {
  const router = useRouter();
  const puedeOrdenes = usePuede("comercial.ordenes.gestionar");
  const puedePresupuestos = usePuede("comercial.presupuestos.gestionar");
  const conOrdenes = useCapacidad("ordenes");
  const conPresupuestos = useCapacidad("presupuestos");
  const conCotizacion = useCapacidad("cotizacion");
  const [cambiando, setCambiando] = React.useState(false);
  const enCurso = React.useRef(false);
  if (!puedeOrdenes || !puedePresupuestos || !conOrdenes || !conPresupuestos || !conCotizacion) return null;
  const destino = tipo === "orden" ? "presupuesto" : "orden de trabajo";
  async function cambiar() {
    if (disabled || enCurso.current) return;
    enCurso.current = true;
    setCambiando(true);
    onPendienteChange?.(true);
    try {
      const resultado = await apiRequest<{ id: string; tipo: "orden" | "presupuesto" }>(
        `/borradores/${tipo}/${id}/a-${tipo === "orden" ? "presupuesto" : "orden"}`,
        { method: "POST", body: JSON.stringify({ version }) },
      );
      toast.success(`Borrador cambiado a ${destino}. Se conservaron los productos y precios.`);
      router.replace(resultado.tipo === "orden"
        ? `/produccion/ordenes/${resultado.id}`
        : `/comercial/presupuestos/${resultado.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo cambiar el tipo del borrador.");
      enCurso.current = false;
      setCambiando(false);
      onPendienteChange?.(false);
    }
  }
  return <ActionButton variant="outline" isDisabled={disabled || cambiando} onPress={() => void cambiar()}
    title={disabled ? motivoBloqueo ?? "Guardá los cambios pendientes antes de cambiar el tipo." : "Conserva productos, precios y datos. El borrador anterior queda archivado."}>
    <ArrowLeftRight aria-hidden />
    {cambiando ? "Cambiando…" : `Cambiar a ${destino}`}
  </ActionButton>;
}
