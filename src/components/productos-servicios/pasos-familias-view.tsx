"use client";

/**
 * Pasos de producción — familias componibles del tenant (Etapa D).
 *
 * La vista tiene dos mitades: "Tus pasos" (las FamiliaTenant, con su ciclo
 * de vida) y el catálogo del sistema en solo-lectura. El alta es un wizard
 * de preguntas FÍSICAS (¿máquina? ¿cómo se mide el tiempo? ¿materiales?) que
 * por debajo compone una forma que el motor ya sabe costear — nunca puede
 * emitir una inválida: la valida el back con la misma puerta única.
 *
 * v1 deliberado: crear (de preset o desde cero), inhabilitar/reactivar y
 * eliminar. La edición completa de la forma llega con la ficha (patrón
 * maquinaria) en una pasada siguiente.
 */
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConfirmacionDestructiva } from "@/components/ui/confirmacion-destructiva";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { HumanSelect, type HumanSelectOption } from "@/components/ui/human-select";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api";
import { getCentrosCosto } from "@/lib/costos-api";
import { getProveedores } from "@/lib/proveedores-api";
import { categoriaFamiliaLabels, getLabel } from "@/lib/labels-humanos";
import {
  actualizarFamiliaTenant,
  crearFamiliaTenant,
  eliminarFamiliaTenant,
  getCatalogoFamilias,
  getFamiliasTenant,
  getLookupsConfigPaso,
  guardarDefaultsFamilia,
  previewCosteoFamiliaTenant,
  type LookupsConfigPaso,
} from "@/lib/productos-servicios-api";
import type {
  CatalogoFamilias,
  FamiliaListItem,
  FamiliaTenant,
  PreviewCosteoFamilia,
  UpsertFamiliaTenantInput,
} from "@/lib/productos-servicios";

import s from "./pasos-familias.module.css";

// ─────────────────────────────────────────────────────────────────────
// Estado del wizard
// ─────────────────────────────────────────────────────────────────────

type PasoWizard =
  | "arranque"
  | "quien"
  | "proveedor"
  | "maquina"
  | "maquinas-candidatas"
  | "tiempo"
  | "materiales"
  | "cantidad"
  | "activacion"
  | "centro"
  | "registro"
  | "final";

interface SlotDraft {
  /** Presente cuando el slot ya existía: se PRESERVA al guardar, porque los
   *  productos configurados referencian el material por este código. Sólo
   *  los slots nuevos generan slug. */
  codigo?: string;
  nombre: string;
  tipo: string;
  requerido: boolean;
  /** Familias de materia prima que el slot acepta. Vacío = sin filtro
   *  (el editor de rutas deja elegir cualquier material). */
  familiasMateriaPrima: string[];
}

interface FormaDraft {
  presetOrigen: string | null;
  relacionMaquina: "M-0" | "M-1" | "M-2";
  plantillasCompatibles: string[];
  modoTiempo: "T-1" | "T-2" | "T-3" | "T-4";
  slots: SlotDraft[];
  mecanismoCantidad: string;
  /** B.3.4 — superficie de acomodo cuando mecanismo = CALCULADO_POR_PASO. */
  superficie: "pliego" | "pliegos_multiples" | "rollo" | null;
  /** Variables del pedido que multiplican el trabajo del paso (caras,
   *  tipoCopia). Sin esto el paso nunca duplica por doble faz. */
  multiplicadores: string[];
  /** E.2 — bifurcación inicial: quién hace el paso. La rama proveedor
   *  salta máquina/tiempo/materiales/cantidad/estación/registro. */
  quienLoHace: "taller" | "proveedor";
  proveedorDefaultId: string | null;
  fuenteCostoDefault: "matriz" | "tarifa_magnitud" | "fijo";
  plazoDefaultDias: string;
  /** E.1 — defaults declarados del paso (strings porque son inputs;
   *  vacío = sin default). Se guardan en FamiliaPasoDefaults. */
  centroCostoDefaultId: string | null;
  ritmoDefaultHora: string;
  tiempoFijoDefaultMin: string;
  demasiaDefaultMm: string;
  modoActivacionDefault: string;
  activacionForzada: boolean;
  modoRegistro: "cronometro" | "solo_completar";
  categoria: string;
  nombre: string;
  descripcion: string;
}

/** Familias de materia prima del sistema, en idioma de taller. El slot
 *  filtra por familia; las subfamilias siguen siendo del catálogo. */
const FAMILIAS_MATERIAL = [
  { value: "SUSTRATO", label: "Sustratos (papel, vinilo, lona, rígidos)" },
  { value: "TINTA_COLORANTE", label: "Tintas y colorantes" },
  { value: "TRANSFERENCIA_LAMINACION", label: "Films de transfer y laminado" },
  { value: "TERMINACION_EDITORIAL", label: "Terminación editorial (anillos, espirales)" },
  { value: "HERRAJE_ACCESORIO", label: "Herrajes y accesorios (ojales, argollas)" },
  { value: "MAGNETICO_FIJACION", label: "Magnéticos y fijación" },
  { value: "ADHESIVO_TECNICO", label: "Adhesivos técnicos" },
  { value: "QUIMICO_AUXILIAR", label: "Químicos auxiliares" },
  { value: "PINTURA_RECUBRIMIENTO", label: "Pinturas y recubrimientos" },
  { value: "METAL_ESTRUCTURA", label: "Metales y estructura" },
  { value: "POP_EXHIBIDOR", label: "POP y exhibidores" },
  { value: "PACKING_INSTALACION", label: "Packing e instalación" },
  { value: "ELECTRONICA_CARTELERIA", label: "Electrónica de cartelería" },
  { value: "NEON_LUMINARIA", label: "Neón y luminarias" },
  { value: "ADITIVA_3D", label: "Insumos de impresión 3D" },
  { value: "SELLOS", label: "Sellos" },
];

/** Multiplicadores que el tenant puede declarar. Son los dos que el
 *  cotizador SIEMPRE carga en el JobContext (`caras` y `tipoCopia`), así que
 *  siempre tienen un valor real con el que multiplicar. Los otros que usa el
 *  catálogo (hojasPorLibro, perforacionesPorPieza…) dependen de params
 *  propios de esas familias y no se ofrecen: elegirlos acá no multiplicaría
 *  nada. */
const MULTIPLICADORES_DISPONIBLES = [
  {
    value: "caras",
    titulo: "Las caras (simple o doble faz)",
    desc: "Una lona impresa de los dos lados lleva el doble de trabajo que de un lado.",
  },
  {
    value: "tipoCopia",
    titulo: "El tipo de copia (original, duplicado…)",
    desc: "Un talonario por triplicado repite el paso en cada juego de copias.",
  },
];

const DRAFT_INICIAL: FormaDraft = {
  presetOrigen: null,
  relacionMaquina: "M-0",
  plantillasCompatibles: [],
  modoTiempo: "T-2",
  slots: [],
  mecanismoCantidad: "DIRECT_FROM_JOBCONTEXT",
  superficie: null,
  multiplicadores: [],
  quienLoHace: "taller",
  proveedorDefaultId: null,
  fuenteCostoDefault: "matriz",
  plazoDefaultDias: "",
  centroCostoDefaultId: null,
  ritmoDefaultHora: "",
  tiempoFijoDefaultMin: "",
  demasiaDefaultMm: "",
  modoActivacionDefault: "OPCIONAL",
  activacionForzada: false,
  modoRegistro: "cronometro",
  categoria: "operaciones_manuales",
  nombre: "",
  descripcion: "",
};

function slugSlot(nombre: string): string {
  return (
    nombre
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "insumo"
  );
}

/** Las máquinas del taller agrupadas por plantilla: la compatibilidad de la
 *  familia es por TIPO, así que la card de selección también (elegir una
 *  máquina puntual marcaba "de sorpresa" a todas sus hermanas de tipo). */
function agruparPorPlantilla(
  maquinas: Array<{ nombre: string; plantilla: string }>,
): Array<{ plantilla: string; maquinas: string[] }> {
  const porPlantilla = new Map<string, string[]>();
  for (const m of maquinas) {
    const arr = porPlantilla.get(m.plantilla) ?? [];
    arr.push(m.nombre);
    porPlantilla.set(m.plantilla, arr);
  }
  return Array.from(porPlantilla.entries()).map(([plantilla, nombres]) => ({
    plantilla,
    maquinas: nombres,
  }));
}

/** 100 → "1h 40m", 45 → "45 min": el resultado del preview habla en tiempo
 *  de taller, no en minutos crudos. */
function formatearMinutos(min: number): string {
  if (min < 60) return `${min} min`;
  const horas = Math.floor(min / 60);
  const resto = min % 60;
  return resto > 0 ? `${horas}h ${resto}m` : `${horas}h`;
}

