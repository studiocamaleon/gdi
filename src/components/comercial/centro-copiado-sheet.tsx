"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { leerMedidasPdf } from "@/lib/pdf-medidas";
import { ConfirmacionSalida } from "@/components/ui/confirmacion-salida";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import type { PropuestaItem } from "@/lib/propuestas";
import {
  cotizarCentroCopiado,
  construirItemsCentroCopiado,
  opcionesCentroCopiado,
  itemConstruidoAPropuestaItem,
  tamanosProducibles,
  type ColorDoc,
  type FazDoc,
  type FormatoTamano,
  type PapelOpcion,
  type CotizarCentroCopiadoResponse,
} from "@/lib/centro-copiado-api";
import {
  NIVELES_COBERTURA,
  NIVEL_COBERTURA_LABELS,
} from "@/lib/cobertura-toner";
import s from "./centro-copiado-sheet.module.css";

/** Un tamaño resuelto en una fila: nombre + medidas (para el payload y el motor). */
type TamanoFila = { tamano: string; tamanoAnchoMm: number; tamanoAltoMm: number };

type DocRow = TamanoFila & {
  id: string;
  nombre: string;
  paginas: number;
  /** true = las páginas las leyó el sistema del PDF (se marcan en verde). */
  paginasAuto: boolean;
  papelMateriaPrimaId: string;
  gramaje: number | null;
  color: ColorDoc;
  faz: FazDoc;
  /** Cobertura de tóner del documento ('borrador'|'normal'|'alta'). */
  cobertura: string;
  copias: number;
  /** Terminaciones (pasos opcionales) del documento suelto. */
  terminaciones: string[];
  /** Archivo original subido (para persistir en R2 al guardar la orden). */
  file: File | null;
  grupoId: string | null;
};

type Defaults = TamanoFila & {
  papelMateriaPrimaId: string;
  gramaje: number | null;
  color: ColorDoc;
  faz: FazDoc;
  copias: number;
};

/** Estado de un tomo (grupo anillado): juegos, nombre y sus terminaciones. */
type GrupoState = { juegos: number; nombre: string; terminaciones: string[] };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAgregar: (items: PropuestaItem[]) => void;
  /** Edición: la CARGA completa (todos los renglones que entraron juntos). */
  editItems?: PropuestaItem[] | null;
}

type SegMeta = {
  nombre?: string | null;
  paginas: number;
  tamano: string;
  tamanoAnchoMm?: number;
  tamanoAltoMm?: number;
  papelMateriaPrimaId: string;
  gramaje?: number | null;
  color: ColorDoc;
  faz: FazDoc;
  cobertura?: string | null;
};

/** Metadata que el backend deja en jobContext._centroCopiado para rehidratar. */
type MetaCarga = {
  nombre?: string | null;
  paginas?: number;
  copias?: number;
  tamano?: string;
  tamanoAnchoMm?: number;
  tamanoAltoMm?: number;
  papelMateriaPrimaId?: string;
  gramaje?: number | null;
  color?: ColorDoc;
  faz?: FazDoc;
  cobertura?: string | null;
  terminaciones?: string[];
  // Tomo compuesto:
  esTomo?: boolean;
  segmentos?: SegMeta[];
  juegos?: number;
  tomoNombre?: string;
};

let seqRow = 0;
const nextId = () => `d${++seqRow}-${Date.now().toString(36)}`;
const fmt = (n: number) =>
  "$" + Math.round(n).toLocaleString("es-AR", { maximumFractionDigits: 0 });

/** Fallback de medidas por nombre (para rehidratar cargas viejas sin dims). */
const CC_FALLBACK_DIMS: Record<string, { anchoMm: number; altoMm: number }> = {
  A4: { anchoMm: 210, altoMm: 297 },
  A3: { anchoMm: 297, altoMm: 420 },
  Oficio: { anchoMm: 216, altoMm: 356 },
  Carta: { anchoMm: 216, altoMm: 279 },
  SRA3: { anchoMm: 325, altoMm: 475 },
  "SRA3+": { anchoMm: 330, altoMm: 480 },
  "SRA3++": { anchoMm: 325, altoMm: 500 },
};
const dimsPorNombre = (nombre: string): { anchoMm: number; altoMm: number } | null =>
  CC_FALLBACK_DIMS[nombre] ?? null;

