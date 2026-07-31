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
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { useConfigRegional } from "@/components/navigation/config-regional-provider";
import { perfilPais } from "@/lib/perfiles-pais-impuestos";
import s from "./impuestos-config.module.css";

interface Props {
  initialItems: PrecioCatalogoItem[];
}

type EditKind = "iva" | "iva-nuevo" | "empresa-nuevo" | "empresa-edit";

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
  const { paisCodigo } = useConfigRegional();
  const perfil = perfilPais(paisCodigo);

  const [condicion, setCondicion] = React.useState<
    CondicionFiscalEmisor | null | "desconocida"
  >("desconocida");

  React.useEffect(() => {
    // La condición fiscal (RI/Monotributo) es de Argentina; el resto de países
    // no la usa para gatear el impuesto.
    if (!perfil.usaCondicionFiscal) return;
    let cancel = false;
    getConfiguracionFiscal()
      .then((cf) => !cancel && setCondicion(cf?.condicionFiscal ?? null))
      .catch(() => !cancel && setCondicion("desconocida"));
    return () => {
      cancel = true;
    };
  }, [perfil.usaCondicionFiscal]);

  // IVA = lo que se suma al precio (POR_FUERA). Empresa = costo tuyo (el resto).
  // Sólo activos: es lo que el motor aplica (los inactivos ya no cotizan).
  const activos = initialItems.filter((i) => i.activo);
  const ivaRows = activos.filter((i) => i.traslado === "POR_FUERA");
  const empresaRows = activos.filter((i) => i.traslado !== "POR_FUERA");

  // AR gatea por condición fiscal; el resto cobra por defecto (el motor cobra
  // salvo Monotributo/Exento, que esos países no marcan).
  const cobraIva = perfil.usaCondicionFiscal ? condicion === "RI" : true;
  const mostrarEmpresa = perfil.tieneImpuestosEmpresa || empresaRows.length > 0;

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

  const abrirNuevaIva = () => {
    setKind("iva-nuevo");
    setEditItem(null);
    setNombre(perfil.impuesto);
    setPorcentaje(String(perfil.tasaGeneral));
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
    if (
      (kind === "empresa-nuevo" || kind === "empresa-edit") &&
      !nombre.trim()
    ) {
      toast.error("Poné un nombre al impuesto.");
      return;
    }
    setGuardando(true);
    try {
      if (kind === "iva" && editItem) {
        await actualizarImpuestoCatalogo(editItem.id, { porcentaje: pct });
        toast.success(`Alícuota de ${perfil.impuesto} actualizada`);
      } else if (kind === "iva-nuevo") {
        await crearImpuestoCatalogo({
          codigo: "iva",
          nombre: perfil.impuesto,
          porcentaje: pct,
          traslado: "POR_FUERA",
          baseCalculo: "NETO",
          alcance: "PRODUCTO",
        });
        toast.success(`Alícuota de ${perfil.impuesto} definida`);
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

  const esEmpresa = kind === "empresa-nuevo" || kind === "empresa-edit";

  return (
    <div className={s.wrap}>
      <div className={s.head}>
        <div className={s.headRow}>
          <span className={s.headTitle}>Impuestos</span>
          <span className={s.paisChip}>
            {perfil.bandera} {perfil.nombre}
          </span>
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
            <div className={s.seccionTitulo}>{perfil.impuesto}</div>
            <div className={s.seccionSub}>
              Se suma al precio y lo paga el cliente. Vos lo cobrás y se lo
              pasás al Estado — no es un costo tuyo.
            </div>
          </div>
        </div>

        <div className={s.regimen}>
          {perfil.usaCondicionFiscal ? (
            <>
              <div className={s.regimenTexto}>
                <span
                  className={`${s.dot} ${cobraIva ? s.dotOn : s.dotOff}`}
                />
                {condicion === "desconocida" ? (
                  <span>
                    Definí tu condición fiscal para saber si cobrás{" "}
                    {perfil.impuesto}.
                  </span>
                ) : cobraIva ? (
                  <span>
                    Cobrás {perfil.impuesto} · sos {CONDICION_EMISOR_LABELS.RI}.
                  </span>
                ) : (
                  <span>
                    No cobrás {perfil.impuesto} ·{" "}
                    {condicion
                      ? CONDICION_EMISOR_LABELS[condicion]
                      : "sin definir"}
                    .
                  </span>
                )}
              </div>
              <Link
                href="/configuracion/datos-fiscales"
                className={s.regimenLink}
              >
                Cambiar en Datos fiscales →
              </Link>
            </>
          ) : (
            <div className={s.regimenTexto}>
              <span className={`${s.dot} ${s.dotOn}`} />
              <span>{perfil.regimenNota}</span>
            </div>
          )}
        </div>

        <div className={s.filas}>
          {ivaRows.length === 0 ? (
            <div className={s.addRow}>
              <button
                type="button"
                className={s.addBtn}
                onClick={abrirNuevaIva}
              >
                <PlusIcon className="size-4" />
                Definir alícuota de {perfil.impuesto}
              </button>
            </div>
          ) : (
            ivaRows.map((row) => (
              <div key={row.id} className={s.fila}>
                <div className={s.filaBody}>
                  <div className={s.filaNombre}>Normal</div>
                  <div className={s.filaNota}>
                    {perfil.impuesto} general — la mayoría de los productos
                  </div>
                </div>
                <span className={s.pct}>{row.porcentaje.toFixed(2)}%</span>
                <div className={s.filaAcciones}>
                  <button
                    type="button"
                    className={s.iconBtn}
                    onClick={() => abrirEditarIva(row)}
                    aria-label={`Editar alícuota de ${perfil.impuesto}`}
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
              <div className={s.filaNota}>{perfil.notaExento}</div>
            </div>
            <span className={`${s.pct} ${s.pctMuted}`}>0%</span>
          </div>
        </div>
      </section>

      {/* ── Impuestos de empresa (según el país) ── */}
      {mostrarEmpresa && (
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
      )}

      {/* ── Sheet de edición ── */}
      <AlertDialog open={openSheet} onOpenChange={setOpenSheet}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {!esEmpresa
                ? `Alícuota de ${perfil.impuesto} general`
                : kind === "empresa-edit"
                  ? "Editar impuesto de empresa"
                  : "Nuevo impuesto de empresa"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {!esEmpresa
                ? `El porcentaje del ${perfil.impuesto} general que se suma al precio.`
                : "Un costo de tu empresa que se embebe en el precio."}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className={s.form}>
            {esEmpresa && (
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

            {esEmpresa && (
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