function humanizarPlantilla(plantilla: string): string {
  const texto = plantilla.replaceAll("_", " ").toLowerCase();
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function numeroONull(texto: string): number | null {
  const n = Number(texto);
  return texto.trim() !== "" && Number.isFinite(n) && n > 0 ? n : null;
}

function draftAInput(d: FormaDraft): UpsertFamiliaTenantInput {
  // E.2 — un paso de proveedor no tiene máquina, tiempo interno, materiales
  // propios ni estación: forma canónica mínima + defaults de tercerización.
  // La GRILLA de precios se carga por producto, como siempre.
  if (d.quienLoHace === "proveedor") {
    return {
      nombre: d.nombre.trim(),
      descripcion: d.descripcion.trim() || undefined,
      categoria: d.categoria,
      relacionMaquina: ["M-0"],
      modosTiempo: ["T-4"],
      mecanismosCantidad: ["DIRECT_FROM_JOBCONTEXT"],
      modoActivacionDefault: d.modoActivacionDefault,
      ...(d.activacionForzada
        ? { modosActivacion: [d.modoActivacionDefault] }
        : {}),
      slots: [],
      plantillasCompatibles: [],
      modoRegistro: "solo_completar",
      presetOrigen: d.presetOrigen ?? undefined,
      defaults: {
        tercerizado: true,
        proveedorId: d.proveedorDefaultId,
        fuenteCostoTercerizado: d.fuenteCostoDefault,
        plazoProveedorDias: numeroONull(d.plazoDefaultDias),
      },
    };
  }
  const conMaquina = d.relacionMaquina !== "M-0";
  return {
    nombre: d.nombre.trim(),
    descripcion: d.descripcion.trim() || undefined,
    categoria: d.categoria,
    relacionMaquina: [d.relacionMaquina],
    modosTiempo: [d.modoTiempo],
    mecanismosCantidad: [d.mecanismoCantidad],
    multiplicadores: d.multiplicadores,
    // B.3.4 — acomoda piezas: la superficie viaja con la forma; presente
    // ⇔ CALCULADO_POR_PASO (el validador exige la coherencia).
    nestingConfig:
      d.mecanismoCantidad === "CALCULADO_POR_PASO" && d.superficie
        ? { superficie: d.superficie }
        : null,
    modoActivacionDefault: d.modoActivacionDefault,
    // Fijado = la familia sólo soporta ese modo y el editor del producto no
    // ofrece otros. Sin fijar, el service completa los cuatro universales.
    ...(d.activacionForzada
      ? { modosActivacion: [d.modoActivacionDefault] }
      : {}),
    slots: d.slots.map((slot) => ({
      codigo: slot.codigo ?? slugSlot(slot.nombre),
      nombre: slot.nombre.trim(),
      tipo: slot.tipo,
      requerido: slot.requerido,
      // Sin familias marcadas no se manda el filtro: el slot acepta todo.
      ...(slot.familiasMateriaPrima.length > 0
        ? {
            compatibilidadMaterial: {
              familiasMateriaPrima: slot.familiasMateriaPrima,
            },
          }
        : {}),
    })),
    plantillasCompatibles: conMaquina ? d.plantillasCompatibles : [],
    modoRegistro: d.modoRegistro,
    presetOrigen: d.presetOrigen ?? undefined,
    // E.1 — las respuestas del wizard quedan como defaults del paso
    // (la familia sugiere, el producto pisa).
    defaults: {
      centroCostoId: d.centroCostoDefaultId,
      productividadHora:
        d.modoTiempo === "T-2" ? numeroONull(d.ritmoDefaultHora) : null,
      tiempoFijoMin:
        d.modoTiempo === "T-1" ? numeroONull(d.tiempoFijoDefaultMin) : null,
      demasiaMm:
        d.mecanismoCantidad === "CALCULADO_POR_PASO"
          ? numeroONull(d.demasiaDefaultMm)
          : null,
    },
  };
}

/** Precarga desde un preset del catálogo: forma entera, nombre libre. */
function draftDesdePreset(f: FamiliaListItem): FormaDraft {
  const relacion = (f.relacionMaquinaSoportada[0] ?? "M-0") as
    | "M-0"
    | "M-1"
    | "M-2";
  return {
    presetOrigen: f.codigo,
    relacionMaquina: relacion,
    plantillasCompatibles: [],
    modoTiempo: (f.modosTiempoSoportados[0] ?? "T-2") as FormaDraft["modoTiempo"],
    slots: f.slotsRequeridos
      .filter((slot) => slot.tipo !== "CONSUMIBLE_MAQUINA")
      .map((slot) => ({
        nombre: slot.nombre,
        tipo: slot.tipo,
        requerido: slot.requerido,
        // El clon hereda el filtro de materiales del catálogo.
        familiasMateriaPrima: [
          ...(slot.compatibilidadMaterial?.familiasMateriaPrima ?? []),
        ],
      })),
    mecanismoCantidad:
      f.mecanismosCantidadSoportados.find(
        (m) => m !== "CALCULADO_POR_PASO",
      ) ?? "DIRECT_FROM_JOBCONTEXT",
    superficie: null,
    // El clon hereda los multiplicadores del preset: antes se perdían y
    // el paso nuevo nunca podía duplicar por doble faz.
    multiplicadores: [...(f.multiplicadoresSoportados ?? [])],
    quienLoHace: "taller",
    proveedorDefaultId: null,
    fuenteCostoDefault: "matriz",
    plazoDefaultDias: "",
    centroCostoDefaultId: null,
    ritmoDefaultHora: "",
    tiempoFijoDefaultMin: "",
    demasiaDefaultMm: "",
    modoActivacionDefault: f.modoActivacionDefault,
    activacionForzada: false,
    modoRegistro: "cronometro",
    categoria: f.categoria,
    nombre: "",
    descripcion: f.descripcion ?? "",
  };
}

/** Draft desde una familia EXISTENTE (modo edición): forma entera con los
 *  códigos de slot preservados. */
function draftDesdeFamilia(f: FamiliaTenant): FormaDraft {
  const relacion = (f.relacionMaquina[0] ?? "M-0") as "M-0" | "M-1" | "M-2";
  return {
    presetOrigen: f.presetOrigen,
    relacionMaquina: relacion,
    plantillasCompatibles: f.plantillasCompatibles,
    modoTiempo: (f.modosTiempo[0] ?? "T-2") as FormaDraft["modoTiempo"],
    slots: f.slots.map((slot) => ({
      codigo: slot.codigo,
      nombre: slot.nombre,
      tipo: slot.tipo,
      requerido: slot.requerido,
      familiasMateriaPrima: [
        ...(slot.compatibilidadMaterial?.familiasMateriaPrima ?? []),
      ],
    })),
    mecanismoCantidad: f.mecanismosCantidad.includes("CALCULADO_POR_PASO")
      ? "CALCULADO_POR_PASO"
      : (f.mecanismosCantidad[0] ?? "DIRECT_FROM_JOBCONTEXT"),
    superficie: (f.nestingConfigJson?.superficie ?? null) as
      | "pliego"
      | "pliegos_multiples"
      | "rollo"
      | null,
    multiplicadores: [...(f.multiplicadores ?? [])],
    quienLoHace: f.defaults?.tercerizado ? "proveedor" : "taller",
    proveedorDefaultId: f.defaults?.proveedorId ?? null,
    fuenteCostoDefault: (f.defaults?.fuenteCostoTercerizado ?? "matriz") as
      | "matriz"
      | "tarifa_magnitud"
      | "fijo",
    plazoDefaultDias:
      f.defaults?.plazoProveedorDias != null
        ? String(f.defaults.plazoProveedorDias)
        : "",
    centroCostoDefaultId: f.defaults?.centroCostoId ?? null,
    ritmoDefaultHora:
      f.defaults?.productividadHora != null
        ? String(f.defaults.productividadHora)
        : "",
    tiempoFijoDefaultMin:
      f.defaults?.tiempoFijoMin != null
        ? String(f.defaults.tiempoFijoMin)
        : "",
    demasiaDefaultMm:
      f.defaults?.demasiaMm != null ? String(f.defaults.demasiaMm) : "",
    modoActivacionDefault: f.modoActivacionDefault,
    activacionForzada: f.modosActivacion.length === 1,
    modoRegistro: (f.modoRegistro ?? "cronometro") as FormaDraft["modoRegistro"],
    categoria: f.categoria,
    nombre: f.nombre,
    descripcion: f.descripcion ?? "",
  };
}

// ─────────────────────────────────────────────────────────────────────
// Vista principal
// ─────────────────────────────────────────────────────────────────────

export function PasosFamiliasView() {
  const [familias, setFamilias] = React.useState<FamiliaTenant[]>([]);
  const [catalogo, setCatalogo] = React.useState<CatalogoFamilias | null>(null);
  const [centros, setCentros] = React.useState<
    Array<{ id: string; nombre: string }>
  >([]);
  const [proveedores, setProveedores] = React.useState<
    Array<{ id: string; nombre: string }>
  >([]);
  const [cargando, setCargando] = React.useState(true);
  const [wizardAbierto, setWizardAbierto] = React.useState(false);
  const [aEditar, setAEditar] = React.useState<FamiliaTenant | null>(null);
  const [aEliminar, setAEliminar] = React.useState<FamiliaTenant | null>(null);
  // E.1 — familia del SISTEMA cuyos defaults se están configurando.
  const [defaultsDe, setDefaultsDe] = React.useState<FamiliaListItem | null>(
    null,
  );

  const recargar = React.useCallback(async () => {
    const filas = await getFamiliasTenant();
    setFamilias(filas);
  }, []);

  React.useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const [filas, cat, ccs, provs] = await Promise.all([
          getFamiliasTenant(),
          getCatalogoFamilias(),
          getCentrosCosto(),
          getProveedores().catch(() => []),
        ]);
        if (!vivo) return;
        setFamilias(filas);
        setCatalogo(cat);
        setCentros(
          (ccs as Array<{ id: string; nombre: string }>).map((c) => ({
            id: c.id,
            nombre: c.nombre,
          })),
        );
        setProveedores(
          (provs as Array<{ id: string; nombre: string }>).map((pv) => ({
            id: pv.id,
            nombre: pv.nombre,
          })),
        );
      } catch {
        if (vivo) toast.error("No se pudieron cargar los pasos.");
      } finally {
        if (vivo) setCargando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  const sistema = React.useMemo(
    () =>
      (catalogo?.familias ?? []).filter(
        (f) => f.origen !== "tenant" && f.visibleEnSelector !== false,
      ),
    [catalogo],
  );

  const resumenForma = (f: FamiliaTenant): string[] => {
    const chips: string[] = [];
    if (f.defaults?.tercerizado) {
      chips.push("Tercerizado");
      return chips;
    }
    chips.push(f.relacionMaquina.includes("M-0") ? "Sin máquina" : "Con máquina");
    const tiempo = f.modosTiempo[0];
    chips.push(
      tiempo === "T-1"
        ? "Tiempo fijo"
        : tiempo === "T-2"
          ? "Productividad propia"
          : tiempo === "T-3"
            ? "Perfil de máquina"
            : "Tiempo del comercial",
    );
    if (f.slots.length > 0)
      chips.push(`${f.slots.length} material${f.slots.length > 1 ? "es" : ""}`);
    if (f.modosActivacion.length === 1) {
      const etiqueta =
        f.modosActivacion[0] === "OBLIGATORIO"
          ? "Siempre obligatorio"
          : f.modosActivacion[0] === "OPCIONAL"
            ? "Siempre opcional"
            : "Siempre condicional";
      chips.push(etiqueta);
    }
    chips.push(
      (f.modoRegistro ?? "cronometro") === "cronometro"
        ? "Cronómetro"
        : "Un click",
    );
    return chips;
  };

  const toggleActiva = async (f: FamiliaTenant) => {
    try {
      await actualizarFamiliaTenant(f.id, { activo: !f.activo });
      await recargar();
      toast.success(f.activo ? `"${f.nombre}" inhabilitado.` : `"${f.nombre}" reactivado.`);
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "No se pudo actualizar.",
      );
    }
  };

  const eliminar = async (f: FamiliaTenant) => {
    try {
      await eliminarFamiliaTenant(f.id);
      await recargar();
      toast.success(`"${f.nombre}" eliminado.`);
    } catch (error) {
      // El 409 del back explica la salida correcta (inhabilitar).
      toast.error(
        error instanceof ApiError ? error.message : "No se pudo eliminar.",
      );
    } finally {
      setAEliminar(null);
    }
  };

  return (
    <div className="content">
      <div className="page-head">
        <div className="title-block">
          <h1>Pasos de producción</h1>
          <p>
            Los tipos de paso con los que se arman las rutas: el catálogo del
            sistema más los que crea tu empresa.
          </p>
        </div>
        <Button onClick={() => setWizardAbierto(true)}>+ Nuevo paso</Button>
      </div>
      <div className={s.wrap}>

      <section className={s.seccion}>
        <div className={s.seccionHead}>
          <div>
            <div className={s.seccionTitulo}>Tus pasos</div>
            <div className={s.seccionSub}>
              Creados por tu empresa. Aparecen en el editor de rutas como
              cualquier paso del catálogo.
            </div>
          </div>
        </div>
        {cargando ? (
          <div className={s.catalogoGrid}>Cargando…</div>
        ) : familias.length === 0 ? (
          <EstadoVacio
            variant="compacto"
            titulo="Todavía no creaste pasos propios"
            descripcion="Si lo que tu taller hace no está en el catálogo —serigrafía, bordado, armado especial— crealo acá y usalo en cualquier ruta."
            cta={{ label: "Crear el primero", onClick: () => setWizardAbierto(true) }}
          />
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Forma</th>
                <th>Categoría</th>
                <th>Estado</th>
                <th className="right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {familias.map((f) => (
                <tr key={f.id} className={f.activo ? undefined : s.inactiva}>
                  <td>
                    <div className="name">{f.nombre}</div>
                    {f.descripcion ? <div className="desc">{f.descripcion}</div> : null}
                  </td>
                  <td>
                    <div className={s.forma}>
                      {resumenForma(f).map((chip) => (
                        <span key={chip} className={s.formaChip}>
                          {chip}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>{getLabel(categoriaFamiliaLabels, f.categoria).label}</td>
                  <td>
                    <span className="tag">{f.activo ? "Activo" : "Inhabilitado"}</span>
                  </td>
                  <td className="right">
                    <Button variant="ghost" size="sm" onClick={() => setAEditar(f)}>
                      Editar
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => toggleActiva(f)}>
                      {f.activo ? "Inhabilitar" : "Reactivar"}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setAEliminar(f)}>
                      Eliminar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className={s.seccion}>
        <div className={s.seccionHead}>
          <div>
            <div className={s.seccionTitulo}>Catálogo del sistema</div>
            <div className={s.seccionSub}>
              Los {sistema.length} tipos de paso que trae Grafo. No se editan;
              cualquiera sirve de punto de partida para un paso tuyo.
            </div>
          </div>
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Descripción</th>
              <th>Categoría</th>
              <th className="right">Defaults</th>
            </tr>
          </thead>
          <tbody>
            {sistema.map((f) => (
              <tr key={f.codigo}>
                <td>
                  <div className="name">{f.nombre}</div>
                </td>
                <td>
                  <div className="desc">{f.descripcion}</div>
                </td>
                <td>{getLabel(categoriaFamiliaLabels, f.categoria).label}</td>
                <td className="right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDefaultsDe(f)}
                  >
                    {f.defaults ? "Defaults ✓" : "Configurar"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {wizardAbierto || aEditar ? (
        <WizardNuevoPaso
          // key: al pasar de editar una familia a otra (o al alta), el wizard
          // se remonta con el draft correcto en vez de arrastrar estado.
          key={aEditar?.id ?? "nuevo"}
          catalogoSistema={sistema}
          centros={centros}
          proveedores={proveedores}
          editar={aEditar}
          onCerrar={() => {
            setWizardAbierto(false);
            setAEditar(null);
          }}
          onCreado={async () => {
            setWizardAbierto(false);
            setAEditar(null);
            await recargar();
          }}
        />
      ) : null}

      {defaultsDe ? (
        <DefaultsSheet
          familia={defaultsDe}
          centros={centros}
          proveedores={proveedores}
          onCerrar={() => setDefaultsDe(null)}
          onGuardado={async () => {
            setDefaultsDe(null);
            try {
              setCatalogo(await getCatalogoFamilias());
            } catch {
              /* la próxima carga lo trae */
            }
          }}
        />
      ) : null}

      <ConfirmacionDestructiva
        open={aEliminar !== null}
        onOpenChange={(open) => {
          if (!open) setAEliminar(null);
        }}
        titulo="Eliminar paso"
        nombreItem={aEliminar?.nombre}
        requiereTipear={false}
        descripcion="Sólo se puede eliminar un paso que ninguna ruta ni orden usó jamás. Si tiene historial, el sistema va a ofrecer inhabilitarlo en su lugar."
        accionLabel="Eliminar"
        onConfirmar={async () => {
          if (aEliminar) await eliminar(aEliminar);
        }}
      />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Wizard
// ─────────────────────────────────────────────────────────────────────

function WizardNuevoPaso({
  catalogoSistema,
  centros,
  proveedores,
  editar,
  onCerrar,
  onCreado,
}: {
  catalogoSistema: FamiliaListItem[];
  centros: Array<{ id: string; nombre: string }>;
  proveedores: Array<{ id: string; nombre: string }>;
  /** Familia existente: el wizard abre precargado y guarda con PATCH. */
  editar?: FamiliaTenant | null;
  onCerrar: () => void;
  onCreado: () => Promise<void>;
}) {
  // En edición no tiene sentido "¿partís de un paso existente?": se arranca
  // directo en la primera pregunta real, con todo precargado.
  const [paso, setPaso] = React.useState<PasoWizard>(
    editar ? "quien" : "arranque",
  );
  const [draft, setDraft] = React.useState<FormaDraft>(() =>
    editar ? draftDesdeFamilia(editar) : DRAFT_INICIAL,
  );
  const [erroresBack, setErroresBack] = React.useState<string[]>([]);
  const [guardando, setGuardando] = React.useState(false);
  const [lookups, setLookups] = React.useState<LookupsConfigPaso | null>(null);

  // Las máquinas reales del taller: para "¿con qué máquinas se puede hacer?"
  React.useEffect(() => {
    getLookupsConfigPaso()
      .then(setLookups)
      .catch(() => setLookups(null));
  }, []);

  const set = (parcial: Partial<FormaDraft>) =>
    setDraft((d) => ({ ...d, ...parcial }));

  const conMaquina = draft.relacionMaquina !== "M-0";

  // El orden real del flujo, saltando la pregunta de máquinas candidatas
  // cuando el paso es manual.
  const esProveedor = draft.quienLoHace === "proveedor";
  const secuencia: PasoWizard[] = React.useMemo(
    () =>
      esProveedor
        ? [
            ...(editar ? [] : (["arranque"] as PasoWizard[])),
            "quien",
            "proveedor",
            "activacion",
            "final",
          ]
        : [
            ...(editar ? [] : (["arranque"] as PasoWizard[])),
            "quien",
            "maquina",
            ...(conMaquina ? (["maquinas-candidatas"] as PasoWizard[]) : []),
            "tiempo",
            "materiales",
            "cantidad",
            "activacion",
            "centro",
            "registro",
            "final",
          ],
    [conMaquina, editar, esProveedor],
  );
  const indice = secuencia.indexOf(paso);
  const avanzar = () => setPaso(secuencia[Math.min(indice + 1, secuencia.length - 1)]);
  const retroceder = () => setPaso(secuencia[Math.max(indice - 1, 0)]);

  const presetOptions = React.useMemo<HumanSelectOption[]>(
    () =>
      catalogoSistema.map((f) => ({
        value: f.codigo,
        label: f.nombre,
        description: f.descripcion,
        group: getLabel(categoriaFamiliaLabels, f.categoria).label,
      })),
    [catalogoSistema],
  );

  const guardar = async () => {
    setGuardando(true);
    setErroresBack([]);
    try {
      if (editar) {
        await actualizarFamiliaTenant(editar.id, draftAInput(draft));
        toast.success(`Paso "${draft.nombre.trim()}" actualizado.`);
      } else {
        await crearFamiliaTenant(draftAInput(draft));
        toast.success(`Paso "${draft.nombre.trim()}" creado.`);
      }
      await onCreado();
    } catch (error) {
      if (error instanceof ApiError) {
        // El back manda los errores como array; apiRequest los une con ", ".
        setErroresBack(error.message.split(", ").filter(Boolean));
      } else {
        setErroresBack(["No se pudo guardar el paso."]);
      }
    } finally {
      setGuardando(false);
    }
  };

  const Opcion = ({
    activa,
    titulo,
    desc,
    onClick,
  }: {
    activa: boolean;
    titulo: string;
    desc: string;
    onClick: () => void;
  }) => (
    <button
      type="button"
      className={`${s.opcion} ${activa ? s.opcionActiva : ""}`}
      onClick={onClick}
    >
      <span className={s.opcionTitulo}>{titulo}</span>
      <span className={s.opcionDesc}>{desc}</span>
    </button>
  );

  const puedeAvanzar = (): boolean => {
    if (paso === "maquinas-candidatas")
      return draft.plantillasCompatibles.length > 0;
    if (paso === "materiales")
      return draft.slots.every((slot) => slot.nombre.trim().length > 0);
    return true;
  };

  return (
    // disablePointerDismissal: los HumanSelect renderizan su lista en un
    // portal FUERA del sheet, y elegir una opción contaba como "click afuera"
    // y cerraba el wizard solo (pasó en el E2E). Se cierra con Cancelar o X.
    <Sheet
      open
      disablePointerDismissal
      onOpenChange={(open) => !open && onCerrar()}
    >
      <SheetContent
        className="flex w-full flex-col gap-0"
        // Inline y no utility: el default del sheet (max-w-sm con variante
        // data-[side]) le gana a una clase max-w-* y el wizard quedaba
        // angosto y sin aire.
        style={{ maxWidth: 720 }}
      >
        <SheetHeader className={s.wizardHead}>
          <SheetTitle>
            {editar ? `Editar: ${editar.nombre}` : "Nuevo paso de producción"}
          </SheetTitle>
          <SheetDescription>
            {editar
              ? "Los cambios valen para las cotizaciones nuevas; las órdenes en curso no se tocan."
              : "Contestá en idioma de taller; la forma técnica la arma el sistema."}
          </SheetDescription>
        </SheetHeader>

        <div className={s.wizardBody}>
          <div className={s.pasoIndicador}>
            Paso {indice + 1} de {secuencia.length}
          </div>

          {paso === "arranque" ? (
            <>
              <div className={s.pregunta}>¿Partís de un paso existente?</div>
              <p className={s.ayuda}>
                Elegir uno del catálogo precarga todo y sólo le ponés nombre.
                Desde cero, el wizard pregunta lo que hace falta.
              </p>
              <div className={s.opciones}>
                <Opcion
                  activa={draft.presetOrigen === null}
                  titulo="Desde cero"
                  desc="Un paso que el catálogo no tiene: serigrafía, bordado, armado especial…"
                  onClick={() => setDraft({ ...DRAFT_INICIAL })}
                />
              </div>
              <HumanSelect
                value={draft.presetOrigen ?? ""}
                onValueChange={(codigo) => {
                  const preset = catalogoSistema.find((f) => f.codigo === codigo);
                  if (preset) setDraft(draftDesdePreset(preset));
                }}
                options={presetOptions}
                placeholder="…o elegí un paso del catálogo como base"
              />
            </>
          ) : null}

          {paso === "quien" ? (
            <>
              <div className={s.pregunta}>¿Quién hace este paso?</div>
              <div className={s.opciones}>
                <Opcion
                  activa={draft.quienLoHace === "taller"}
                  titulo="Tu taller"
                  desc="Lo produce tu equipo: máquinas, tiempos y materiales propios."
                  onClick={() => set({ quienLoHace: "taller" })}
                />
                <Opcion
                  activa={draft.quienLoHace === "proveedor"}
                  titulo="Un proveedor"
                  desc="Se compra hecho: definís proveedor, cómo cotiza y plazo. Los precios se cargan en cada producto."
                  onClick={() => set({ quienLoHace: "proveedor" })}
                />
              </div>
            </>
          ) : null}

          {paso === "proveedor" ? (
            <>
              <div className={s.pregunta}>¿Cómo se le compra?</div>
              <p className={s.ayuda}>
                Esto queda como sugerencia del paso: cada producto puede
                cambiar proveedor o internalizarlo. La grilla de precios se
                carga al configurar cada producto.
              </p>
              <div className="field">
                <span className={s.previewLabel}>Proveedor habitual</span>
                <HumanSelect
                  value={draft.proveedorDefaultId ?? ""}
                  onValueChange={(id) =>
                    set({ proveedorDefaultId: id || null })
                  }
                  options={proveedores.map((pv) => ({
                    value: pv.id,
                    label: pv.nombre,
                  }))}
                  placeholder="Elegir proveedor (opcional)"
                />
              </div>
              <div className={s.pregunta} style={{ marginTop: 8 }}>
                ¿Cómo cotiza el proveedor?
              </div>
              <div className={s.opciones}>
                <Opcion
                  activa={draft.fuenteCostoDefault === "matriz"}
                  titulo="Con una grilla de precios"
                  desc="Precio por combinación (medida, material…): la matriz se carga en cada producto."
                  onClick={() => set({ fuenteCostoDefault: "matriz" })}
                />
                <Opcion
                  activa={draft.fuenteCostoDefault === "tarifa_magnitud"}
                  titulo="Por cantidad o medida"
                  desc="Una tarifa por unidad, m² o metro: se define en cada producto."
                  onClick={() => set({ fuenteCostoDefault: "tarifa_magnitud" })}
                />
                <Opcion
                  activa={draft.fuenteCostoDefault === "fijo"}
                  titulo="Precio fijo por trabajo"
                  desc="Cobra lo mismo sin importar la cantidad."
                  onClick={() => set({ fuenteCostoDefault: "fijo" })}
                />
              </div>
              <div className="field" style={{ marginTop: 8 }}>
                <span className={s.previewLabel}>Plazo típico (opcional)</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Input
                    value={draft.plazoDefaultDias}
                    onChange={(e) => set({ plazoDefaultDias: e.target.value })}
                    placeholder="Ej: 5"
                    inputMode="numeric"
                    style={{ maxWidth: 120 }}
                  />
                  <span className={s.previewPista}>días hábiles</span>
                </div>
              </div>
            </>
          ) : null}

          {paso === "maquina" ? (
            <>
              <div className={s.pregunta}>¿Este paso usa una máquina?</div>
              <div className={s.opciones}>
                <Opcion
                  activa={draft.relacionMaquina === "M-0"}
                  titulo="No, es trabajo manual"
                  desc="Lo hace una persona con herramientas de mano: armado, estampado, control."
                  onClick={() =>
                    set({
                      relacionMaquina: "M-0",
                      plantillasCompatibles: [],
                      modoTiempo:
                        draft.modoTiempo === "T-3" ? "T-2" : draft.modoTiempo,
                    })
                  }
                />
                <Opcion
                  activa={draft.relacionMaquina === "M-1"}
                  titulo="Sí, una máquina fija"
                  desc="Siempre la misma máquina (o una elegida al armar el producto)."
                  onClick={() => set({ relacionMaquina: "M-1", modoTiempo: "T-3" })}
                />
                <Opcion
                  activa={draft.relacionMaquina === "M-2"}
                  titulo="Sí, y el comercial elige entre alternativas"
                  desc="Distintas tecnologías pueden hacerlo; se decide al cotizar."
                  onClick={() => set({ relacionMaquina: "M-2", modoTiempo: "T-3" })}
                />
              </div>
            </>
          ) : null}

          {paso === "maquinas-candidatas" ? (
            <>
              <div className={s.pregunta}>
                ¿Qué tipo de máquina puede hacerlo?
              </div>
              <p className={s.ayuda}>
                La compatibilidad es por TIPO de máquina, no por máquina
                puntual: habilitar un tipo habilita todas las tuyas de ese
                tipo (y las que compres después). Cuál se usa en concreto se
                decide al armar cada producto.
              </p>
              <div className={s.opciones}>
                {agruparPorPlantilla(lookups?.maquinas ?? []).map((grupo) => {
                  const activa = draft.plantillasCompatibles.includes(
                    grupo.plantilla,
                  );
                  return (
                    <Opcion
                      key={grupo.plantilla}
                      activa={activa}
                      titulo={humanizarPlantilla(grupo.plantilla)}
                      desc={`Tus máquinas de este tipo: ${grupo.maquinas.join(", ")}`}
                      onClick={() =>
                        set({
                          plantillasCompatibles: activa
                            ? draft.plantillasCompatibles.filter(
                                (p) => p !== grupo.plantilla,
                              )
                            : [...draft.plantillasCompatibles, grupo.plantilla],
                        })
                      }
                    />
                  );
                })}
                {lookups && lookups.maquinas.length === 0 ? (
                  <div className={s.slotsVacio}>
                    No hay máquinas cargadas en Maquinaria todavía.
                  </div>
                ) : null}
              </div>
            </>
          ) : null}

          {paso === "tiempo" ? (
            <>
              <div className={s.pregunta}>¿Cómo se mide el tiempo de este paso?</div>
              <div className={s.opciones}>
                {!conMaquina ? (
                  <>
                    <Opcion
                      activa={draft.modoTiempo === "T-2"}
                      titulo="Por ritmo de trabajo"
                      desc="Tantas piezas por hora — el tiempo crece con la cantidad."
                      onClick={() => set({ modoTiempo: "T-2" })}
                    />
                    <Opcion
                      activa={draft.modoTiempo === "T-1"}
                      titulo="Tiempo fijo"
                      desc="Lleva lo mismo sin importar la cantidad: preparar, calibrar, revisar."
                      onClick={() => set({ modoTiempo: "T-1" })}
                    />
                  </>
                ) : (
                  <>
                    <Opcion
                      activa={draft.modoTiempo === "T-3"}
                      titulo="Lo dicta la máquina"
                      desc="La productividad sale del perfil de la máquina elegida."
                      onClick={() => set({ modoTiempo: "T-3" })}
                    />
                    <Opcion
                      activa={draft.modoTiempo === "T-2"}
                      titulo="Por ritmo de trabajo del operario"
                      desc="La máquina asiste pero el ritmo lo pone la persona."
                      onClick={() => set({ modoTiempo: "T-2" })}
                    />
                  </>
                )}
                <Opcion
                  activa={draft.modoTiempo === "T-4"}
                  titulo="Lo estima el comercial al cotizar"
                  desc="Trabajos tan variables que el tiempo se carga a mano en cada cotización."
                  onClick={() => set({ modoTiempo: "T-4" })}
                />
              </div>
            </>
          ) : null}

          {paso === "materiales" ? (
            <>
              <div className={s.pregunta}>
                ¿Este paso gasta algún material propio?
              </div>
              <p className={s.ayuda}>
                Cosas que el paso consume y hay que cobrar: cola, ojales, film,
                hilo, cinta, bolsas… Acá se declara QUÉ pide el paso; el
                material concreto y su precio se eligen al armar cada producto.
              </p>
              {conMaquina ? (
                <div className={s.notaTinta}>
                  La tinta o el tóner de la máquina NO van acá: el sistema los
                  cobra solo, desde el perfil de la máquina elegida.
                </div>
              ) : null}
              {draft.slots.length === 0 ? (
                <div className={s.slotsVacio}>
                  Sin materiales propios. Muchos pasos manuales no gastan nada —
                  puede quedar así.
                </div>
              ) : (
                <div className={s.opciones}>
                  {draft.slots.map((slot, i) => (
                    <div key={i} className={s.slotFila}>
                      <Input
                        value={slot.nombre}
                        placeholder="¿Qué gasta? (ej: Hilo de bordar, Ojales, Cola)"
                        onChange={(e) => {
                          const slots = [...draft.slots];
                          slots[i] = { ...slot, nombre: e.target.value };
                          set({ slots });
                        }}
                      />
                      <label
                        style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}
                      >
                        <Switch
                          checked={slot.requerido}
                          onCheckedChange={(requerido) => {
                            const slots = [...draft.slots];
                            slots[i] = { ...slot, requerido };
                            set({ slots });
                          }}
                        />
                        Obligatorio
                      </label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          set({ slots: draft.slots.filter((_, j) => j !== i) })
                        }
                      >
                        Quitar
                      </Button>
                      <div
                        style={{
                          gridColumn: "1 / -1",
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 6,
                          marginTop: 4,
                        }}
                      >
                        <span
                          className={s.previewPista}
                          style={{ width: "100%", marginBottom: 2 }}
                        >
                          ¿Qué tipo de material va acá? Sin marcar nada, al
                          armar el producto se puede elegir cualquiera.
                        </span>
                        {FAMILIAS_MATERIAL.map((fam) => {
                          const activa = slot.familiasMateriaPrima.includes(
                            fam.value,
                          );
                          return (
                            <button
                              key={fam.value}
                              type="button"
                              className="btn"
                              style={{
                                fontSize: 11.5,
                                fontWeight: activa ? 650 : 400,
                                opacity: activa ? 1 : 0.62,
                              }}
                              onClick={() => {
                                const slots = [...draft.slots];
                                slots[i] = {
                                  ...slot,
                                  familiasMateriaPrima: activa
                                    ? slot.familiasMateriaPrima.filter(
                                        (f) => f !== fam.value,
                                      )
                                    : [
                                        ...slot.familiasMateriaPrima,
                                        fam.value,
                                      ],
                                };
                                set({ slots });
                              }}
                            >
                              {activa ? "✓ " : ""}
                              {fam.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <p className={s.previewPista}>
                “Obligatorio” = un producto no se puede cotizar sin elegirle
                este material. Si a veces se usa y a veces no, dejalo opcional.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  set({
                    slots: [
                      ...draft.slots,
                      // Siempre INSUMO_PASO: es el único tipo con sentido para
                      // un paso componible — SUSTRATO/TAPA/OTRO no cambian
                      // nada en el motor y CONSUMIBLE_MAQUINA se cobra solo
                      // desde el perfil (el dropdown de tipos era una decisión
                      // sin consecuencias, se quitó a propósito).
                      {
                        nombre: "",
                        tipo: "INSUMO_PASO",
                        requerido: false,
                        familiasMateriaPrima: [],
                      },
                    ],
                  })
                }
              >
                + Agregar material
              </Button>
            </>
          ) : null}

          {paso === "cantidad" ? (
            <>
              <div className={s.pregunta}>¿Sobre cuántas piezas trabaja?</div>
              <div className={s.opciones}>
                <Opcion
                  activa={draft.mecanismoCantidad === "DIRECT_FROM_JOBCONTEXT"}
                  titulo="La cantidad pedida"
                  desc="Trabaja sobre lo que pidió el cliente: 100 remeras → 100 estampadas."
                  onClick={() => set({ mecanismoCantidad: "DIRECT_FROM_JOBCONTEXT" })}
                />
                <Opcion
                  activa={draft.mecanismoCantidad === "HEREDAR_DEL_OUTPUT_CANONICO"}
                  titulo="Lo que dejó el paso anterior"
                  desc="Trabaja sobre pliegos, piezas o unidades que produjo otro paso."
                  onClick={() =>
                    set({ mecanismoCantidad: "HEREDAR_DEL_OUTPUT_CANONICO" })
                  }
                />
                <Opcion
                  activa={draft.mecanismoCantidad === "CONVERSION"}
                  titulo="Una conversión"
                  desc="Agrupa o divide: 1000 piezas en cajas de 100 → 10 cajas."
                  onClick={() => set({ mecanismoCantidad: "CONVERSION" })}
                />
                <Opcion
                  activa={draft.mecanismoCantidad === "CALCULADO_POR_PASO"}
                  titulo="El paso la calcula acomodando piezas"
                  desc="El sistema acomoda las piezas en el material y calcula cuánto entra: pliegos necesarios, metros de rollo."
                  onClick={() =>
                    set({
                      mecanismoCantidad: "CALCULADO_POR_PASO",
                      superficie: draft.superficie ?? "pliego",
                    })
                  }
                />
              </div>
              {draft.mecanismoCantidad === "CALCULADO_POR_PASO" ? (
                <>
                  <div className={s.pregunta}>¿Sobre qué acomoda?</div>
                  <p className={s.ayuda}>
                    Elegís la superficie física; el algoritmo de acomodo lo
                    pone el sistema (el mismo que usan la impresión y el corte
                    de Grafoprint).
                  </p>
                  <div className={s.opciones}>
                    {/* "pliego" y "pliegos_multiples" rutean al MISMO
                        algoritmo (grid-2d-multi, que degrada solo a
                        single con piezas uniformes): eran una elección
                        sin consecuencia. Se ofrecen como una sola; el
                        valor legacy sigue siendo válido en el motor. */}
                    <Opcion
                      activa={
                        draft.superficie === "pliego" ||
                        draft.superficie === "pliegos_multiples"
                      }
                      titulo="Pliegos, hojas o placas"
                      desc="Tarjetas, talonarios, placas rígidas: calcula cuántas piezas entran por hoja y cuántas hojas hacen falta. Si el trabajo trae piezas de distintas medidas, las combina solo."
                      onClick={() => set({ superficie: "pliego" })}
                    />
                    <Opcion
                      activa={draft.superficie === "rollo"}
                      titulo="Un rollo"
                      desc="Vinilo, lona: las piezas se acomodan a lo ancho del rollo y calcula los metros consumidos, con desperdicio real."
                      onClick={() => set({ superficie: "rollo" })}
                    />
                  </div>
                </>
              ) : null}

              <div className={s.pregunta} style={{ marginTop: 20 }}>
                ¿El trabajo se multiplica por algo del pedido?
              </div>
              <p className={s.ayuda}>
                Si el paso se hace una vez por cara o por copia, marcalo acá y
                el tiempo (y el material que lo declare) se multiplica solo al
                cotizar. Cada producto puede desactivarlo en su ruta.
              </p>
              <div className={s.opciones}>
                {MULTIPLICADORES_DISPONIBLES.map((mult) => {
                  const activa = draft.multiplicadores.includes(mult.value);
                  return (
                    <Opcion
                      key={mult.value}
                      activa={activa}
                      titulo={mult.titulo}
                      desc={mult.desc}
                      onClick={() =>
                        set({
                          multiplicadores: activa
                            ? draft.multiplicadores.filter(
                                (m) => m !== mult.value,
                              )
                            : [...draft.multiplicadores, mult.value],
                        })
                      }
                    />
                  );
                })}
              </div>
              <p className={s.ayuda} style={{ marginTop: 8 }}>
                {draft.multiplicadores.length === 0
                  ? "Sin multiplicadores: el trabajo se cobra una vez, sin importar caras ni copias."
                  : "Podés desmarcarlos para volver al comportamiento simple."}
              </p>
            </>
          ) : null}

          {paso === "activacion" ? (
            <>
              <div className={s.pregunta}>
                ¿Cómo entra normalmente a la ruta de un producto?
              </div>
              <p className={s.ayuda}>
                Esto es el punto de partida: cada producto puede cambiarlo al
                configurar su ruta — el mismo paso puede ser obligatorio en un
                producto y opcional en otro. Si querés que NO se pueda cambiar,
                fijalo abajo.
              </p>
              <div className={s.opciones}>
                <Opcion
                  activa={draft.modoActivacionDefault === "OPCIONAL"}
                  titulo="Opcional"
                  desc="El comercial lo activa cuando el trabajo lo pide. Lo más común."
                  onClick={() => set({ modoActivacionDefault: "OPCIONAL" })}
                />
                <Opcion
                  activa={draft.modoActivacionDefault === "OBLIGATORIO"}
                  titulo="Siempre"
                  desc="Si está en la ruta, se ejecuta en todos los trabajos."
                  onClick={() => set({ modoActivacionDefault: "OBLIGATORIO" })}
                />
                <Opcion
                  activa={draft.modoActivacionDefault === "CONDICIONAL"}
                  titulo="Según una condición"
                  desc="Se activa solo cuando el pedido cumple una regla (medida, opción…)."
                  onClick={() => set({ modoActivacionDefault: "CONDICIONAL" })}
                />
              </div>
              <label className={s.fijarActivacion}>
                <Switch
                  checked={draft.activacionForzada}
                  onCheckedChange={(activacionForzada) =>
                    set({ activacionForzada })
                  }
                />
                <span>
                  <span className={s.opcionTitulo}>
                    Fijar para todos los productos
                  </span>
                  <span className={s.opcionDesc}>
                    Los productos que usen este paso no van a poder cambiar
                    esta elección (sólo apagarlo por ruta con “No ejecutar”).
                  </span>
                </span>
              </label>
            </>
          ) : null}

          {paso === "centro" ? (
            <>
              <div className={s.pregunta}>¿En qué centro productivo se costea?</div>
              <p className={s.ayuda}>
                El centro de costo pone la tarifa horaria cuando el paso no
                usa máquina. Queda como sugerencia: cada producto puede
                elegir otro. La estación del tablero se arma aparte, desde
                Estaciones (por máquina, tecnología, paso o familia).
              </p>
              <HumanSelect
                value={draft.centroCostoDefaultId ?? ""}
                onValueChange={(id) => set({ centroCostoDefaultId: id || null })}
                options={centros.map((c) => ({ value: c.id, label: c.nombre }))}
                placeholder="Centro de costo (opcional)"
              />
            </>
          ) : null}

          {paso === "registro" ? (
            <>
              <div className={s.pregunta}>¿Cómo se registra el trabajo en el tablero?</div>
              <div className={s.opciones}>
                <Opcion
                  activa={draft.modoRegistro === "cronometro"}
                  titulo="Con cronómetro"
                  desc="Iniciar, pausar, completar: mide el tiempo real de la persona."
                  onClick={() => set({ modoRegistro: "cronometro" })}
                />
                <Opcion
                  activa={draft.modoRegistro === "solo_completar"}
                  titulo="Un click al terminar"
                  desc="Domina la máquina o la tanda: se marca hecho y listo."
                  onClick={() => set({ modoRegistro: "solo_completar" })}
                />
              </div>
            </>
          ) : null}

          {paso === "final" ? (
            <PasoFinal
              draft={draft}
              set={set}
              centros={centros}
              erroresBack={erroresBack}
            />
          ) : null}
        </div>

        <div className={s.wizardFooter}>
          <Button variant="ghost" onClick={indice === 0 ? onCerrar : retroceder}>
            {indice === 0 ? "Cancelar" : "← Atrás"}
          </Button>
          {paso === "final" ? (
            <Button
              onClick={guardar}
              disabled={guardando || draft.nombre.trim().length === 0}
            >
              {guardando
                ? "Guardando…"
                : editar
                  ? "Guardar cambios"
                  : "Crear paso"}
            </Button>
          ) : (
            <Button onClick={avanzar} disabled={!puedeAvanzar()}>
              Siguiente →
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Paso final: nombre + categoría + preview de costeo (visible, opcional §8.8)
// ─────────────────────────────────────────────────────────────────────

function PasoFinal({
  draft,
  set,
  centros,
  erroresBack,
}: {
  draft: FormaDraft;
  set: (p: Partial<FormaDraft>) => void;
  centros: Array<{ id: string; nombre: string }>;
  erroresBack: string[];
}) {
  // E.1 — el ritmo, el tiempo fijo y el centro YA no son de la prueba: son
  // los valores típicos del paso (draft) y se guardan como defaults. La
  // prueba sólo aporta la cantidad de ejemplo.
  const [pvCantidad, setPvCantidad] = React.useState("100");
  const [resultado, setResultado] = React.useState<PreviewCosteoFamilia | null>(
    null,
  );
  const [probando, setProbando] = React.useState(false);

  const esProveedor = draft.quienLoHace === "proveedor";
  const previewAplica =
    !esProveedor && (draft.modoTiempo === "T-1" || draft.modoTiempo === "T-2");

  const probar = async () => {
    if (!draft.centroCostoDefaultId) return;
    setProbando(true);
    try {
      const r = await previewCosteoFamiliaTenant({
        cantidad: Number(pvCantidad) || 0,
        modoTiempo: draft.modoTiempo,
        tiempoFijoMin: Number(draft.tiempoFijoDefaultMin) || 0,
        productividadPorHora: Number(draft.ritmoDefaultHora) || 0,
        centroCostoId: draft.centroCostoDefaultId,
      });
      setResultado(r);
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "No se pudo calcular.",
      );
    } finally {
      setProbando(false);
    }
  };

  const categoriaOptions: HumanSelectOption[] = Object.entries(
    categoriaFamiliaLabels,
  ).map(([codigo, l]) => ({
    value: codigo,
    label: l.label,
    description: l.descripcion,
  }));

  return (
    <>
      <div className={s.pregunta}>Ponele nombre</div>
      <div className="field">
        <Input
          value={draft.nombre}
          placeholder="Ej: Serigrafía manual, Bordado, Armado de kit"
          onChange={(e) => set({ nombre: e.target.value })}
          autoFocus
        />
      </div>
      <div className="field">
        <Textarea
          value={draft.descripcion}
          placeholder="Descripción (opcional): qué hace este paso, para quien arma rutas."
          rows={2}
          onChange={(e) => set({ descripcion: e.target.value })}
        />
      </div>
      <HumanSelect
        value={draft.categoria}
        onValueChange={(categoria) => set({ categoria })}
        options={categoriaOptions}
        placeholder="Categoría"
      />

      {/* B.3.2 — derivado de las respuestas (espeja derivarOutputsTenant
          del back); acá sólo se INFORMA, no hay nada que configurar. */}
      <div className={s.dejaBox}>
        <div className={s.opcionTitulo}>Qué deja este paso a los siguientes</div>
        <div className={s.dejaChips}>
          <span className={s.dejaChip}>Unidades procesadas</span>
          {esProveedor ? null : (
            <span className={s.dejaChip}>Minutos de trabajo</span>
          )}
          {draft.mecanismoCantidad === "CONVERSION" ? (
            <span className={s.dejaChip}>Grupos armados</span>
          ) : null}
          {draft.mecanismoCantidad === "CALCULADO_POR_PASO" &&
          (draft.superficie === "pliego" ||
            draft.superficie === "pliegos_multiples") ? (
            <>
              <span className={s.dejaChip}>Pliegos (con su medida)</span>
              <span className={s.dejaChip}>Aprovechamiento</span>
            </>
          ) : null}
          {draft.mecanismoCantidad === "CALCULADO_POR_PASO" &&
          draft.superficie === "rollo" ? (
            <>
              <span className={s.dejaChip}>m² consumidos</span>
              <span className={s.dejaChip}>Metros lineales</span>
              <span className={s.dejaChip}>Aprovechamiento</span>
            </>
          ) : null}
        </div>
        <div className={s.previewAviso}>
          Los pasos siguientes de una ruta pueden usar estos números — por
          ejemplo, heredar la cantidad. Sale de tus respuestas: no hay nada
          que configurar acá.
        </div>
      </div>

      {previewAplica ? (
        <div className={s.preview}>
          <div className={s.opcionTitulo}>Valores típicos del paso (y una prueba de costo)</div>
          <div className={s.previewIntro}>
            {draft.modoTiempo === "T-2"
              ? "¿A qué ritmo se hace normalmente y en qué centro productivo? Estas respuestas quedan como sugerencia del paso — cada producto puede pisarlas. La cantidad es sólo para probar el costo."
              : "¿Cuántos minutos lleva normalmente y en qué centro productivo? Queda como sugerencia del paso — cada producto puede pisarla."}
          </div>
          <div className={s.previewGrid}>
            <label className={s.previewCampo}>
              <span className={s.previewLabel}>Cantidad del pedido</span>
              <Input
                value={pvCantidad}
                onChange={(e) => setPvCantidad(e.target.value)}
                placeholder="Ej: 100"
                inputMode="numeric"
              />
              <span className={s.previewPista}>piezas a producir</span>
            </label>
            {draft.modoTiempo === "T-2" ? (
              <label className={s.previewCampo}>
                <span className={s.previewLabel}>Ritmo de trabajo</span>
                <Input
                  value={draft.ritmoDefaultHora}
                  onChange={(e) =>
                    set({ ritmoDefaultHora: e.target.value })
                  }
                  placeholder="Ej: 60"
                  inputMode="numeric"
                />
                <span className={s.previewPista}>piezas por hora</span>
              </label>
            ) : (
              <label className={s.previewCampo}>
                <span className={s.previewLabel}>Duración del paso</span>
                <Input
                  value={draft.tiempoFijoDefaultMin}
                  onChange={(e) => set({ tiempoFijoDefaultMin: e.target.value })}
                  placeholder="Ej: 30"
                  inputMode="numeric"
                />
                <span className={s.previewPista}>minutos, fijos</span>
              </label>
            )}
            <label className={s.previewCampo}>
              <span className={s.previewLabel}>¿En qué centro productivo?</span>
              <HumanSelect
                value={draft.centroCostoDefaultId ?? ""}
                onValueChange={(centroCostoId) =>
                  set({ centroCostoDefaultId: centroCostoId || null })
                }
                options={centros.map((c) => ({ value: c.id, label: c.nombre }))}
                placeholder="Centro de costo"
              />
              <span className={s.previewPista}>define la tarifa por hora</span>
            </label>
          </div>
          <div className={s.previewResultado}>
            <Button
              variant="outline"
              size="sm"
              onClick={probar}
              disabled={probando || !draft.centroCostoDefaultId}
            >
              {probando ? "Calculando…" : "Calcular costo"}
            </Button>
            {resultado ? (
              <span className={s.previewMonto}>
                {formatearMinutos(resultado.totalMin)} de trabajo · ${" "}
                {resultado.costoTiempo.toLocaleString("es-AR")}
              </span>
            ) : null}
          </div>
          {resultado ? (
            <div className={s.previewAviso}>
              {resultado.tarifaPublicada
                ? `La cuenta: ${formatearMinutos(resultado.totalMin)} × $${resultado.tarifaHora.toLocaleString("es-AR")}/h (tarifa ${resultado.periodo} de ${resultado.centroCostoNombre}). Es la misma que hará el motor al cotizar.`
                : `${resultado.centroCostoNombre} no tiene tarifa publicada en ${resultado.periodo}: el costo da $0 hasta publicarla en Centros de costo.`}
            </div>
          ) : (
            <div className={s.previewAviso}>
              El ritmo y el centro quedan guardados como los típicos del paso:
              al configurar un producto ya vienen puestos, y ahí se pueden
              pisar.
            </div>
          )}
        </div>
      ) : (
        <div className={s.preview}>
          <div className={s.opcionTitulo}>El costo se ve al cotizar</div>
          <div className={s.previewAviso}>
            {esProveedor
              ? "El costo lo pone el proveedor: la grilla o tarifa se carga al configurar cada producto, y ahí se ve el precio."
              : draft.modoTiempo === "T-3"
                ? "El tiempo de este paso lo dicta la máquina elegida (su perfil de productividad), así que el costo aparece al cotizar un producto concreto."
                : "El tiempo de este paso lo estima el comercial en cada cotización, así que no hay un costo fijo para previsualizar."}
          </div>
        </div>
      )}

      {erroresBack.length > 0 ? (
        <div className={s.erroresBox}>
          La definición tiene errores:
          <ul>
            {erroresBack.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────
// E.1 — Defaults declarados de una familia del SISTEMA ("tu guillotina la
// cobra el centro X"). Sólo muestra los campos que la forma soporta.
// ─────────────────────────────────────────────────────────────────────

function DefaultsSheet({
  familia,
  centros,
  proveedores,
  onCerrar,
  onGuardado,
}: {
  familia: FamiliaListItem;
  centros: Array<{ id: string; nombre: string }>;
  proveedores: Array<{ id: string; nombre: string }>;
  onCerrar: () => void;
  onGuardado: () => Promise<void>;
}) {
  const d = familia.defaults;
  const [centroCostoId, setCentroCostoId] = React.useState<string | null>(
    d?.centroCostoId ?? null,
  );
  const [ritmo, setRitmo] = React.useState(
    d?.productividadHora != null ? String(d.productividadHora) : "",
  );
  const [tiempoFijo, setTiempoFijo] = React.useState(
    d?.tiempoFijoMin != null ? String(d.tiempoFijoMin) : "",
  );
  const [demasia, setDemasia] = React.useState(
    d?.demasiaMm != null ? String(d.demasiaMm) : "",
  );
  const [solape, setSolape] = React.useState(
    d?.solapePanelMm != null ? String(d.solapePanelMm) : "",
  );
  // E.2 — tercerización declarada del paso.
  const [tercerizado, setTercerizado] = React.useState(d?.tercerizado ?? false);
  const [proveedorId, setProveedorId] = React.useState<string | null>(
    d?.proveedorId ?? null,
  );
  const [fuenteCosto, setFuenteCosto] = React.useState(
    d?.fuenteCostoTercerizado ?? "matriz",
  );
  const [plazoDias, setPlazoDias] = React.useState(
    d?.plazoProveedorDias != null ? String(d.plazoProveedorDias) : "",
  );
  const [guardando, setGuardando] = React.useState(false);

  const soportaT2 = familia.modosTiempoSoportados.includes("T-2");
  const soportaT1 = familia.modosTiempoSoportados.includes("T-1");
  const soportaManual = familia.relacionMaquinaSoportada.includes("M-0");
  // Nestea = deja pliegos o m² (Registro de Capacidades, B.3).
  const nestea = (familia.capacidades ?? []).some(
    (c) => c.key === "pliegos" || c.key === "m2_consumidos",
  );
  const panela = familia.codigo === "impresion_por_area";

  const guardar = async () => {
    setGuardando(true);
    try {
      await guardarDefaultsFamilia(familia.codigo, {
        centroCostoId,
        productividadHora: soportaT2 ? numeroONull(ritmo) : null,
        tiempoFijoMin: soportaT1 ? numeroONull(tiempoFijo) : null,
        demasiaMm: nestea ? numeroONull(demasia) : null,
        solapePanelMm: panela ? numeroONull(solape) : null,
        tercerizado: tercerizado ? true : null,
        proveedorId: tercerizado ? proveedorId : null,
        fuenteCostoTercerizado: tercerizado ? fuenteCosto : null,
        plazoProveedorDias: tercerizado ? numeroONull(plazoDias) : null,
      });
      toast.success("Defaults guardados");
      await onGuardado();
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "No se pudo guardar.",
      );
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Sheet open onOpenChange={(open) => !open && onCerrar()}>
      <SheetContent className={s.wizard} style={{ maxWidth: 480 }}>
        <SheetHeader className={s.wizardHead}>
          <SheetTitle>Defaults de {familia.nombre}</SheetTitle>
          <SheetDescription>
            Valores típicos de TU taller para este paso. Cada producto puede
            pisarlos al configurar su ruta; vacío = sin sugerencia.
          </SheetDescription>
        </SheetHeader>
        <div className={s.wizardBody}>
          {!soportaManual && !soportaT2 && !soportaT1 && !nestea && !panela ? (
            <p className={s.ayuda}>
              Este paso no tiene defaults de tiempo/costo propios: la máquina
              pone la tarifa y el tiempo. Igual podés declarar que lo
              terceriza un proveedor.
            </p>
          ) : null}
          {soportaManual ? (
            <div className="field">
              <span className={s.previewLabel}>¿En qué centro productivo se hace?</span>
              <HumanSelect
                value={centroCostoId ?? ""}
                onValueChange={(id) => setCentroCostoId(id || null)}
                options={centros.map((c) => ({ value: c.id, label: c.nombre }))}
                placeholder="Centro de costo (para pasos sin máquina)"
              />
              <span className={s.previewPista}>
                Aplica cuando el paso se hace a mano; con máquina la tarifa la
                pone la máquina.
              </span>
            </div>
          ) : null}
          {soportaT2 ? (
            <div className="field">
              <span className={s.previewLabel}>Ritmo típico</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Input
                  value={ritmo}
                  onChange={(e) => setRitmo(e.target.value)}
                  placeholder="Ej: 60"
                  inputMode="decimal"
                  style={{ maxWidth: 120 }}
                />
                <span className={s.previewPista}>unidades por hora</span>
              </div>
            </div>
          ) : null}
          {soportaT1 ? (
            <div className="field">
              <span className={s.previewLabel}>Duración típica</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Input
                  value={tiempoFijo}
                  onChange={(e) => setTiempoFijo(e.target.value)}
                  placeholder="Ej: 30"
                  inputMode="decimal"
                  style={{ maxWidth: 120 }}
                />
                <span className={s.previewPista}>minutos, fijos</span>
              </div>
            </div>
          ) : null}
          {nestea ? (
            <div className="field">
              <span className={s.previewLabel}>Demasía típica por pieza</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Input
                  value={demasia}
                  onChange={(e) => setDemasia(e.target.value)}
                  placeholder="Ej: 3"
                  inputMode="decimal"
                  style={{ maxWidth: 120 }}
                />
                <span className={s.previewPista}>mm por lado</span>
              </div>
            </div>
          ) : null}
          <label className={s.fijarActivacion}>
            <Switch
              checked={tercerizado}
              onCheckedChange={(v) => setTercerizado(v)}
            />
            <span>
              <span className={s.opcionTitulo}>Lo terceriza un proveedor</span>
              <span className={s.opcionDesc}>
                Las configuraciones nuevas de producto nacen con la
                tercerización prendida y precargada; cada producto puede
                internalizarlo o cambiar de proveedor.
              </span>
            </span>
          </label>
          {tercerizado ? (
            <>
              <div className="field">
                <span className={s.previewLabel}>Proveedor habitual</span>
                <HumanSelect
                  value={proveedorId ?? ""}
                  onValueChange={(id) => setProveedorId(id || null)}
                  options={proveedores.map((pv) => ({
                    value: pv.id,
                    label: pv.nombre,
                  }))}
                  placeholder="Elegir proveedor (opcional)"
                />
              </div>
              <div className="field">
                <span className={s.previewLabel}>¿Cómo cotiza?</span>
                <HumanSelect
                  value={fuenteCosto}
                  onValueChange={(v) => setFuenteCosto(v || "matriz")}
                  options={[
                    { value: "matriz", label: "Con una grilla de precios" },
                    { value: "tarifa_magnitud", label: "Por cantidad o medida" },
                    { value: "fijo", label: "Precio fijo por trabajo" },
                  ]}
                />
              </div>
              <div className="field">
                <span className={s.previewLabel}>Plazo típico</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Input
                    value={plazoDias}
                    onChange={(e) => setPlazoDias(e.target.value)}
                    placeholder="Ej: 5"
                    inputMode="numeric"
                    style={{ maxWidth: 120 }}
                  />
                  <span className={s.previewPista}>días hábiles</span>
                </div>
              </div>
            </>
          ) : null}
          {panela ? (
            <div className="field">
              <span className={s.previewLabel}>Solape típico de panel</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Input
                  value={solape}
                  onChange={(e) => setSolape(e.target.value)}
                  placeholder="Ej: 30"
                  inputMode="decimal"
                  style={{ maxWidth: 120 }}
                />
                <span className={s.previewPista}>
                  mm donde un panel pisa al otro para soldar
                </span>
              </div>
            </div>
          ) : null}
        </div>
        <div className={s.wizardFooter}>
          <Button variant="ghost" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={guardando}>
            {guardando ? "Guardando…" : "Guardar defaults"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
