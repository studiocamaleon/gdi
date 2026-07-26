"use client";

import * as React from "react";
import { formatearMoneda, type Moneda } from "@/lib/moneda";
import { useConfigRegional } from "@/components/navigation/config-regional-provider";
import Link from "next/link";
import { toast } from "sonner";

import { ConfirmacionDestructiva } from "@/components/ui/confirmacion-destructiva";
import {
  alinearConNomina,
  getConciliacionNomina,
  type ConciliacionNomina,
} from "@/lib/gastos-fijos-api";

/**
 * La línea de sueldos del punto de equilibrio, contra la nómina real.
 *
 * Los dos módulos están desacoplados a propósito —el punto de equilibrio puede
 * incluir cosas que no imputan a ningún centro productivo— pero desacoplado no
 * es lo mismo que sin conciliar: hasta acá nadie podía decir si la diferencia
 * era una decisión o un número que quedó viejo. Esto NO fuerza la igualdad: la
 * muestra, y ofrece alinearla si corresponde.
 */

const fmt = (n: number, moneda: Moneda) =>
  formatearMoneda(n, moneda, { decimales: 0 });

export function ConciliacionNominaCard({
  mes,
  onAlineado,
}: {
  mes: string;
  onAlineado: () => void | Promise<void>;
}) {
  const { moneda } = useConfigRegional();
  const [datos, setDatos] = React.useState<ConciliacionNomina | null>(null);
  const [error, setError] = React.useState(false);
  const [confirmando, setConfirmando] = React.useState(false);

  const cargar = React.useCallback(() => {
    getConciliacionNomina(mes)
      .then(setDatos)
      .catch(() => setError(true));
  }, [mes]);

  React.useEffect(() => cargar(), [cargar]);

  if (error || !datos) return null;

  // Sin legajos cargados no hay con qué comparar, y una tarjeta que dice
  // "faltan datos" en una pantalla que no es la suya sólo estorba.
  if (datos.estado === "sin_nomina") return null;

  const alineado = datos.estado === "alineado";
  const deMas = datos.estado === "declarado_de_mas";

  async function alinear() {
    try {
      const r = await alinearConNomina(mes);
      setDatos(r);
      await onAlineado();
      toast.success("La línea de sueldos quedó igual a la nómina.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo alinear.");
    } finally {
      setConfirmando(false);
    }
  }

  return (
    <div className={`gf-concil${alineado ? " ok" : ""}`}>
      <div className="gf-concil-head">
        <div>
          <div className="t">Sueldos declarados vs. nómina real</div>
          <div className="s">
            {datos.nomina.personas} persona
            {datos.nomina.personas === 1 ? "" : "s"} con sueldo en{" "}
            <Link href="/empleados">sus legajos</Link>, con el aguinaldo
            prorrateado.
          </div>
        </div>
        {alineado ? (
          <span className="gf-concil-badge">Alineado</span>
        ) : (
          <button
            type="button"
            className="btn"
            onClick={() => setConfirmando(true)}
          >
            Usar la nómina real
          </button>
        )}
      </div>

      <div className="gf-concil-nums">
        <div>
          <span className="k">Acá declarás</span>
          <span className="v">{fmt(datos.declarado, moneda)}</span>
        </div>
        <div>
          <span className="k">La nómina cuesta</span>
          <span className="v">{fmt(datos.nomina.costoMensual, moneda)}</span>
        </div>
        <div className={alineado ? "" : "dif"}>
          <span className="k">Diferencia</span>
          <span className="v">
            {alineado
              ? "—"
              : `${datos.diferencia > 0 ? "+" : "−"}${fmt(Math.abs(datos.diferencia), moneda)}`}
          </span>
        </div>
      </div>

      {!alineado ? (
        <p className="gf-concil-nota">
          {deMas
            ? "Estás contando más sueldos de los que hay cargados en los legajos. Puede ser a propósito (algo que pagás y no es un legajo) o un número que quedó viejo."
            : "El punto de equilibrio no está cubriendo toda la masa salarial, así que te está dando más bajo de lo que es."}
        </p>
      ) : null}

      <ConfirmacionDestructiva
        open={confirmando}
        onOpenChange={setConfirmando}
        titulo="Reemplazar los sueldos por la nómina real"
        descripcion={`Las líneas de sueldos de este mes se cierran y queda una sola con ${fmt(datos.nomina.costoMensual, moneda)}.`}
        impacto={[
          "Los meses anteriores no se tocan: las líneas viejas se cierran, no se borran.",
          "Cambia el punto de equilibrio de Reportes.",
          "Si después cambia un sueldo, esta línea NO se actualiza sola: hay que volver a alinear.",
        ]}
        requiereTipear={false}
        accionLabel="Usar la nómina real"
        onConfirmar={alinear}
      />
    </div>
  );
}
