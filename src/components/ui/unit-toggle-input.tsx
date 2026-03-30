"use client";

/**
 * UnitToggleInput — input numérico con unidad clickeable.
 *
 * El valor siempre se almacena y comunica en la `canonicalUnit` definida
 * por la plantilla. El usuario puede hacer clic en la etiqueta de unidad
 * para cambiar la unidad de visualización; el componente convierte el
 * valor automáticamente en ambas direcciones.
 *
 * Ejemplo:
 *   canonicalUnit="m", valor almacenado=0.61
 *   → el usuario cambia a "cm" → muestra 61
 *   → el usuario escribe 100 → onChange("1") (en metros)
 */

import * as React from "react";
import {
  type UnitCode,
  UNIT_DEFINITIONS,
  areUnitsCompatible,
  convertUnitValue,
  getUnitDefinition,
} from "@/lib/unidades";
import { cn } from "@/lib/utils";

// ── Orden preferido de unidades por dimensión ──────────────────────────────

const DIMENSION_UNIT_ORDER: Partial<Record<string, UnitCode[]>> = {
  length: ["mm", "cm", "m"],
  mass: ["gramo", "kg"],
  volume: ["ml", "litro", "m3"],
  area: ["mm2", "m2"],
};

/**
 * Devuelve las unidades compatibles con `canonical` en el orden preferido.
 * Si sólo hay una, el toggle no tiene efecto útil.
 */
function getCompatibleUnitsOrdered(canonical: UnitCode): UnitCode[] {
  const def = UNIT_DEFINITIONS[canonical];
  if (!def) return [canonical];

  const preferredOrder = DIMENSION_UNIT_ORDER[def.dimension];
  if (!preferredOrder) return [canonical];

  return preferredOrder.filter(
    (code) => UNIT_DEFINITIONS[code] && areUnitsCompatible(canonical, code),
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function parseNumber(raw: string): number | null {
  const n = parseFloat(raw.replace(",", "."));
  return isFinite(n) ? n : null;
}

/**
 * Formatea un número para mostrarlo en el input.
 * Evita decimales innecesarios (p. ej. 61.0 → "61").
 */
function formatDisplay(n: number): string {
  // Hasta 6 decimales significativos, sin trailing zeros
  return parseFloat(n.toPrecision(8)).toString();
}

// ── Componente ─────────────────────────────────────────────────────────────

export interface UnitToggleInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  /** Valor actual en la unidad canónica (como string, tal como se almacena en atributosVariante). */
  value: string;
  /** Unidad canónica en que se almacena el valor. */
  canonicalUnit: UnitCode;
  /**
   * Unidad de visualización por defecto (arranca mostrando en esta unidad).
   * Debe ser compatible con `canonicalUnit`. Si no se indica, usa `canonicalUnit`.
   */
  defaultDisplayUnit?: UnitCode;
  /** Callback con el nuevo valor convertido a la unidad canónica (como string). */
  onValueChange: (canonicalValue: string) => void;
  /** Ancho del input. Por defecto "w-full". */
  inputClassName?: string;
}

export function UnitToggleInput({
  value,
  canonicalUnit,
  defaultDisplayUnit,
  onValueChange,
  disabled,
  inputClassName,
  className,
  ...rest
}: UnitToggleInputProps) {
  const compatibleUnits = React.useMemo(
    () => getCompatibleUnitsOrdered(canonicalUnit),
    [canonicalUnit],
  );
  const canToggle = compatibleUnits.length > 1;

  // Unidad de visualización actual (estado local).
  // Arranca en `defaultDisplayUnit` si es compatible, sino en `canonicalUnit`.
  const resolvedDefault = React.useMemo<UnitCode>(() => {
    if (defaultDisplayUnit && areUnitsCompatible(canonicalUnit, defaultDisplayUnit)) {
      return defaultDisplayUnit;
    }
    return canonicalUnit;
  }, [canonicalUnit, defaultDisplayUnit]);

  const [displayUnit, setDisplayUnit] = React.useState<UnitCode>(resolvedDefault);

  // Texto del input (controlado localmente para preservar edición en curso)
  const canonicalNum = parseNumber(value);
  const displayNum =
    canonicalNum !== null && displayUnit !== canonicalUnit
      ? convertUnitValue(canonicalNum, canonicalUnit, displayUnit)
      : canonicalNum;

  const [inputText, setInputText] = React.useState(() =>
    displayNum !== null ? formatDisplay(displayNum) : value,
  );

  // Sincronizar cuando cambia el valor externo (p. ej. al cargar datos)
  React.useEffect(() => {
    const external =
      canonicalNum !== null && displayUnit !== canonicalUnit
        ? convertUnitValue(canonicalNum, canonicalUnit, displayUnit)
        : canonicalNum;
    setInputText(external !== null ? formatDisplay(external) : value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, canonicalUnit]);

  // Cuando el usuario cambia la unidad de visualización
  const cycleUnit = () => {
    if (!canToggle) return;
    const currentIdx = compatibleUnits.indexOf(displayUnit);
    const nextUnit = compatibleUnits[(currentIdx + 1) % compatibleUnits.length];

    // Convertir el texto actual al valor en la nueva unidad de visualización
    const currentNum = parseNumber(inputText);
    if (currentNum !== null) {
      const converted = convertUnitValue(currentNum, displayUnit, nextUnit);
      setInputText(formatDisplay(converted));
    }
    setDisplayUnit(nextUnit);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setInputText(raw);

    const num = parseNumber(raw);
    if (num !== null) {
      // Convertir al valor canónico antes de notificar al padre
      const canonical =
        displayUnit !== canonicalUnit
          ? convertUnitValue(num, displayUnit, canonicalUnit)
          : num;
      onValueChange(formatDisplay(canonical));
    } else if (raw === "" || raw === "-") {
      onValueChange(raw);
    }
  };

  const unitDef = getUnitDefinition(displayUnit);
  const symbol = unitDef?.symbol ?? displayUnit;

  return (
    <div className={cn("flex items-center", className)}>
      <input
        {...rest}
        type="text"
        inputMode="decimal"
        value={inputText}
        disabled={disabled}
        onChange={handleChange}
        className={cn(
          // Mismos estilos base que el componente <Input> de shadcn
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium",
          "placeholder:text-muted-foreground",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
          // Quitar redondeo derecho para que el badge quede pegado
          canToggle && "rounded-r-none border-r-0",
          inputClassName,
        )}
      />
      {canToggle && (
        <button
          type="button"
          onClick={cycleUnit}
          disabled={disabled}
          title={`Cambiar unidad (actualmente: ${symbol})`}
          className={cn(
            "flex h-9 shrink-0 items-center justify-center rounded-r-md border border-input bg-muted px-2.5",
            "text-xs font-medium text-muted-foreground transition-colors",
            "hover:bg-accent hover:text-accent-foreground",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "min-w-[2.5rem]",
          )}
        >
          {symbol}
        </button>
      )}
      {!canToggle && unitDef && (
        <span className="ml-2 shrink-0 text-xs text-muted-foreground">{symbol}</span>
      )}
    </div>
  );
}