/** Select con estética del sistema (base-ui) para las listas de la fila. */
function SysSelect({
  value,
  onChange,
  options,
  placeholder = "Elegí",
  ariaLabel,
  /** Ancho fijo del trigger (ej. "w-[240px]") para evitar saltos de layout. */
  triggerClassName = "w-full min-w-0",
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  ariaLabel?: string;
  triggerClassName?: string;
}) {
  const current = options.find((o) => o.value === value)?.label;
  return (
    <Select value={value} onValueChange={(v) => onChange((v as string) ?? "")}>
      <SelectTrigger
        aria-label={ariaLabel}
        className={cn("h-8", triggerClassName)}
        disabled={options.length === 0}
      >
        <span
          className={cn(
            "flex flex-1 truncate text-left",
            !current && "text-muted-foreground",
          )}
        >
          {current || placeholder}
        </span>
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * Multi-select con estética del sistema para las terminaciones. Escala: el popup
 * scrollea vertical si hay muchas (no genera scroll horizontal en la fila). El
 * trigger muestra un resumen y sólo lista las terminaciones REALMENTE ofrecidas.
 */
function SysMultiSelect({
  values,
  onChange,
  options,
  placeholder = "Ninguna",
  ariaLabel,
  triggerClassName = "w-[150px]",
}: {
  values: string[];
  onChange: (v: string[]) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  ariaLabel?: string;
  triggerClassName?: string;
}) {
  const elegidas = options.filter((o) => values.includes(o.value)).map((o) => o.label);
  const resumen =
    elegidas.length === 0
      ? placeholder
      : elegidas.length <= 2
        ? elegidas.join(", ")
        : `${elegidas.length} terminaciones`;
  return (
    <Select multiple value={values} onValueChange={(v) => onChange((v as string[]) ?? [])}>
      <SelectTrigger
        aria-label={ariaLabel}
        className={cn("h-8", triggerClassName)}
        disabled={options.length === 0}
      >
        <span
          className={cn(
            "flex flex-1 truncate text-left",
            elegidas.length === 0 && "text-muted-foreground",
          )}
        >
          {resumen}
        </span>
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default function CentroCopiadoSheet({
  open,
  onOpenChange,
  onAgregar,
  editItems,
}: Props) {
  const [papeles, setPapeles] = React.useState<PapelOpcion[]>([]);
  // Tamaños que la config del tenant ofrece; null = todos los producibles.
  const [tamanosOfrecidos, setTamanosOfrecidos] = React.useState<
    string[] | null
  >(null);
  const [defaults, setDefaults] = React.useState<Defaults>({
    tamano: "A4",
    tamanoAnchoMm: 210,
    tamanoAltoMm: 297,
    papelMateriaPrimaId: "",
    gramaje: null,
    color: "BN",
    faz: 1,
    copias: 1,
  });
  const papelDe = React.useCallback(
    (id: string) => papeles.find((p) => p.materiaPrimaId === id),
    [papeles],
  );
  const gramajesDe = React.useCallback(
    (id: string) => papelDe(id)?.gramajes ?? [],
    [papelDe],
  );
  // Tamaños que ese papel + gramaje puede producir (exacto o cortado del mayor).
  const tamanosDe = React.useCallback(
    (papelId: string, gramaje: number | null): FormatoTamano[] =>
      tamanosProducibles(papelDe(papelId), gramaje, tamanosOfrecidos),
    [papelDe, tamanosOfrecidos],
  );
  // Resuelve un tamaño para (papel, gramaje): mantiene el preferido si se puede
  // producir; si no, cae al primero producible; null si el papel no produce nada.
  const resolverTamano = React.useCallback(
    (papelId: string, gramaje: number | null, preferido?: string): TamanoFila | null => {
      const lista = tamanosDe(papelId, gramaje);
      if (lista.length === 0) return null;
      const f = lista.find((t) => t.nombre === preferido) ?? lista[0];
      return { tamano: f.nombre, tamanoAnchoMm: f.anchoMm, tamanoAltoMm: f.altoMm };
    },
    [tamanosDe],
  );

  const [docs, setDocs] = React.useState<DocRow[]>([]);
  const [grupos, setGrupos] = React.useState<
    Record<string, GrupoState>
  >({});
  // Terminaciones (pasos opcionales) disponibles; las trae el backend.
  const [terminacionesDisp, setTerminacionesDisp] = React.useState<string[]>([]);
  const [sel, setSel] = React.useState<Set<string>>(new Set());
  const [preview, setPreview] = React.useState<CotizarCentroCopiadoResponse | null>(null);
  const [previewError, setPreviewError] = React.useState<string | null>(null);
  const [dragActive, setDragActive] = React.useState(false);
  const [guardando, setGuardando] = React.useState(false);
  const [confirmarSalida, setConfirmarSalida] = React.useState(false);
  const previewSeq = React.useRef(0);
  const fileRef = React.useRef<HTMLInputElement>(null);

  // Cargar opciones (papeles) al abrir.
  React.useEffect(() => {
    if (!open) return;
    let vivo = true;
    void opcionesCentroCopiado()
      .then((o) => {
        if (!vivo) return;
        setPapeles(o.papeles);
        setTerminacionesDisp(o.terminaciones ?? []);
        setTamanosOfrecidos(o.tamanosOfrecidos ?? null);
        if (o.papelDefaultId) {
          const tipo = o.papeles.find((p) => p.materiaPrimaId === o.papelDefaultId);
          const g = tipo?.gramajes[0] ?? null;
          const producibles = tamanosProducibles(tipo, g, o.tamanosOfrecidos ?? null);
          const t = producibles.find((x) => x.nombre === "A4") ?? producibles[0];
          setDefaults((d) =>
            d.papelMateriaPrimaId
              ? d
              : {
                  ...d,
                  papelMateriaPrimaId: o.papelDefaultId!,
                  gramaje: g,
                  ...(t
                    ? { tamano: t.nombre, tamanoAnchoMm: t.anchoMm, tamanoAltoMm: t.altoMm }
                    : {}),
                },
          );
        }
      })
      .catch(() => toast.error("No se pudieron cargar los papeles."));
    return () => {
      vivo = false;
    };
  }, [open]);

  // Bloquear el scroll del fondo mientras el modal está abierto.
  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Al cerrar, limpiar el estado (así reabrir para "agregar" empieza en blanco).
  React.useEffect(() => {
    if (open) return;
    setDocs([]);
    setGrupos({});
    setSel(new Set());
    setPreview(null);
    setPreviewError(null);
    setConfirmarSalida(false);
  }, [open]);

  // Edición: rehidratar la CARGA completa — cada renglón suelto es un documento,
  // cada tomo compuesto es un grupo con sus sub-documentos. Así el precio no
  // cambia por re-cotizar aislado.
  React.useEffect(() => {
    if (!open || !editItems?.length) return;
    const dims = (nombre: string, a?: number, b?: number) =>
      a && b ? { anchoMm: a, altoMm: b } : (dimsPorNombre(nombre) ?? { anchoMm: 210, altoMm: 297 });
    const nuevosDocs: DocRow[] = [];
    const nuevosGrupos: Record<string, GrupoState> = {};
    let g = 0;
    for (const it of editItems) {
      const meta = (it.jobContext as { _centroCopiado?: MetaCarga } | undefined)
        ?._centroCopiado;
      if (!meta) continue;
      if (meta.esTomo && meta.segmentos?.length) {
        const gid = `g${g++}-${Date.now().toString(36)}`;
        nuevosGrupos[gid] = {
          juegos: meta.juegos ?? 1,
          nombre: meta.tomoNombre ?? "",
          terminaciones: meta.terminaciones ?? ["Anillado"],
        };
        for (const seg of meta.segmentos) {
          const tn = seg.tamano ?? "A4";
          const d = dims(tn, seg.tamanoAnchoMm, seg.tamanoAltoMm);
          nuevosDocs.push({
            id: nextId(),
            nombre: seg.nombre ?? "Documento",
            paginas: Number(seg.paginas) || 1,
            paginasAuto: true,
            tamano: tn,
            tamanoAnchoMm: d.anchoMm,
            tamanoAltoMm: d.altoMm,
            papelMateriaPrimaId: seg.papelMateriaPrimaId ?? "",
            gramaje: seg.gramaje ?? null,
            color: seg.color ?? "BN",
            faz: seg.faz ?? 1,
            cobertura: seg.cobertura ?? "alta",
            copias: meta.juegos ?? 1,
            terminaciones: [], // las terminaciones viven en el tomo, no en el segmento
            file: null, // al editar no se re-sube el archivo original (ya está en R2)
            grupoId: gid,
          });
        }
      } else {
        const tn = meta.tamano ?? "A4";
        const d = dims(tn, meta.tamanoAnchoMm, meta.tamanoAltoMm);
        nuevosDocs.push({
          id: nextId(),
          nombre: meta.nombre ?? it.varianteNombre ?? "Documento",
          paginas: Number(meta.paginas) || 1,
          paginasAuto: true,
          tamano: tn,
          tamanoAnchoMm: d.anchoMm,
          tamanoAltoMm: d.altoMm,
          papelMateriaPrimaId: meta.papelMateriaPrimaId ?? "",
          gramaje: meta.gramaje ?? null,
          color: meta.color ?? "BN",
          faz: meta.faz ?? 1,
          cobertura: meta.cobertura ?? "alta",
          copias: Number(meta.copias) || 1,
          terminaciones: meta.terminaciones ?? [],
          file: null, // al editar no se re-sube el archivo original (ya está en R2)
          grupoId: null,
        });
      }
    }
    setDocs(nuevosDocs);
    setGrupos(nuevosGrupos);
  }, [open, editItems]);

  // Cerrar: si hay carga, confirmar para no perderla.
  const intentarCerrar = React.useCallback(() => {
    if (docs.length > 0) setConfirmarSalida(true);
    else onOpenChange(false);
  }, [docs.length, onOpenChange]);

  // Esc cierra el modal (con confirmación si hay carga).
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !confirmarSalida && !guardando) {
        e.preventDefault();
        e.stopPropagation();
        intentarCerrar();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, confirmarSalida, guardando, intentarCerrar]);

  // Precio en vivo (debounce).
  React.useEffect(() => {
    if (!open) return;
    if (docs.length === 0) {
      setPreview(null);
      return;
    }
    // No cotizar si alguna fila está incompleta (sin papel o sin páginas): las
    // manuales / no-PDF arrancan en 0 y las tiene que completar el usuario.
    const listos = docs.every((d) => d.papelMateriaPrimaId && d.paginas >= 1);
    if (!listos) {
      setPreview(null);
      return;
    }
    const seq = ++previewSeq.current;
    const handle = setTimeout(() => {
      void cotizarCentroCopiado({
        documentos: docs.map((d) => ({
          id: d.id,
          nombre: d.nombre.trim() || undefined,
          paginas: d.paginas,
          copias: d.copias,
          tamano: d.tamano,
          tamanoAnchoMm: d.tamanoAnchoMm,
          tamanoAltoMm: d.tamanoAltoMm,
          papelMateriaPrimaId: d.papelMateriaPrimaId,
          gramaje: d.gramaje,
          color: d.color,
          faz: d.faz,
          cobertura: d.cobertura,
          terminaciones: d.terminaciones,
          grupoId: d.grupoId,
        })),
        grupos: Object.entries(grupos).map(([id, g]) => ({
          id,
          juegos: g.juegos,
          nombre: g.nombre.trim() || undefined,
          terminaciones: g.terminaciones,
        })),
      })
        .then((r) => {
          if (seq !== previewSeq.current) return;
          setPreview(r);
          const err = r.documentos.find((d) => d.error)?.error ?? null;
          setPreviewError(err);
        })
        .catch((e) => {
          if (seq !== previewSeq.current) return;
          setPreviewError(
            e instanceof Error ? e.message : "No se pudo calcular el precio.",
          );
        });
    }, 350);
    return () => clearTimeout(handle);
  }, [open, docs, grupos]);

  const agregarDocs = React.useCallback(
    (
      nuevos: {
        nombre: string;
        paginas: number;
        paginasAuto: boolean;
        file?: File | null;
      }[],
    ) => {
      setDocs((prev) => [
        ...prev,
        ...nuevos.map((n) => ({
          id: nextId(),
          nombre: n.nombre,
          paginas: n.paginas,
          paginasAuto: n.paginasAuto,
          tamano: defaults.tamano,
          tamanoAnchoMm: defaults.tamanoAnchoMm,
          tamanoAltoMm: defaults.tamanoAltoMm,
          papelMateriaPrimaId: defaults.papelMateriaPrimaId,
          gramaje: defaults.gramaje,
          color: defaults.color,
          faz: defaults.faz,
          cobertura: "alta",
          copias: defaults.copias,
          terminaciones: [],
          file: n.file ?? null,
          grupoId: null,
        })),
      ]);
    },
    [defaults],
  );

  const onArchivos = React.useCallback(
    async (files: FileList | File[]) => {
      // Sólo el PDF se auto-lee (páginas en verde); DOC/Excel quedan en 0 para
      // cargar a mano, pero el archivo igual queda asociado a la fila (para R2).
      const lista = Array.from(files);
      const lecturas = await leerMedidasPdf(lista);
      // leerMedidasPdf preserva el orden ⇒ lecturas[i] ↔ lista[i].
      const nuevos = lecturas.map((l, i) =>
        l.ok
          ? {
              nombre: l.archivoNombre,
              paginas: l.paginas[0]?.totalPaginas ?? 1,
              paginasAuto: true,
              file: lista[i] ?? null,
            }
          : {
              nombre: l.archivoNombre,
              paginas: 0,
              paginasAuto: false,
              file: lista[i] ?? null,
            },
      );
      agregarDocs(nuevos);
    },
    [agregarDocs],
  );

  const agregarFilaManual = React.useCallback(() => {
    agregarDocs([{ nombre: "", paginas: 0, paginasAuto: false, file: null }]);
  }, [agregarDocs]);

  const aplicarATodos = React.useCallback(() => {
    setDocs((prev) =>
      prev.map((d) => {
        // El tamaño default puede no ser producible con el papel default de la
        // fila: se resuelve al primero producible si hace falta.
        const t =
          resolverTamano(defaults.papelMateriaPrimaId, defaults.gramaje, defaults.tamano) ??
          { tamano: d.tamano, tamanoAnchoMm: d.tamanoAnchoMm, tamanoAltoMm: d.tamanoAltoMm };
        return {
          ...d,
          ...t,
          papelMateriaPrimaId: defaults.papelMateriaPrimaId,
          gramaje: defaults.gramaje,
          color: defaults.color,
          faz: defaults.faz,
          copias: d.grupoId ? d.copias : defaults.copias,
        };
      }),
    );
  }, [defaults, resolverTamano]);

  const editar = (id: string, patch: Partial<DocRow>) =>
    setDocs((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));

  // Cambiar el tamaño de una fila: setea nombre + medidas del formato elegido.
  const cambiarTamano = (id: string, nombre: string, lista: FormatoTamano[]) => {
    const f = lista.find((x) => x.nombre === nombre);
    if (!f) return;
    editar(id, { tamano: f.nombre, tamanoAnchoMm: f.anchoMm, tamanoAltoMm: f.altoMm });
  };

  // Al cambiar el tipo de papel: resetear gramaje al primero y re-resolver el
  // tamaño (mantener el actual si el nuevo papel lo produce, si no el primero).
  const cambiarPapel = (id: string, papelId: string, actual: string) => {
    const g = gramajesDe(papelId)[0] ?? null;
    const t = resolverTamano(papelId, g, actual);
    editar(id, {
      papelMateriaPrimaId: papelId,
      gramaje: g,
      ...(t ?? {}),
    });
  };

  // Al cambiar el gramaje: re-resolver el tamaño con el nuevo gramaje.
  const cambiarGramaje = (id: string, papelId: string, gramaje: number, actual: string) => {
    const t = resolverTamano(papelId, gramaje, actual);
    editar(id, { gramaje, ...(t ?? {}) });
  };

  const eliminar = (id: string) => {
    setDocs((prev) => prev.filter((d) => d.id !== id));
    setSel((prev) => {
      const n = new Set(prev);
      n.delete(id);
      return n;
    });
  };

  const anillarJuntos = React.useCallback(() => {
    if (sel.size < 2) return;
    const gid = `g${Date.now().toString(36)}`;
    // Un tomo nace Anillado (si el backend lo ofrece); el usuario puede cambiarlo.
    const termIni = terminacionesDisp.includes("Anillado") ? ["Anillado"] : [];
    setGrupos((prev) => ({
      ...prev,
      [gid]: { juegos: 1, nombre: "", terminaciones: termIni },
    }));
    setDocs((prev) => prev.map((d) => (sel.has(d.id) ? { ...d, grupoId: gid } : d)));
    setSel(new Set());
  }, [sel, terminacionesDisp]);

  const desagrupar = (gid: string) => {
    setDocs((prev) => prev.map((d) => (d.grupoId === gid ? { ...d, grupoId: null } : d)));
    setGrupos((prev) => {
      const n = { ...prev };
      delete n[gid];
      return n;
    });
  };

  const toggleSel = (id: string) =>
    setSel((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const previewDoc = (id: string) => preview?.documentos.find((d) => d.id === id);
  const subtotalDoc = (id: string) => previewDoc(id)?.subtotal ?? null;
  const errorDoc = (id: string) => previewDoc(id)?.error ?? null;
  // Precio (neto) por hoja física: le sirve al comercial para tenerlo claro.
  const precioHojaDoc = (id: string) => {
    const p = previewDoc(id);
    if (!p || p.error || !p.hojas) return null;
    return p.subtotal / p.hojas;
  };
  const fmtHoja = (n: number) =>
    "$" +
    (Math.round(n * 100) / 100).toLocaleString("es-AR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const agregar = React.useCallback(async () => {
    if (docs.length === 0) return;
    if (docs.some((d) => d.paginas < 1 || !d.papelMateriaPrimaId)) {
      toast.error("Completá las páginas y el papel de todas las filas.");
      return;
    }
    setGuardando(true);
    try {
      const r = await construirItemsCentroCopiado({
        documentos: docs.map((d) => ({
          id: d.id,
          nombre: d.nombre.trim() || undefined,
          paginas: d.paginas,
          copias: d.copias,
          tamano: d.tamano,
          tamanoAnchoMm: d.tamanoAnchoMm,
          tamanoAltoMm: d.tamanoAltoMm,
          papelMateriaPrimaId: d.papelMateriaPrimaId,
          gramaje: d.gramaje,
          color: d.color,
          faz: d.faz,
          cobertura: d.cobertura,
          terminaciones: d.terminaciones,
          grupoId: d.grupoId,
        })),
        grupos: Object.entries(grupos).map(([id, g]) => ({
          id,
          juegos: g.juegos,
          nombre: g.nombre.trim() || undefined,
          terminaciones: g.terminaciones,
        })),
      });
      const conError = r.items.filter((i) => i.error);
      if (conError.length) {
        toast.error(`${conError.length} documento(s) no se pudieron cotizar.`);
        return;
      }
      // Adjunta los archivos originales a cada ítem para subirlos a R2 al
      // guardar la orden: un suelto lleva su file; un tomo, los de sus miembros
      // (ic.documentoId es el id del grupo). Se conservan sólo en memoria.
      const filesDe = (ic: (typeof r.items)[number]): File[] => {
        const suelto = docs.find((d) => d.id === ic.documentoId);
        if (suelto) return suelto.file ? [suelto.file] : [];
        return docs
          .filter((d) => d.grupoId === ic.documentoId)
          .map((d) => d.file)
          .filter((f): f is File => !!f);
      };
      const items = r.items.map((ic) => {
        const pi = itemConstruidoAPropuestaItem(ic);
        const files = filesDe(ic);
        return files.length ? { ...pi, archivosPendientes: files } : pi;
      });
      onAgregar(items);
      toast.success(`${items.length} renglón(es) agregados desde el centro de copiado.`);
      // Reset.
      setDocs([]);
      setGrupos({});
      setSel(new Set());
      setPreview(null);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudieron agregar los renglones.");
    } finally {
      setGuardando(false);
    }
  }, [docs, grupos, onAgregar, onOpenChange]);

  if (!open) return null;

  const t = preview?.totales;
  // Filas incompletas: sin páginas (manuales / no-PDF sin cargar) o sin papel.
  const incompletos = docs.filter(
    (d) => d.paginas < 1 || !d.papelMateriaPrimaId,
  ).length;
  // Orden de render: agrupados juntos por grupoId, sueltos después.
  const grupoIds = Array.from(new Set(docs.map((d) => d.grupoId).filter((g): g is string => !!g)));
  const sueltos = docs.filter((d) => !d.grupoId);
  const papelOptions = papeles.map((p) => ({ value: p.materiaPrimaId, label: p.nombre }));

  const renderCard = (d: DocRow, index: number, enGrupo: boolean) => {
    const tamanos = tamanosDe(d.papelMateriaPrimaId, d.gramaje);
    const tamanoOptions = tamanos.map((tm) => ({ value: tm.nombre, label: tm.nombre }));
    const gramajes = gramajesDe(d.papelMateriaPrimaId);
    return (
      <div key={d.id} className={`${s.card} ${enGrupo ? s.cardGrupo : ""}`}>
        <div className={s.cardTop}>
          {!enGrupo && (
            <input
              type="checkbox"
              className={s.chk}
              checked={sel.has(d.id)}
              onChange={() => toggleSel(d.id)}
              aria-label={`Seleccionar ${d.nombre}`}
            />
          )}
          <span className={s.docNum}>{String(index + 1).padStart(2, "0")}</span>
          <input
            type="text"
            value={d.nombre}
            onChange={(e) => editar(d.id, { nombre: e.target.value })}
            placeholder="Nombre del documento"
            className={s.docNombreInput}
            aria-label="Nombre del documento"
          />
          <span className={s.cardPrecio}>
            {errorDoc(d.id) ? (
              <span className={s.errChip} title={errorDoc(d.id)!}>
                ⚠ sin precio
              </span>
            ) : subtotalDoc(d.id) != null ? (
              <>
                {precioHojaDoc(d.id) != null ? (
                  <span className={s.cardUnit}>
                    {fmtHoja(precioHojaDoc(d.id)!)}/hoja
                  </span>
                ) : null}
                <span className={s.cardSub}>{fmt(subtotalDoc(d.id)!)}</span>
                <span className={s.cardIva}>sin IVA</span>
              </>
            ) : (
              <span className={s.muted}>…</span>
            )}
          </span>
          <button type="button" className={s.del} onClick={() => eliminar(d.id)} aria-label="Quitar">
            ✕
          </button>
        </div>
        <div className={s.cardCtrls}>
          <label className={s.ctrl}>
            <span>Págs</span>
            <input
              type="number"
              min={0}
              value={d.paginas || ""}
              placeholder="0"
              onChange={(e) =>
                editar(d.id, {
                  paginas: Math.max(0, Number(e.target.value) || 0),
                  paginasAuto: false,
                })
              }
              className={`${s.inputMini} ${
                d.paginas < 1
                  ? s.inputFalta
                  : d.paginasAuto
                    ? s.inputAuto
                    : ""
              }`}
              title={d.paginasAuto ? "Páginas leídas del PDF" : undefined}
            />
          </label>
          <label className={s.ctrl}>
            <span>Copias</span>
            {enGrupo ? (
              <span className={s.delTomo}>del tomo</span>
            ) : (
              <input
                type="number"
                min={1}
                value={d.copias}
                onChange={(e) => editar(d.id, { copias: Math.max(1, Number(e.target.value) || 1) })}
                className={s.inputMini}
              />
            )}
          </label>
          {/* El tipo de papel + gramaje condicionan el tamaño → van primero. */}
          <label className={s.ctrl}>
            <span>Papel</span>
            <SysSelect
              value={d.papelMateriaPrimaId}
              onChange={(v) => cambiarPapel(d.id, v, d.tamano)}
              options={papelOptions}
              ariaLabel="Papel"
              triggerClassName="w-[190px]"
            />
          </label>
          {gramajes.length > 1 && (
            <label className={s.ctrl}>
              <span>Gramaje</span>
              <SysSelect
                value={d.gramaje != null ? String(d.gramaje) : ""}
                onChange={(v) => cambiarGramaje(d.id, d.papelMateriaPrimaId, Number(v), d.tamano)}
                options={gramajes.map((g) => ({ value: String(g), label: `${g} g` }))}
                ariaLabel="Gramaje"
                triggerClassName="w-[92px]"
              />
            </label>
          )}
          <label className={s.ctrl}>
            <span>Tamaño</span>
            <SysSelect
              value={d.tamano}
              onChange={(v) => cambiarTamano(d.id, v, tamanos)}
              options={tamanoOptions}
              ariaLabel="Tamaño"
              placeholder="—"
              triggerClassName="w-[88px]"
            />
          </label>
          <label className={s.ctrl}>
            <span>Color</span>
            <div className={s.seg}>
              <button
                type="button"
                className={d.color === "BN" ? s.segOn : s.segOff}
                onClick={() => editar(d.id, { color: "BN" })}
              >
                B/N
              </button>
              <button
                type="button"
                className={d.color === "COLOR" ? s.segOn : s.segOff}
                onClick={() => editar(d.id, { color: "COLOR" })}
              >
                Color
              </button>
            </div>
          </label>
          <label className={s.ctrl}>
            <span>Faz</span>
            <div className={s.seg}>
              <button
                type="button"
                className={d.faz === 1 ? s.segOn : s.segOff}
                onClick={() => editar(d.id, { faz: 1 })}
              >
                Simple
              </button>
              <button
                type="button"
                className={d.faz === 2 ? s.segOn : s.segOff}
                onClick={() => editar(d.id, { faz: 2 })}
              >
                Doble
              </button>
            </div>
          </label>
          {/* Cobertura de tóner del documento (default Alta). Modula el consumo
              de tóner; el perfil de máquina lo resuelve el sistema. */}
          <label className={s.ctrl}>
            <span>Cobertura</span>
            <SysSelect
              value={d.cobertura}
              onChange={(v) => editar(d.id, { cobertura: v })}
              options={NIVELES_COBERTURA.map((nivel) => ({
                value: nivel,
                label: NIVEL_COBERTURA_LABELS[nivel],
              }))}
              ariaLabel="Cobertura de tóner"
              triggerClassName="w-[120px]"
            />
          </label>
          {/* Terminaciones (pasos opcionales) del suelto; en el tomo van una sola
              vez en el header del grupo. Sólo aparece si hay alguna ofrecida. */}
          {!enGrupo && terminacionesDisp.length > 0 && (
            <label className={s.ctrl}>
              <span>Terminaciones</span>
              <SysMultiSelect
                values={d.terminaciones}
                onChange={(v) => editar(d.id, { terminaciones: v })}
                options={terminacionesDisp.map((t) => ({ value: t, label: t }))}
                ariaLabel="Terminaciones"
                triggerClassName="w-[130px]"
              />
            </label>
          )}
        </div>
      </div>
    );
  };

  let idx = 0;

  // Tamaños y gramajes producibles con el papel default (para los selects de arriba).
  const defTamanos = tamanosDe(defaults.papelMateriaPrimaId, defaults.gramaje);
  const defGramajes = gramajesDe(defaults.papelMateriaPrimaId);

  // Se portala a document.body: si el modal se renderiza dentro de un ancestro con
  // `transform`/`filter`/`will-change`, el position:fixed + max-height dejan de
  // medir contra el viewport (el sheet no se acota y el scroll interno no captura
  // el wheel → scrollea la página de atrás). En el body no hay ese ancestro.
  const contenido = (
    <>
      <div className={s.backdrop} onClick={intentarCerrar} />
      <div className={s.sheet} role="dialog" aria-modal="true" aria-label="Centro de copiado">
        <header className={s.head}>
          <div>
            <div className={s.eyebrow}>Comercial · Nueva orden</div>
            <h2 className={s.titulo}>
              Centro de copiado{" "}
              <span className={s.badge}>
                {editItems?.length ? "Editar carga" : "Carga rápida"}
              </span>
            </h2>
            <p className={s.sub}>
              Cargá varios documentos de una vez. Seleccioná dos o más y agrupalos para anillar
              juntos.
            </p>
          </div>
          <button type="button" className={s.close} onClick={intentarCerrar} aria-label="Cerrar">
            ✕
          </button>
        </header>

        <div className={s.body}>
          <section className={s.cargar}>
            <div
              className={`${s.drop} ${dragActive ? s.dropActive : ""}`}
              role="button"
              tabIndex={0}
              onClick={() => fileRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  fileRef.current?.click();
                }
              }}
              onDragEnter={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setDragActive(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDragActive(false);
                if (e.dataTransfer.files?.length) void onArchivos(e.dataTransfer.files);
              }}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx"
                multiple
                hidden
                onChange={(e) => {
                  if (e.target.files?.length) void onArchivos(e.target.files);
                  e.target.value = "";
                }}
              />
              <div className={s.dropIcon}>⬦</div>
              <div className={s.dropTitle}>
                {dragActive
                  ? "Soltá los archivos acá"
                  : "Arrastrá o elegí archivos"}
              </div>
              <div className={s.dropHint}>
                PDF, Word o Excel. Del PDF leemos las páginas; en el resto las
                cargás a mano.
              </div>
            </div>

            <div className={s.defaults}>
              <div className={s.defaultsHead}>Valores por defecto</div>
              <div className={s.defaultsGrid}>
                {/* Papel + gramaje primero (condicionan el tamaño), después Tamaño. */}
                <label className={s.campo}>
                  <span>Papel</span>
                  <SysSelect
                    value={defaults.papelMateriaPrimaId}
                    onChange={(v) => {
                      const g = gramajesDe(v)[0] ?? null;
                      const t = resolverTamano(v, g, defaults.tamano);
                      setDefaults({
                        ...defaults,
                        papelMateriaPrimaId: v,
                        gramaje: g,
                        ...(t ?? {}),
                      });
                    }}
                    options={papelOptions}
                    ariaLabel="Papel por defecto"
                    triggerClassName="w-[190px]"
                  />
                </label>
                {defGramajes.length > 1 && (
                  <label className={s.campo}>
                    <span>Gramaje</span>
                    <SysSelect
                      value={defaults.gramaje != null ? String(defaults.gramaje) : ""}
                      onChange={(v) => {
                        const g = Number(v);
                        const t = resolverTamano(defaults.papelMateriaPrimaId, g, defaults.tamano);
                        setDefaults({ ...defaults, gramaje: g, ...(t ?? {}) });
                      }}
                      options={defGramajes.map((g) => ({ value: String(g), label: `${g} g` }))}
                      ariaLabel="Gramaje por defecto"
                      triggerClassName="w-[92px]"
                    />
                  </label>
                )}
                <label className={s.campo}>
                  <span>Tamaño</span>
                  <SysSelect
                    value={defaults.tamano}
                    onChange={(v) => {
                      const f = defTamanos.find((x) => x.nombre === v);
                      if (f)
                        setDefaults({
                          ...defaults,
                          tamano: f.nombre,
                          tamanoAnchoMm: f.anchoMm,
                          tamanoAltoMm: f.altoMm,
                        });
                    }}
                    options={defTamanos.map((tm) => ({ value: tm.nombre, label: tm.nombre }))}
                    ariaLabel="Tamaño por defecto"
                    placeholder="—"
                    triggerClassName="w-[88px]"
                  />
                </label>
                <label className={s.campo}>
                  <span>Color</span>
                  <div className={s.seg}>
                    <button
                      type="button"
                      className={defaults.color === "BN" ? s.segOn : s.segOff}
                      onClick={() => setDefaults({ ...defaults, color: "BN" })}
                    >
                      B/N
                    </button>
                    <button
                      type="button"
                      className={defaults.color === "COLOR" ? s.segOn : s.segOff}
                      onClick={() => setDefaults({ ...defaults, color: "COLOR" })}
                    >
                      Color
                    </button>
                  </div>
                </label>
                <label className={s.campo}>
                  <span>Faz</span>
                  <div className={s.seg}>
                    <button
                      type="button"
                      className={defaults.faz === 1 ? s.segOn : s.segOff}
                      onClick={() => setDefaults({ ...defaults, faz: 1 })}
                    >
                      Simple
                    </button>
                    <button
                      type="button"
                      className={defaults.faz === 2 ? s.segOn : s.segOff}
                      onClick={() => setDefaults({ ...defaults, faz: 2 })}
                    >
                      Doble
                    </button>
                  </div>
                </label>
                <label className={s.campo}>
                  <span>Copias</span>
                  <input
                    type="number"
                    min={1}
                    value={defaults.copias}
                    onChange={(e) => setDefaults({ ...defaults, copias: Math.max(1, Number(e.target.value) || 1) })}
                    className={s.inputMini}
                  />
                </label>
                <button type="button" className="btn" onClick={aplicarATodos} disabled={docs.length === 0}>
                  Aplicar a todos
                </button>
              </div>
            </div>
          </section>

          <section className={s.tablaWrap}>
            <div className={s.tablaHead}>
              <span>Documentos del trabajo</span>
              <div className={s.tablaHeadBtns}>
                <button type="button" className="btn" onClick={agregarFilaManual}>
                  + Fila manual
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={anillarJuntos}
                  disabled={sel.size < 2}
                  title={sel.size < 2 ? "Seleccioná dos o más" : "Anillar juntos"}
                >
                  Anillar juntos ({sel.size})
                </button>
              </div>
            </div>
            {docs.length === 0 ? (
              <div className={s.vacio}>Todavía no cargaste documentos.</div>
            ) : (
              <div className={s.lista}>
                {grupoIds.map((gid) => {
                  const miembros = docs.filter((d) => d.grupoId === gid);
                  const gprev = preview?.grupos.find((g) => g.id === gid);
                  return (
                    <div key={gid} className={s.tomo}>
                      <div className={s.tomoHead}>
                        <span className={s.tomoTitle}>Tomo anillado</span>
                        <input
                          type="text"
                          value={grupos[gid]?.nombre ?? ""}
                          onChange={(e) =>
                            setGrupos((prev) => ({
                              ...prev,
                              [gid]: { ...prev[gid], nombre: e.target.value },
                            }))
                          }
                          placeholder={`Nombre del tomo (${miembros.length} docs)`}
                          className={s.tomoNombre}
                          aria-label="Nombre del tomo"
                        />
                        <label className={s.tomoJuegos}>
                          Juegos
                          <input
                            type="number"
                            min={1}
                            value={grupos[gid]?.juegos ?? 1}
                            onChange={(e) =>
                              setGrupos((prev) => ({
                                ...prev,
                                [gid]: {
                                  ...prev[gid],
                                  juegos: Math.max(1, Number(e.target.value) || 1),
                                },
                              }))
                            }
                            className={s.inputMini}
                          />
                        </label>
                        {/* Terminaciones del tomo entero (un solo selector). */}
                        {terminacionesDisp.length > 0 && (
                          <SysMultiSelect
                            values={grupos[gid]?.terminaciones ?? []}
                            onChange={(v) =>
                              setGrupos((prev) => ({
                                ...prev,
                                [gid]: { ...prev[gid], terminaciones: v },
                              }))
                            }
                            options={terminacionesDisp.map((t) => ({ value: t, label: t }))}
                            ariaLabel="Terminaciones del tomo"
                            triggerClassName="w-[160px]"
                          />
                        )}
                        <span className={s.tomoMeta}>
                          {gprev ? `${gprev.hojasPorLibro} hojas/juego` : ""}
                        </span>
                        <span className={s.tomoSub}>{gprev ? fmt(gprev.subtotal) : "—"}</span>
                        <button
                          type="button"
                          className={s.del}
                          onClick={() => desagrupar(gid)}
                          aria-label="Desagrupar tomo"
                        >
                          ✕
                        </button>
                      </div>
                      {miembros.map((d) => renderCard(d, idx++, true))}
                    </div>
                  );
                })}
                {sueltos.map((d) => renderCard(d, idx++, false))}
              </div>
            )}
          </section>
        </div>

        {previewError && docs.length > 0 && (
          <div className={s.errBanner}>
            No se pudo calcular el precio: {previewError}
          </div>
        )}
        <footer className={s.foot}>
          <div className={s.stats}>
            <div>
              <span className={s.statNum}>{t?.documentos ?? docs.length}</span>
              <span className={s.statLbl}>Documentos</span>
            </div>
            <div>
              <span className={s.statNum}>{t?.tomos ?? grupoIds.length}</span>
              <span className={s.statLbl}>Tomos</span>
            </div>
            <div>
              <span className={s.statNum}>{t?.carillas ?? 0}</span>
              <span className={s.statLbl}>Carillas</span>
            </div>
            <div>
              <span className={s.statNum}>{t?.hojasFisicas ?? 0}</span>
              <span className={s.statLbl}>Hojas físicas</span>
            </div>
          </div>
          <div className={s.totalBox}>
            <div className={s.totalFinal}>
              <span>Total c/IVA</span>
              <strong>{fmt((t?.subtotal ?? 0) + (t?.iva ?? 0))}</strong>
            </div>
            <div className={s.totalNetoSub}>
              Neto {fmt(t?.subtotal ?? 0)} · IVA {fmt(t?.iva ?? 0)}
            </div>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void agregar()}
            disabled={docs.length === 0 || incompletos > 0 || guardando}
            title={
              incompletos > 0
                ? `${incompletos} fila(s) sin páginas o sin papel`
                : undefined
            }
          >
            {guardando
              ? "Guardando…"
              : incompletos > 0
                ? `Completá ${incompletos} fila(s)`
                : editItems?.length
                  ? "Guardar cambios"
                  : "Agregar a la OT"}
          </button>
        </footer>
      </div>
      <ConfirmacionSalida
        open={confirmarSalida}
        cambios={docs.length}
        donde="el centro de copiado"
        guardando={guardando}
        onGuardarYSalir={async () => {
          await agregar();
          setConfirmarSalida(false);
        }}
        onDescartarYSalir={() => {
          setConfirmarSalida(false);
          onOpenChange(false);
        }}
        onSeguirEditando={() => setConfirmarSalida(false)}
      />
    </>
  );

  return typeof document === "undefined"
    ? null
    : createPortal(contenido, document.body);
}
