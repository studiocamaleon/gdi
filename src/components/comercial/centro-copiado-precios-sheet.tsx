"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import {
  cotizarCentroCopiado,
  opcionesCentroCopiado,
  dimsDeFormato,
  type DocumentoCentroCopiado,
  type ColorDoc,
  type FazDoc,
} from "@/lib/centro-copiado-api";
import { formatCurrency } from "@/lib/propuestas";
import type { PropuestaItem } from "@/lib/propuestas";
import type { Moneda } from "@/lib/monedas";
import s from "./centro-copiado-precios.module.css";

/** Config que define el precio de una hoja: papel + gramaje + tamaño + color + faz. */
type Config = {
  papelMateriaPrimaId: string;
  gramaje: number | null;
  tamano: string;
  color: ColorDoc;
  faz: FazDoc;
};

type Seg = {
  paginas?: number;
  copias?: number;
  tamano?: string;
  tamanoAnchoMm?: number;
  tamanoAltoMm?: number;
  papelMateriaPrimaId?: string;
  gramaje?: number | null;
  color?: ColorDoc;
  faz?: FazDoc;
};
type CcMeta = Seg & {
  esTomo?: boolean;
  juegos?: number;
  segmentos?: Seg[];
};

/** Una config con sus montos consolidados en la OT. */
type FilaConfig = Config & {
  hojas: number;
  netoTotal: number;
  finalTotal: number;
};
/** Un papel con sus configs y subtotales. */
type GrupoPapel = {
  papelLabel: string;
  hojas: number;
  netoTotal: number;
  finalTotal: number;
  filas: FilaConfig[];
};
type Resumen = {
  grupos: GrupoPapel[];
  hojas: number;
  netoTotal: number;
  finalTotal: number;
};

const claveConfig = (c: Config) =>
  `${c.papelMateriaPrimaId}|${c.gramaje ?? ""}|${c.tamano}|${c.color}|${c.faz}`;
const clavePapel = (c: Config) => `${c.papelMateriaPrimaId}|${c.gramaje ?? ""}`;

const configLabel = (c: Config) =>
  `${c.tamano} · ${c.color === "COLOR" ? "Color" : "B/N"} · ${
    c.faz === 2 ? "Doble faz" : "Simple faz"
  }`;

interface Props {
  open: boolean;
  onClose: () => void;
  /** Todos los ítems de la OT; se filtran los de centro de copiado. */
  items: PropuestaItem[];
  moneda: Moneda;
}

