"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";
import { numeroMoneda, parsearMonto, type Moneda } from "@/lib/moneda";
import { cn } from "@/lib/utils";

/**
 * EL input de dinero. Uno solo.
 *
 * Convivían tres patrones incompatibles: `type="number"` (el separador
 * decimal del navegador no es el de la moneda del tenant), máscaras
 * `replace(/\D/g, "")` que hacían imposible tipear centavos, y texto libre
 * parseado con `replace(",", ".")` que convertía "1.234,56" en NaN. Acá se
 * tipea con los separadores de la propia moneda ("1.234,56" en AR,
 * "1,234.56" en HN) y al salir del campo el texto se normaliza con
 * `numeroMoneda` — en CLP sin centavos, porque no existen.
 *
 * Controlado por STRING: el caller guarda el texto en su form state y en
 * cada cambio recibe además el número parseado (null si el texto no es un
 * monto). Mientras se tipea NO se re-formatea — re-formatear por tecla
 * pelea con el cursor —; la normalización pasa sólo en blur.
 */
export function MoneyInput({
  value,
  onValueChange,
  moneda,
  placeholder,
  disabled,
  ariaLabel,
  className,
  inputClassName,
}: {
  value: string;
  onValueChange: (texto: string, numero: number | null) => void;
  moneda: Moneda;
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
  /** Va al wrapper `.arc-money` (p. ej. "big", o "money" en contextos scopeados). */
  className?: string;
  /** Va al `<input>` (p. ej. "ctl" donde el CSS scopeado estila por esa clase). */
  inputClassName?: string;
}) {
  // `arc-money-in` no estila: existe para que el padding que reserva el lugar
  // del símbolo le gane al `padding` shorthand del módulo que lo contenga.
  // Ver el bloque del final de globals.css.
  const numero = parsearMonto(value, moneda);
  const invalido = value.trim() !== "" && numero === null;
  return (
    <div className={cn("arc-money", className)}>
      <span className="c">{moneda.simbolo}</span>
      <Input
        inputMode="decimal"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-invalid={invalido || undefined}
        className={cn("arc-money-in", inputClassName)}
        onChange={(e) =>
          onValueChange(e.target.value, parsearMonto(e.target.value, moneda))
        }
        onBlur={() => {
          const normalizado = normalizarMontoTexto(value, moneda);
          if (normalizado !== value) onValueChange(normalizado, numero);
        }}
      />
    </div>
  );
}

/**
 * Lo que hace el blur, como función pura: si el texto es un monto, queda con
 * los separadores y decimales de la moneda ("1234,5" → "1.234,50"; en CLP
 * sin centavos); si no lo es (o está vacío) queda tal cual, para que el
 * usuario vea QUÉ escribió mal en vez de perderlo.
 */
export function normalizarMontoTexto(texto: string, moneda: Moneda): string {
  const n = parsearMonto(texto, moneda);
  return n === null ? texto : numeroMoneda(n, moneda);
}
