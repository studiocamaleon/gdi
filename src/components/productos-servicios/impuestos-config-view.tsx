"use client";

/**
 * <ImpuestosConfigView /> — el "librito" de impuestos del país (Fase 2.5).
 *
 * Reemplaza al catálogo crudo para IMPUESTOS: en vez de crear filas con
 * traslado/base/alcance, muestra:
 *   1. IVA por categoría (Normal / Exento) + si lo cobrás según tu condición
 *      fiscal (que vive en Datos fiscales).
 *   2. Impuestos de tu empresa (IIBB, cheque): costo tuyo, dentro del precio.
 *
 * La jerga técnica (POR_FUERA/POR_DENTRO/alcance) queda resuelta por debajo:
 *   - IVA           → POR_FUERA, NETO, alcance PRODUCTO.
 *   - empresa       → POR_DENTRO, alcance TENANT, base según "vendés/cobrás".
 *
 * Ver docs/impuestos-modelo-latam-diseno.md. Comisiones sigue con el manager
 * viejo por ahora.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConfirmacionDestructiva } from "@/components/ui/confirmacion-destructiva";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  actualizarImpuestoCatalogo,
  crearImpuestoCatalogo,
  eliminarImpuestoCatalogo,
} from "@/lib/productos-servicios-api";
import type { PrecioCatalogoItem } from "./precio-catalogo-manager";
import {
  CONDICION_EMISOR_LABELS,
  type CondicionFiscalEmisor,
} from "@/lib/administracion";
import { getConfiguracionFiscal } from "@/lib/administracion-api";
import s from "./impuestos-config.module.css";

interface Props {
  initialItems: PrecioCatalogoItem[];
}

type EditKind = "iva" | "empresa-nuevo" | "empresa-edit";

/** Cómo se calcula un impuesto de empresa, en criollo → base técnica. */
const BASES_EMPRESA = [
  {
    value: "NETO" as const,
    titulo: "Sobre lo que vendés",
    desc: "Un % de tu facturación sin IVA. Es el caso típico (ej. Ingresos Brutos).",
  },
  {
    value: "BRUTO_COBRADO" as const,
    titulo: "Sobre lo que cobrás",
    desc: "Un % del total acreditado con IVA (ej. impuesto al cheque bancario).",
  },
];

function slugCodigo(nombre: string): string {
  const base = nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24);
  return `emp_${base || "impuesto"}`;
}

