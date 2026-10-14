"use client";
import { useId } from "react";
import {
  errorValorCantidadManual,
  type CantidadManualConfig,
} from "@/lib/cantidad-manual-paso";

export function CantidadManualPasoField({
  config,
  value,
  onChange,
}: {
  config: CantidadManualConfig;
  value: number | null | undefined;
  onChange: (value: number | null) => void;
}) {
  const id = useId();
  const error = errorValorCantidadManual(config, value);
  return (
    <div className="ap-spec">
      <label htmlFor={id}>
        {config.etiqueta} ({config.unidad}) · Obligatorio
      </label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min={0}
        step="any"
        required
        value={value ?? ""}
        placeholder="Ingresá la cantidad total del paso"
        aria-invalid={Boolean(error)}
        aria-describedby={`${id}-ayuda`}
        onChange={(event) =>
          onChange(
            event.target.value === "" ? null : event.target.valueAsNumber,
          )
        }
      />
      <p
        id={`${id}-ayuda`}
        className={
          error ? "text-xs text-destructive" : "text-xs text-muted-foreground"
        }
      >
        {error ??
          "Cantidad total de este trabajo, independiente de la cantidad del producto."}
      </p>
    </div>
  );
}
