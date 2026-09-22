"use client";
import { useCapacidad } from "@/components/navigation/capacidades-provider";
import { useEffect, useRef, useState } from "react";
import { Chip, Input, TextArea } from "@heroui/react";
import Link from "next/link";
import { FormDialog } from "@/components/design-system/form-dialog";
import { ActionButton } from "@/components/design-system/action-button";
import { SelectField } from "@/components/design-system/select-field";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { stockUnitLabel } from "@/components/inventario/stock-conversion-fields";
import { notifyInventoryChanged } from "@/lib/inventario-navigation";
import {
  accionCompra,
  getCompra,
  recibirCompra,
  numeroCompra,
  type CatalogoCompras,
  type Compra,
} from "@/lib/compras-api";
import styles from "./compras.module.css";
export const estadosCompra: Record<string, string> = {
  BORRADOR: "Borrador",
  EMITIDA: "Pendiente de recepción",
  PARCIAL: "Recibida parcialmente",
  RECIBIDA: "Recibida",
  CERRADA: "Saldo cerrado",
  CANCELADA: "Cancelada",
};
const num = (v: number | string) =>
  Number(v).toLocaleString("es-AR", { maximumFractionDigits: 8 });
const fecha = (s: string | null) =>
  s ? s.slice(0, 10).split("-").reverse().join("/") : "Por confirmar";
