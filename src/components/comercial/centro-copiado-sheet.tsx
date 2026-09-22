"use client";
import { useCapacidad } from "@/components/navigation/capacidades-provider";
import type { SeleccionCad } from "../../../apps/api/src/common/seleccion-cad";

import { useMotorConTipoCambio } from "./tipo-cambio-documento";

import {
  DesignSystemProvider,
  useDesignScope,
  useDesignTheme,
} from "@/components/design-system/appearance";
import { ActionButton } from "@/components/design-system/action-button";
import { FormDialog } from "@/components/design-system/form-dialog";
import { SelectField } from "@/components/design-system/select-field";
import { Select, ListBox, Tabs } from "@heroui/react";
import { NavigationTabList } from "@/components/design-system/navigation-tab-list";
import {
  FileText,
  Upload,
  Plus,
  Trash2,
  Layers,
  Printer,
  SlidersHorizontal,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import {
  opcionesCadCopiado,
  perfilCadPreferido,
  paginasCad,
  medidasSeleccionadas,
  resumenMedidas,
  numeroMedida,
  sugerirCad,
  cantidadImpresionesCad,
  type CopiasPaginaCad,
  type PerfilCadCopiado,
  type MedidaPagina,
} from "@/lib/centro-copiado-cad";
import { DetallePaginasCad } from "./detalle-paginas-cad";
import { resolverRangoPaginas } from "@/lib/rangos-paginas";

import * as React from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { leerMedidasPdf } from "@/lib/pdf-medidas";
import {
  ORIENTACION_PDF_LABELS,
  orientacionesSeleccionadas,
  resumirOrientaciones,
  type OrientacionPagina,
} from "@/lib/orientacion-pdf";
import type { PropuestaItem } from "@/lib/propuestas";
import {
  opcionesCentroCopiado,
  itemConstruidoAPropuestaItem,
  tamanosProducibles,
  type ColorDoc,
  type FazDoc,
  type FormatoTamano,
  type PapelOpcion,
  type CotizarCentroCopiadoResponse,
  metaCentroCopiado,
} from "@/lib/centro-copiado-api";
import {
  NIVELES_COBERTURA,
  NIVEL_COBERTURA_LABELS,
} from "@/lib/cobertura-toner";
import s from "./centro-copiado-sheet.module.css";
import selectStyles from "@/components/design-system/select-field.module.css";
import focus from "@/components/design-system/field-focus.module.css";

/** Un tamaño resuelto en una fila: nombre + medidas (para el payload y el motor). */
type TamanoFila = {
  tamano: string;
  tamanoAnchoMm: number;
  tamanoAltoMm: number;
};

type DocRow = TamanoFila & {
  modo: "HOJAS" | "CAD";
  medidasPaginas?: MedidaPagina[];
  cad?: SeleccionCad;
  id: string;
  nombre: string;
  archivoNombre?: string;
  paginas: number;
  rangoPaginas: string;
  orientacionesPaginas?: OrientacionPagina[];
  /** true = las páginas las leyó el sistema del PDF y no son editables. */
  paginasAuto: boolean;
  papelMateriaPrimaId: string;
  gramaje: number | null;
  color: ColorDoc;
  faz: FazDoc;
  /** Cobertura de tóner del documento ('borrador'|'normal'|'alta'). */
  cobertura: string;
  copias: number;
  copiasPorPagina?: CopiasPaginaCad[];
  /** Terminaciones (pasos opcionales) del documento suelto. */
  terminaciones: string[];
  /** Tipo de anillo elegido (cuando la terminación Anillado está activa). */
  tipoAnillo: string;
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

/** Estado de un tomo (grupo anillado): juegos, nombre, terminaciones y tipo de anillo. */
type GrupoState = {
  juegos: number;
  nombre: string;
  terminaciones: string[];
  tipoAnillo: string;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Devuelve false si el formulario ya no admite cambios. */
  onAgregar: (items: PropuestaItem[]) => void | boolean;
  /** Cliente de la propuesta; habilita su precio especial en el motor. */
  clienteId?: string | null;
  /** Edición: la CARGA completa (todos los renglones que entraron juntos). */
  editItems?: PropuestaItem[] | null;
}

let seqRow = 0;
const nextId = () => `d${++seqRow}-${Date.now().toString(36)}`;
const fmt = (n: number) =>
  "$" + Math.round(n).toLocaleString("es-AR", { maximumFractionDigits: 0 });

const seleccionDe = (doc: DocRow) =>
  resolverRangoPaginas(doc.rangoPaginas, doc.paginas);
const paginasParaCotizar = (doc: DocRow) => ({
  paginas: seleccionDe(doc).paginas,
  ...(doc.file || doc.archivoNombre ? { paginasOriginales: doc.paginas } : {}),
  ...(doc.rangoPaginas.trim() ? { rangoPaginas: seleccionDe(doc).rango } : {}),
  modo: doc.modo,
  ...(doc.modo === "CAD"
    ? { cad: doc.cad, copiasPorPagina: doc.copiasPorPagina }
    : {}),
  ...(doc.medidasPaginas ? { medidasPaginas: doc.medidasPaginas } : {}),
  ...(doc.orientacionesPaginas
    ? { orientacionesPaginas: doc.orientacionesPaginas }
    : {}),
});
const faltaConfiguracion = (d: DocRow) =>
  d.modo === "CAD"
    ? !d.cad ||
      (d.cad.cotizacion !== undefined && !d.cad.cotizacion.revision) ||
      !d.medidasPaginas?.length
    : !d.papelMateriaPrimaId;

const OPCIONES_COLOR = [
  { value: "BN", label: "B/N", icon: null },
  { value: "COLOR", label: "Color", icon: null },
];
const OPCIONES_FAZ = [
  { value: "1", label: "Simple", icon: null },
  { value: "2", label: "Doble", icon: null },
];

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
const dimsPorNombre = (
  nombre: string,
): { anchoMm: number; altoMm: number } | null =>
  CC_FALLBACK_DIMS[nombre] ?? null;

/** Select con estética del sistema para las listas de la fila. */
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
  return (
    <div className={triggerClassName}>
      <SelectField
        aria-label={ariaLabel ?? placeholder}
        disabled={options.length === 0}
        value={value}
        onChange={onChange}
        options={options}
        className={s.compactSelect}
      />
    </div>
  );
}

const aplicarPerfilCad = (
  d: DocRow,
  perfil?: PerfilCadCopiado,
): Partial<DocRow> => ({
  modo: "CAD",
  faz: 1,
  grupoId: null,
  terminaciones: [],
  tipoAnillo: "",
  tamano: "CAD",
  cad: perfil
    ? {
        cotizacion: { id: perfil.id, revision: perfil.revision },
      }
    : undefined,
  ...(perfil
    ? {
        papelMateriaPrimaId: perfil.papelMateriaPrimaId,
        gramaje: perfil.gramaje,
        color: perfil.color,
      }
    : { papelMateriaPrimaId: "", gramaje: null }),
  tamanoAnchoMm: d.medidasPaginas?.[0]?.anchoMm ?? 1,
  tamanoAltoMm: d.medidasPaginas?.[0]?.altoMm ?? 1,
});

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
  const scope = useDesignScope();
  const theme = useDesignTheme();
  const elegidas = options
    .filter((o) => values.includes(o.value))
    .map((o) => o.label);
  const resumen =
    elegidas.length === 0
      ? placeholder
      : elegidas.length <= 2
        ? elegidas.join(", ")
        : `${elegidas.length} terminaciones`;
  return (
    <div className={triggerClassName}>
      <Select
        selectionMode="multiple"
        aria-label={ariaLabel}
        className={cn(selectStyles.root, s.compactSelect)}
        fullWidth
        isDisabled={options.length === 0}
        value={values}
        onChange={(v) => onChange(v.map(String))}
      >
        <Select.Trigger className={focus.singleBorder}>
          <Select.Value>{resumen}</Select.Value>
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover {...scope} className={theme}>
          <ListBox>
            {options.map((o) => (
              <ListBox.Item key={o.value} id={o.value} textValue={o.label}>
                {o.label}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>
    </div>
  );
}

export default function CentroCopiadoSheet(props: Props) {
  return (
    <DesignSystemProvider theme="brand" appearance="light">
      <CentroCopiadoContenido {...props} />
    </DesignSystemProvider>
  );
}

function CentroCopiadoContenido({
  open,
  onOpenChange,
  onAgregar,
  clienteId,
  editItems,
}: Props) {
  const conCopiado = useCapacidad("centro_copiado");
  const conCad = useCapacidad("cotizacion_cad");
  const conTerminaciones = useCapacidad("terminaciones_copiado");
  const { cotizarCentroCopiado, construirItemsCentroCopiado } =
    useMotorConTipoCambio();
  const [perfilesCad, setPerfilesCad] = React.useState<PerfilCadCopiado[]>([]);
  const [errorPerfilesCad, setErrorPerfilesCad] = React.useState("");
  const [cargandoCad, setCargandoCad] = React.useState(false);
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
    (
      papelId: string,
      gramaje: number | null,
      preferido?: string,
    ): TamanoFila | null => {
      const lista = tamanosDe(papelId, gramaje);
      if (lista.length === 0) return null;
      const f = lista.find((t) => t.nombre === preferido) ?? lista[0];
      return {
        tamano: f.nombre,
        tamanoAnchoMm: f.anchoMm,
        tamanoAltoMm: f.altoMm,
      };
    },
    [tamanosDe],
  );

  const [tab, setTab] = React.useState<DocRow["modo"]>("HOJAS");
  const [cadDefaults, setCadDefaults] = React.useState({
    perfilId: "",
    color: "BN" as ColorDoc,
    copias: 1,
  });
  const [cargandoHojas, setCargandoHojas] = React.useState(true);
  const perfilCadDefault =
    perfilesCad.find(
      (p) => p.id === cadDefaults.perfilId && p.color === cadDefaults.color,
    ) ?? perfilCadPreferido(perfilesCad, cadDefaults.color);
  const [docs, setDocs] = React.useState<DocRow[]>([]);
  const [grupos, setGrupos] = React.useState<Record<string, GrupoState>>({});
  const errorPlan = !conCopiado
    ? "El Centro de copiado no está incluido en el plan. Los documentos guardados se conservan."
    : !conCad && docs.some((d) => d.modo === "CAD")
      ? "Esta carga contiene planos CAD, una función no incluida en el plan. Los archivos guardados se conservan; no se modificará la carga."
      : !conTerminaciones &&
          (Object.keys(grupos).length > 0 ||
            docs.some((d) => d.grupoId || d.terminaciones.length > 0))
        ? "Esta carga contiene terminaciones o tomos, una función no incluida en el plan. Se conserva su configuración; no se modificará la carga."
        : null;
  // Terminaciones (pasos opcionales) disponibles; las trae el backend.
  const [terminacionesDisp, setTerminacionesDisp] = React.useState<string[]>(
    [],
  );
  // Tipos de anillo instalados (para el selector cuando hay Anillado).
  const [tiposAnilloDisp, setTiposAnilloDisp] = React.useState<
    { value: string; label: string }[]
  >([]);
  const [sel, setSel] = React.useState<Set<string>>(new Set());
  const [opcionesAbiertas, setOpcionesAbiertas] = React.useState<Set<string>>(
    new Set(),
  );
  const [preview, setPreview] =
    React.useState<CotizarCentroCopiadoResponse | null>(null);
  const [previewError, setPreviewError] = React.useState<string | null>(null);
  const [dragActive, setDragActive] = React.useState(false);
  const [guardando, setGuardando] = React.useState(false);
  const [cotizando, setCotizando] = React.useState(false);
  const [leyendo, setLeyendo] = React.useState(false);
  const [confirmarSalida, setConfirmarSalida] = React.useState(false);
  const previewSeq = React.useRef(0);
  const fileRef = React.useRef<HTMLInputElement>(null);

  // Cargar opciones (papeles) al abrir.
  React.useEffect(() => {
    if (!open || !conCopiado) return;
    let vivo = true;
    setCargandoHojas(true);
    void opcionesCentroCopiado()
      .then((o) => {
        if (!vivo) return;
        setPapeles(o.papeles);
        setTerminacionesDisp(conTerminaciones ? (o.terminaciones ?? []) : []);
        setTiposAnilloDisp(conTerminaciones ? (o.tiposAnillo ?? []) : []);
        setTamanosOfrecidos(o.tamanosOfrecidos ?? null);
        if (o.papelDefaultId) {
          const tipo = o.papeles.find(
            (p) => p.materiaPrimaId === o.papelDefaultId,
          );
          const g = tipo?.gramajes[0] ?? null;
          const producibles = tamanosProducibles(
            tipo,
            g,
            o.tamanosOfrecidos ?? null,
          );
          const t =
            producibles.find((x) => x.nombre === "A4") ?? producibles[0];
          setDefaults((d) =>
            d.papelMateriaPrimaId
              ? d
              : {
                  ...d,
                  papelMateriaPrimaId: o.papelDefaultId!,
                  gramaje: g,
                  ...(t
                    ? {
                        tamano: t.nombre,
                        tamanoAnchoMm: t.anchoMm,
                        tamanoAltoMm: t.altoMm,
                      }
                    : {}),
                },
          );
        }
      })
      .catch(() => {
        if (vivo) {
          setPapeles([]);
          toast.error(
            "No se pudieron cargar los papeles. Podés elegir la pestaña para clasificar los archivos.",
          );
        }
      })
      .finally(() => {
        if (vivo) setCargandoHojas(false);
      });
    return () => {
      vivo = false;
    };
  }, [open, conCopiado, conTerminaciones]);

  React.useEffect(() => {
    if (!open || !conCopiado || !conCad) return;
    let vivo = true;
    setCargandoCad(true);
    setErrorPerfilesCad("");
    void opcionesCadCopiado()
      .then((r) => {
        if (vivo) setPerfilesCad(r.perfiles);
      })
      .catch((e) => {
        if (vivo) {
          setPerfilesCad([]);
          setErrorPerfilesCad(
            e instanceof Error
              ? e.message
              : "No se pudieron cargar los perfiles CAD.",
          );
        }
      })
      .finally(() => {
        if (vivo) setCargandoCad(false);
      });
    return () => {
      vivo = false;
    };
  }, [open, conCopiado, conCad]);

  const formatosHojas = React.useMemo(
    () =>
      papeles.flatMap((p) =>
        p.gramajes.flatMap((g) => tamanosProducibles(p, g, tamanosOfrecidos)),
      ),
    [papeles, tamanosOfrecidos],
  );

  // Al cerrar, limpiar el estado (así reabrir para "agregar" empieza en blanco).
  React.useEffect(() => {
    if (open) return;
    setDocs([]);
    setTab("HOJAS");
    setGrupos({});
    setSel(new Set());
    setPreview(null);
    setPreviewError(null);
    setConfirmarSalida(false);
    setOpcionesAbiertas(new Set());
  }, [open]);

  // Edición: rehidratar la CARGA completa — cada renglón suelto es un documento,
  // cada tomo compuesto es un grupo con sus sub-documentos. Así el precio no
  // cambia por re-cotizar aislado.
  React.useEffect(() => {
    if (!open || !editItems?.length) return;
    const dims = (nombre: string, a?: number, b?: number) =>
      a && b
        ? { anchoMm: a, altoMm: b }
        : (dimsPorNombre(nombre) ?? { anchoMm: 210, altoMm: 297 });
    const nuevosDocs: DocRow[] = [];
    const nuevosGrupos: Record<string, GrupoState> = {};
    let g = 0;
    for (const it of editItems) {
      const meta = metaCentroCopiado(it.jobContext);
      if (!meta) continue;
      // El renglón de anillado se re-deriva de la terminación del doc/tomo.
      if (meta.esAnillado) continue;
      if (meta.esTomo && meta.segmentos?.length) {
        const gid = `g${g++}-${Date.now().toString(36)}`;
        nuevosGrupos[gid] = {
          juegos: meta.juegos ?? 1,
          nombre: meta.tomoNombre ?? "",
          terminaciones: meta.terminaciones ?? ["Anillado"],
          tipoAnillo: meta.tipoAnillo ?? "",
        };
        for (const [segmentoIndex, seg] of meta.segmentos.entries()) {
          const tn = seg.tamano ?? "A4";
          const d = dims(tn, seg.tamanoAnchoMm, seg.tamanoAltoMm);
          nuevosDocs.push({
            id: nextId(),
            nombre: seg.nombre ?? "Documento",
            archivoNombre: seg.archivoNombre,
            paginas: Number(seg.paginasOriginales ?? seg.paginas) || 1,
            rangoPaginas: seg.rangoPaginas ?? "",
            orientacionesPaginas: seg.orientacionesPaginas,
            medidasPaginas: seg.medidasPaginas,
            modo: "HOJAS",
            paginasAuto: (seg.archivoNombre ?? seg.nombre ?? "")
              .toLowerCase()
              .endsWith(".pdf"),
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
            tipoAnillo: "",
            // Si la carga todavía no se guardó, conserva el File en memoria.
            // En cargas persistidas queda null porque el original ya vive en R2.
            file: it.archivosPendientes?.[segmentoIndex] ?? null,
            grupoId: gid,
          });
        }
      } else {
        const tn = meta.tamano ?? "A4";
        const d = dims(tn, meta.tamanoAnchoMm, meta.tamanoAltoMm);
        nuevosDocs.push({
          id: nextId(),
          nombre: meta.nombre ?? it.varianteNombre ?? "Documento",
          archivoNombre: meta.archivoNombre,
          paginas: Number(meta.paginasOriginales ?? meta.paginas) || 1,
          rangoPaginas: meta.rangoPaginas ?? "",
          orientacionesPaginas: meta.orientacionesPaginas,
          medidasPaginas: meta.medidasPaginas,
          modo: meta.modo ?? "HOJAS",
          cad: meta.cad?.cotizacion
            ? meta.cad
            : (() => {
                const contexto = it.jobContext as
                  | Record<string, unknown>
                  | undefined;
                const maquinaId = Object.entries(contexto ?? {}).find(([k]) =>
                  k.startsWith("maquinaSeleccionada_"),
                )?.[1];
                const ruta = (meta as unknown as Record<string, unknown>)
                  .rutaAlternativaId;
                const material = (meta as unknown as Record<string, unknown>)
                  .materialVarianteId;
                return maquinaId && ruta && material
                  ? {
                      ...meta.cad,
                      cotizacion: {
                        id: `${maquinaId}:${ruta}:${material}:${meta.color}`,
                        revision: "",
                      },
                    }
                  : meta.cad;
              })(),
          paginasAuto: (meta.archivoNombre ?? meta.nombre ?? "")
            .toLowerCase()
            .endsWith(".pdf"),
          tamano: tn,
          tamanoAnchoMm: d.anchoMm,
          tamanoAltoMm: d.altoMm,
          papelMateriaPrimaId: meta.papelMateriaPrimaId ?? "",
          gramaje: meta.gramaje ?? null,
          color: meta.color ?? "BN",
          faz: meta.faz ?? 1,
          cobertura: meta.cobertura ?? "alta",
          copias: Number(meta.copias) || 1,
          copiasPorPagina:
            meta.modo === "CAD" ? meta.copiasPorPagina : undefined,
          terminaciones: meta.terminaciones ?? [],
          tipoAnillo: meta.tipoAnillo ?? "",
          file: it.archivosPendientes?.[0] ?? null,
          grupoId: null,
        });
      }
    }
    setDocs(nuevosDocs);
    setTab(nuevosDocs[0]?.modo ?? "HOJAS");
    setGrupos(nuevosGrupos);
  }, [open, editItems]);

  // Cerrar: si hay carga, confirmar para no perderla.
  const intentarCerrar = React.useCallback(() => {
    if (guardando || leyendo) return;
    if (docs.length > 0) setConfirmarSalida(true);
    else onOpenChange(false);
  }, [docs.length, onOpenChange, guardando, leyendo]);

  // Invalida también requests en vuelo si un rango queda incompleto.
  React.useEffect(() => {
    const seq = ++previewSeq.current;
    setPreview(null);
    setPreviewError(null);
    setCotizando(false);
    if (!open) return;
    if (errorPlan) {
      setPreviewError(errorPlan);
      return;
    }
    if (docs.length === 0) {
      setPreview(null);
      return;
    }
    // No cotizar si alguna fila está incompleta (sin papel o sin páginas): las
    // manuales / no-PDF arrancan en 0 y las tiene que completar el usuario.
    const listos = docs.every(
      (d) => !faltaConfiguracion(d) && !seleccionDe(d).error,
    );
    if (!listos) {
      setPreview(null);
      return;
    }
    setCotizando(true);
    const handle = setTimeout(() => {
      void cotizarCentroCopiado({
        clienteId: clienteId || undefined,
        documentos: docs.map((d) => ({
          id: d.id,
          nombre: d.nombre.trim() || undefined,
          archivoNombre: d.file?.name ?? d.archivoNombre,
          ...paginasParaCotizar(d),
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
          tipoAnillo: d.tipoAnillo || undefined,
          grupoId: d.grupoId,
        })),
        grupos: Object.entries(grupos).map(([id, g]) => ({
          id,
          juegos: g.juegos,
          nombre: g.nombre.trim() || undefined,
          terminaciones: g.terminaciones,
          tipoAnillo: g.tipoAnillo || undefined,
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
        })
        .finally(() => {
          if (seq === previewSeq.current) setCotizando(false);
        });
    }, 350);
    return () => clearTimeout(handle);
  }, [open, docs, grupos, clienteId, cotizarCentroCopiado, errorPlan]);

  const agregarDocs = React.useCallback(
    (
      nuevos: {
        nombre: string;
        paginas: number;
        paginasAuto: boolean;
        orientacionesPaginas?: OrientacionPagina[];
        medidasPaginas?: MedidaPagina[];
        file?: File | null;
      }[],
    ) => {
      const filas: DocRow[] = nuevos.flatMap((n): DocRow[] => {
        const esCad =
          n.paginasAuto &&
          !!n.medidasPaginas?.length &&
          (tab === "CAD" ||
            (formatosHojas.length > 0 &&
              sugerirCad(n.medidasPaginas, formatosHojas)));
        if (esCad && !conCad) {
          toast.error(
            `${n.nombre}: el tamaño corresponde a Planos CAD, que no está incluido en el plan. No se agregó ni se redujo el archivo.`,
          );
          return [];
        }
        const base: DocRow = {
          id: nextId(),
          modo: "HOJAS",
          medidasPaginas: n.medidasPaginas,
          nombre: n.nombre,
          paginas: n.paginas,
          rangoPaginas: "",
          paginasAuto: n.paginasAuto,
          orientacionesPaginas: n.orientacionesPaginas,
          ...defaults,
          cobertura: "alta",
          terminaciones: [],
          tipoAnillo: "",
          file: n.file ?? null,
          grupoId: null,
        };
        if (!esCad) return [base];
        const perfil =
          tab === "CAD"
            ? perfilCadDefault
            : perfilCadPreferido(perfilesCad, defaults.color);
        return [
          {
            ...base,
            color: tab === "CAD" ? cadDefaults.color : defaults.color,
            copias: tab === "CAD" ? cadDefaults.copias : defaults.copias,
            ...aplicarPerfilCad(base, perfil),
          },
        ];
      });
      setDocs((prev) => [...prev, ...filas]);
      const cad = filas.filter((d) => d.modo === "CAD").length;
      if (tab === "HOJAS" && cad) {
        toast.info(
          `${cad === 1 ? "1 archivo pasó" : `${cad} archivos pasaron`} a Planos CAD por su tamaño.`,
        );
        if (cad === filas.length) setTab("CAD");
      }
    },
    [
      defaults,
      tab,
      formatosHojas,
      perfilesCad,
      perfilCadDefault,
      cadDefaults,
      conCad,
    ],
  );

  const onArchivos = React.useCallback(
    async (files: FileList | File[]) => {
      // Sólo el PDF se auto-lee; DOC/Excel quedan en 0 para
      // cargar a mano, pero el archivo igual queda asociado a la fila (para R2).
      if (leyendo || guardando || cargandoHojas || cargandoCad) return;
      const lista = Array.from(files).filter(
        (file) => tab !== "CAD" || file.name.toLowerCase().endsWith(".pdf"),
      );
      if (lista.length < files.length)
        toast.error(
          "Planos CAD admite archivos PDF. Cargá Word o Excel en Documentos.",
        );
      if (!lista.length) return;
      setLeyendo(true);
      try {
        const lecturas = await leerMedidasPdf(lista);
        // leerMedidasPdf preserva el orden ⇒ lecturas[i] ↔ lista[i].
        if (tab === "CAD" && lecturas.some((l) => !l.ok))
          toast.error(
            "No se pudieron leer algunos PDF. Revisá que sean válidos y no estén protegidos.",
          );
        const nuevos = lecturas.map((l, i) =>
          l.ok
            ? {
                nombre: l.archivoNombre,
                paginas: l.paginas[0]?.totalPaginas ?? 1,
                paginasAuto: true,
                orientacionesPaginas: l.paginas.map((p) => p.orientacion),
                medidasPaginas: l.paginas.map(
                  (p) =>
                    p.medidaVisible ?? { anchoMm: p.anchoMm, altoMm: p.altoMm },
                ),
                file: lista[i] ?? null,
              }
            : {
                nombre: l.archivoNombre,
                paginas: 0,
                paginasAuto: false,
                file: lista[i] ?? null,
              },
        );
        agregarDocs(
          tab === "CAD" ? nuevos.filter((n) => n.paginasAuto) : nuevos,
        );
      } finally {
        setLeyendo(false);
      }
    },
    [agregarDocs, leyendo, guardando, cargandoHojas, cargandoCad, tab],
  );

  const agregarFilaManual = React.useCallback(() => {
    agregarDocs([{ nombre: "", paginas: 0, paginasAuto: false, file: null }]);
  }, [agregarDocs]);

  const aplicarATodos = React.useCallback(() => {
    setDocs((prev) =>
      prev.map((d) => {
        if (d.modo !== tab) return d;
        if (tab === "CAD")
          return {
            ...d,
            ...aplicarPerfilCad(d, perfilCadDefault),
            color: cadDefaults.color,
            copias: cadDefaults.copias,
            copiasPorPagina: d.copiasPorPagina?.map((p) => ({
              ...p,
              copias: cadDefaults.copias,
            })),
          };
        // El tamaño default puede no ser producible con el papel default de la
        // fila: se resuelve al primero producible si hace falta.
        const t = resolverTamano(
          defaults.papelMateriaPrimaId,
          defaults.gramaje,
          defaults.tamano,
        ) ?? {
          tamano: d.tamano,
          tamanoAnchoMm: d.tamanoAnchoMm,
          tamanoAltoMm: d.tamanoAltoMm,
        };
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
  }, [defaults, resolverTamano, tab, perfilCadDefault, cadDefaults]);

  const editar = (id: string, patch: Partial<DocRow>) =>
    setDocs((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));

  const cambiarModo = (d: DocRow, modo: DocRow["modo"]) => {
    if (modo === "CAD" && !conCad) return;
    if (modo === "HOJAS" && d.copiasPorPagina) return;
    setTab(modo);
    if (modo === "CAD") {
      editar(
        d.id,
        aplicarPerfilCad(d, perfilCadPreferido(perfilesCad, d.color)),
      );
      setSel((prev) => {
        const next = new Set(prev);
        next.delete(d.id);
        return next;
      });
    } else
      editar(d.id, {
        modo: "HOJAS",
        cad: undefined,
        copiasPorPagina: undefined,
        ...defaults,
        copias: d.copias,
        color: d.color,
      });
  };
  const cambiarColorCad = (d: DocRow, color: ColorDoc) => {
    const actual = perfilesCad.find((p) => p.id === d.cad?.cotizacion?.id);
    const mismaReceta = actual
      ? perfilesCad.filter(
          (p) =>
            p.maquinaId === actual.maquinaId &&
            p.rutaAlternativaId === actual.rutaAlternativaId &&
            p.materialVarianteId === actual.materialVarianteId,
        )
      : perfilesCad;
    editar(d.id, {
      ...aplicarPerfilCad(d, perfilCadPreferido(mismaReceta, color)),
      color,
    });
  };

  // Cambiar el tamaño de una fila: setea nombre + medidas del formato elegido.
  const cambiarTamano = (
    id: string,
    nombre: string,
    lista: FormatoTamano[],
  ) => {
    const f = lista.find((x) => x.nombre === nombre);
    if (!f) return;
    editar(id, {
      tamano: f.nombre,
      tamanoAnchoMm: f.anchoMm,
      tamanoAltoMm: f.altoMm,
    });
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
  const cambiarGramaje = (
    id: string,
    papelId: string,
    gramaje: number,
    actual: string,
  ) => {
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
    if (
      !conTerminaciones ||
      sel.size < 2 ||
      docs.some((d) => sel.has(d.id) && d.modo === "CAD")
    )
      return;
    const gid = `g${Date.now().toString(36)}`;
    // Un tomo nace Anillado (si el backend lo ofrece); el usuario puede cambiarlo.
    const termIni = terminacionesDisp.includes("Anillado") ? ["Anillado"] : [];
    setGrupos((prev) => ({
      ...prev,
      [gid]: {
        juegos: 1,
        nombre: "",
        terminaciones: termIni,
        tipoAnillo: tiposAnilloDisp[0]?.value ?? "",
      },
    }));
    setDocs((prev) =>
      prev.map((d) => (sel.has(d.id) ? { ...d, grupoId: gid } : d)),
    );
    setSel(new Set());
  }, [sel, docs, terminacionesDisp, tiposAnilloDisp, conTerminaciones]);

  const desagrupar = (gid: string) => {
    setDocs((prev) =>
      prev.map((d) => (d.grupoId === gid ? { ...d, grupoId: null } : d)),
    );
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

  // Etiqueta legible del tipo de anillo (de las opciones del backend).
  const labelTipoAnillo = (v: string) =>
    tiposAnilloDisp.find((t) => t.value === v)?.label ??
    (v ? v.replaceAll("_", " ") : "Anillado");

  const previewDoc = (id: string) =>
    preview?.documentos.find((d) => d.id === id);
  const subtotalImpresionDoc = (id: string) => {
    const p = previewDoc(id);
    if (!p) return null;
    const anillado = p.anillado && !p.anillado.error ? p.anillado.subtotal : 0;
    return Math.max(0, p.subtotal - anillado);
  };
  const errorDoc = (id: string) => previewDoc(id)?.error ?? null;
  // Precio (neto) por hoja física: le sirve al comercial para tenerlo claro. El
  // El backend devuelve el total combinado y el incremental del anillado. Para
  // la UI se resta ese incremental y se muestran dos conceptos auditables.
  const precioHojaDoc = (id: string) => {
    const p = previewDoc(id);
    if (!p || p.error || !p.hojas) return null;
    return (subtotalImpresionDoc(id) ?? 0) / p.hojas;
  };
  const fmtHoja = (n: number) =>
    "$" +
    (Math.round(n * 100) / 100).toLocaleString("es-AR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const agregar = React.useCallback(async () => {
    if (errorPlan) {
      toast.error(errorPlan);
      return;
    }
    if (docs.length === 0) return;
    if (guardando || leyendo) return;
    if (docs.some((d) => seleccionDe(d).error || faltaConfiguracion(d))) {
      toast.error(
        "Revisá las páginas, los rangos y el papel de todas las filas.",
      );
      return;
    }
    setGuardando(true);
    try {
      const r = await construirItemsCentroCopiado({
        clienteId: clienteId || undefined,
        documentos: docs.map((d) => ({
          id: d.id,
          nombre: d.nombre.trim() || undefined,
          archivoNombre: d.file?.name ?? d.archivoNombre,
          ...paginasParaCotizar(d),
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
          tipoAnillo: d.tipoAnillo || undefined,
          grupoId: d.grupoId,
        })),
        grupos: Object.entries(grupos).map(([id, g]) => ({
          id,
          juegos: g.juegos,
          nombre: g.nombre.trim() || undefined,
          terminaciones: g.terminaciones,
          tipoAnillo: g.tipoAnillo || undefined,
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
      if (onAgregar(items) === false) return;
      toast.success(
        `${items.length} renglón(es) agregados desde el centro de copiado.`,
      );
      // Reset.
      setDocs([]);
      setGrupos({});
      setSel(new Set());
      setPreview(null);
      onOpenChange(false);
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : "No se pudieron agregar los renglones.",
      );
    } finally {
      setGuardando(false);
    }
  }, [
    docs,
    grupos,
    errorPlan,
    clienteId,
    onAgregar,
    onOpenChange,
    construirItemsCentroCopiado,
    guardando,
    leyendo,
  ]);

  if (!open) return null;

  const t = preview?.totales;
  const cantidades = docs.reduce(
    (total, doc) => {
      if (doc.modo === "CAD") {
        const cantidad = cantidadImpresionesCad(doc);
        return {
          carillas: total.carillas + cantidad,
          hojas: total.hojas + cantidad,
        };
      }
      const paginas = seleccionDe(doc).paginas;
      const copias = doc.grupoId
        ? (grupos[doc.grupoId]?.juegos ?? 1)
        : doc.copias;
      return {
        carillas: total.carillas + paginas * copias,
        hojas: total.hojas + Math.ceil(paginas / doc.faz) * copias,
      };
    },
    { carillas: 0, hojas: 0 },
  );
  const anilladoNeto = preview
    ? [
        ...preview.documentos.map((documento) => documento.anillado),
        ...preview.grupos.map((grupo) => grupo.anillado),
      ].reduce(
        (total, anillado) =>
          total + (anillado && !anillado.error ? anillado.subtotal : 0),
        0,
      )
    : 0;
  const impresionNeto = Math.max(0, (t?.subtotal ?? 0) - anilladoNeto);
  // Filas incompletas: sin páginas (manuales / no-PDF sin cargar) o sin papel.
  const incompletos = docs.filter(
    (d) => !!seleccionDe(d).error || faltaConfiguracion(d),
  ).length;
  const tieneErroresCotizacion =
    !!previewError ||
    !!preview?.documentos.some((d) => d.error || d.anillado?.error) ||
    !!preview?.grupos.some((g) => g.error || g.anillado?.error);
  // Orden de render: agrupados juntos por grupoId, sueltos después.
  const grupoIds = Array.from(
    new Set(docs.map((d) => d.grupoId).filter((g): g is string => !!g)),
  );
  const docsVisibles = docs.filter((d) => d.modo === tab);
  const sueltos = docsVisibles.filter((d) => !d.grupoId);
  const avisoTab = (modo: DocRow["modo"]) =>
    docs.some(
      (d) =>
        d.modo === modo &&
        (faltaConfiguracion(d) || seleccionDe(d).error || errorDoc(d.id)),
    )
      ? "Revisar archivos"
      : undefined;
  const papelOptions = papeles.map((p) => ({
    value: p.materiaPrimaId,
    label: p.nombre,
  }));

  const renderFila = (d: DocRow, index: number, enGrupo: boolean) => {
    const seleccion = seleccionDe(d);
    const esCad = d.modo === "CAD";
    const desglosado = esCad && d.copiasPorPagina !== undefined;
    const abrirPaginas = () =>
      setOpcionesAbiertas((prev) => new Set(prev).add(d.id));
    const medidas = medidasSeleccionadas(d.medidasPaginas, d.rangoPaginas);
    const perfilCad = perfilesCad.find((p) => p.id === d.cad?.cotizacion?.id);
    const perfilCadCambio =
      esCad && perfilCad && perfilCad.revision !== d.cad?.cotizacion?.revision;
    const geometriaCad = esCad
      ? paginasCad(d.medidasPaginas, d.rangoPaginas, perfilCad)
      : [];
    const errorGeometria = geometriaCad.find((p) => p.error);
    const orientacion = resumirOrientaciones(
      orientacionesSeleccionadas(d.orientacionesPaginas, d.rangoPaginas),
    );
    const tieneArchivo = !!(d.file || d.archivoNombre);
    const gramajes = gramajesDe(d.papelMateriaPrimaId);
    const opciones = opcionesAbiertas.has(d.id);
    const anillado = !enGrupo ? previewDoc(d.id)?.anillado : null;
    const error =
      (errorGeometria
        ? `Página ${errorGeometria.pagina}: ${errorGeometria.error}`
        : null) ||
      errorDoc(d.id) ||
      anillado?.error;
    const nombre = d.nombre || `Documento ${index + 1}`;
    return (
      <React.Fragment key={d.id}>
        <tr
          aria-label={`Documento ${index + 1}`}
          className={cn(s.documentRow, enGrupo && s.rowGrupo)}
          data-selected={sel.has(d.id) || undefined}
        >
          <td>
            {!enGrupo ? (
              <input
                type="checkbox"
                className={s.chk}
                checked={sel.has(d.id)}
                disabled={esCad || !conTerminaciones}
                onChange={() => toggleSel(d.id)}
                aria-label={`Seleccionar ${nombre}`}
              />
            ) : (
              <Layers className={s.grupoIcon} aria-hidden="true" />
            )}
          </td>
          <td>
            <input
              type="text"
              value={d.nombre}
              onChange={(e) => editar(d.id, { nombre: e.target.value })}
              placeholder="Nombre del documento"
              className={s.docNombreInput}
              aria-label={`Nombre del documento ${index + 1}`}
              title={nombre}
            />
            <div className={s.docMeta}>
              <span className={s.docNum}>
                {String(index + 1).padStart(2, "0")}
              </span>
              {orientacion && (
                <span
                  className={s.orientacion}
                  title="Orientación de las páginas seleccionadas"
                  aria-label={`Orientación: ${ORIENTACION_PDF_LABELS[orientacion]}`}
                >
                  {ORIENTACION_PDF_LABELS[orientacion]}
                </span>
              )}
              {!esCad && (
                <span>
                  Cobertura{" "}
                  {NIVEL_COBERTURA_LABELS[
                    d.cobertura as keyof typeof NIVEL_COBERTURA_LABELS
                  ] ?? d.cobertura}
                  {enGrupo
                    ? " · del tomo"
                    : d.terminaciones.length
                      ? ` · ${d.terminaciones.join(", ")}`
                      : ""}
                </span>
              )}
              {esCad && <span>Escala 100%</span>}
              {esCad && d.paginas > 1 && !desglosado && (
                <ActionButton
                  variant="tertiary"
                  className={s.desglosar}
                  onPress={() => {
                    editar(d.id, { copiasPorPagina: [] });
                    abrirPaginas();
                  }}
                >
                  Desglosar páginas
                </ActionButton>
              )}
            </div>
          </td>
          <td>
            {tieneArchivo ? (
              <>
                <input
                  type="text"
                  value={d.rangoPaginas}
                  placeholder="Todas · ej. 1-7,9"
                  maxLength={2000}
                  onChange={(e) =>
                    editar(d.id, { rangoPaginas: e.target.value })
                  }
                  onBlur={() => {
                    if (!seleccion.error && d.rangoPaginas !== seleccion.rango)
                      editar(d.id, { rangoPaginas: seleccion.rango });
                  }}
                  aria-label={`Páginas a imprimir de ${nombre}`}
                  aria-invalid={!!seleccion.error && !!d.rangoPaginas}
                  aria-describedby={`${d.id}-rango-ayuda`}
                  className={s.rangoInput}
                  title="Ej.: 1-7,9,12-16. Vacío = todas. En orden del archivo, sin repetir."
                />
                {!d.paginasAuto && (
                  <label className={s.totalArchivo}>
                    Total del archivo{" "}
                    <input
                      aria-label={`Total de páginas de ${nombre}`}
                      type="number"
                      min={1}
                      value={d.paginas || ""}
                      placeholder="0"
                      onChange={(e) =>
                        editar(d.id, {
                          paginas: Math.max(0, Number(e.target.value) || 0),
                        })
                      }
                      className={s.inputMini}
                    />
                  </label>
                )}
                <div
                  id={`${d.id}-rango-ayuda`}
                  className={cn(s.rangoAyuda, seleccion.error && s.rangoError)}
                  aria-live="polite"
                >
                  {seleccion.error ||
                    `${seleccion.paginas} de ${d.paginas} páginas`}
                </div>
              </>
            ) : (
              <>
                <input
                  type="number"
                  min={1}
                  value={d.paginas || ""}
                  placeholder="Páginas"
                  aria-label={`Páginas de ${nombre}`}
                  onChange={(e) =>
                    editar(d.id, {
                      paginas: Math.max(0, Number(e.target.value) || 0),
                      paginasAuto: false,
                    })
                  }
                  className={cn(
                    s.inputMini,
                    s.paginasManual,
                    d.paginas < 1 && s.inputFalta,
                  )}
                />
                <span className={s.cellHint}>Carga manual</span>
              </>
            )}
          </td>
          <td>
            {enGrupo ? (
              <span className={s.delTomo} title="Se define en Juegos del tomo">
                {grupos[d.grupoId!]?.juegos ?? 1}
                <small>juegos</small>
              </span>
            ) : desglosado ? (
              <ActionButton
                variant="tertiary"
                className={s.copiasDesglosadas}
                onPress={abrirPaginas}
                aria-label={`Editar copias por página de ${nombre}`}
              >
                <strong>{cantidadImpresionesCad(d)}</strong>
                <span>Por página</span>
              </ActionButton>
            ) : (
              <input
                type="number"
                min={1}
                value={d.copias}
                aria-label={`Copias de ${nombre}`}
                onChange={(e) =>
                  editar(d.id, {
                    copias: Math.max(1, Number(e.target.value) || 1),
                  })
                }
                className={s.inputMini}
              />
            )}
          </td>
          {esCad ? (
            <td colSpan={2}>
              <SysSelect
                value={d.cad?.cotizacion?.id ?? ""}
                onChange={(id) =>
                  editar(
                    d.id,
                    aplicarPerfilCad(
                      d,
                      perfilesCad.find((p) => p.id === id),
                    ),
                  )
                }
                options={[
                  {
                    value: "",
                    label: cargandoCad
                      ? "Cargando configuraciones…"
                      : "Elegí configuración CAD",
                  },
                  ...perfilesCad
                    .filter((p) => p.color === d.color)
                    .map((p) => ({
                      value: p.id,
                      label: `${p.nombre} · ${p.materialNombre} · ${p.maquinaNombre}`,
                    })),
                ]}
                ariaLabel={`Configuración CAD de ${nombre}`}
              />
              <span className={s.cellHint}>
                {perfilCad
                  ? `Rollo ${numeroMedida(perfilCad.rollo.anchoRolloMm)} mm`
                  : "Revisá las recetas y materiales de tus plotters CAD"}
              </span>
            </td>
          ) : (
            <>
              <td>
                <SysSelect
                  value={d.papelMateriaPrimaId}
                  onChange={(v) => cambiarPapel(d.id, v, d.tamano)}
                  options={papelOptions}
                  ariaLabel={`Papel de ${nombre}`}
                />
              </td>
              <td>
                {gramajes.length > 1 ? (
                  <SysSelect
                    value={d.gramaje != null ? String(d.gramaje) : ""}
                    onChange={(v) =>
                      cambiarGramaje(
                        d.id,
                        d.papelMateriaPrimaId,
                        Number(v),
                        d.tamano,
                      )
                    }
                    options={gramajes.map((g) => ({
                      value: String(g),
                      label: `${g} g`,
                    }))}
                    ariaLabel={`Gramaje de ${nombre}`}
                  />
                ) : (
                  <span className={s.valorCelda}>
                    {d.gramaje != null ? `${d.gramaje} g` : "—"}
                  </span>
                )}
              </td>
            </>
          )}
          <td>
            {esCad ? (
              <span className={s.medidaOriginal}>
                {resumenMedidas(medidas)}
                <small>Original</small>
              </span>
            ) : (
              <SysSelect
                value={d.tamano}
                onChange={(v) =>
                  cambiarTamano(
                    d.id,
                    v,
                    tamanosDe(d.papelMateriaPrimaId, d.gramaje),
                  )
                }
                options={tamanosDe(d.papelMateriaPrimaId, d.gramaje).map(
                  (tm) => ({ value: tm.nombre, label: tm.nombre }),
                )}
                ariaLabel={`Tamaño de ${nombre}`}
                placeholder="—"
              />
            )}
          </td>
          <td>
            <SysSelect
              value={d.color}
              options={OPCIONES_COLOR}
              onChange={(v) =>
                esCad
                  ? cambiarColorCad(d, v as ColorDoc)
                  : editar(d.id, { color: v as ColorDoc })
              }
              ariaLabel={`Color de ${nombre}`}
            />
          </td>
          <td>
            {esCad ? (
              <span className={s.cellHint}>Simple</span>
            ) : (
              <SysSelect
                value={String(d.faz)}
                options={OPCIONES_FAZ}
                onChange={(v) => editar(d.id, { faz: Number(v) as FazDoc })}
                ariaLabel={`Faz de ${nombre}`}
              />
            )}
          </td>
          <td className={s.importeCell}>
            {error ? (
              <span className={s.errChip}>Sin precio</span>
            ) : subtotalImpresionDoc(d.id) != null ? (
              <>
                <strong>{fmt(subtotalImpresionDoc(d.id)!)}</strong>
                <span className={s.cellHint}>
                  {precioHojaDoc(d.id) != null
                    ? `${fmtHoja(precioHojaDoc(d.id)!)}/${esCad ? "plano" : "hoja"}`
                    : ""}
                </span>
              </>
            ) : (
              <span className={s.muted}>{cotizando ? "…" : "—"}</span>
            )}
          </td>
          <td>
            <ActionButton
              variant="tertiary"
              isIconOnly
              className={s.rowButton}
              aria-label={`Opciones de ${nombre}`}
              aria-expanded={opciones}
              aria-controls={`${d.id}-opciones`}
              title={
                esCad
                  ? "Medidas y configuración CAD"
                  : "Cobertura y terminaciones"
              }
              onPress={() =>
                setOpcionesAbiertas((prev) => {
                  const next = new Set(prev);
                  if (next.has(d.id)) next.delete(d.id);
                  else next.add(d.id);
                  return next;
                })
              }
            >
              <SlidersHorizontal aria-hidden="true" />
            </ActionButton>
          </td>
          <td>
            <ActionButton
              variant="tertiary"
              isIconOnly
              className={s.rowButton}
              onPress={() => eliminar(d.id)}
              aria-label={`Quitar ${nombre}`}
            >
              <Trash2 aria-hidden="true" />
            </ActionButton>
          </td>
        </tr>
        {(opciones ||
          error ||
          anillado ||
          perfilCadCambio ||
          (esCad && !perfilCad)) && (
          <tr className={s.detailRow}>
            <td colSpan={12}>
              {esCad && !perfilCad && (
                <p className={s.rangoError}>
                  {errorPerfilesCad ||
                    (cargandoCad
                      ? "Cargando configuraciones CAD…"
                      : "Elegí una configuración CAD del color seleccionado. Si no hay opciones, revisá las recetas y materiales de tus plotters CAD.")}
                </p>
              )}
              {perfilCadCambio && (
                <div className={s.sugerenciaCad}>
                  <span>
                    La receta o el material cambió. Actualizala para volver a
                    cotizar.
                  </span>
                  <ActionButton
                    variant="tertiary"
                    onPress={() => editar(d.id, aplicarPerfilCad(d, perfilCad))}
                  >
                    Actualizar configuración
                  </ActionButton>
                </div>
              )}
              {opciones &&
                !enGrupo &&
                (esCad || conCad) &&
                !!d.medidasPaginas?.length && (
                  <div className={s.moverArchivo}>
                    <ActionButton
                      variant="tertiary"
                      onPress={() => cambiarModo(d, esCad ? "HOJAS" : "CAD")}
                      isDisabled={desglosado}
                      title={
                        desglosado
                          ? "Unificá las copias antes de mover a Documentos."
                          : undefined
                      }
                    >
                      {esCad ? "Mover a Documentos" : "Mover a Planos CAD"}
                    </ActionButton>
                  </div>
                )}
              {opciones && esCad && (
                <DetallePaginasCad
                  key={`${d.id}-${d.rangoPaginas}`}
                  id={`${d.id}-opciones`}
                  nombre={nombre}
                  paginas={geometriaCad}
                  perfil={perfilCad}
                  copias={d.copias}
                  copiasPorPagina={d.copiasPorPagina}
                  onCopiasPagina={(pagina, copias) =>
                    editar(d.id, {
                      copiasPorPagina: [
                        ...(d.copiasPorPagina ?? []).filter(
                          (p) => p.pagina !== pagina,
                        ),
                        { pagina, copias },
                      ],
                    })
                  }
                  onUnificar={() =>
                    editar(d.id, { copiasPorPagina: undefined })
                  }
                />
              )}
              {opciones && !esCad && (
                <div className={s.rowOptions} id={`${d.id}-opciones`}>
                  <span className={s.optionsTitle}>Opciones de {nombre}</span>
                  <label className={s.campo}>
                    <span>Cobertura</span>
                    <SysSelect
                      value={d.cobertura}
                      onChange={(v) => editar(d.id, { cobertura: v })}
                      options={NIVELES_COBERTURA.map((nivel) => ({
                        value: nivel,
                        label: NIVEL_COBERTURA_LABELS[nivel],
                      }))}
                      ariaLabel={`Cobertura de ${nombre}`}
                      triggerClassName="w-[120px]"
                    />
                  </label>
                  {conTerminaciones &&
                    !enGrupo &&
                    terminacionesDisp.length > 0 && (
                      <label className={s.campo}>
                        <span>Terminaciones</span>
                        <SysMultiSelect
                          values={d.terminaciones}
                          onChange={(v) => editar(d.id, { terminaciones: v })}
                          options={terminacionesDisp.map((t) => ({
                            value: t,
                            label: t,
                          }))}
                          ariaLabel={`Terminaciones de ${nombre}`}
                          triggerClassName="w-[160px]"
                        />
                      </label>
                    )}
                  {!enGrupo &&
                    tiposAnilloDisp.length > 1 &&
                    d.terminaciones.includes("Anillado") && (
                      <label className={s.campo}>
                        <span>Tipo de anillo</span>
                        <SysSelect
                          value={d.tipoAnillo || tiposAnilloDisp[0].value}
                          onChange={(v) => editar(d.id, { tipoAnillo: v })}
                          options={tiposAnilloDisp}
                          ariaLabel={`Tipo de anillo de ${nombre}`}
                          triggerClassName="w-[150px]"
                        />
                      </label>
                    )}
                  {enGrupo && (
                    <span className={s.cellHint}>
                      Las terminaciones se definen en el tomo.
                    </span>
                  )}
                </div>
              )}
              {error ? (
                <p className={s.rowError} role="alert">
                  {error}
                </p>
              ) : (
                anillado && (
                  <div className={s.tomoAnillado}>
                    <span>
                      Anillado · {labelTipoAnillo(anillado.tipoAnillo)}
                      {anillado.diametroMm ? ` Ø${anillado.diametroMm} mm` : ""}
                    </span>
                    <strong>+ {fmt(anillado.subtotal)} sin IVA</strong>
                  </div>
                )
              )}
            </td>
          </tr>
        )}
      </React.Fragment>
    );
  };

  let idx = 0;

  // Tamaños y gramajes producibles con el papel default (para los selects de arriba).
  const defTamanos = tamanosDe(defaults.papelMateriaPrimaId, defaults.gramaje);
  const defGramajes = gramajesDe(defaults.papelMateriaPrimaId);

  return (
    <>
      <FormDialog
        isOpen={open}
        onOpenChange={(next) => {
          if (!next) intentarCerrar();
        }}
        isDismissable={!guardando && !leyendo && !confirmarSalida}
        title={
          <span className={s.modalTitle}>
            <Printer aria-hidden="true" />
            Centro de copiado
          </span>
        }
        description={
          editItems?.length
            ? "Editá los documentos, sus páginas y las opciones de impresión."
            : "Cargá archivos, elegí las páginas y prepará tu trabajo de impresión."
        }
        className={s.sheet}
      >
        <div className={s.body}>
          <fieldset disabled={guardando || leyendo} className={s.bodyFields}>
            <section className={s.cargar}>
              <div
                className={cn(s.drop, dragActive && s.dropActive)}
                aria-label={
                  tab === "CAD" ? "Agregar planos PDF" : "Agregar archivos"
                }
                aria-busy={leyendo || cargandoHojas || cargandoCad}
                aria-disabled={
                  guardando || leyendo || cargandoHojas || cargandoCad
                }
                role="button"
                tabIndex={0}
                onClick={() => {
                  if (!guardando && !leyendo && !cargandoHojas && !cargandoCad)
                    fileRef.current?.click();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    if (
                      !guardando &&
                      !leyendo &&
                      !cargandoHojas &&
                      !cargandoCad
                    )
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
                  if (e.dataTransfer.files?.length)
                    void onArchivos(e.dataTransfer.files);
                }}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept={tab === "CAD" ? ".pdf" : ".pdf,.doc,.docx,.xls,.xlsx"}
                  multiple
                  hidden
                  onChange={(e) => {
                    if (e.target.files?.length) void onArchivos(e.target.files);
                    e.target.value = "";
                  }}
                />
                <span className={s.dropIcon}>
                  <Upload aria-hidden="true" />
                </span>
                <div className={s.dropTitle}>
                  {leyendo
                    ? "Leyendo archivos…"
                    : dragActive
                      ? "Soltá los archivos acá"
                      : cargandoHojas || cargandoCad
                        ? "Cargando opciones…"
                        : tab === "CAD"
                          ? "Agregar planos PDF"
                          : "Agregar archivos"}
                </div>
                <div className={s.dropHint}>
                  {tab === "CAD"
                    ? "Arrastrá planos PDF de cualquier tamaño."
                    : conCad
                      ? "PDF, Word o Excel. Los PDF grandes pasan a CAD."
                      : "PDF, Word o Excel en los tamaños disponibles para documentos."}
                </div>
              </div>

              {tab === "CAD" ? (
                <div className={s.defaults}>
                  <div className={s.defaultsHead}>
                    <div>
                      <strong>Configuración de planos</strong>
                      <span>Tamaño original · 100% · Simple faz</span>
                    </div>
                  </div>
                  <div className={s.defaultsGrid}>
                    <label className={cn(s.campo, s.perfilDefault)}>
                      <span>Producto, papel y máquina</span>
                      <SysSelect
                        value={perfilCadDefault?.id ?? ""}
                        onChange={(perfilId) =>
                          setCadDefaults((d) => ({ ...d, perfilId }))
                        }
                        options={perfilesCad
                          .filter((p) => p.color === cadDefaults.color)
                          .map((p) => ({
                            value: p.id,
                            label: `${p.nombre} · ${p.materialNombre} · ${p.maquinaNombre}`,
                          }))}
                        ariaLabel="Configuración CAD por defecto"
                        placeholder={
                          cargandoCad
                            ? "Cargando…"
                            : "Elegí una configuración CAD"
                        }
                      />
                    </label>
                    <label className={s.campo}>
                      <span>Color</span>
                      <SysSelect
                        value={cadDefaults.color}
                        options={OPCIONES_COLOR}
                        ariaLabel="Color CAD por defecto"
                        onChange={(color) =>
                          setCadDefaults((d) => ({
                            ...d,
                            color: color as ColorDoc,
                            perfilId: "",
                          }))
                        }
                      />
                    </label>
                    <label className={cn(s.campo, s.copiasDefault)}>
                      <span>Copias</span>
                      <input
                        type="number"
                        min={1}
                        className={s.inputMini}
                        value={cadDefaults.copias}
                        onChange={(e) =>
                          setCadDefaults((d) => ({
                            ...d,
                            copias: Math.max(1, Number(e.target.value) || 1),
                          }))
                        }
                      />
                    </label>
                    <ActionButton
                      variant="outline"
                      onPress={aplicarATodos}
                      isDisabled={!docsVisibles.length || !perfilCadDefault}
                      title="Aplica la configuración y las copias a todas las páginas de los planos."
                    >
                      Aplicar a los planos
                    </ActionButton>
                  </div>
                  {!cargandoCad && !perfilCadDefault && (
                    <p className={s.configAviso}>
                      {errorPerfilesCad ||
                        "Elegí una configuración CAD. Si no hay opciones, revisá las recetas y materiales de tus plotters CAD."}
                    </p>
                  )}
                </div>
              ) : (
                <div className={s.defaults}>
                  <div className={s.defaultsHead}>
                    <div>
                      <strong>Configuración inicial</strong>
                      <span>Para los nuevos archivos</span>
                    </div>
                  </div>
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
                      />
                    </label>
                    {defGramajes.length > 1 && (
                      <label className={s.campo}>
                        <span>Gramaje</span>
                        <SysSelect
                          value={
                            defaults.gramaje != null
                              ? String(defaults.gramaje)
                              : ""
                          }
                          onChange={(v) => {
                            const g = Number(v);
                            const t = resolverTamano(
                              defaults.papelMateriaPrimaId,
                              g,
                              defaults.tamano,
                            );
                            setDefaults({
                              ...defaults,
                              gramaje: g,
                              ...(t ?? {}),
                            });
                          }}
                          options={defGramajes.map((g) => ({
                            value: String(g),
                            label: `${g} g`,
                          }))}
                          ariaLabel="Gramaje por defecto"
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
                        options={defTamanos.map((tm) => ({
                          value: tm.nombre,
                          label: tm.nombre,
                        }))}
                        ariaLabel="Tamaño por defecto"
                        placeholder="—"
                      />
                    </label>
                    <div className={s.campo}>
                      <span>Color</span>
                      <SysSelect
                        ariaLabel="Color por defecto"
                        options={OPCIONES_COLOR}
                        value={defaults.color}
                        onChange={(v) =>
                          setDefaults({ ...defaults, color: v as ColorDoc })
                        }
                      />
                    </div>
                    <div className={s.campo}>
                      <span>Faz</span>
                      <SysSelect
                        ariaLabel="Faz por defecto"
                        options={OPCIONES_FAZ}
                        value={String(defaults.faz)}
                        onChange={(v) =>
                          setDefaults({
                            ...defaults,
                            faz: Number(v) as FazDoc,
                          })
                        }
                      />
                    </div>
                    <label className={cn(s.campo, s.copiasDefault)}>
                      <span>Copias</span>
                      <input
                        type="number"
                        min={1}
                        value={defaults.copias}
                        onChange={(e) =>
                          setDefaults({
                            ...defaults,
                            copias: Math.max(1, Number(e.target.value) || 1),
                          })
                        }
                        className={s.inputMini}
                      />
                    </label>
                    <ActionButton
                      type="button"
                      variant="outline"
                      className={s.aplicarDefaults}
                      onPress={aplicarATodos}
                      isDisabled={docsVisibles.length === 0}
                    >
                      Aplicar a documentos
                    </ActionButton>
                  </div>
                </div>
              )}
            </section>

            <Tabs
              selectedKey={tab}
              onSelectionChange={(key) => setTab(key as DocRow["modo"])}
              isDisabled={guardando || leyendo}
              className={s.tabsRoot}
            >
              <section
                className={s.tablaWrap}
                onDragOver={(e) => {
                  if (e.dataTransfer.types.includes("Files"))
                    e.preventDefault();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files?.length)
                    void onArchivos(e.dataTransfer.files);
                }}
              >
                <div className={s.tablaHead}>
                  <NavigationTabList
                    label="Tipos de archivo"
                    items={[
                      {
                        id: "HOJAS",
                        label: "Documentos",
                        count: docs.filter((d) => d.modo === "HOJAS").length,
                        warning: avisoTab("HOJAS"),
                      },
                      {
                        id: "CAD",
                        label: "Planos CAD",
                        count: docs.filter((d) => d.modo === "CAD").length,
                        warning: avisoTab("CAD"),
                      },
                    ].filter(
                      (item) =>
                        item.id !== "CAD" ||
                        conCad ||
                        docs.some((d) => d.modo === "CAD"),
                    )}
                  />
                  {tab === "HOJAS" && (
                    <div className={s.tablaHeadBtns}>
                      <ActionButton
                        type="button"
                        variant="outline"
                        onPress={agregarFilaManual}
                      >
                        <Plus data-icon="inline-start" /> Fila manual
                      </ActionButton>
                      {conTerminaciones && (
                        <ActionButton
                          type="button"
                          variant="outline"
                          onPress={anillarJuntos}
                          isDisabled={
                            sel.size < 2 ||
                            !terminacionesDisp.includes("Anillado")
                          }
                          title={
                            !terminacionesDisp.includes("Anillado")
                              ? "Configurá una anilladora y anillos para crear tomos"
                              : sel.size < 2
                                ? "Seleccioná dos o más"
                                : "Anillar juntos"
                          }
                        >
                          <Layers data-icon="inline-start" />
                          Anillar juntos ({sel.size})
                        </ActionButton>
                      )}
                    </div>
                  )}
                </div>
                <Tabs.Panel id={tab} key={tab} className={s.tabPanel}>
                  {docsVisibles.length === 0 ? (
                    <Empty className={s.vacio}>
                      <EmptyHeader>
                        <EmptyMedia variant="icon">
                          <FileText />
                        </EmptyMedia>
                        <EmptyTitle>
                          {tab === "CAD"
                            ? "Cargá tus planos"
                            : "Tu trabajo empieza con un documento"}
                        </EmptyTitle>
                        <EmptyDescription>
                          {tab === "CAD"
                            ? "Arrastrá un PDF acá. Conservamos el tamaño original de cada página."
                            : "Arrastrá archivos acá o agregá una fila manual."}
                        </EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  ) : (
                    <div
                      className={s.tableScroll}
                      role="region"
                      aria-label="Documentos y opciones de impresión"
                      tabIndex={0}
                    >
                      <table
                        className={s.documentsTable}
                        aria-label={
                          tab === "CAD"
                            ? "Planos CAD del trabajo"
                            : "Documentos del trabajo"
                        }
                      >
                        <colgroup>
                          <col className={s.colCheck} />
                          <col className={s.colDocument} />
                          <col className={s.colPages} />
                          <col className={s.colCopies} />
                          <col className={s.colPaper} />
                          <col className={s.colWeight} />
                          <col className={s.colSize} />
                          <col className={s.colColor} />
                          <col className={s.colFaces} />
                          <col className={s.colPrice} />
                          <col className={s.colAction} />
                          <col className={s.colAction} />
                        </colgroup>
                        <thead>
                          <tr>
                            <th scope="col">
                              <span className="sr-only">Seleccionar</span>
                            </th>
                            <th scope="col">Documento</th>
                            <th scope="col">Páginas / rango</th>
                            <th scope="col">Copias</th>
                            {tab === "CAD" ? (
                              <th scope="col" colSpan={2}>
                                Perfil / rollo
                              </th>
                            ) : (
                              <>
                                <th scope="col">Papel</th>
                                <th scope="col">Gramaje</th>
                              </>
                            )}
                            <th scope="col">Tamaño</th>
                            <th scope="col">Color</th>
                            <th scope="col">Faz</th>
                            <th scope="col" className={s.importeCell}>
                              Importe <small>sin IVA</small>
                            </th>
                            <th
                              scope="colgroup"
                              colSpan={2}
                              className={s.actionsHead}
                            >
                              Acciones
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {(tab === "HOJAS" ? grupoIds : []).map((gid) => {
                            const miembros = docs.filter(
                              (d) => d.grupoId === gid,
                            );
                            const gprev = preview?.grupos.find(
                              (g) => g.id === gid,
                            );
                            return (
                              <React.Fragment key={gid}>
                                <tr className={s.tomoRow}>
                                  <td colSpan={12}>
                                    <div className={s.tomoHead}>
                                      <span className={s.tomoTitle}>
                                        Tomo anillado
                                      </span>
                                      <input
                                        type="text"
                                        value={grupos[gid]?.nombre ?? ""}
                                        onChange={(e) =>
                                          setGrupos((prev) => ({
                                            ...prev,
                                            [gid]: {
                                              ...prev[gid],
                                              nombre: e.target.value,
                                            },
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
                                                juegos: Math.max(
                                                  1,
                                                  Number(e.target.value) || 1,
                                                ),
                                              },
                                            }))
                                          }
                                          className={s.inputMini}
                                        />
                                      </label>
                                      {/* Terminaciones del tomo entero (un solo selector). */}
                                      {terminacionesDisp.length > 0 && (
                                        <SysMultiSelect
                                          values={
                                            grupos[gid]?.terminaciones ?? []
                                          }
                                          onChange={(v) =>
                                            setGrupos((prev) => ({
                                              ...prev,
                                              [gid]: {
                                                ...prev[gid],
                                                terminaciones: v,
                                              },
                                            }))
                                          }
                                          options={terminacionesDisp.map(
                                            (t) => ({
                                              value: t,
                                              label: t,
                                            }),
                                          )}
                                          ariaLabel="Terminaciones del tomo"
                                          triggerClassName="w-[160px]"
                                        />
                                      )}
                                      {/* Tipo de anillo del tomo: sólo si hay más de uno y anilla. */}
                                      {tiposAnilloDisp.length > 1 &&
                                        (
                                          grupos[gid]?.terminaciones ?? []
                                        ).includes("Anillado") && (
                                          <SysSelect
                                            value={
                                              grupos[gid]?.tipoAnillo ||
                                              tiposAnilloDisp[0].value
                                            }
                                            onChange={(v) =>
                                              setGrupos((prev) => ({
                                                ...prev,
                                                [gid]: {
                                                  ...prev[gid],
                                                  tipoAnillo: v,
                                                },
                                              }))
                                            }
                                            options={tiposAnilloDisp}
                                            ariaLabel="Tipo de anillo del tomo"
                                            triggerClassName="w-[150px]"
                                          />
                                        )}
                                      <span className={s.tomoMeta}>
                                        {gprev
                                          ? `${gprev.hojasPorLibro} hojas/juego`
                                          : ""}
                                      </span>
                                      <span className={s.tomoSub}>
                                        {gprev
                                          ? `Hojas ${fmt(
                                              Math.max(
                                                0,
                                                gprev.subtotal -
                                                  (gprev.anillado?.subtotal ??
                                                    0),
                                              ),
                                            )}`
                                          : "—"}
                                      </span>
                                      <ActionButton
                                        type="button"
                                        variant="tertiary"
                                        isIconOnly
                                        onPress={() => desagrupar(gid)}
                                        aria-label="Desagrupar tomo"
                                      >
                                        <Trash2 data-icon="inline-start" />
                                      </ActionButton>
                                    </div>
                                    {gprev?.anillado &&
                                      (gprev.anillado.error ? (
                                        <div className={s.tomoAnilladoWarn}>
                                          ⚠ {gprev.anillado.error} No se puede
                                          agregar hasta corregirlo.
                                        </div>
                                      ) : (
                                        <div className={s.tomoAnillado}>
                                          <span className={s.tomoAnilladoLbl}>
                                            Anillado ·{" "}
                                            {labelTipoAnillo(
                                              gprev.anillado.tipoAnillo,
                                            )}
                                            {gprev.anillado.diametroMm
                                              ? ` Ø${gprev.anillado.diametroMm} mm`
                                              : ""}
                                          </span>
                                          <span
                                            className={s.tomoAnilladoPrecio}
                                          >
                                            + {fmt(gprev.anillado.subtotal)} sin
                                            IVA
                                          </span>
                                        </div>
                                      ))}
                                  </td>
                                </tr>
                                {miembros.map((d) =>
                                  renderFila(d, idx++, true),
                                )}
                              </React.Fragment>
                            );
                          })}
                          {sueltos.map((d) => renderFila(d, idx++, false))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Tabs.Panel>
              </section>
            </Tabs>
          </fieldset>
        </div>

        {previewError && docs.length > 0 && (
          <Alert variant="destructive" className={s.errBanner}>
            <AlertDescription>
              No se pudo calcular el precio: {previewError}
            </AlertDescription>
          </Alert>
        )}
        <footer className={s.foot}>
          <div className={s.stats}>
            <div>
              <span className={s.statNum}>{t?.documentos ?? docs.length}</span>
              <span className={s.statLbl}>Archivos</span>
            </div>
            <div>
              <span className={s.statNum}>{t?.tomos ?? grupoIds.length}</span>
              <span className={s.statLbl}>Tomos</span>
            </div>
            <div>
              <span className={s.statNum}>{cantidades.carillas}</span>
              <span className={s.statLbl}>Carillas</span>
            </div>
            <div>
              <span className={s.statNum}>{cantidades.hojas}</span>
              <span className={s.statLbl}>
                {docs.some((d) => d.modo === "CAD")
                  ? "Hojas / planos"
                  : "Hojas físicas"}
              </span>
            </div>
          </div>
          <div className={s.totalBox}>
            <div className={s.totalFinal}>
              <span>Total de la carga c/IVA</span>
              <strong aria-live="polite">
                {cotizando
                  ? "…"
                  : tieneErroresCotizacion
                    ? "—"
                    : t
                      ? fmt(t.total)
                      : docs.length
                        ? "—"
                        : fmt(0)}
              </strong>
            </div>
            <div className={s.totalNetoSub}>
              {t && !tieneErroresCotizacion ? (
                <>
                  Impresión {fmt(impresionNeto)}
                  {conTerminaciones && <> · Anillado {fmt(anilladoNeto)}</>} ·
                  IVA {fmt(t.iva)}
                </>
              ) : cotizando ? (
                "Calculando precio…"
              ) : (
                ""
              )}
            </div>
          </div>
          <ActionButton
            type="button"
            onPress={() => void agregar()}
            isDisabled={
              docs.length === 0 ||
              !!errorPlan ||
              incompletos > 0 ||
              tieneErroresCotizacion ||
              guardando ||
              leyendo ||
              cotizando
            }
            title={
              errorPlan
                ? errorPlan
                : incompletos > 0
                  ? `${incompletos} fila(s) con páginas, rangos o papel por completar`
                  : tieneErroresCotizacion
                    ? "Corregí los errores de cotización antes de agregar la carga"
                    : undefined
            }
          >
            {errorPlan
              ? "Función no incluida"
              : guardando
                ? "Guardando…"
                : leyendo
                  ? "Leyendo archivos…"
                  : cotizando
                    ? "Cotizando…"
                    : incompletos > 0
                      ? `Completá ${incompletos} fila(s)`
                      : tieneErroresCotizacion
                        ? "Corregí los errores"
                        : editItems?.length
                          ? "Guardar cambios"
                          : "Agregar a la OT"}
          </ActionButton>
        </footer>
      </FormDialog>
      <FormDialog
        isOpen={confirmarSalida}
        onOpenChange={setConfirmarSalida}
        isDismissable={!guardando}
        title="¿Cerrar Centro de copiado?"
        description="Tenés documentos sin guardar en esta carga. Podés seguir editando, agregarlos a la orden o descartar los cambios."
      >
        <div className={s.confirmActions}>
          <ActionButton
            variant="tertiary"
            isDisabled={guardando}
            onPress={() => setConfirmarSalida(false)}
          >
            Seguir editando
          </ActionButton>
          <ActionButton
            variant="outline"
            isDisabled={guardando}
            onPress={() => {
              setConfirmarSalida(false);
              onOpenChange(false);
            }}
          >
            Descartar y salir
          </ActionButton>
          <ActionButton
            isDisabled={
              !!errorPlan ||
              guardando ||
              leyendo ||
              cotizando ||
              incompletos > 0 ||
              tieneErroresCotizacion
            }
            onPress={async () => {
              await agregar();
              setConfirmarSalida(false);
            }}
          >
            {guardando
              ? "Guardando…"
              : editItems?.length
                ? "Guardar cambios"
                : "Agregar a la OT"}
          </ActionButton>
        </div>
      </FormDialog>
    </>
  );
}
