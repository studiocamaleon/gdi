"use client";
import { Input } from "./nodos-ui";
import { leerCantidadManual } from "@/lib/cantidad-manual-paso";

export function CantidadManualConfigFields({
  params,
  onChange,
}: {
  params: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const config = leerCantidadManual(params);
  if (!config) return null;
  return (
    <div className="grid gap-3 rounded-md border p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">
          Nombre del dato al cotizar
          <Input
            value={config.etiqueta}
            maxLength={80}
            required
            placeholder="Ej.: Superficie a desplotear"
            onChange={(e) =>
              onChange({
                cantidadManual: { ...config, etiqueta: e.target.value },
              })
            }
          />
        </label>
        <label className="grid gap-1 text-sm">
          Unidad de la cantidad y del ritmo
          <Input
            value={config.unidad}
            maxLength={24}
            required
            placeholder="Ej.: m², m, unidades"
            onChange={(e) =>
              onChange({
                cantidadManual: { ...config, unidad: e.target.value },
              })
            }
          />
        </label>
      </div>
      <p className="text-xs text-muted-foreground">
        Al cotizar se ingresará la cantidad total de este paso en{" "}
        {config.unidad || "la unidad indicada"}. El tiempo se calculará con esa
        cantidad y el ritmo definido abajo. Esta cantidad no modifica las
        medidas ni los materiales del producto.
      </p>
    </div>
  );
}
