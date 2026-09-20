"use client";
import { useState } from "react";
import { Input } from "@heroui/react";
import { ActionButton } from "@/components/design-system/action-button";
import { SelectField } from "@/components/design-system/select-field";
import { FormDialog } from "@/components/design-system/form-dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { InventoryVariantPicker } from "@/components/inventario/inventory-variant-picker";
import { stockUnitLabel } from "@/components/inventario/stock-conversion-fields";
import {
  guardarOfertaCompra,
  nombreVarianteCompra,
  type CatalogoCompras,
  type OfertaCompra,
} from "@/lib/compras-api";
import styles from "./compras.module.css";
export function OfertaForm({
  catalogo,
  oferta,
  onClose,
  onSaved,
}: {
  catalogo: CatalogoCompras;
  oferta?: OfertaCompra;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [proveedor, setProveedor] = useState(oferta?.proveedorId ?? "");
  const [variante, setVariante] = useState(oferta?.varianteId ?? "");
  const [unidad, setUnidad] = useState(oferta?.unidadCompra ?? "UNIDAD");
  const [factor, setFactor] = useState(
    oferta ? String(oferta.factorStock) : "",
  );
  const [precio, setPrecio] = useState(
    oferta?.precio == null ? "" : String(oferta.precio),
  );
  const [moneda, setMoneda] = useState(oferta?.moneda ?? catalogo.monedaStock);
  const [minimo, setMinimo] = useState(String(oferta?.minimo ?? 0));
  const [multiplo, setMultiplo] = useState(
    oferta?.multiplo == null ? "" : String(oferta.multiplo),
  );
  const [dias, setDias] = useState(
    oferta?.reposicionDias == null ? "" : String(oferta.reposicionDias),
  );
  const [tipo, setTipo] = useState(oferta?.reposicionTipo ?? "CORRIDOS");
  const [vigencia, setVigencia] = useState(
    oferta?.vigenteHasta?.slice(0, 10) ?? "",
  );
  const [codigo, setCodigo] = useState(oferta?.codigoProveedor ?? "");
  const [activo, setActivo] = useState(oferta?.activo ?? true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const v = catalogo.variantes.find((v) => v.id === variante);
  const stock = v?.unidadStock ?? v?.materiaPrima.unidadStock ?? "";
  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!proveedor || !variante || !factor) {
      setError("Elegí proveedor, material y contenido de la presentación.");
      return;
    }
    setBusy(true);
    try {
      await guardarOfertaCompra({
        proveedorId: proveedor,
        varianteId: variante,
        version: oferta?.version ?? 0,
        codigoProveedor: codigo,
        unidadCompra: unidad,
        factorStock: Number(factor),
        precio: precio === "" ? null : Number(precio),
        moneda,
        minimo: Number(minimo),
        multiplo: multiplo === "" ? null : Number(multiplo),
        reposicionDias: dias === "" ? null : Number(dias),
        reposicionTipo: dias === "" ? null : tipo,
        vigenteHasta: vigencia || null,
        activo,
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <FormDialog
      isOpen
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      isDismissable={!busy}
      title={
        oferta
          ? "Editar oferta de proveedor"
          : "Agregar proveedor para un material"
      }
      description="Condiciones de compra. No reemplazan el precio usado para cotizar trabajos."
    >
      <form onSubmit={guardar}>
        <div className={styles.body}>
          <FieldGroup className={styles.offerGrid}>
            <Field>
              <FieldLabel>Proveedor</FieldLabel>
              <SelectField
                aria-label="Proveedor de la oferta"
                value={proveedor}
                options={catalogo.proveedores.map((p) => ({
                  value: p.id,
                  label: p.nombre,
                }))}
                onChange={setProveedor}
                disabled={!!oferta || busy}
              />
            </Field>
            <Field>
              <FieldLabel>Código del proveedor</FieldLabel>
              <Input
                aria-label="Código del proveedor"
                maxLength={120}
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
              />
            </Field>
          </FieldGroup>
          {oferta ? (
            <strong>{v ? nombreVarianteCompra(v) : "Material"}</strong>
          ) : (
            <InventoryVariantPicker
              label="Material de la oferta"
              value={variante}
              options={catalogo.variantes.map((v) => ({
                id: v.id,
                label: nombreVarianteCompra(v),
              }))}
              onChange={(id) => {
                setVariante(id);
                const v = catalogo.variantes.find((v) => v.id === id)!;
                const u = v.unidadCompra ?? v.materiaPrima.unidadCompra;
                setUnidad(u);
                setFactor(
                  u === (v.unidadStock ?? v.materiaPrima.unidadStock)
                    ? "1"
                    : "",
                );
              }}
            />
          )}
          <FieldGroup className={styles.offerGrid}>
            <Field>
              <FieldLabel>Unidad de compra</FieldLabel>
              <SelectField
                aria-label="Unidad de compra de la oferta"
                value={unidad}
                options={catalogo.unidades.map((u) => ({
                  value: u,
                  label: stockUnitLabel(u),
                }))}
                onChange={(u) => {
                  setUnidad(u);
                  setFactor(u === stock ? "1" : "");
                }}
              />
            </Field>
            <Field>
              <FieldLabel>
                {stockUnitLabel(stock)} por {stockUnitLabel(unidad)}
              </FieldLabel>
              <Input
                aria-label="Contenido de la presentación"
                type="number"
                step="any"
                min="0.00000001"
                required
                value={factor}
                onChange={(e) => setFactor(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel>Precio por {stockUnitLabel(unidad)}</FieldLabel>
              <Input
                aria-label="Precio de la oferta"
                type="number"
                step="any"
                min="0.000001"
                value={precio}
                onChange={(e) => setPrecio(e.target.value)}
                placeholder="A confirmar"
              />
            </Field>
            <Field>
              <FieldLabel>Moneda</FieldLabel>
              <Input
                aria-label="Moneda de la oferta"
                maxLength={3}
                required
                value={moneda}
                onChange={(e) => setMoneda(e.target.value.toUpperCase())}
              />
            </Field>
            <Field>
              <FieldLabel>Compra mínima · {stockUnitLabel(unidad)}</FieldLabel>
              <Input
                aria-label="Compra mínima"
                type="number"
                step="any"
                min={0}
                value={minimo}
                required
                onChange={(e) => setMinimo(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel>Múltiplo de compra</FieldLabel>
              <Input
                aria-label="Múltiplo de compra"
                type="number"
                step="any"
                min="0.00000001"
                value={multiplo}
                onChange={(e) => setMultiplo(e.target.value)}
                placeholder="Sin restricción"
              />
            </Field>
            <Field>
              <FieldLabel>Reposición específica · días</FieldLabel>
              <Input
                aria-label="Reposición específica"
                type="number"
                min={0}
                max={3650}
                step={1}
                value={dias}
                onChange={(e) => setDias(e.target.value)}
                placeholder="Heredar del proveedor"
              />
            </Field>
            <Field>
              <FieldLabel>Cómputo</FieldLabel>
              <SelectField
                aria-label="Cómputo del plazo"
                value={tipo}
                options={[
                  { value: "CORRIDOS", label: "Días corridos" },
                  { value: "HABILES", label: "Lunes a viernes" },
                ]}
                onChange={setTipo}
                disabled={dias === ""}
              />
            </Field>
            <Field>
              <FieldLabel>Vigente hasta</FieldLabel>
              <Input
                aria-label="Vigencia de la oferta"
                type="date"
                value={vigencia}
                onChange={(e) => setVigencia(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel>Estado</FieldLabel>
              <SelectField
                aria-label="Estado de la oferta"
                value={activo ? "activa" : "inactiva"}
                options={[
                  { value: "activa", label: "Disponible" },
                  { value: "inactiva", label: "Inhabilitada" },
                ]}
                onChange={(v) => setActivo(v === "activa")}
              />
            </Field>
          </FieldGroup>
          <p className={styles.secondary}>
            El plazo vacío hereda el general del proveedor; 0 significa entrega
            en el día. Lunes a viernes no descuenta feriados.
          </p>
          {error && (
            <p role="alert" className={styles.warning}>
              {error}
            </p>
          )}
        </div>
        <footer className={styles.footer}>
          <ActionButton variant="outline" onPress={onClose} isDisabled={busy}>
            Cancelar
          </ActionButton>
          <ActionButton type="submit" isPending={busy}>
            Guardar oferta
          </ActionButton>
        </footer>
      </form>
    </FormDialog>
  );
}