export default function CentroCopiadoPreciosSheet({
  open,
  onClose,
  items,
  moneda,
}: Props) {
  const [resumen, setResumen] = React.useState<Resumen | null>(null);
  const [cargando, setCargando] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Esc cierra.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Bloquear scroll de fondo.
  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Al abrir: reconstruye las hojas de la OT y las cotiza para el $/hoja por config.
  React.useEffect(() => {
    if (!open) return;
    let vivo = true;
    setCargando(true);
    setError(null);
    setResumen(null);

    // 1. Todas las hojas como documentos sueltos (cada tomo se abre en sus
    //    segmentos, con copias = juegos). El precio es lineal (sin setup), así que
    //    cotizar cada config una vez da el $/hoja exacto.
    let seq = 0;
    const documentos: DocumentoCentroCopiado[] = [];
    const configPorId = new Map<string, Config>();
    for (const it of items) {
      const meta = (it.jobContext as { _centroCopiado?: CcMeta } | undefined)
        ?._centroCopiado;
      if (!meta) continue;
      const segs: Seg[] =
        meta.esTomo && meta.segmentos?.length
          ? meta.segmentos.map((sg) => ({ ...sg, copias: meta.juegos ?? 1 }))
          : [{ ...meta, copias: meta.copias ?? 1 }];
      for (const sg of segs) {
        if (!sg.papelMateriaPrimaId) continue;
        const id = `r${seq++}`;
        const tamano = sg.tamano ?? "A4";
        const dims =
          sg.tamanoAnchoMm && sg.tamanoAltoMm
            ? { anchoMm: sg.tamanoAnchoMm, altoMm: sg.tamanoAltoMm }
            : dimsDeFormato(tamano);
        const color: ColorDoc = sg.color ?? "BN";
        const faz: FazDoc = sg.faz ?? 1;
        documentos.push({
          id,
          paginas: Number(sg.paginas) || 1,
          copias: Number(sg.copias) || 1,
          tamano,
          tamanoAnchoMm: dims.anchoMm,
          tamanoAltoMm: dims.altoMm,
          papelMateriaPrimaId: sg.papelMateriaPrimaId,
          gramaje: sg.gramaje ?? null,
          color,
          faz,
        });
        configPorId.set(id, {
          papelMateriaPrimaId: sg.papelMateriaPrimaId,
          gramaje: sg.gramaje ?? null,
          tamano,
          color,
          faz,
        });
      }
    }

    if (documentos.length === 0) {
      setResumen({ grupos: [], hojas: 0, netoTotal: 0, finalTotal: 0 });
      setCargando(false);
      return;
    }

    void Promise.all([
      cotizarCentroCopiado({ documentos }),
      opcionesCentroCopiado(),
    ])
      .then(([cot, opciones]) => {
        if (!vivo) return;
        const nombrePapel = new Map(
          opciones.papeles.map((p) => [p.materiaPrimaId, p.nombre]),
        );
        // 2. Agrupa los resultados por config (sumando hojas y montos).
        const porConfig = new Map<string, FilaConfig>();
        for (const d of cot.documentos) {
          if (d.error) continue;
          const cfg = configPorId.get(d.id);
          if (!cfg) continue;
          const k = claveConfig(cfg);
          const acc =
            porConfig.get(k) ??
            ({ ...cfg, hojas: 0, netoTotal: 0, finalTotal: 0 } as FilaConfig);
          acc.hojas += d.hojas;
          acc.netoTotal += d.subtotal;
          acc.finalTotal += d.total;
          porConfig.set(k, acc);
        }
        // 3. Agrupa las configs por papel.
        const porPapel = new Map<string, GrupoPapel>();
        for (const fila of porConfig.values()) {
          const label = `${nombrePapel.get(fila.papelMateriaPrimaId) ?? "Papel"}${
            fila.gramaje ? ` ${fila.gramaje}g` : ""
          }`;
          const k = clavePapel(fila);
          const g =
            porPapel.get(k) ??
            ({
              papelLabel: label,
              hojas: 0,
              netoTotal: 0,
              finalTotal: 0,
              filas: [],
            } as GrupoPapel);
          g.filas.push(fila);
          g.hojas += fila.hojas;
          g.netoTotal += fila.netoTotal;
          g.finalTotal += fila.finalTotal;
          porPapel.set(k, g);
        }
        const grupos = [...porPapel.values()].sort((a, b) =>
          a.papelLabel.localeCompare(b.papelLabel),
        );
        for (const g of grupos)
          g.filas.sort((a, b) => configLabel(a).localeCompare(configLabel(b)));
        setResumen({
          grupos,
          hojas: grupos.reduce((n, g) => n + g.hojas, 0),
          netoTotal: grupos.reduce((n, g) => n + g.netoTotal, 0),
          finalTotal: grupos.reduce((n, g) => n + g.finalTotal, 0),
        });
      })
      .catch((e) => {
        if (!vivo) return;
        const msg =
          e instanceof Error ? e.message : "No se pudo calcular el resumen.";
        setError(msg);
        toast.error(msg);
      })
      .finally(() => {
        if (vivo) setCargando(false);
      });

    return () => {
      vivo = false;
    };
  }, [open, items]);

  if (!open) return null;

  const porHoja = (neto: number, final: number, hojas: number) => ({
    neto: hojas > 0 ? neto / hojas : 0,
    final: hojas > 0 ? final / hojas : 0,
  });

  const contenido = (
    <>
      <div className={s.backdrop} onClick={onClose} />
      <div
        className={s.sheet}
        role="dialog"
        aria-modal="true"
        aria-label="Precios de impresión"
      >
        <header className={s.head}>
          <div>
            <div className={s.eyebrow}>Centro de copiado</div>
            <h2 className={s.titulo}>Precios de impresión</h2>
            <p className={s.sub}>
              Precio por hoja de cada papel y configuración (neto y final con IVA).
            </p>
          </div>
          <button
            type="button"
            className={s.close}
            onClick={onClose}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </header>

        <div className={s.body}>
          {cargando ? (
            <div className={s.estado}>Calculando precios…</div>
          ) : error ? (
            <div className={s.estado}>No se pudo calcular: {error}</div>
          ) : !resumen || resumen.grupos.length === 0 ? (
            <div className={s.estado}>
              No hay impresiones de centro de copiado en esta orden.
            </div>
          ) : (
            resumen.grupos.map((g) => {
              const subHoja = porHoja(g.netoTotal, g.finalTotal, g.hojas);
              return (
                <div key={g.papelLabel} className={s.papel}>
                  <div className={s.papelHead}>
                    <span className={s.papelNombre}>{g.papelLabel}</span>
                    <span className={s.papelHojas}>{g.hojas} hojas</span>
                  </div>
                  {g.filas.map((f) => {
                    const ph = porHoja(f.netoTotal, f.finalTotal, f.hojas);
                    return (
                      <div key={claveConfig(f)} className={s.fila}>
                        <div className={s.config}>
                          <span className={s.configLbl}>{configLabel(f)}</span>
                          <span className={s.configMeta}>{f.hojas} hojas</span>
                        </div>
                        <div className={s.hoja}>
                          <span className={s.hojaCap}>Por hoja</span>
                          <span className={s.hojaNeto}>
                            {formatCurrency(ph.neto, moneda)}
                          </span>
                          <span className={s.hojaFinal}>
                            {formatCurrency(ph.final, moneda)} c/IVA
                          </span>
                        </div>
                        <div className={s.sub2}>
                          <span className={s.hojaCap}>Subtotal</span>
                          <span className={s.sub2Neto}>
                            {formatCurrency(f.netoTotal, moneda)}
                          </span>
                          <span className={s.sub2Final}>
                            {formatCurrency(f.finalTotal, moneda)} c/IVA
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  <div className={s.papelTotal}>
                    <span className={s.papelTotalLbl}>
                      Subtotal {g.papelLabel} · prom. {formatCurrency(subHoja.neto, moneda)}/hoja
                    </span>
                    <span className={s.sub2Neto}>
                      {formatCurrency(g.netoTotal, moneda)}
                    </span>
                    <span className={s.sub2Final}>
                      {formatCurrency(g.finalTotal, moneda)} c/IVA
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {resumen && resumen.grupos.length > 0 && (
          <footer className={s.foot}>
            <span className={s.footLbl}>
              Total impresión · {resumen.hojas} hojas
            </span>
            <div className={s.footNums}>
              <div className={s.footNeto}>
                {formatCurrency(resumen.netoTotal, moneda)}
              </div>
              <div className={s.footFinal}>
                {formatCurrency(resumen.finalTotal, moneda)} con IVA
              </div>
            </div>
          </footer>
        )}
      </div>
    </>
  );

  return typeof document === "undefined"
    ? null
    : createPortal(contenido, document.body);
}
