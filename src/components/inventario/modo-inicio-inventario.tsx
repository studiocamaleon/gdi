"use client";
import { useCallback, useEffect, useState } from "react";
import { PackageOpen } from "lucide-react";
import { toast } from "sonner";
import { ActionButton } from "@/components/design-system/action-button";
import { FormDialog } from "@/components/design-system/form-dialog";
import { AvisoInicioInventario } from "./aviso-inicio-inventario";
import { usePuede } from "@/components/navigation/permisos-provider";
import {
  getInicioInventario,
  saveInicioInventario,
  type InicioInventario,
} from "@/lib/materiales-orden-api";
import {
  INVENTORY_CHANGED,
  notifyInventoryChanged,
} from "@/lib/inventario-navigation";
import styles from "../comercial/materiales-orden.module.css";

/** El modo pertenece a la empresa, nunca al almacenamiento local del navegador. */
export function ModoInicioInventario({
  configuracion = false,
}: {
  configuracion?: boolean;
}) {
  const gestionar = usePuede("inventario.stock.gestionar");
  const [data, setData] = useState<InicioInventario | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const cargar = useCallback(async () => {
    try {
      setData(await getInicioInventario());
      setError("");
    } catch {
      setError("No se pudo consultar el modo de inventario.");
    }
  }, []);
  useEffect(() => {
    void cargar();
    window.addEventListener("focus", cargar);
    window.addEventListener(INVENTORY_CHANGED, cargar);
    const timer = setInterval(cargar, 60_000);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", cargar);
      window.removeEventListener(INVENTORY_CHANGED, cargar);
    };
  }, [cargar]);
  async function cambiar() {
    if (!data || busy) return;
    setBusy(true);
    setError("");
    try {
      const next = await saveInicioInventario({
        activo: !data.activo,
        version: data.version,
      });
      setData(next);
      setOpen(false);
      notifyInventoryChanged();
      toast.success(
        next.activo
          ? "Modo de inicio sin stock activado."
          : "Control normal de stock restablecido.",
      );
    } catch (e) {
      const mensaje =
        e instanceof Error ? e.message : "No se pudo cambiar el modo.";
      await cargar();
      setError(mensaje);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {configuracion && gestionar && (
        <ActionButton
          variant={data?.activo ? "primary" : "outline"}
          onPress={() => {
            setOpen(true);
            void cargar();
          }}
          aria-pressed={data?.activo ?? false}
        >
          <PackageOpen data-icon="inline-start" />
          {data?.activo ? "Modo de inicio activo" : "Modo de inicio"}
        </ActionButton>
      )}
      {!configuracion && data?.activo && (
        <AvisoInicioInventario />
      )}
      <FormDialog
        isOpen={open}
        onOpenChange={setOpen}
        isDismissable={!busy}
        title="Modo de inicio sin stock"
        description="Una ayuda temporal mientras cargás el inventario de tu empresa."
      >
        <div className={styles.dialogBody}>
          <p>
            Permite cotizar, emitir y avanzar las nuevas órdenes sin esperar
            materiales o compras. El precio sigue incluyendo los materiales y
            todos los costos de producción.
          </p>
          <p>
            No agrega existencias ficticias, no reserva y no descuenta stock. La
            disponibilidad física queda a cargo del equipo.
          </p>
          <p>
            Las órdenes que ya estaban emitidas conservan su control. Cuando lo
            desactives, las nuevas volverán al funcionamiento habitual; las
            emitidas en este modo quedarán identificadas y no descontarán
            materiales retroactivamente.
          </p>
          <p>
            <strong>
              {!data
                ? "Consultando configuración…"
                : data.activo
                  ? "Actualmente activo. Desactivalo cuando termines de cargar el stock real."
                  : "Actualmente desactivado."}
            </strong>
          </p>
          {error && <p role="alert">{error}</p>}
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
            isPending={busy}
            isDisabled={!data || busy || !!error}
            onPress={cambiar}
          >
            {data?.activo
              ? "Volver al control normal"
              : "Activar modo de inicio"}
          </ActionButton>
        </footer>
      </FormDialog>
    </>
  );
}
