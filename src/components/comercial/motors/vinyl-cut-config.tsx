"use client";

import * as React from "react";
import { PlusIcon, XIcon } from "lucide-react";

import type { VinylCutConfig } from "@/lib/productos-servicios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type VinylCutColorDraft = {
  id: string;
  label: string;
  colorFiltro: string | null;
  medidas: Array<{
    anchoMm: number | null;
    altoMm: number | null;
    cantidad: number;
  }>;
};

export type VinylCutProposalConfigProps = {
  config: VinylCutConfig;
  colorOptions: string[];
  colores: VinylCutColorDraft[];
  onColoresChange: (colores: VinylCutColorDraft[]) => void;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EMPTY_SELECT = "__none__";

export function buildDefaultColor(index: number): VinylCutColorDraft {
  return {
    id: crypto.randomUUID(),
    label: `Color ${index + 1}`,
    colorFiltro: null,
    medidas: [{ anchoMm: null, altoMm: null, cantidad: 1 }],
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function VinylCutProposalConfig({
  colorOptions,
  colores,
  onColoresChange,
}: VinylCutProposalConfigProps) {
  function updateColor(colorId: string, patch: Partial<VinylCutColorDraft>) {
    onColoresChange(
      colores.map((c) => (c.id === colorId ? { ...c, ...patch } : c)),
    );
  }

  function removeColor(colorId: string) {
    if (colores.length <= 1) return;
    onColoresChange(colores.filter((c) => c.id !== colorId));
  }

  function addColor() {
    onColoresChange([...colores, buildDefaultColor(colores.length)]);
  }

  function updateMedida(
    colorId: string,
    medidaIdx: number,
    field: "anchoMm" | "altoMm" | "cantidad",
    value: number | null,
  ) {
    onColoresChange(
      colores.map((c) => {
        if (c.id !== colorId) return c;
        const next = [...c.medidas];
        next[medidaIdx] = { ...next[medidaIdx], [field]: value };
        return { ...c, medidas: next };
      }),
    );
  }

  function addMedida(colorId: string) {
    onColoresChange(
      colores.map((c) => {
        if (c.id !== colorId) return c;
        return {
          ...c,
          medidas: [...c.medidas, { anchoMm: null, altoMm: null, cantidad: 1 }],
        };
      }),
    );
  }

  function removeMedida(colorId: string, medidaIdx: number) {
    onColoresChange(
      colores.map((c) => {
        if (c.id !== colorId) return c;
        if (c.medidas.length <= 1) return c;
        return { ...c, medidas: c.medidas.filter((_, i) => i !== medidaIdx) };
      }),
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {colores.map((color, colorIdx) => (
        <div
          key={color.id}
          className="flex flex-col gap-3 rounded-lg border border-border/70 p-4"
        >
          {/* Color header */}
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Color {colorIdx + 1}
            </p>
            {colores.length > 1 && (
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => removeColor(color.id)}
              >
                <XIcon className="size-3.5" />
              </Button>
            )}
          </div>

          {/* Color selector */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-muted-foreground">Color del vinilo</span>
            <Select
              value={color.colorFiltro ?? EMPTY_SELECT}
              onValueChange={(v) =>
                updateColor(color.id, {
                  colorFiltro: !v || v === EMPTY_SELECT ? null : v,
                  label: !v || v === EMPTY_SELECT ? `Color ${colorIdx + 1}` : v,
                })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar color">
                  {color.colorFiltro ?? "Seleccionar..."}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {colorOptions.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Medidas */}
          <div className="flex flex-col gap-2">
            <span className="text-[10px] text-muted-foreground">Medidas</span>
            {color.medidas.map((m, mIdx) => (
              <div key={mIdx} className="flex items-center gap-2">
                <div className="grid flex-1 grid-cols-3 gap-2">
                  <div className="flex flex-col gap-1">
                    {mIdx === 0 && (
                      <span className="text-[10px] text-muted-foreground">
                        Ancho (cm)
                      </span>
                    )}
                    <Input
                      type="number"
                      min={0.1}
                      step={0.1}
                      placeholder="Ancho"
                      value={m.anchoMm != null ? m.anchoMm / 10 : ""}
                      onChange={(e) => {
                        const v = e.target.value
                          ? Math.round(Number(e.target.value) * 10)
                          : null;
                        updateMedida(color.id, mIdx, "anchoMm", v);
                      }}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    {mIdx === 0 && (
                      <span className="text-[10px] text-muted-foreground">
                        Alto (cm)
                      </span>
                    )}
                    <Input
                      type="number"
                      min={0.1}
                      step={0.1}
                      placeholder="Alto"
                      value={m.altoMm != null ? m.altoMm / 10 : ""}
                      onChange={(e) => {
                        const v = e.target.value
                          ? Math.round(Number(e.target.value) * 10)
                          : null;
                        updateMedida(color.id, mIdx, "altoMm", v);
                      }}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    {mIdx === 0 && (
                      <span className="text-[10px] text-muted-foreground">
                        Cantidad
                      </span>
                    )}
                    <Input
                      type="number"
                      min={1}
                      value={m.cantidad || ""}
                      onChange={(e) =>
                        updateMedida(
                          color.id,
                          mIdx,
                          "cantidad",
                          Math.max(1, Number(e.target.value) || 1),
                        )
                      }
                    />
                  </div>
                </div>
                {color.medidas.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="shrink-0"
                    onClick={() => removeMedida(color.id, mIdx)}
                  >
                    <XIcon className="size-3.5" />
                  </Button>
                )}
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="w-fit"
              onClick={() => addMedida(color.id)}
            >
              <PlusIcon />
              Agregar medida
            </Button>
          </div>
        </div>
      ))}

      <Button variant="outline" size="sm" className="w-fit" onClick={addColor}>
        <PlusIcon />
        Agregar color
      </Button>
    </div>
  );
}
