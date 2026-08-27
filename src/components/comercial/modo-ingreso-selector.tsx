"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import seC from "./cotizador-seccion.module.css";

export type OpcionModoIngreso<T extends string = string> = {
  value: T;
  label: string;
};

type Props<T extends string> = {
  value: T;
  options: Array<OpcionModoIngreso<T>>;
  onValueChange: (value: T) => void;
  ariaLabel?: string;
};

/**
 * Única puerta visual para elegir cómo se describe un trabajo al cotizar.
 * Las capacidades cambian por producto; la posición, el título y la interacción
 * permanecen iguales en todo el sheet.
 */
export function ModoIngresoSelector<T extends string>({
  value,
  options,
  onValueChange,
  ariaLabel = "Modo de ingreso",
}: Props<T>) {
  if (options.length < 2) return null;

  return (
    <div className={seC.card}>
      <div className={seC.gh}>Modo de ingreso</div>
      <div className={seC.body}>
        <ToggleGroup
          multiple={false}
          variant="outline"
          value={[value]}
          onValueChange={(values) => {
            const next = values.at(-1) as T | undefined;
            if (next) onValueChange(next);
          }}
          aria-label={ariaLabel}
          className="grid w-full"
          style={{
            gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
          }}
        >
          {options.map((option) => (
            <ToggleGroupItem
              key={option.value}
              value={option.value}
              className="w-full"
            >
              {option.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
    </div>
  );
}
