"use client";

import { useState, type ComponentProps } from "react";
import { Input } from "@heroui/react";
import {
  BadgePercentIcon,
  CircleDollarSignIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";
import { FormDialog } from "@/components/design-system/form-dialog";
import { ActionButton } from "@/components/design-system/action-button";
import { SegmentedControl } from "@/components/design-system/choice-controls";
import focus from "@/components/design-system/field-focus.module.css";
import { useConfigRegional } from "@/components/navigation/config-regional-provider";
import { formatCurrency, type PropuestaItem } from "@/lib/propuestas";
import { netoListaDeItem, type DescuentoInput } from "@/lib/descuentos-orden";
import s from "./orden-financial-forms.module.css";

export type DescuentoTarget = {
  scope: "item" | "orden";
  itemId: string | null;
};

/** Sólo descuento manual. El motor y el prorrateo permanecen en la ficha. */
function DescuentoForm({
  target,
  items,
  aplicando,
  onClose,
  onApply,
}: {
  target: DescuentoTarget;
  items: PropuestaItem[];
  aplicando: boolean;
  onClose: () => void;
  onApply: (
    scope: "item" | "orden",
    itemId: string | null,
    descuento: DescuentoInput | null,
  ) => void;
}) {
  const { moneda } = useConfigRegional();
  const descuentoInicial = (
    target.scope === "item"
      ? items.find((item) => item.id === target.itemId)
      : items.find((item) => item.descuentoInput)
  )?.descuentoInput;
  const [tipo, setTipo] = useState<"PORCENTAJE" | "MONTO">(
    descuentoInicial?.tipo ?? "PORCENTAJE",
  );
  const [valor, setValor] = useState(descuentoInicial?.valor ?? 0);
  const { scope, itemId } = target;
  const itemObjetivo =
    scope === "item" ? items.find((item) => item.id === itemId) : null;
  const netoLista =
    scope === "item"
      ? itemObjetivo
        ? netoListaDeItem(itemObjetivo)
        : 0
      : items.reduce((acc, item) => acc + netoListaDeItem(item), 0);
  const montoPreview =
    tipo === "PORCENTAJE"
      ? (netoLista * Math.min(Math.max(valor, 0), 100)) / 100
      : Math.min(Math.max(valor, 0), netoLista);
  const hayDescuento =
    scope === "item"
      ? Boolean(itemObjetivo?.descuentoInput)
      : items.some((item) => item.descuentoInput);
  const invalido =
    valor <= 0 ||
    (tipo === "PORCENTAJE" && valor > 100) ||
    !Number.isFinite(valor);
  const aplicar = () => {
    if (aplicando) return;
    if (scope === "item" && !itemObjetivo) {
      toast.error("No se pudo identificar el producto a descontar.");
      return;
    }
    if (invalido) return;
    onApply(scope, scope === "item" ? itemId : null, { tipo, valor });
  };
  return (
    <FormDialog
      isOpen
      onOpenChange={(open) => !open && !aplicando && onClose()}
      isDismissable={!aplicando}
      title="Aplicar descuento"
      description="Ajustá el precio antes de impuestos y revisá el importe resultante."
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          aplicar();
        }}
      >
        <div className={s.body}>
          <div className={s.target}>
            <span className={s.label}>Descuento para</span>
            <strong>
              {scope === "item"
                ? (itemObjetivo?.productoNombre ?? "Producto")
                : `Toda la orden · ${items.length} ${items.length === 1 ? "producto" : "productos"}`}
            </strong>
          </div>
          <div className={s.field}>
            <span className={s.label}>Tipo de descuento</span>
            <SegmentedControl
              aria-label="Tipo de descuento"
              value={tipo}
              onChange={(value) => setTipo(value as typeof tipo)}
              isDisabled={aplicando}
              options={[
                {
                  value: "PORCENTAJE",
                  label: "Porcentaje",
                  icon: <BadgePercentIcon />,
                },
                {
                  value: "MONTO",
                  label: "Monto",
                  icon: <CircleDollarSignIcon />,
                },
              ]}
            />
          </div>
          <label className={s.field}>
            <span className={s.label}>
              {tipo === "PORCENTAJE" ? "Porcentaje (%)" : "Monto neto"}
            </span>
            <Input
              autoFocus
              className={`${s.input} ${focus.singleBorder}`}
              type="number"
              min="0"
              step={tipo === "PORCENTAJE" ? "0.5" : "1"}
              max={tipo === "PORCENTAJE" ? "100" : undefined}
              value={valor}
              disabled={aplicando}
              onChange={(event) => setValor(Number(event.target.value) || 0)}
            />
          </label>
          <dl
            className={s.calculation}
            aria-label="Vista previa del descuento"
            aria-live="polite"
          >
            <div>
              <dt>Neto de lista</dt>
              <dd>{formatCurrency(netoLista, moneda)}</dd>
            </div>
            <div className={s.discount}>
              <dt>Descuento</dt>
              <dd>−{formatCurrency(montoPreview, moneda)}</dd>
            </div>
            <div>
              <dt>Neto con descuento</dt>
              <dd>
                {formatCurrency(Math.max(0, netoLista - montoPreview), moneda)}
              </dd>
            </div>
          </dl>
          <p className={s.hint}>
            {scope === "orden"
              ? tipo === "MONTO"
                ? "Se reparte entre los productos según su peso."
                : "Se aplica el mismo porcentaje a cada producto."
              : "El margen resultante se recalcula al aplicar."}
            <small>
              Impuestos y comisiones se recalculan sobre el neto descontado.
            </small>
          </p>
        </div>
        <div className={s.footer}>
          {hayDescuento && (
            <ActionButton
              variant="ghost"
              className={s.remove}
              isDisabled={aplicando}
              onPress={() =>
                onApply(scope, scope === "item" ? itemId : null, null)
              }
            >
              <Trash2Icon />
              Quitar descuento
            </ActionButton>
          )}
          <ActionButton
            variant="outline"
            onPress={onClose}
            isDisabled={aplicando}
          >
            Cancelar
          </ActionButton>
          <ActionButton
            type="submit"
            isDisabled={aplicando || !items.length || invalido}
          >
            <BadgePercentIcon />
            {aplicando ? "Aplicando…" : "Aplicar descuento"}
          </ActionButton>
        </div>
      </form>
    </FormDialog>
  );
}

/** El formulario se inicializa al abrir; una recotización no pisa lo escrito. */
export function DescuentoOrdenDialog({
  target,
  ...props
}: Omit<ComponentProps<typeof DescuentoForm>, "target"> & {
  target: DescuentoTarget | null;
}) {
  return target ? (
    <DescuentoForm
      key={`${target.scope}:${target.itemId}`}
      target={target}
      {...props}
    />
  ) : null;
}
