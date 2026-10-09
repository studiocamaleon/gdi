"use client";

import * as React from "react";

const textoCantidad = (value: number) => String(value).replace(".", ",");

/** Conserva el separador mientras se escribe; el motor recibe sólo números. */
export function CantidadProductoInput({
  value,
  onValueChange,
  permiteDecimales,
  ariaLabel,
}: {
  value: number;
  onValueChange: (value: number) => void;
  permiteDecimales: boolean;
  ariaLabel: string;
}) {
  const [edicion, setEdicion] = React.useState(() => ({
    texto: textoCantidad(value),
    numero: value,
  }));
  // Los botones y la hidratación pueden cambiar el valor externo. El eco de
  // nuestra propia edición no debe convertir «0,» en «0» ni borrar ceros.
  const texto = edicion.numero === value ? edicion.texto : textoCantidad(value);
  React.useEffect(() => {
    setEdicion((actual) =>
      actual.numero === value
        ? actual
        : { texto: textoCantidad(value), numero: value },
    );
  }, [value]);

  return (
    <input
      type="text"
      inputMode={permiteDecimales ? "decimal" : "numeric"}
      aria-label={ariaLabel}
      aria-invalid={value <= 0 || undefined}
      value={texto}
      onChange={(event) => {
        const raw = event.target.value;
        const patron = permiteDecimales ? /^\d*(?:[.,]\d*)?$/ : /^\d*$/;
        if (!patron.test(raw)) return;
        const numero = Number(raw.replace(",", "."));
        // Un separador solo es una edición en curso, igual que un campo vacío.
        const next = raw === "," || raw === "." ? 0 : numero;
        if (!Number.isFinite(next)) return;
        setEdicion({ texto: raw, numero: next });
        onValueChange(next);
      }}
      onBlur={() => {
        setEdicion({
          texto: texto === "" ? "" : textoCantidad(value),
          numero: value,
        });
      }}
    />
  );
}
