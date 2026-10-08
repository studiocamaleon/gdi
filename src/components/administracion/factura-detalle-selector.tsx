"use client";
import { SegmentedControl } from "@/components/design-system/choice-controls";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";

export type DetalleFactura = "items" | "orden";
export function FacturaDetalleSelector({
  value,
  onChange,
  disabled,
}: {
  value: DetalleFactura;
  onChange: (value: DetalleFactura) => void;
  disabled?: boolean;
}) {
  return (
    <Field>
      <FieldLabel>Detalle del comprobante</FieldLabel>
      <SegmentedControl
        aria-label="Detalle del comprobante"
        tone="graphite"
        value={value}
        onChange={(v) => onChange(v as DetalleFactura)}
        isDisabled={disabled}
        options={[
          { value: "items", label: "Productos y cargos", icon: null },
          { value: "orden", label: "Resumen por OT", icon: null },
        ]}
      />
      <FieldDescription>
        {value === "items"
          ? "Cada producto y cargo tendrá su propio renglón, con sus descuentos. Si una orden se factura parcialmente, se mostrará sólo el importe parcial."
          : "Un renglón por orden. Si hay distintas alícuotas de IVA, se separan para conservar los impuestos."}
      </FieldDescription>
    </Field>
  );
}
