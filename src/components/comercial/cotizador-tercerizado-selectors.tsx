"use client";

import * as React from "react";
import type { ConfigPasoDetalle } from "@/lib/productos-servicios";
import type { TercerizadoEje } from "@/lib/productos-servicios-api";
import seC from "./cotizador-seccion.module.css";

/**
 * Selectores de eje para los pasos TERCERIZADOS con fuente `matriz` del
 * producto que se está cotizando. Aislado del sheet gigante.
 *
 * El eje `cantidad` NO se dibuja acá: la cantidad se elige con el campo de
 * cantidad normal del ítem (que ya muestra las cantidades definidas como
 * botones cuando el producto trabaja con cantidades fijas). Así no hay dos
 * campos de cantidad; la selección de matriz recibe `qty` en `buildJobContext`.
 * Los demás ejes (papel, terminación, …) se muestran como botones segmentados
 * para mantener la estética del resto del cotizador.
 * docs/productos-tercerizados-diseno.md §7b.
 */
export function CotizadorTercerizadoSelectors({
  configPasos,
  seleccion,
  onChange,
  renderSegmented,
}: {
  configPasos: ConfigPasoDetalle[];
  seleccion: Record<string, Record<string, string>>;
  onChange: (configPasoId: string, ejeClave: string, valorClave: string) => void;
  renderSegmented: (
    name: string,
    value: string,
    options: Array<{ value: string; label: string }>,
    onChange: (value: string) => void,
  ) => React.ReactNode;
}) {
  const bloques = tercerizadoMatrizPasos(configPasos)
    .map((cp) => ({
      cp,
      // El eje cantidad lo maneja el campo de cantidad del ítem.
      ejes: tercerizadoEjes(cp).filter((eje) => eje.clave !== "cantidad"),
    }))
    .filter((bloque) => bloque.ejes.length > 0);
  if (bloques.length === 0) return null;

  return (
    <>
      {bloques.flatMap(({ cp, ejes }) => {
        const sel = seleccion[cp.id] ?? {};
        return ejes.map((eje) => (
          <div key={`${cp.id}:${eje.clave}`} className="ap-spec ap-spec-wide">
            <label>{eje.label}</label>
            {renderSegmented(
              eje.label,
              sel[eje.clave] ?? "",
              eje.valores.map((v) => ({ value: v.clave, label: v.label })),
              (valorClave) => onChange(cp.id, eje.clave, valorClave),
            )}
          </div>
        ));
      })}
    </>
  );
}

/** Pasos tercerizados con fuente `matriz` de un set de config-pasos. */
export function tercerizadoMatrizPasos(
  configPasos: ConfigPasoDetalle[],
): ConfigPasoDetalle[] {
  return configPasos.filter(
    (cp) => cp.tercerizado && cp.fuenteCostoTercerizado === "matriz",
  );
}

/** Pasos tercerizados con fuente `manual` (el proveedor cotiza por trabajo). */
export function tercerizadoManualPasos(
  configPasos: ConfigPasoDetalle[],
): ConfigPasoDetalle[] {
  return configPasos.filter(
    (cp) => cp.tercerizado && cp.fuenteCostoTercerizado === "manual",
  );
}

/** Costo estimado de referencia de la config del paso (null si no hay). */
export function tercerizadoCostoEstimado(
  cp: ConfigPasoDetalle,
): number | null {
  const cfg = cp.tercerizadoConfigJson;
  const est =
    cfg && typeof cfg === "object"
      ? Number((cfg as { costoEstimado?: unknown }).costoEstimado)
      : NaN;
  return Number.isFinite(est) && est > 0 ? est : null;
}

/**
 * Inputs de costo del proveedor para los pasos con fuente `manual`: el
 * proveedor cotizó ESTE trabajo y el comercial carga el monto (neto). Sin
 * monto y con estimado de referencia, el motor usa el estimado y la
 * cotización queda marcada como estimada.
 */
export function CotizadorTercerizadoCostoManual({
  configPasos,
  valores,
  onChange,
  simboloMoneda,
  nombreDe,
}: {
  configPasos: ConfigPasoDetalle[];
  valores: Record<string, number | null>;
  onChange: (configPasoId: string, valor: number | null) => void;
  simboloMoneda: string;
  nombreDe: (cp: ConfigPasoDetalle) => string;
}) {
  const pasos = tercerizadoManualPasos(configPasos);
  if (pasos.length === 0) return null;

  // Tarjeta con barra negra, el mismo idioma que Medida/params: una card por
  // paso que el proveedor cotiza por trabajo.
  return (
    <>
      {pasos.map((cp) => {
        const estimado = tercerizadoCostoEstimado(cp);
        const valor = valores[cp.id];
        return (
          <div key={`terc-manual-${cp.id}`} className={seC.card}>
            <div className={seC.gh}>Costo del proveedor · {nombreDe(cp)}</div>
            <div className={seC.body}>
              <div className="ap-spec ap-spec-wide">
                <label>Cotización del proveedor ({simboloMoneda} neto)</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={valor ?? ""}
                  placeholder={
                    estimado != null
                      ? `Estimado: ${simboloMoneda} ${estimado}`
                      : "Requerido — cotización del proveedor"
                  }
                  onChange={(event) =>
                    onChange(
                      cp.id,
                      event.target.value === ""
                        ? null
                        : Number(event.target.value),
                    )
                  }
                />
                {valor == null && estimado != null ? (
                  <div className="ap-minimum-alert">
                    <span>
                      Cotiza con el estimado de referencia — confirmá el costo
                      con el proveedor antes de cerrar el precio.
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}

/** Ejes de un paso tercerizado, ordenados por `orden`. */
export function tercerizadoEjes(cp: ConfigPasoDetalle): TercerizadoEje[] {
  const cfg = cp.tercerizadoConfigJson;
  const ejes = cfg && typeof cfg === "object" ? (cfg as { ejes?: unknown }).ejes : null;
  if (!Array.isArray(ejes)) return [];
  return [...(ejes as TercerizadoEje[])].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
}

/**
 * Cantidades definidas por el/los eje(s) `cantidad` de los pasos tercerizados
 * con matriz. Alimentan el campo de cantidad del ítem como botones fijos.
 */
export function getTercerizadoCantidades(
  configPasos: ConfigPasoDetalle[],
): number[] {
  const valores = new Set<number>();
  for (const cp of tercerizadoMatrizPasos(configPasos)) {
    const eje = tercerizadoEjes(cp).find((e) => e.clave === "cantidad");
    if (!eje) continue;
    for (const v of eje.valores) {
      const n = Number(v.clave);
      if (Number.isFinite(n) && n > 0) valores.add(n);
    }
  }
  return [...valores].sort((a, b) => a - b);
}
