"use client";

import * as React from "react";
import { toast } from "sonner";
import { ActionLink } from "@/components/design-system/action-link";
import { useDesignScope, useDesignTheme } from "@/components/design-system/appearance";
import { useCapacidad } from "@/components/navigation/capacidades-provider";
import { usePuede } from "@/components/navigation/permisos-provider";
import { useConfigRegional } from "@/components/navigation/config-regional-provider";
import { formatearMoneda } from "@/lib/moneda";
import { getRecurrentes } from "@/lib/egresos-api";
import type { CategoriaEgreso, GastoRecurrente } from "@/lib/egresos";
import type { GastoFijo } from "@/lib/gastos-fijos-api";
import type { ProveedorOpcion } from "@/lib/proveedores";
import { ProgramacionesAnterioresLista } from "./egresos-view";

/** Conserva las plantillas previas sin ofrecer un segundo lugar de alta. */
export function ProgramacionesAnterioresView(props: {
  initialRecurrentes: GastoRecurrente[];
  categorias: CategoriaEgreso[];
  proveedores: ProveedorOpcion[];
  gastosFijos: GastoFijo[];
}) {
  const [recurrentes, setRecurrentes] = React.useState(
    props.initialRecurrentes,
  );
  const capacidad = useCapacidad("gastos_recurrentes");
  const cuentas = useCapacidad("cuentas_pagar");
  const permiso = usePuede("administracion.gestionar");
  const { moneda } = useConfigRegional();
  const scope = useDesignScope();
  const theme = useDesignTheme();
  const recargar = async () => {
    try {
      setRecurrentes((await getRecurrentes()).recurrentes);
    } catch {
      toast.error("No se pudo actualizar la lista de programaciones.");
    }
  };
  return (
    <section className="egr-page">
      <div className="egr-wrap">
        <header className="egr-head">
          <div>
            <h1>Programaciones anteriores</h1>
            <p className="sub">
              Conservá y revisá las plantillas existentes. Las nuevas se
              configuran en Gastos fijos; las obligaciones emitidas se gestionan
              en Cuentas por pagar.
            </p>
          </div>
        </header>
        <nav {...scope} className={`${theme} egr-toolbar`} aria-label="Gestión de programaciones">
          <ActionLink href="/administracion/gastos-fijos" variant="outline">
            Ir a Gastos fijos
          </ActionLink>
          <ActionLink href="/administracion/egresos" variant="ghost">
            Volver al registro de egresos
          </ActionLink>
        </nav>
        <ProgramacionesAnterioresLista
          {...props}
          recurrentes={recurrentes}
          hoy={new Date().toISOString().slice(0, 10)}
          puedeGestionar={capacidad && cuentas && permiso}
          fmt={(v) => formatearMoneda(v, moneda)}
          onCambio={() => void recargar()}
        />
      </div>
    </section>
  );
}
