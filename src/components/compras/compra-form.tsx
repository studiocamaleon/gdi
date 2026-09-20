"use client";
import { useRef, useState } from "react";
import { Input, TextArea } from "@heroui/react";
import { Trash2, Plus } from "lucide-react";
import { ActionButton } from "@/components/design-system/action-button";
import { SelectField } from "@/components/design-system/select-field";
import { FormDialog } from "@/components/design-system/form-dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { InventoryVariantPicker } from "@/components/inventario/inventory-variant-picker";
import { stockUnitLabel } from "@/components/inventario/stock-conversion-fields";
import {
  crearCompra,
  nombreVarianteCompra,
  type CatalogoCompras,
  type NecesidadCompra,
  type CrearCompraPayload,
  type LineaCompraPayload,
} from "@/lib/compras-api";
import styles from "./compras.module.css";
import {
  factorCompra,
  numeroCompraInput,
  ofertaCompraVigente,
  sugerirPrecioCompra,
} from "@/lib/compra-valores";
type Linea = {
  id: string;
  varianteId: string;
  unidadCompra: string;
  factor: string;
  cantidad: string;
  precio: string;
  precioEditado: boolean;
  fecha: string;
  asignaciones: LineaCompraPayload["asignaciones"];
};
const hoy = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export function CompraForm({
  catalogo,
  necesidades,
  onClose,
  onSaved,
}: {
  catalogo: CatalogoCompras;
  necesidades: NecesidadCompra[];
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const defaultProveedor =
    necesidades.length &&
    necesidades.every((n) => n.proveedor?.id === necesidades[0].proveedor?.id)
      ? (necesidades[0].proveedor?.id ?? "")
      : "";
  const [proveedor, setProveedor] = useState(defaultProveedor);
  const [ubicacion, setUbicacion] = useState(
    catalogo.ubicaciones.length === 1 ? catalogo.ubicaciones[0].id : "",
  );
  const [fecha, setFecha] = useState(hoy);
  const [moneda, setMoneda] = useState(catalogo.monedaStock);
  const [cambio, setCambio] = useState("1");
  const [notas, setNotas] = useState("");
  function nueva(
    varianteId: string,
    asignaciones: Linea["asignaciones"] = [],
    prov = proveedor,
  ): Linea {
    const v = catalogo.variantes.find((v) => v.id === varianteId)!;
    const oferta = ofertaCompraVigente(v, prov);
    const unidad =
      oferta?.unidadCompra ?? v.unidadCompra ?? v.materiaPrima.unidadCompra;
    const factor = factorCompra(v, unidad, oferta);
    const total = asignaciones.reduce((s, a) => s + a.cantidad, 0);
    let cantidad = total && factor ? total / factor : 1;
    if (oferta) {
      cantidad = Math.max(cantidad, Number(oferta.minimo));
      if (oferta.multiplo)
        cantidad =
          Math.ceil(cantidad / Number(oferta.multiplo)) *
          Number(oferta.multiplo);
    }
    return {
      id: crypto.randomUUID(),
      varianteId,
      unidadCompra: unidad,
      factor: factor === null ? "" : String(factor),
      cantidad: String(Number(cantidad.toFixed(8))),
      precio: sugerirPrecioCompra(
        v,
        unidad,
        factor,
        oferta,
        moneda,
        catalogo.monedaStock,
      ).precio,
      precioEditado: false,
      fecha: "",
      asignaciones,
    };
  }
  const [lineas, setLineas] = useState<Linea[]>(() =>
    [...new Set(necesidades.map((n) => n.varianteId))].map((id) =>
      nueva(
        id,
        necesidades
          .filter((n) => n.varianteId === id)
          .map((n) => ({
            necesidadId: n.id,
            revision: n.revision,
            cantidad: Number(n.porCubrir),
          })),
        defaultProveedor,
      ),
    ),
  );
  const [variante, setVariante] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const reintento = useRef<{ body: string; clave: string } | null>(null);
  function patch(id: string, patch: Partial<Linea>) {
    setLineas((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }
  function cambiarUnidad(l: Linea, unidadCompra: string) {
    const v = catalogo.variantes.find((v) => v.id === l.varianteId)!;
    const oferta = ofertaCompraVigente(v, proveedor);
    const factor = factorCompra(v, unidadCompra, oferta);
    const previo = Number(l.factor);
    const puedeConvertir = factor != null && previo > 0;
    patch(l.id, {
      unidadCompra,
      factor: factor == null ? "" : numeroCompraInput(factor),
      cantidad:
        puedeConvertir && l.cantidad
          ? numeroCompraInput((Number(l.cantidad) * previo) / factor)
          : l.cantidad,
      precio: l.precioEditado
        ? puedeConvertir && l.precio
          ? numeroCompraInput((Number(l.precio) * factor) / previo, 6)
          : ""
        : sugerirPrecioCompra(
            v,
            unidadCompra,
            factor,
            oferta,
            moneda,
            catalogo.monedaStock,
          ).precio,
    });
  }
  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!proveedor || !ubicacion || !lineas.length) {
      setError("Elegí proveedor, destino y al menos un material.");
      return;
    }
    if (
      lineas.some(
        (l) =>
          ![l.factor, l.cantidad, l.precio].every(
            (v) => v !== "" && Number.isFinite(Number(v)) && Number(v) > 0,
          ),
      )
    ) {
      setError("Completá cantidades, contenido y precio de cada material.");
      return;
    }
    const payload: CrearCompraPayload = {
      proveedorId: proveedor,
      ubicacionId: ubicacion,
      fechaPedido: fecha,
      moneda,
      tipoCambio: moneda === catalogo.monedaStock ? 1 : Number(cambio),
      notas,
      lineas: lineas.map((l) => ({
        varianteId: l.varianteId,
        unidadCompra: l.unidadCompra,
        factorStock: Number(l.factor),
        cantidad: Number(l.cantidad),
        precio: Number(l.precio),
        fechaConfirmada: l.fecha || null,
        asignaciones: l.asignaciones,
      })),
    };
    const body = JSON.stringify(payload);
    if (reintento.current?.body !== body)
      reintento.current = { body, clave: crypto.randomUUID() };
    setBusy(true);
    try {
      const result = await crearCompra({
        ...payload,
        clave: reintento.current.clave,
      });
      onSaved(result.ordenId);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo guardar la compra.",
      );
    } finally {
      setBusy(false);
    }
  }
  const prov = catalogo.proveedores.find((p) => p.id === proveedor);
  return (
    <FormDialog
      isOpen
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      isDismissable={!busy}
      title="Preparar compra"
      description="Revisá cantidades y llegada antes de registrar el pedido al proveedor."
      className={styles.dialog}
    >
      <form onSubmit={guardar} className={styles.pageBody}>
        <div className={styles.body}>
          <FieldGroup className={styles.grid}>
            <Field>
              <FieldLabel>Proveedor</FieldLabel>
              <SelectField
                aria-label="Proveedor de la compra"
                value={proveedor}
                options={catalogo.proveedores.map((p) => ({
                  value: p.id,
                  label: p.nombre,
                }))}
                onChange={(id) => {
                  setProveedor(id);
                  setLineas((ls) =>
                    ls.map((l) => ({
                      ...nueva(l.varianteId, l.asignaciones, id),
                      id: l.id,
                    })),
                  );
                }}
                disabled={busy}
              />
              <span className={styles.secondary}>
                {prov?.reposicionDias == null
                  ? "Plazo habitual sin confirmar"
                  : `${prov.reposicionDias} días ${prov.reposicionTipo === "HABILES" ? "de lunes a viernes" : "corridos"}`}
              </span>
            </Field>
            <Field>
              <FieldLabel>Destino</FieldLabel>
              <SelectField
                aria-label="Destino de la compra"
                value={ubicacion}
                options={catalogo.ubicaciones.map((u) => ({
                  value: u.id,
                  label: `${u.almacen.nombre} · ${u.nombre}`,
                }))}
                onChange={setUbicacion}
                disabled={busy}
              />
              {!catalogo.ubicaciones.length && (
                <a className={styles.link} href="/inventario/centro-stock">
                  Creá primero un depósito en Stock
                </a>
              )}
            </Field>
            <Field>
              <FieldLabel>Fecha prevista del pedido</FieldLabel>
              <Input
                aria-label="Fecha prevista del pedido"
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                required
                disabled={busy}
              />
            </Field>
            <Field>
              <FieldLabel>Moneda de la compra</FieldLabel>
              <Input
                aria-label="Moneda de la compra"
                value={moneda}
                maxLength={3}
                onChange={(e) => {
                  const nuevaMoneda = e.target.value.toUpperCase();
                  setMoneda(nuevaMoneda);
                  setCambio("");
                  setLineas((ls) =>
                    ls.map((l) => {
                      const v = catalogo.variantes.find(
                        (v) => v.id === l.varianteId,
                      )!;
                      return {
                        ...l,
                        precioEditado: false,
                        precio: sugerirPrecioCompra(
                          v,
                          l.unidadCompra,
                          Number(l.factor) || null,
                          ofertaCompraVigente(v, proveedor),
                          nuevaMoneda,
                          catalogo.monedaStock,
                        ).precio,
                      };
                    }),
                  );
                }}
                required
                disabled={busy}
              />
            </Field>
            {moneda !== catalogo.monedaStock && (
              <Field>
                <FieldLabel>
                  {catalogo.monedaStock} por 1 {moneda}
                </FieldLabel>
                <Input
                  aria-label="Tipo de cambio de la compra"
                  type="number"
                  step="any"
                  min="0.00000001"
                  value={cambio}
                  onChange={(e) => setCambio(e.target.value)}
                  required
                  disabled={busy}
                />
              </Field>
            )}
          </FieldGroup>
          {lineas.map((l, i) => {
            const v = catalogo.variantes.find((v) => v.id === l.varianteId)!;
            const unidad = v.unidadStock ?? v.materiaPrima.unidadStock;
            const oferta = ofertaCompraVigente(v, proveedor);
            const factorGuardado = factorCompra(v, l.unidadCompra, oferta);
            const sugerencia = sugerirPrecioCompra(
              v,
              l.unidadCompra,
              Number(l.factor) || null,
              oferta,
              moneda,
              catalogo.monedaStock,
            );
            return (
              <section className={styles.line} key={l.id}>
                <div className={styles.lineTitle}>
                  <strong>
                    {i + 1}. {nombreVarianteCompra(v)}
                  </strong>
                  <ActionButton
                    variant="ghost"
                    isIconOnly
                    aria-label={`Quitar material ${i + 1}`}
                    isDisabled={busy}
                    onPress={() =>
                      setLineas((ls) => ls.filter((x) => x.id !== l.id))
                    }
                  >
                    <Trash2 />
                  </ActionButton>
                </div>
                <FieldGroup className={styles.lineFields}>
                  <Field>
                    <FieldLabel>Cantidad</FieldLabel>
                    <Input
                      aria-label={`Cantidad material ${i + 1}`}
                      type="number"
                      step="any"
                      min="0.00000001"
                      required
                      value={l.cantidad}
                      onChange={(e) =>
                        patch(l.id, { cantidad: e.target.value })
                      }
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Unidad de compra</FieldLabel>
                    <SelectField
                      aria-label={`Unidad material ${i + 1}`}
                      value={l.unidadCompra}
                      options={catalogo.unidades.map((u) => ({
                        value: u,
                        label: stockUnitLabel(u),
                      }))}
                      onChange={(u) => cambiarUnidad(l, u)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel>
                      {stockUnitLabel(unidad)} por{" "}
                      {stockUnitLabel(l.unidadCompra)}
                    </FieldLabel>
                    <Input
                      aria-label={`Contenido material ${i + 1}`}
                      type="number"
                      step="any"
                      min="0.00000001"
                      required
                      value={l.factor}
                      readOnly={factorGuardado != null}
                      onChange={(e) =>
                        patch(l.id, {
                          factor: e.target.value,
                          ...(!l.precioEditado
                            ? {
                                precio: sugerirPrecioCompra(
                                  v,
                                  l.unidadCompra,
                                  Number(e.target.value) || null,
                                  oferta,
                                  moneda,
                                  catalogo.monedaStock,
                                ).precio,
                              }
                            : {}),
                        })
                      }
                    />
                    {factorGuardado != null && (
                      <span className={styles.secondary}>
                        Conversión automática
                      </span>
                    )}
                  </Field>
                  <Field>
                    <FieldLabel>
                      Precio por {stockUnitLabel(l.unidadCompra)} · {moneda}
                    </FieldLabel>
                    <Input
                      aria-label={`Precio material ${i + 1}`}
                      type="number"
                      step="any"
                      min="0.000001"
                      required
                      value={l.precio}
                      onChange={(e) =>
                        patch(l.id, {
                          precio: e.target.value,
                          precioEditado: true,
                        })
                      }
                    />
                    {l.precio && (
                      <span className={styles.secondary}>
                        {l.precioEditado
                          ? "Precio ajustado para esta compra"
                          : sugerencia.origen}
                      </span>
                    )}
                  </Field>
                  <Field>
                    <FieldLabel>Llegada confirmada</FieldLabel>
                    <Input
                      aria-label={`Llegada material ${i + 1}`}
                      type="date"
                      value={l.fecha}
                      onChange={(e) => patch(l.id, { fecha: e.target.value })}
                    />
                  </Field>
                </FieldGroup>
                {!l.precio && sugerencia.aviso && (
                  <p className={styles.warning}>{sugerencia.aviso}</p>
                )}
                <span className={styles.secondary}>
                  {l.factor
                    ? `${Number((Number(l.cantidad) * Number(l.factor)).toFixed(8)).toLocaleString("es-AR")} ${stockUnitLabel(unidad)} previstos para stock`
                    : "Confirmá el contenido de la presentación."}{" "}
                  ·{" "}
                  {l.asignaciones.length
                    ? `${l.asignaciones.length} OT vinculadas: ${l.asignaciones.reduce((s, a) => s + a.cantidad, 0).toLocaleString("es-AR")} ${stockUnitLabel(unidad)}. El excedente queda para stock.`
                    : "Reposición de stock, sin asignación a una OT."}
                </span>
              </section>
            );
          })}
          <div className={styles.addRow}>
            <InventoryVariantPicker
              label="Material para comprar"
              value={variante}
              options={catalogo.variantes.map((v) => ({
                id: v.id,
                label: nombreVarianteCompra(v),
              }))}
              onChange={setVariante}
            />
            <ActionButton
              variant="outline"
              isDisabled={!variante || busy}
              onPress={() => {
                setLineas((ls) => [...ls, nueva(variante)]);
                setVariante("");
              }}
            >
              <Plus />
              Agregar material
            </ActionButton>
          </div>
          <Field>
            <FieldLabel>Notas para el proveedor</FieldLabel>
            <TextArea
              aria-label="Notas de la compra"
              maxLength={1000}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
            />
          </Field>
          <p className={styles.secondary}>
            Precios netos, sin impuestos recuperables. Guardar prepara un
            borrador y aparta la necesidad de nuevas compras; emitir registra el
            pedido. La compra no genera una factura ni un pago.
          </p>
          {error && (
            <p role="alert" className={styles.warning}>
              {error}
            </p>
          )}
        </div>
        <footer className={styles.footer}>
          <strong>
            Total neto: {moneda}{" "}
            {lineas
              .reduce((s, l) => s + Number(l.cantidad) * Number(l.precio), 0)
              .toLocaleString("es-AR", { maximumFractionDigits: 2 })}
          </strong>
          <ActionButton variant="outline" onPress={onClose} isDisabled={busy}>
            Cancelar
          </ActionButton>
          <ActionButton type="submit" isPending={busy}>
            Guardar borrador
          </ActionButton>
        </footer>
      </form>
    </FormDialog>
  );
}
