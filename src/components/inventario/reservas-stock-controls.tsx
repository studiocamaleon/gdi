"use client";
import { useCapacidad } from "@/components/navigation/capacidades-provider";
import { useState } from "react";
import { Label, Switch } from "@heroui/react";
import Link from "next/link";
import { ActionButton } from "@/components/design-system/action-button";
import { SelectField } from "@/components/design-system/select-field";
import { FormDialog } from "@/components/design-system/form-dialog";
import {
  getPoliticaReservas,
  savePoliticaReservas,
  getReservasStock,
  type PoliticaReservas,
  type ReservaStock,
} from "@/lib/materiales-orden-api";
import { notifyInventoryChanged } from "@/lib/inventario-navigation";
import { stockUnitLabel } from "./stock-conversion-fields";
import styles from "../comercial/materiales-orden.module.css";

export function ConfiguracionReservas() {
  const conReservas = useCapacidad("reservas");
  const conExistencias = useCapacidad("existencias");
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<PoliticaReservas | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function cargar() {
    setOpen(true);
    setError("");
    setData(null);
    setBusy(true);
    try {
      setData(await getPoliticaReservas());
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo cargar la configuración.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function guardar() {
    if (!data) return;
    setBusy(true);
    setError("");
    try {
      await savePoliticaReservas(data);
      notifyInventoryChanged();
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  }
  if (!conReservas || !conExistencias) return null;
  return (
    <>
      <ActionButton variant="outline" onPress={cargar}>
        Reservas por OT
      </ActionButton>
      <FormDialog
        isOpen={open}
        onOpenChange={setOpen}
        isDismissable={!busy}
        title="Reservas por OT"
        description="Configuración compartida por la empresa."
      >
        <div className={styles.dialogBody}>
          {busy && !data && <p role="status">Consultando configuración…</p>}
          {data && (
            <>
              <Switch
                isSelected={data.habilitada}
                onChange={(value) => setData({ ...data, habilitada: value })}
                isDisabled={busy}
              >
                <Switch.Content className={styles.switchRow}>
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                  <Label>Activar reservas de materiales</Label>
                </Switch.Content>
              </Switch>
              <p>
                Al emitir una OT, sus necesidades aparecen en Compras. Cotizar y
                emitir sigue siendo posible aunque falte material. Los
                presupuestos y borradores no apartan stock.
              </p>
              <label>
                <span>Cuándo reservar</span>
                <SelectField
                  aria-label="Cuándo reservar"
                  value={data.modo}
                  disabled={busy || !data.habilitada}
                  options={[
                    {
                      value: "AL_EMITIR",
                      label: "Automáticamente al emitir (recomendado)",
                    },
                    {
                      value: "MANUAL",
                      label: "Manualmente desde Materiales de la OT",
                    },
                  ]}
                  onChange={(modo) =>
                    setData({ ...data, modo: modo as PoliticaReservas["modo"] })
                  }
                />
              </label>
              <p>
                {data.modo === "AL_EMITIR"
                  ? "Grafo aparta el stock libre al emitir y ajusta las reservas si cambian los materiales. El resto queda pendiente de abastecimiento."
                  : "Grafo registra las necesidades al emitir. Un responsable elige cuándo apartar el stock desde Materiales de la OT."}{" "}
                Las órdenes anteriores sin control se incorporan desde
                Materiales. Cambiar el modo no reserva ni libera stock de
                inmediato.
              </p>
              <Switch
                isSelected={data.incluirConsumibles}
                onChange={(value) =>
                  setData({ ...data, incluirConsumibles: value })
                }
                isDisabled={busy || !data.habilitada}
              >
                <Switch.Content className={styles.switchRow}>
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                  <Label>Incluir consumibles de máquinas</Label>
                </Switch.Content>
              </Switch>
              <p>
                Las tintas y otros consumibles usan cantidades estimadas por el
                cálculo. Este cambio se aplicará cuando se vuelvan a operar o
                editar los materiales de una OT; no registra consumos.
              </p>
            </>
          )}
          {error && <p role="alert">{error}</p>}
          {!data && !busy && (
            <ActionButton variant="outline" onPress={cargar}>
              Reintentar
            </ActionButton>
          )}
        </div>
        <footer className={styles.dialogFooter}>
          <ActionButton
            variant="outline"
            isDisabled={busy}
            onPress={() => setOpen(false)}
          >
            Cancelar
          </ActionButton>
          <ActionButton
            isDisabled={busy || !data}
            isPending={busy}
            onPress={guardar}
          >
            Guardar
          </ActionButton>
        </footer>
      </FormDialog>
    </>
  );
}

export function ReservasDeSaldo({
  varianteId,
  ubicacionId,
  cantidad,
  unidad,
}: {
  varianteId: string;
  ubicacionId: string;
  cantidad: number;
  unidad: string;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ReservaStock[] | null>(null);
  const [error, setError] = useState("");
  async function cargar() {
    setOpen(true);
    setData(null);
    setError("");
    try {
      setData(await getReservasStock(varianteId, ubicacionId));
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "No se pudieron consultar las reservas.",
      );
    }
  }
  const fmt = (n: number) =>
    `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 8 }).format(n)} ${stockUnitLabel(unidad)}`;
  if (!cantidad) return <>{fmt(0)}</>;
  return (
    <>
      <ActionButton
        variant="ghost"
        onPress={cargar}
        aria-label="Ver órdenes con reservas"
      >
        {fmt(cantidad)}
      </ActionButton>
      <FormDialog
        isOpen={open}
        onOpenChange={setOpen}
        title="Stock reservado"
        description="Órdenes que apartaron material en esta ubicación."
      >
        <div className={styles.dialogBody}>
          {error ? (
            <p role="alert">{error}</p>
          ) : !data ? (
            <p role="status">Consultando reservas…</p>
          ) : (
            <>
              {data.map((r) => (
                <div key={r.id} className={styles.controlHeading}>
                  <Link
                    href={`/produccion/ordenes/${r.necesidad.orden.id}`}
                    onClick={() => setOpen(false)}
                  >
                    {r.necesidad.orden.numero}
                  </Link>
                  <strong>{fmt(Number(r.cantidad))}</strong>
                </div>
              ))}
              {!data.length && (
                <p>Ya no hay reservas pendientes en esta ubicación.</p>
              )}
              {data.length === 100 && (
                <p>Se muestran las primeras 100 reservas.</p>
              )}
            </>
          )}
        </div>
      </FormDialog>
    </>
  );
}
