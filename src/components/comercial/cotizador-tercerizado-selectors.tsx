"use client";

import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ConfigPasoDetalle } from "@/lib/productos-servicios";
import type { TercerizadoEje } from "@/lib/productos-servicios-api";

/**
 * Selectores de eje para los pasos TERCERIZADOS con fuente `matriz` del
 * producto que se está cotizando. Aislado del sheet gigante: sólo lee los
 * ejes y emite la selección; el motor hace el lookup con
 * `tercerizado_<configPasoId>`. docs/productos-tercerizados-diseno.md §7b.
 */
export function CotizadorTercerizadoSelectors({
  configPasos,
  seleccion,
  onChange,
}: {
  configPasos: ConfigPasoDetalle[];
  seleccion: Record<string, Record<string, string>>;
  onChange: (configPasoId: string, ejeClave: string, valorClave: string) => void;
}) {
  const pasos = configPasos.filter(
    (cp) => cp.tercerizado && cp.fuenteCostoTercerizado === "matriz",
  );
  if (pasos.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      {pasos.map((cp) => {
        const ejes = ejesDe(cp);
        if (ejes.length === 0) return null;
        const sel = seleccion[cp.id] ?? {};
        return (
          <div key={cp.id} className="flex flex-col gap-2">
            <span className="text-sm font-medium">
              {cp.nombreVisible?.trim() || "Opciones del proveedor"}
            </span>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {ejes.map((eje) => (
                <label key={eje.clave} className="flex flex-col gap-1.5 text-sm">
                  <span className="text-muted-foreground">{eje.label}</span>
                  <Select
                    value={sel[eje.clave] ?? ""}
                    onValueChange={(v) => onChange(cp.id, eje.clave, v ?? "")}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Elegí…" />
                    </SelectTrigger>
                    <SelectContent>
                      {eje.valores.map((v) => (
                        <SelectItem key={v.clave} value={v.clave}>
                          {v.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ejesDe(cp: ConfigPasoDetalle): TercerizadoEje[] {
  const cfg = cp.tercerizadoConfigJson;
  const ejes = cfg && typeof cfg === "object" ? (cfg as { ejes?: unknown }).ejes : null;
  if (!Array.isArray(ejes)) return [];
  return [...(ejes as TercerizadoEje[])].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
}