export function CompraDetalle({
  id,
  catalogo,
  canManage: permisoGestionar,
  onClose,
  onChanged,
}: {
  id: string;
  catalogo: CatalogoCompras | null;
  canManage: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const conCompras = useCapacidad("compras");
  const conRecepciones = useCapacidad("recepciones");
  const canManage = permisoGestionar && conCompras && Boolean(catalogo);
  const [compra, setCompra] = useState<Compra | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const [modoElegido, setModo] = useState<
    "ver" | "recibir" | "cancelar" | "cerrar" | "emitir" | "fecha"
  >("ver");
  const modo = canManage ? modoElegido : "ver";
  const [ubicacion, setUbicacion] = useState("");
  const [referencia, setReferencia] = useState("");
  const [notas, setNotas] = useState("");
  const [motivo, setMotivo] = useState("");
  const [fechaLinea, setFechaLinea] = useState("");
  const [fechaNueva, setFechaNueva] = useState("");
  const [cantidades, setCantidades] = useState<
    Record<string, { compra: string; stock: string }>
  >({});
  const pending = useRef<{ body: string; clave: string } | null>(null);
  useEffect(() => {
    const abort = new AbortController();
    setCompra(null);
    setError("");
    getCompra(id, abort.signal)
      .then((c) => {
        if (!abort.signal.aborted) {
          setCompra(c);
          setUbicacion(c.ubicacionId);
        }
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(e.message);
      });
    return () => abort.abort();
  }, [id, reload]);
  function abrirRecepcion() {
    if (!compra || !canManage) return;
    setModo("recibir");
    setError("");
    setCantidades(
      Object.fromEntries(
        compra.lineas.map((l) => [l.id, { compra: "", stock: "" }]),
      ),
    );
  }
  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!compra || !canManage) return;
    setError("");
    const payload =
      modo === "recibir"
        ? {
            version: compra.version,
            ubicacionId: ubicacion,
            referencia,
            notas,
            lineas: compra.lineas
              .filter((l) => Number(cantidades[l.id]?.compra) > 0)
              .map((l) => ({
                lineaId: l.id,
                cantidad: Number(cantidades[l.id].compra),
                cantidadStock: Number(cantidades[l.id].stock),
              })),
          }
        : {
            version: compra.version,
            accion: modo,
            motivo,
            lineaId: fechaLinea || undefined,
            fechaConfirmada: fechaNueva || null,
          };
    if ("lineas" in payload && !payload.lineas?.length) {
      setError("Indicá la cantidad que llegó en al menos una línea.");
      return;
    }
    const body = JSON.stringify({ modo, payload });
    if (pending.current?.body !== body)
      pending.current = { body, clave: crypto.randomUUID() };
    setBusy(true);
    try {
      if ("lineas" in payload && payload.lineas)
        await recibirCompra(id, {
          version: payload.version,
          ubicacionId: payload.ubicacionId!,
          referencia: payload.referencia,
          notas: payload.notas,
          lineas: payload.lineas,
          clave: pending.current.clave,
        });
      else
        await accionCompra(id, {
          version: compra.version,
          accion: modo,
          motivo,
          lineaId: fechaLinea || undefined,
          fechaConfirmada: fechaNueva || null,
          clave: pending.current.clave,
        });
      pending.current = null;
      setModo("ver");
      setReload((v) => v + 1);
      notifyInventoryChanged();
      onChanged();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo completar la operación.",
      );
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
        compra
          ? `${numeroCompra(compra.numero)} · ${compra.proveedorNombre}`
          : "Consultando compra…"
      }
      description={
        conCompras
          ? "Pedido, llegada y recepción de materiales."
          : "Consulta histórica del pedido y sus recepciones."
      }
      className={styles.dialogWide}
    >
      <form onSubmit={enviar}>
        <div className={styles.body}>
          {error && (
            <p role="alert" className={styles.warning}>
              {error}{" "}
              <ActionButton
                variant="outline"
                isDisabled={busy}
                onPress={() => {
                  setModo("ver");
                  setReload((v) => v + 1);
                }}
              >
                Actualizar compra
              </ActionButton>
            </p>
          )}
          {compra && (
            <>
              <div className={styles.summary}>
                <p>
                  Estado
                  <strong>
                    <Chip>{estadosCompra[compra.estado]}</Chip>
                  </strong>
                </p>
                <p>
                  Pedido previsto<strong>{fecha(compra.fechaPedido)}</strong>
                </p>
                <p>
                  Destino
                  <strong>
                    {compra.ubicacion.almacen.nombre} ·{" "}
                    {compra.ubicacion.nombre}
                  </strong>
                </p>
                <p>
                  Total neto
                  <strong>
                    {compra.moneda}{" "}
                    {num(
                      compra.lineas.reduce(
                        (s, l) => s + Number(l.cantidad) * Number(l.precio),
                        0,
                      ),
                    )}
                  </strong>
                </p>
                {compra.moneda !== compra.monedaStock && (
                  <p>
                    Cambio fijado
                    <strong>
                      {num(compra.tipoCambio)} {compra.monedaStock} /{" "}
                      {compra.moneda}
                    </strong>
                  </p>
                )}
              </div>
              {compra.notas && <p>{compra.notas}</p>}
              <Table className={styles.table}>
                <TableHeader>
                  <TableRow>
                    <TableHead>Material</TableHead>
                    <TableHead>Pedido</TableHead>
                    <TableHead>Recibido</TableHead>
                    <TableHead>Pendiente</TableHead>
                    <TableHead>Precio neto</TableHead>
                    <TableHead>Llegada</TableHead>
                    {modo === "recibir" && (
                      <>
                        <TableHead>Recibir ahora</TableHead>
                        <TableHead>Ingreso a stock</TableHead>
                      </>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {compra.lineas.map((l) => {
                    const pendiente = Number(l.cantidad) - Number(l.recibida);
                    const peso =
                      ["KG", "GRAMO"].includes(l.unidadCompra) &&
                      ["HOJA", "PLACA", "UNIDAD"].includes(l.unidadStock);
                    return (
                      <TableRow key={l.id}>
                        <TableCell className={styles.material}>
                          <strong>{l.nombre}</strong>
                          <span className={styles.secondary}>
                            1 {stockUnitLabel(l.unidadCompra)} ={" "}
                            {num(l.factorStock)} {stockUnitLabel(l.unidadStock)}
                          </span>
                          {l.coberturas?.map((c) => (
                            <Link
                              className={styles.secondary}
                              key={c.id}
                              href={`/produccion/ordenes/${c.necesidad.orden.id}`}
                            >
                              {c.necesidad.orden.numero}: {num(c.cantidad)}{" "}
                              {stockUnitLabel(l.unidadStock)}
                            </Link>
                          ))}
                        </TableCell>
                        <TableCell>
                          {num(l.cantidad)} {stockUnitLabel(l.unidadCompra)}
                        </TableCell>
                        <TableCell>{num(l.recibida)}</TableCell>
                        <TableCell>{num(pendiente)}</TableCell>
                        <TableCell>
                          {compra.moneda} {num(l.precio)}
                        </TableCell>
                        <TableCell>
                          {fecha(l.fechaConfirmada ?? l.fechaEstimada)}
                          <span className={styles.secondary}>
                            {l.fechaConfirmada
                              ? "Confirmada por proveedor"
                              : l.fechaEstimada
                                ? "Estimada por reposición"
                                : ""}
                          </span>
                          {canManage &&
                            modo === "ver" &&
                            ["BORRADOR", "EMITIDA", "PARCIAL"].includes(
                              compra.estado,
                            ) && (
                              <ActionButton
                                variant="ghost"
                                onPress={() => {
                                  setModo("fecha");
                                  setFechaLinea(l.id);
                                  setFechaNueva(
                                    l.fechaConfirmada?.slice(0, 10) ?? "",
                                  );
                                }}
                              >
                                Confirmar fecha
                              </ActionButton>
                            )}
                        </TableCell>
                        {modo === "recibir" && (
                          <>
                            <TableCell>
                              {pendiente > 0 && (
                                <Input
                                  aria-label={`Recibir ${l.nombre}`}
                                  type="number"
                                  step="any"
                                  min={0}
                                  max={pendiente}
                                  value={cantidades[l.id]?.compra ?? ""}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    setCantidades((c) => ({
                                      ...c,
                                      [l.id]: {
                                        compra: value,
                                        stock: value
                                          ? String(
                                              Number(
                                                (
                                                  Number(value) *
                                                  Number(l.factorStock)
                                                ).toFixed(8),
                                              ),
                                            )
                                          : "",
                                      },
                                    }));
                                  }}
                                />
                              )}
                            </TableCell>
                            <TableCell>
                              {pendiente > 0 && (
                                <>
                                  <Input
                                    aria-label={`Stock recibido ${l.nombre}`}
                                    type="number"
                                    step="any"
                                    min={0}
                                    readOnly={!peso}
                                    value={cantidades[l.id]?.stock ?? ""}
                                    onChange={(e) =>
                                      setCantidades((c) => ({
                                        ...c,
                                        [l.id]: {
                                          ...c[l.id],
                                          stock: e.target.value,
                                        },
                                      }))
                                    }
                                  />
                                  <span className={styles.secondary}>
                                    {stockUnitLabel(l.unidadStock)}
                                    {peso ? " · confirmar cantidad real" : ""}
                                  </span>
                                </>
                              )}
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {modo === "recibir" && (
                <>
                  <FieldGroup className={styles.grid}>
                    <Field>
                      <FieldLabel>Ubicación donde se recibió</FieldLabel>
                      <SelectField
                        aria-label="Ubicación de recepción"
                        value={ubicacion}
                        options={(catalogo?.ubicaciones ?? []).map((u) => ({
                          value: u.id,
                          label: `${u.almacen.nombre} · ${u.nombre}`,
                        }))}
                        onChange={setUbicacion}
                      />
                    </Field>
                    <Field>
                      <FieldLabel>Remito / referencia</FieldLabel>
                      <Input
                        aria-label="Referencia de la recepción"
                        value={referencia}
                        maxLength={160}
                        onChange={(e) => setReferencia(e.target.value)}
                      />
                    </Field>
                    <Field>
                      <FieldLabel>Observaciones</FieldLabel>
                      <Input
                        aria-label="Observaciones de la recepción"
                        value={notas}
                        maxLength={500}
                        onChange={(e) => setNotas(e.target.value)}
                      />
                    </Field>
                  </FieldGroup>
                  <p className={styles.secondary}>
                    Registrá sólo lo aceptado para usar. Ingresa al stock y
                    reserva para las OTs vinculadas que aún lo necesitan. Lo
                    demás queda libre; las cantidades vacías continúan
                    pendientes.
                  </p>
                </>
              )}
              {modo === "fecha" && (
                <Field>
                  <FieldLabel>Fecha confirmada por el proveedor</FieldLabel>
                  <Input
                    aria-label="Fecha confirmada por el proveedor"
                    type="date"
                    value={fechaNueva}
                    onChange={(e) => setFechaNueva(e.target.value)}
                  />
                  <span className={styles.secondary}>
                    Dejar vacío vuelve a la estimación del plazo habitual.
                  </span>
                </Field>
              )}
              {["cerrar", "cancelar"].includes(modo) && (
                <Field>
                  <FieldLabel>Motivo</FieldLabel>
                  <TextArea
                    aria-label="Motivo de cierre de compra"
                    value={motivo}
                    maxLength={500}
                    required
                    onChange={(e) => setMotivo(e.target.value)}
                  />
                  <span className={styles.secondary}>
                    Se libera la cobertura pendiente. Las recepciones ya
                    registradas se conservan.
                  </span>
                </Field>
              )}
              {modo === "emitir" && (
                <p>
                  Confirmá que el pedido fue realizado al proveedor. Desde ese
                  momento figurará como material en compra. Esta acción no envía
                  correos ni modifica el stock.
                </p>
              )}
              {compra.motivoCierre && (
                <p>Motivo de cierre: {compra.motivoCierre}</p>
              )}
              {modo === "ver" && (
                <details>
                  <summary>
                    Recepciones registradas ({compra.recepciones?.length ?? 0})
                  </summary>
                  {!compra.recepciones?.length ? (
                    <p className={styles.secondary}>
                      Todavía no se recibió material.
                    </p>
                  ) : (
                    compra.recepciones.map((r) => (
                      <div key={r.id} className={styles.history}>
                        <strong>
                          {fecha(r.createdAt)} · {r.referencia ?? "Sin remito"}{" "}
                          · {r.ubicacion.nombre}
                        </strong>
                        <span className={styles.secondary}>{r.actor}</span>
                        {r.detalles.map((d) => {
                          const l = compra.lineas.find(
                            (l) => l.id === d.lineaId,
                          )!;
                          return (
                            <p key={d.lineaId}>
                              {l.nombre}: {num(d.cantidadCompra)}{" "}
                              {stockUnitLabel(l.unidadCompra)} →{" "}
                              {num(d.cantidadStock)}{" "}
                              {stockUnitLabel(l.unidadStock)} en stock
                              {d.reservasJson.length
                                ? ` · ${d.reservasJson.length} OT con reserva`
                                : ""}
                            </p>
                          );
                        })}
                      </div>
                    ))
                  )}
                </details>
              )}
            </>
          )}
        </div>
        <footer className={styles.footer}>
          {modo === "ver" ? (
            <>
              <ActionButton variant="outline" onPress={onClose}>
                Cerrar
              </ActionButton>
              {canManage && compra && (
                <>
                  {compra.estado === "BORRADOR" && (
                    <ActionButton onPress={() => setModo("emitir")}>
                      Registrar pedido
                    </ActionButton>
                  )}
                  {conRecepciones &&
                    ["EMITIDA", "PARCIAL"].includes(compra.estado) && (
                      <ActionButton onPress={abrirRecepcion}>
                        Recibir materiales
                      </ActionButton>
                    )}
                  {["BORRADOR", "EMITIDA"].includes(compra.estado) && (
                    <ActionButton
                      variant="outline"
                      onPress={() => {
                        setModo("cancelar");
                        setMotivo("");
                      }}
                    >
                      Cancelar compra
                    </ActionButton>
                  )}
                  {compra.estado === "PARCIAL" && (
                    <ActionButton
                      variant="outline"
                      onPress={() => {
                        setModo("cerrar");
                        setMotivo("");
                      }}
                    >
                      Cerrar saldo pendiente
                    </ActionButton>
                  )}
                </>
              )}
            </>
          ) : (
            <>
              <ActionButton
                variant="outline"
                isDisabled={busy}
                onPress={() => {
                  setModo("ver");
                  setError("");
                }}
              >
                Volver
              </ActionButton>
              <ActionButton type="submit" isPending={busy}>
                {modo === "recibir"
                  ? "Confirmar recepción"
                  : modo === "emitir"
                    ? "Confirmar pedido"
                    : modo === "fecha"
                      ? "Guardar fecha"
                      : "Confirmar cierre"}
              </ActionButton>
            </>
          )}
        </footer>
      </form>
    </FormDialog>
  );
}
