"use client";

/**
 * <ComisionesConfigView /> — el "librito" de comisiones (Fase A).
 *
 * Espeja la vista de impuestos. Dos tipos, según lo que ya distingue el motor:
 *   - Pasarela de pago → alcance TENANT, base BRUTO_COBRADO. Es de "cómo te
 *     pagan": se aplica a TODA cotización sin tildar por producto (el "8% por
 *     las dudas"). Igual que un impuesto de empresa.
 *   - Vendedor → alcance PRODUCTO, base NETO. Se asigna por producto en su Tab
 *     Precio.
 *
 * Reusa el módulo CSS de impuestos (clases genéricas) y los endpoints del
 * catálogo de comisiones. Ver docs/comisiones-modelo-diseno.md.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConfirmacionDestructiva } from "@/components/ui/confirmacion-destructiva";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  actualizarComisionCatalogo,
  crearComisionCatalogo,
  eliminarComisionCatalogo,
  type ComisionCatalogoItem,
} from "@/lib/productos-servicios-api";
import s from "./impuestos-config.module.css";

interface Props {
  initialItems: ComisionCatalogoItem[];
}

type Seccion = "pasarela" | "vendedor";

function slugCodigo(nombre: string, seccion: Seccion): string {
  const base = nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 20);
  return `${seccion === "pasarela" ? "pas" : "ven"}_${base || "comision"}`;
}

export function ComisionesConfigView({ initialItems }: Props) {
  const router = useRouter();

  const activos = initialItems.filter((i) => i.activo);
  const pasarelaRows = activos.filter((i) => i.alcance === "TENANT");
  const vendedorRows = activos.filter((i) => i.alcance !== "TENANT");

  const [openSheet, setOpenSheet] = React.useState(false);
  const [seccion, setSeccion] = React.useState<Seccion>("pasarela");
  const [editItem, setEditItem] = React.useState<ComisionCatalogoItem | null>(
    null,
  );
  const [nombre, setNombre] = React.useState("");
  const [porcentaje, setPorcentaje] = React.useState("");
  const [guardando, setGuardando] = React.useState(false);
  const [aBorrar, setABorrar] = React.useState<ComisionCatalogoItem | null>(
    null,
  );

  const abrirNuevo = (sec: Seccion) => {
    setSeccion(sec);
    setEditItem(null);
    setNombre("");
    setPorcentaje("");
    setOpenSheet(true);
  };

  const abrirEditar = (sec: Seccion, item: ComisionCatalogoItem) => {
    setSeccion(sec);
    setEditItem(item);
    setNombre(item.nombre);
    setPorcentaje(String(item.porcentaje));
    setOpenSheet(true);
  };

  const guardar = async () => {
    const pct = Number(porcentaje);
    if (Number.isNaN(pct) || pct < 0 || pct > 100) {
      toast.error("El porcentaje tiene que ser un número entre 0 y 100.");
      return;
    }
    if (!nombre.trim()) {
      toast.error("Poné un nombre a la comisión.");
      return;
    }
    setGuardando(true);
    try {
      if (editItem) {
        await actualizarComisionCatalogo(editItem.id, {
          nombre: nombre.trim(),
          porcentaje: pct,
        });
        toast.success(`"${nombre.trim()}" actualizada`);
      } else {
        await crearComisionCatalogo({
          codigo: slugCodigo(nombre, seccion),
          nombre: nombre.trim(),
          porcentaje: pct,
          baseCalculo: seccion === "pasarela" ? "BRUTO_COBRADO" : "NETO",
          alcance: seccion === "pasarela" ? "TENANT" : "PRODUCTO",
        });
        toast.success(`"${nombre.trim()}" agregada`);
      }
      setOpenSheet(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error guardando");
    } finally {
      setGuardando(false);
    }
  };

  const ejecutarBorrado = async () => {
    if (!aBorrar) return;
    try {
      await eliminarComisionCatalogo(aBorrar.id);
      toast.success("Comisión eliminada");
      setABorrar(null);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    }
  };

  const renderFila = (sec: Seccion, row: ComisionCatalogoItem) => (
    <div key={row.id} className={s.fila}>
      <div className={s.filaBody}>
        <div className={s.filaNombre}>{row.nombre}</div>
        <div className={s.filaNota}>
          {sec === "pasarela" ? "Sobre lo que cobrás" : "Sobre lo que vendés"}
        </div>
      </div>
      <span className={s.pct}>{row.porcentaje.toFixed(2)}%</span>
      <div className={s.filaAcciones}>
        <button
          type="button"
          className={s.iconBtn}
          onClick={() => abrirEditar(sec, row)}
          aria-label={`Editar ${row.nombre}`}
        >
          <PencilIcon className="size-4" />
        </button>
        <button
          type="button"
          className={`${s.iconBtn} ${s.iconBtnDanger}`}
          onClick={() => setABorrar(row)}
          aria-label={`Eliminar ${row.nombre}`}
        >
          <Trash2Icon className="size-4" />
        </button>
      </div>
    </div>
  );

  return (
    <div className={s.wrap}>
      <div className={s.head}>
        <div className={s.headRow}>
          <span className={s.headTitle}>Comisiones</span>
        </div>
        <p className={s.sub}>
          Los costos de venta que el sistema mete en el precio. Se configuran
          una vez y casi no se tocan.
        </p>
      </div>

      {/* ── Pasarela de pago (tenant) ── */}
      <section className={s.seccion}>
        <div className={s.seccionHead}>
          <div>
            <div className={s.seccionTitulo}>Comisión de pasarela de pago</div>
            <div className={s.seccionSub}>
              El costo de cobrar (tarjeta, Mercado Pago…). Se aplica sola a todo
              lo que cotizás, para no tener un precio por forma de pago.
            </div>
          </div>
        </div>
        <div className={s.filas}>
          {pasarelaRows.length === 0 ? (
            <div className={s.vacio}>
              No tenés comisión de pasarela cargada.
            </div>
          ) : (
            pasarelaRows.map((row) => renderFila("pasarela", row))
          )}
        </div>
        <div className={s.addRow}>
          <button
            type="button"
            className={s.addBtn}
            onClick={() => abrirNuevo("pasarela")}
          >
            <PlusIcon className="size-4" />
            Agregar comisión de pasarela
          </button>
        </div>
      </section>

      {/* ── Vendedor (por producto) ── */}
      <section className={s.seccion}>
        <div className={s.seccionHead}>
          <div>
            <div className={s.seccionTitulo}>Comisiones de vendedor</div>
            <div className={s.seccionSub}>
              Comisiones que se asignan a cada producto en su Tab Precio (ej. un
              % para el vendedor). Se calculan sobre el precio sin IVA.
            </div>
          </div>
        </div>
        <div className={s.filas}>
          {vendedorRows.length === 0 ? (
            <div className={s.vacio}>
              No tenés comisiones de vendedor cargadas.
            </div>
          ) : (
            vendedorRows.map((row) => renderFila("vendedor", row))
          )}
        </div>
        <div className={s.addRow}>
          <button
            type="button"
            className={s.addBtn}
            onClick={() => abrirNuevo("vendedor")}
          >
            <PlusIcon className="size-4" />
            Agregar comisión de vendedor
          </button>
        </div>
      </section>

      {/* ── Sheet ── */}
      <AlertDialog open={openSheet} onOpenChange={setOpenSheet}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {editItem
                ? "Editar comisión"
                : seccion === "pasarela"
                  ? "Nueva comisión de pasarela"
                  : "Nueva comisión de vendedor"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {seccion === "pasarela"
                ? "Se aplica a todas tus ventas, sobre lo cobrado."
                : "Se asigna por producto, sobre el precio sin IVA."}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className={s.form}>
            <div className={s.campo}>
              <label className={s.campoLabel} htmlFor="com-nombre">
                Nombre
              </label>
              <Input
                id="com-nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder={
                  seccion === "pasarela" ? "Pasarela de pago" : "Comisión vendedor"
                }
              />
            </div>
            <div className={s.campo}>
              <label className={s.campoLabel} htmlFor="com-pct">
                Porcentaje (%)
              </label>
              <Input
                id="com-pct"
                type="number"
                min={0}
                max={100}
                step={0.01}
                value={porcentaje}
                onChange={(e) => setPorcentaje(e.target.value)}
                placeholder="8"
              />
            </div>
          </div>

          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setOpenSheet(false)}>
              Cancelar
            </Button>
            <Button onClick={guardar} disabled={guardando || !porcentaje}>
              {guardando ? "Guardando..." : "Guardar"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ConfirmacionDestructiva
        open={!!aBorrar}
        onOpenChange={(open) => !open && setABorrar(null)}
        titulo="Eliminar comisión"
        descripcion={
          aBorrar ? (
            <>
              Vas a eliminar <strong>{aBorrar.nombre}</strong> (
              {aBorrar.porcentaje.toFixed(2)}%). Deja de aplicarse a las
              cotizaciones nuevas.
            </>
          ) : null
        }
        nombreItem={aBorrar?.nombre}
        accionLabel="Eliminar"
        onConfirmar={ejecutarBorrado}
      />
    </div>
  );
}
