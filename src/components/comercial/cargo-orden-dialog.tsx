"use client";

import * as React from "react";
import { Input, TextArea } from "@heroui/react";
import { PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { FormDialog } from "@/components/design-system/form-dialog";
import { ActionButton } from "@/components/design-system/action-button";
import { SelectField } from "@/components/design-system/select-field";
import focus from "@/components/design-system/field-focus.module.css";
import { useConfigRegional } from "@/components/navigation/config-regional-provider";
import type { CargoDirectoCatalogo } from "@/lib/productos-servicios";
import { formatCurrency, type PropuestaCargoDirecto } from "@/lib/propuestas";
import {
  buildCargoOrdenSnapshot,
  getCargoConfig,
  getCargoDefaultMonto,
  getCargoDefaultPorcentaje,
  getCargoDefaultPrecioUnidad,
  getCargoInputLabel,
} from "@/lib/cargos-orden";
import s from "./orden-financial-forms.module.css";

export function CargoOrdenDialog({
  open,
  cargos,
  subtotalBase,
  onClose,
  onAdd,
}: {
  open: boolean;
  cargos: CargoDirectoCatalogo[];
  subtotalBase: number;
  onClose: () => void;
  onAdd: (cargo: PropuestaCargoDirecto) => void;
}) {
  const { moneda } = useConfigRegional();
  const [cargoId, setCargoId] = React.useState("");
  const selectedCargo = React.useMemo(
    () => cargos.find((cargo) => cargo.id === cargoId) ?? null,
    [cargos, cargoId],
  );
  const zonas = React.useMemo(() => {
    const selectedConfig = getCargoConfig(selectedCargo);
    return Array.isArray(selectedConfig.zonas)
      ? (selectedConfig.zonas as Array<{
          codigo?: string;
          nombre?: string;
          monto?: number;
        }>)
      : [];
  }, [selectedCargo]);
  const [monto, setMonto] = React.useState(0);
  const [porcentaje, setPorcentaje] = React.useState(0);
  const [precioUnidad, setPrecioUnidad] = React.useState(0);
  const [cantidadInput, setCantidadInput] = React.useState(1);
  const [zonaCodigo, setZonaCodigo] = React.useState("");
  const [nota, setNota] = React.useState("");

  React.useEffect(() => {
    if (!open) return;
    const first = cargos[0];
    setCargoId(first?.id ?? "");
  }, [cargos, open]);

  React.useEffect(() => {
    setMonto(getCargoDefaultMonto(selectedCargo));
    setPorcentaje(getCargoDefaultPorcentaje(selectedCargo));
    setPrecioUnidad(getCargoDefaultPrecioUnidad(selectedCargo));
    setCantidadInput(1);
    setZonaCodigo(zonas[0]?.codigo ?? "");
    setNota("");
  }, [selectedCargo, zonas]);

  if (!open) return null;

  const preview = selectedCargo
    ? buildCargoOrdenSnapshot({
        cargo: selectedCargo,
        monto,
        porcentaje,
        precioUnidad,
        cantidadInput,
        zonaCodigo,
        subtotalBase,
        nota,
        moneda,
      })
    : null;

  const handleAdd = () => {
    if (!selectedCargo || !preview) {
      toast.error("Seleccioná un cargo del catálogo.");
      return;
    }
    if (preview.montoNeto <= 0) {
      toast.error("El monto del cargo debe ser mayor a cero.");
      return;
    }
    onAdd(preview);
  };

  const modoLabel: Record<string, string> = {
    MONTO_FIJO_PLANO: "Monto fijo",
    PORCENTAJE_SOBRE_BASE: "Porcentaje sobre subtotal",
    POR_UNIDAD_INPUT: "Por unidad",
  };
  const inputClass = `${s.input} ${focus.singleBorder}`;
  return (
    <FormDialog
      isOpen={open}
      onOpenChange={(value) => !value && onClose()}
      title="Agregar cargo a la orden"
      description="Elegí un cargo y ajustá su importe para esta orden."
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          handleAdd();
        }}
      >
        <div className={s.body}>
          {cargos.length === 0 ? (
            <div className={s.empty}>
              <strong>Sin cargos disponibles</strong>
              <p className={s.hint}>
                Creá cargos en Costos &gt; Cargos directos.
              </p>
            </div>
          ) : (
            <>
              <div className={s.field}>
                <label className={s.label} htmlFor="orden-cargo">
                  Cargo
                </label>
                <SelectField
                  id="orden-cargo"
                  aria-label="Cargo"
                  value={cargoId}
                  onChange={setCargoId}
                  options={cargos.map((cargo) => ({
                    value: cargo.id,
                    label: cargo.nombre,
                  }))}
                />
                {selectedCargo && (
                  <p className={s.hint}>
                    {modoLabel[selectedCargo.modoCalculo] ??
                      selectedCargo.modoCalculo}
                  </p>
                )}
              </div>
              {selectedCargo?.modoCalculo === "MONTO_FIJO_PLANO" &&
                (zonas.length > 0 ? (
                  <div className={s.field}>
                    <label className={s.label} htmlFor="orden-cargo-zona">
                      Zona
                    </label>
                    <SelectField
                      id="orden-cargo-zona"
                      aria-label="Zona"
                      value={zonaCodigo}
                      onChange={setZonaCodigo}
                      options={zonas.map((zona) => ({
                        value: zona.codigo ?? "",
                        label: `${zona.nombre ?? zona.codigo} · ${formatCurrency(Number(zona.monto) || 0, moneda)}`,
                      }))}
                    />
                  </div>
                ) : (
                  <label className={s.field}>
                    <span className={s.label}>Monto neto</span>
                    <Input
                      className={inputClass}
                      type="number"
                      min="0"
                      value={monto}
                      onChange={(event) =>
                        setMonto(Number(event.target.value) || 0)
                      }
                    />
                  </label>
                ))}
              {selectedCargo?.modoCalculo === "PORCENTAJE_SOBRE_BASE" && (
                <label className={s.field}>
                  <span className={s.label}>Porcentaje sobre subtotal</span>
                  <Input
                    className={inputClass}
                    type="number"
                    min="0"
                    step="0.1"
                    value={porcentaje}
                    onChange={(event) =>
                      setPorcentaje(Number(event.target.value) || 0)
                    }
                  />
                  <span className={s.hint}>
                    Base actual: {formatCurrency(subtotalBase, moneda)}
                  </span>
                </label>
              )}
              {selectedCargo?.modoCalculo === "POR_UNIDAD_INPUT" && (
                <div className={s.grid}>
                  <label className={s.field}>
                    <span className={s.label}>
                      {getCargoInputLabel(selectedCargo)}
                    </span>
                    <Input
                      className={inputClass}
                      type="number"
                      min="0"
                      step="0.01"
                      value={cantidadInput}
                      onChange={(event) =>
                        setCantidadInput(Number(event.target.value) || 0)
                      }
                    />
                  </label>
                  <label className={s.field}>
                    <span className={s.label}>Precio por unidad</span>
                    <Input
                      className={inputClass}
                      type="number"
                      min="0"
                      value={precioUnidad}
                      onChange={(event) =>
                        setPrecioUnidad(Number(event.target.value) || 0)
                      }
                    />
                  </label>
                </div>
              )}
              <label className={s.field}>
                <span className={s.label}>Nota interna</span>
                <TextArea
                  className={`${s.textarea} ${focus.singleBorder}`}
                  rows={3}
                  value={nota}
                  onChange={(event) => setNota(event.target.value)}
                  placeholder="Opcional"
                />
              </label>
              {preview && (
                <dl
                  className={s.calculation}
                  aria-label="Resumen del cargo"
                  aria-live="polite"
                >
                  <div>
                    <dt>Neto</dt>
                    <dd>{formatCurrency(preview.montoNeto, moneda)}</dd>
                  </div>
                  <div>
                    <dt>Impuestos</dt>
                    <dd>{formatCurrency(preview.impuestoMonto, moneda)}</dd>
                  </div>
                  <div>
                    <dt>Total del cargo</dt>
                    <dd>{formatCurrency(preview.total, moneda)}</dd>
                  </div>
                </dl>
              )}
            </>
          )}
        </div>
        <div className={s.footer}>
          <ActionButton variant="outline" onPress={onClose}>
            Cancelar
          </ActionButton>
          <ActionButton
            type="submit"
            isDisabled={!preview || preview.montoNeto <= 0}
          >
            <PlusIcon />
            Agregar cargo
          </ActionButton>
        </div>
      </form>
    </FormDialog>
  );
}
