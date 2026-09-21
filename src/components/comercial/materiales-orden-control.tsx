"use client";
import { useCapacidad } from "@/components/navigation/capacidades-provider";
import { useRef, useState } from "react";
import Link from "next/link";
import { Input } from "@heroui/react";
import { toast } from "sonner";
import { ActionButton } from "@/components/design-system/action-button";
import { FormDialog } from "@/components/design-system/form-dialog";
import { SelectField } from "@/components/design-system/select-field";
import { usePuede } from "@/components/navigation/permisos-provider";
import { stockUnitLabel } from "@/components/inventario/stock-conversion-fields";
import { notifyInventoryChanged } from "@/lib/inventario-navigation";
import {
  operarMateriales,
  type MaterialesOrden,
  type ControlMaterial,
  type OperacionMaterial,
} from "@/lib/materiales-orden-api";
import styles from "./materiales-orden.module.css";

export function MaterialesOrdenControl({
  data,
  onChanged,
}: {
  data: MaterialesOrden;
  onChanged: () => void;
}) {
  const canManage = usePuede("inventario.gestionar");
  const conCompras = useCapacidad("compras");
  const canBuy = usePuede("finanzas.ver_margenes") && canManage && conCompras;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState<{
    accion: "definir" | "consumir" | "liberar";
    material: ControlMaterial;
    nombre: string;
  } | null>(null);
  const [cantidad, setCantidad] = useState("");
  const [motivo, setMotivo] = useState("");
  const [ubicacion, setUbicacion] = useState("");
  // Un fallo de red puede ocurrir después del commit: el reintento conserva su clave.
  const pendiente = useRef<{ contenido: string; clave: string } | null>(null);
  const control = data.control!;
  const automatica = control.modoReserva === "AL_EMITIR";
  const activa = ["pendiente", "produccion"].includes(control.estadoOrden);
  const operable =
    canManage &&
    control.habilitado &&
    (activa ||
      (control.iniciado &&
        ["finalizada", "entregada"].includes(control.estadoOrden)));
  async function ejecutar(args: Omit<OperacionMaterial, "clave" | "revision">) {
    const payload = { ...args, revision: data.revision };
    const contenido = JSON.stringify(payload);
    if (pendiente.current?.contenido !== contenido)
      pendiente.current = { contenido, clave: crypto.randomUUID() };
    setBusy(true);
    setError("");
    try {
      await operarMateriales(data.ordenId, {
        ...payload,
        clave: pendiente.current.clave,
      });
      pendiente.current = null;
      setDialog(null);
      notifyInventoryChanged();
      toast.success(
        args.accion === "consumir"
          ? "Consumo registrado en stock."
          : args.accion === "reservar"
            ? "Reservas actualizadas con el stock disponible."
            : "Materiales actualizados.",
      );
      onChanged();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo completar la operación.",
      );
    } finally {
      setBusy(false);
    }
  }
  function abrir(
    accion: "definir" | "consumir" | "liberar",
    material: ControlMaterial,
  ) {
    setDialog({
      accion,
      material,
      nombre:
        data.necesidades.find((m) => m.varianteId === material.varianteId)
          ?.nombre ?? "Material",
    });
    setCantidad(
      String(
        accion === "consumir"
          ? (material.reservas[0]?.cantidad ?? "")
          : (material.cantidad ?? ""),
      ),
    );
    setUbicacion(material.reservas[0]?.ubicacionId ?? "");
    setMotivo("");
    setError("");
  }
  const faltantes = control.materiales.filter(
    (m) => (m.faltante ?? 0) > 0,
  ).length;
  const revisar = control.materiales.filter((m) => m.revisar).length;
  const hayStockParaReservar = control.materiales.some(
    (m) =>
      !m.excluida &&
      !m.revisar &&
      m.cantidad !== null &&
      (m.pendiente ?? 0) > 0 &&
      m.libre > 0,
  );
  return (
    <div className={styles.control}>
      <div className={styles.controlHeading}>
        <div>
          <h3>Disponibilidad para esta OT</h3>
          <p>
            {control.habilitado
              ? automatica
                ? control.iniciado
                  ? "Stock reservado y consumido para esta orden. Los faltantes se gestionan desde Compras."
                  : "La reserva automática se aplica al emitir. Esta orden aún no está incorporada al control."
                : "Reserva manual. Registrar consumo descuenta la existencia física."
              : "El control de reservas está desactivado. Podés activarlo en Stock → Reservas por OT."}
          </p>
        </div>
        {operable &&
          activa &&
          (!automatica || !control.iniciado || hayStockParaReservar) && (
            <ActionButton
              isDisabled={
                busy ||
                (control.iniciado
                  ? !hayStockParaReservar
                  : !control.materiales.some((m) => m.cantidad !== null))
              }
              variant={automatica && control.iniciado ? "outline" : "primary"}
              isPending={busy}
              onPress={() => ejecutar({ accion: "reservar" })}
            >
              {automatica
                ? control.iniciado
                  ? "Reservar stock disponible ahora"
                  : "Incorporar y reservar disponible"
                : "Reservar disponible"}
            </ActionButton>
          )}
      </div>
      {control.habilitado && activa && !control.iniciado && (
        <p className={styles.secondary}>
          Esta OT se emitió antes de activar el control. Podés incorporarla
          desde aquí. Las nuevas órdenes se incorporan al emitir.
        </p>
      )}
      {faltantes > 0 && (
        <p className={styles.warning}>
          {faltantes}{" "}
          {faltantes === 1
            ? "material con faltante"
            : "materiales con faltantes"}
          .{" "}
          {activa
            ? "Pendiente de abastecimiento. Revisá las compras y sus fechas de recepción."
            : control.estadoOrden === "borrador"
              ? "La disponibilidad se verifica antes de emitir."
              : "Revisá los registros de materiales de esta orden."}
        </p>
      )}
      {canBuy && control.iniciado && (
        <Link href="/inventario/compras">
          Ver necesidades en Compras y abastecimiento →
        </Link>
      )}
      {revisar > 0 && (
        <p className={styles.secondary}>
          {revisar}{" "}
          {revisar === 1 ? "material requiere" : "materiales requieren"}{" "}
          confirmar su cantidad en stock antes de reservar.
        </p>
      )}
      {!dialog && error && (
        <p role="alert" className={styles.warning}>
          {error}
        </p>
      )}
      <div className={styles.stockTableWrap}>
        <table className={styles.stockTable}>
          <thead>
            <tr>
              <th>Material</th>
              <th>Necesario</th>
              <th>Libre</th>
              <th>Reservado OT</th>
              <th>Consumido OT</th>
              <th>Faltante físico</th>
              <th>En compra</th>
              {operable && <th>Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {control.materiales.map((m) => {
              const fmt = (n: number | null) =>
                n === null
                  ? "Por revisar"
                  : `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 8 }).format(n)} ${stockUnitLabel(m.unidad ?? "")}`;
              return (
                <tr key={m.varianteId}>
                  <td>
                    <strong>
                      {
                        data.necesidades.find(
                          (n) => n.varianteId === m.varianteId,
                        )?.nombre
                      }
                    </strong>
                    <small>
                      {m.excluida
                        ? "Consumible fuera del control"
                        : m.fuente === "manual"
                          ? "Cantidad confirmada manualmente"
                          : m.motivo}
                    </small>
                  </td>
                  <td>{m.excluida ? "—" : fmt(m.cantidad)}</td>
                  <td>{fmt(m.libre)}</td>
                  <td>{fmt(m.reservada)}</td>
                  <td>{fmt(m.consumida)}</td>
                  <td
                    className={
                      (m.faltante ?? 0) > 0 ? styles.warning : undefined
                    }
                  >
                    {m.excluida ? "—" : fmt(m.faltante)}
                  </td>
                  <td>
                    {fmt(m.enCompra ?? 0)}
                    {m.compras?.map((c) => (
                      <small key={c.ordenId}>
                        {c.cantidad} ·{" "}
                        {c.fecha
                          ? `${c.fecha.split("-").reverse().join("/")} (${c.confirmada ? "confirmada" : "estimada"})`
                          : "Llegada por confirmar"}
                      </small>
                    ))}
                  </td>
                  {operable && (
                    <td>
                      <div className={styles.rowActions}>
                        {m.unidad && activa && (
                          <ActionButton
                            variant="outline"
                            isDisabled={busy}
                            onPress={() => abrir("definir", m)}
                          >
                            {m.revisar ? "Definir cantidad" : "Ajustar"}
                          </ActionButton>
                        )}
                        {m.reservada > 0 && (
                          <>
                            <ActionButton
                              variant="outline"
                              isDisabled={busy || m.revisar}
                              onPress={() => abrir("consumir", m)}
                            >
                              Consumir
                            </ActionButton>
                            <ActionButton
                              variant="ghost"
                              isDisabled={busy}
                              onPress={() => abrir("liberar", m)}
                            >
                              Liberar
                            </ActionButton>
                          </>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className={styles.secondary}>
        Libre = existencias en ubicaciones activas menos todas las reservas.
        Faltante = lo pendiente de esta OT que ese stock libre no alcanza a
        cubrir.
      </p>
      <FormDialog
        isOpen={!!dialog}
        onOpenChange={(open) => {
          if (!open && !busy) setDialog(null);
        }}
        isDismissable={!busy}
        title={
          dialog?.accion === "consumir"
            ? "Registrar consumo"
            : dialog?.accion === "liberar"
              ? "Liberar reserva"
              : "Confirmar necesidad"
        }
        description={dialog?.nombre ?? ""}
      >
        {dialog && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void ejecutar({
                accion: dialog.accion,
                varianteId: dialog.material.varianteId,
                ...(dialog.accion !== "liberar"
                  ? {
                      cantidad: Number(cantidad.replace(",", ".")),
                      unidad: dialog.material.unidad!,
                      motivo: motivo.trim() || undefined,
                    }
                  : {}),
                ...(dialog.accion === "consumir"
                  ? { ubicacionId: ubicacion }
                  : {}),
              });
            }}
          >
            <div className={styles.dialogBody}>
              {dialog.accion === "liberar" ? (
                <p>
                  Se liberarán {dialog.material.reservada}{" "}
                  {stockUnitLabel(dialog.material.unidad ?? "")} pendientes. El
                  consumo ya registrado se conserva.
                </p>
              ) : (
                <>
                  {dialog.accion === "consumir" && (
                    <SelectField
                      aria-label="Ubicación reservada"
                      value={ubicacion}
                      onChange={(v) => {
                        setUbicacion(v);
                        setCantidad(
                          String(
                            dialog.material.reservas.find(
                              (r) => r.ubicacionId === v,
                            )?.cantidad ?? "",
                          ),
                        );
                      }}
                      options={dialog.material.reservas.map((r) => ({
                        value: r.ubicacionId,
                        label: `${r.nombre} · ${r.cantidad} reservados`,
                      }))}
                    />
                  )}
                  <label>
                    Cantidad · {stockUnitLabel(dialog.material.unidad ?? "")}
                    <Input
                      aria-label="Cantidad"
                      inputMode="decimal"
                      value={cantidad}
                      onChange={(e) => setCantidad(e.target.value)}
                      required
                    />
                  </label>
                  <label>
                    {dialog.accion === "definir"
                      ? "Motivo de la cantidad confirmada"
                      : "Observación (opcional)"}
                    <Input
                      aria-label="Motivo"
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                      maxLength={500}
                      required={dialog.accion === "definir"}
                    />
                  </label>
                  <p>
                    {dialog.accion === "definir"
                      ? "La cantidad se guarda para el control de esta OT. Su cotización y sus precios se conservan."
                      : "Confirmá sólo el material que efectivamente utilizaste. Se registrará una salida de stock vinculada a esta OT."}
                  </p>
                </>
              )}
              {error && (
                <p role="alert" className={styles.warning}>
                  {error}
                </p>
              )}
            </div>
            <footer className={styles.dialogFooter}>
              <ActionButton
                variant="outline"
                isDisabled={busy}
                onPress={() => setDialog(null)}
              >
                Cancelar
              </ActionButton>
              <ActionButton
                type="submit"
                isPending={busy}
                isDisabled={
                  busy ||
                  (dialog.accion !== "liberar" &&
                    !(Number(cantidad.replace(",", ".")) > 0))
                }
              >
                Confirmar
              </ActionButton>
            </footer>
          </form>
        )}
      </FormDialog>
    </div>
  );
}