export function ImpuestosConfigView({ initialItems }: Props) {
  const router = useRouter();

  const [condicion, setCondicion] = React.useState<
    CondicionFiscalEmisor | null | "desconocida"
  >("desconocida");

  React.useEffect(() => {
    let cancel = false;
    getConfiguracionFiscal()
      .then((cf) => !cancel && setCondicion(cf?.condicionFiscal ?? null))
      .catch(() => !cancel && setCondicion("desconocida"));
    return () => {
      cancel = true;
    };
  }, []);

  // IVA = lo que se suma al precio (POR_FUERA). Empresa = costo tuyo (el resto).
  // Sólo activos: es lo que el motor aplica (los inactivos ya no cotizan).
  const activos = initialItems.filter((i) => i.activo);
  const ivaRows = activos.filter((i) => i.traslado === "POR_FUERA");
  const empresaRows = activos.filter((i) => i.traslado !== "POR_FUERA");

  const cobraIva = condicion === "RI";

  // ── Sheet de edición ──
  const [openSheet, setOpenSheet] = React.useState(false);
  const [kind, setKind] = React.useState<EditKind>("iva");
  const [editItem, setEditItem] = React.useState<PrecioCatalogoItem | null>(
    null,
  );
  const [nombre, setNombre] = React.useState("");
  const [porcentaje, setPorcentaje] = React.useState("");
  const [base, setBase] = React.useState<"NETO" | "BRUTO_COBRADO">("NETO");
  const [guardando, setGuardando] = React.useState(false);
  const [aBorrar, setABorrar] = React.useState<PrecioCatalogoItem | null>(null);

  const abrirEditarIva = (item: PrecioCatalogoItem) => {
    setKind("iva");
    setEditItem(item);
    setNombre(item.nombre);
    setPorcentaje(String(item.porcentaje));
    setOpenSheet(true);
  };

  const abrirNuevaEmpresa = () => {
    setKind("empresa-nuevo");
    setEditItem(null);
    setNombre("");
    setPorcentaje("");
    setBase("NETO");
    setOpenSheet(true);
  };

  const abrirEditarEmpresa = (item: PrecioCatalogoItem) => {
    setKind("empresa-edit");
    setEditItem(item);
    setNombre(item.nombre);
    setPorcentaje(String(item.porcentaje));
    setBase(item.baseCalculo === "BRUTO_COBRADO" ? "BRUTO_COBRADO" : "NETO");
    setOpenSheet(true);
  };

  const guardar = async () => {
    const pct = Number(porcentaje);
    if (Number.isNaN(pct) || pct < 0 || pct > 100) {
      toast.error("El porcentaje tiene que ser un número entre 0 y 100.");
      return;
    }
    if (kind !== "iva" && !nombre.trim()) {
      toast.error("Poné un nombre al impuesto.");
      return;
    }
    setGuardando(true);
    try {
      if (kind === "iva" && editItem) {
        await actualizarImpuestoCatalogo(editItem.id, { porcentaje: pct });
        toast.success("Alícuota de IVA actualizada");
      } else if (kind === "empresa-edit" && editItem) {
        await actualizarImpuestoCatalogo(editItem.id, {
          nombre: nombre.trim(),
          porcentaje: pct,
          baseCalculo: base,
        });
        toast.success(`"${nombre.trim()}" actualizado`);
      } else {
        await crearImpuestoCatalogo({
          codigo: slugCodigo(nombre),
          nombre: nombre.trim(),
          porcentaje: pct,
          traslado: "POR_DENTRO",
          baseCalculo: base,
          alcance: "TENANT",
        });
        toast.success(`"${nombre.trim()}" agregado`);
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
      await eliminarImpuestoCatalogo(aBorrar.id);
      toast.success("Impuesto eliminado");
      setABorrar(null);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    }
  };

  return (
    <div className={s.wrap}>
      <div className={s.head}>
        <div className={s.headRow}>
          <span className={s.headTitle}>Impuestos</span>
          <span className={s.paisChip}>🇦🇷 Argentina</span>
        </div>
        <p className={s.sub}>
          Cómo se calculan los impuestos de tus ventas. Se configura una vez y
          casi no se toca.
        </p>
      </div>

      {/* ── IVA ── */}
      <section className={`${s.seccion} ${cobraIva ? "" : s.apagado}`}>
        <div className={s.seccionHead}>
          <div>
            <div className={s.seccionTitulo}>IVA</div>
            <div className={s.seccionSub}>
              Se suma al precio y lo paga el cliente. Vos lo cobrás y se lo
              pasás al Estado — no es un costo tuyo.
            </div>
          </div>
        </div>

        <div className={s.regimen}>
          <div className={s.regimenTexto}>
            <span className={`${s.dot} ${cobraIva ? s.dotOn : s.dotOff}`} />
            {condicion === "desconocida" ? (
              <span>Definí tu condición fiscal para saber si cobrás IVA.</span>
            ) : cobraIva ? (
              <span>
                Cobrás IVA · sos {CONDICION_EMISOR_LABELS.RI}.
              </span>
            ) : (
              <span>
                No cobrás IVA ·{" "}
                {condicion ? CONDICION_EMISOR_LABELS[condicion] : "sin definir"}
                .
              </span>
            )}
          </div>
          <Link href="/configuracion/datos-fiscales" className={s.regimenLink}>
            Cambiar en Datos fiscales →
          </Link>
        </div>

        <div className={s.filas}>
          {ivaRows.length === 0 ? (
            <div className={s.vacio}>
              Todavía no hay una alícuota de IVA general cargada.
            </div>
          ) : (
            ivaRows.map((row) => (
              <div key={row.id} className={s.fila}>
                <div className={s.filaBody}>
                  <div className={s.filaNombre}>Normal</div>
                  <div className={s.filaNota}>
                    IVA general — la mayoría de los productos
                  </div>
                </div>
                <span className={s.pct}>{row.porcentaje.toFixed(2)}%</span>
                <div className={s.filaAcciones}>
                  <button
                    type="button"
                    className={s.iconBtn}
                    onClick={() => abrirEditarIva(row)}
                    aria-label="Editar alícuota de IVA"
                  >
                    <PencilIcon className="size-4" />
                  </button>
                </div>
              </div>
            ))
          )}
          <div className={`${s.fila} ${s.filaExenta}`}>
            <div className={s.filaBody}>
              <div className={s.filaNombre}>Exento</div>
              <div className={s.filaNota}>Sin IVA — ej. libros</div>
            </div>
            <span className={`${s.pct} ${s.pctMuted}`}>0%</span>
          </div>
        </div>
      </section>

      {/* ── Impuestos de empresa ── */}
      <section className={s.seccion}>
        <div className={s.seccionHead}>
          <div>
            <div className={s.seccionTitulo}>Impuestos de tu empresa</div>
            <div className={s.seccionSub}>
              Son un costo tuyo y van incluidos dentro del precio — el cliente
              no los ve. Se aplican solos a todo lo que cotizás.
            </div>
          </div>
        </div>

        <div className={s.filas}>
          {empresaRows.length === 0 ? (
            <div className={s.vacio}>
              No tenés impuestos de empresa cargados (ej. Ingresos Brutos).
            </div>
          ) : (
            empresaRows.map((row) => (
              <div key={row.id} className={s.fila}>
                <div className={s.filaBody}>
                  <div className={s.filaNombre}>{row.nombre}</div>
                  <div className={s.filaNota}>
                    {row.baseCalculo === "BRUTO_COBRADO"
                      ? "Sobre lo que cobrás"
                      : "Sobre lo que vendés"}
                  </div>
                </div>
                <span className={s.pct}>{row.porcentaje.toFixed(2)}%</span>
                <div className={s.filaAcciones}>
                  <button
                    type="button"
                    className={s.iconBtn}
                    onClick={() => abrirEditarEmpresa(row)}
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
            ))
          )}
        </div>
        <div className={s.addRow}>
          <button type="button" className={s.addBtn} onClick={abrirNuevaEmpresa}>
            <PlusIcon className="size-4" />
            Agregar impuesto de empresa
          </button>
        </div>
      </section>

      {/* ── Sheet de edición ── */}
      <Sheet open={openSheet} onOpenChange={setOpenSheet}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>
              {kind === "iva"
                ? "Alícuota de IVA general"
                : kind === "empresa-edit"
                  ? "Editar impuesto de empresa"
                  : "Nuevo impuesto de empresa"}
            </SheetTitle>
            <SheetDescription>
              {kind === "iva"
                ? "El porcentaje del IVA general que se suma al precio."
                : "Un costo de tu empresa que se embebe en el precio."}
            </SheetDescription>
          </SheetHeader>

          <div className={s.form}>
            {kind !== "iva" && (
              <div className={s.campo}>
                <label className={s.campoLabel} htmlFor="imp-nombre">
                  Nombre
                </label>
                <Input
                  id="imp-nombre"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ingresos Brutos"
                />
              </div>
            )}

            <div className={s.campo}>
              <label className={s.campoLabel} htmlFor="imp-pct">
                Porcentaje (%)
              </label>
              <Input
                id="imp-pct"
                type="number"
                min={0}
                max={100}
                step={0.01}
                value={porcentaje}
                onChange={(e) => setPorcentaje(e.target.value)}
                placeholder="21"
              />
            </div>

            {kind !== "iva" && (
              <div className={s.campo}>
                <span className={s.campoLabel}>¿Sobre qué se calcula?</span>
                <div className={s.opciones}>
                  {BASES_EMPRESA.map((op) => (
                    <button
                      type="button"
                      key={op.value}
                      className={`${s.opcion} ${
                        base === op.value ? s.opcionActiva : ""
                      }`}
                      onClick={() => setBase(op.value)}
                    >
                      <span className={s.opcionTitulo}>{op.titulo}</span>
                      <span className={s.opcionDesc}>{op.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <SheetFooter>
            <Button variant="outline" onClick={() => setOpenSheet(false)}>
              Cancelar
            </Button>
            <Button onClick={guardar} disabled={guardando || !porcentaje}>
              {guardando ? "Guardando..." : "Guardar"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ConfirmacionDestructiva
        open={!!aBorrar}
        onOpenChange={(open) => !open && setABorrar(null)}
        titulo="Eliminar impuesto de empresa"
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
