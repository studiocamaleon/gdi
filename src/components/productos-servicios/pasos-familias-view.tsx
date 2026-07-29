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
import { getEstaciones } from "@/lib/estaciones-api";
import { getCentrosCosto } from "@/lib/costos-api";
import { categoriaFamiliaLabels, getLabel } from "@/lib/labels-humanos";
import {
  actualizarFamiliaTenant,
  crearFamiliaTenant,
  eliminarFamiliaTenant,
  getCatalogoFamilias,
  getFamiliasTenant,
  getLookupsConfigPaso,
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
  | "maquina"
  | "maquinas-candidatas"
  | "tiempo"
  | "materiales"
  | "cantidad"
  | "activacion"
  | "estacion"
  | "registro"
  | "final";

interface SlotDraft {
  nombre: string;
  tipo: string;
  requerido: boolean;
}

interface FormaDraft {
  presetOrigen: string | null;
  relacionMaquina: "M-0" | "M-1" | "M-2";
  plantillasCompatibles: string[];
  modoTiempo: "T-1" | "T-2" | "T-3" | "T-4";
  slots: SlotDraft[];
  mecanismoCantidad: string;
  modoActivacionDefault: string;
  activacionForzada: boolean;
  estacionId: string | null;
  modoRegistro: "cronometro" | "solo_completar";
  categoria: string;
  nombre: string;
  descripcion: string;
}

const DRAFT_INICIAL: FormaDraft = {
  presetOrigen: null,
  relacionMaquina: "M-0",
  plantillasCompatibles: [],
  modoTiempo: "T-2",
  slots: [],
  mecanismoCantidad: "DIRECT_FROM_JOBCONTEXT",
  modoActivacionDefault: "OPCIONAL",
  activacionForzada: false,
  estacionId: null,
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

function draftAInput(d: FormaDraft): UpsertFamiliaTenantInput {
  const conMaquina = d.relacionMaquina !== "M-0";
  return {
    nombre: d.nombre.trim(),
    descripcion: d.descripcion.trim() || undefined,
    categoria: d.categoria,
    relacionMaquina: [d.relacionMaquina],
    modosTiempo: [d.modoTiempo],
    mecanismosCantidad: [d.mecanismoCantidad],
    modoActivacionDefault: d.modoActivacionDefault,
    // Fijado = la familia sólo soporta ese modo y el editor del producto no
    // ofrece otros. Sin fijar, el service completa los cuatro universales.
    ...(d.activacionForzada
      ? { modosActivacion: [d.modoActivacionDefault] }
      : {}),
    slots: d.slots.map((slot) => ({
      codigo: slugSlot(slot.nombre),
      nombre: slot.nombre.trim(),
      tipo: slot.tipo,
      requerido: slot.requerido,
    })),
    plantillasCompatibles: conMaquina ? d.plantillasCompatibles : [],
    modoRegistro: d.modoRegistro,
    presetOrigen: d.presetOrigen ?? undefined,
    estacionId: d.estacionId,
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
      })),
    mecanismoCantidad:
      f.mecanismosCantidadSoportados.find(
        (m) => m !== "CALCULADO_POR_PASO",
      ) ?? "DIRECT_FROM_JOBCONTEXT",
    modoActivacionDefault: f.modoActivacionDefault,
    activacionForzada: false,
    estacionId: null,
    modoRegistro: "cronometro",
    categoria: f.categoria,
    nombre: "",
    descripcion: f.descripcion ?? "",
  };
}

// ─────────────────────────────────────────────────────────────────────
// Vista principal
// ─────────────────────────────────────────────────────────────────────

export function PasosFamiliasView() {
  const [familias, setFamilias] = React.useState<FamiliaTenant[]>([]);
  const [catalogo, setCatalogo] = React.useState<CatalogoFamilias | null>(null);
  const [estaciones, setEstaciones] = React.useState<
    Array<{ id: string; nombre: string }>
  >([]);
  const [cargando, setCargando] = React.useState(true);
  const [wizardAbierto, setWizardAbierto] = React.useState(false);
  const [aEliminar, setAEliminar] = React.useState<FamiliaTenant | null>(null);

  const recargar = React.useCallback(async () => {
    const filas = await getFamiliasTenant();
    setFamilias(filas);
  }, []);

  React.useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const [filas, cat, ests] = await Promise.all([
          getFamiliasTenant(),
          getCatalogoFamilias(),
          getEstaciones(),
        ]);
        if (!vivo) return;
        setFamilias(filas);
        setCatalogo(cat);
        setEstaciones(ests.map((e) => ({ id: e.id, nombre: e.nombre })));
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
                <th>Estación</th>
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
                  <td>{f.estacion?.nombre ?? "—"}</td>
                  <td>
                    <span className="tag">{f.activo ? "Activo" : "Inhabilitado"}</span>
                  </td>
                  <td className="right">
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
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {wizardAbierto ? (
        <WizardNuevoPaso
          catalogoSistema={sistema}
          estaciones={estaciones}
          onCerrar={() => setWizardAbierto(false)}
          onCreado={async () => {
            setWizardAbierto(false);
            await recargar();
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
  estaciones,
  onCerrar,
  onCreado,
}: {
  catalogoSistema: FamiliaListItem[];
  estaciones: Array<{ id: string; nombre: string }>;
  onCerrar: () => void;
  onCreado: () => Promise<void>;
}) {
  const [paso, setPaso] = React.useState<PasoWizard>("arranque");
  const [draft, setDraft] = React.useState<FormaDraft>(DRAFT_INICIAL);
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
  const secuencia: PasoWizard[] = React.useMemo(
    () => [
      "arranque",
      "maquina",
      ...(conMaquina ? (["maquinas-candidatas"] as PasoWizard[]) : []),
      "tiempo",
      "materiales",
      "cantidad",
      "activacion",
      "estacion",
      "registro",
      "final",
    ],
    [conMaquina],
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
      await crearFamiliaTenant(draftAInput(draft));
      toast.success(`Paso "${draft.nombre.trim()}" creado.`);
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
          <SheetTitle>Nuevo paso de producción</SheetTitle>
          <SheetDescription>
            Contestá en idioma de taller; la forma técnica la arma el sistema.
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
                      { nombre: "", tipo: "INSUMO_PASO", requerido: false },
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
              </div>
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

          {paso === "estacion" ? (
            <>
              <div className={s.pregunta}>¿Dónde se hace?</div>
              <p className={s.ayuda}>
                La estación define a qué cola del tablero llega el paso. Se
                puede cambiar después desde Estaciones.
              </p>
              <HumanSelect
                value={draft.estacionId ?? ""}
                onValueChange={(id) => set({ estacionId: id || null })}
                options={[
                  { value: "", label: "Elegir más tarde" },
                  ...estaciones.map((e) => ({ value: e.id, label: e.nombre })),
                ]}
                placeholder="Estación"
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
              {guardando ? "Guardando…" : "Crear paso"}
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
  erroresBack,
}: {
  draft: FormaDraft;
  set: (p: Partial<FormaDraft>) => void;
  erroresBack: string[];
}) {
  const [centros, setCentros] = React.useState<
    Array<{ id: string; nombre: string }>
  >([]);
  const [pv, setPv] = React.useState({
    cantidad: "100",
    productividad: "60",
    tiempoFijo: "30",
    centroCostoId: "",
  });
  const [resultado, setResultado] = React.useState<PreviewCosteoFamilia | null>(
    null,
  );
  const [probando, setProbando] = React.useState(false);

  React.useEffect(() => {
    getCentrosCosto()
      .then((cs) =>
        setCentros(
          (cs as Array<{ id: string; nombre: string }>).map((c) => ({
            id: c.id,
            nombre: c.nombre,
          })),
        ),
      )
      .catch(() => setCentros([]));
  }, []);

  const previewAplica = draft.modoTiempo === "T-1" || draft.modoTiempo === "T-2";

  const probar = async () => {
    if (!pv.centroCostoId) return;
    setProbando(true);
    try {
      const r = await previewCosteoFamiliaTenant({
        cantidad: Number(pv.cantidad) || 0,
        modoTiempo: draft.modoTiempo,
        tiempoFijoMin: Number(pv.tiempoFijo) || 0,
        productividadPorHora: Number(pv.productividad) || 0,
        centroCostoId: pv.centroCostoId,
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

      {previewAplica ? (
        <div className={s.preview}>
          <div className={s.opcionTitulo}>Probalo con un ejemplo (opcional)</div>
          <div className={s.previewIntro}>
            {draft.modoTiempo === "T-2"
              ? "Imaginate un pedido: ¿cuántas piezas trae, a qué ritmo las hace la persona, y quién las hace? Con eso el sistema calcula lo mismo que va a calcular al cotizar."
              : "Este paso tarda lo mismo sin importar la cantidad: decinos cuántos minutos lleva y quién lo hace."}
          </div>
          <div className={s.previewGrid}>
            <label className={s.previewCampo}>
              <span className={s.previewLabel}>Cantidad del pedido</span>
              <Input
                value={pv.cantidad}
                onChange={(e) => setPv({ ...pv, cantidad: e.target.value })}
                placeholder="Ej: 100"
                inputMode="numeric"
              />
              <span className={s.previewPista}>piezas a producir</span>
            </label>
            {draft.modoTiempo === "T-2" ? (
              <label className={s.previewCampo}>
                <span className={s.previewLabel}>Ritmo de trabajo</span>
                <Input
                  value={pv.productividad}
                  onChange={(e) =>
                    setPv({ ...pv, productividad: e.target.value })
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
                  value={pv.tiempoFijo}
                  onChange={(e) => setPv({ ...pv, tiempoFijo: e.target.value })}
                  placeholder="Ej: 30"
                  inputMode="numeric"
                />
                <span className={s.previewPista}>minutos, fijos</span>
              </label>
            )}
            <label className={s.previewCampo}>
              <span className={s.previewLabel}>¿Quién lo hace?</span>
              <HumanSelect
                value={pv.centroCostoId}
                onValueChange={(centroCostoId) =>
                  setPv({ ...pv, centroCostoId })
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
              disabled={probando || !pv.centroCostoId}
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
              Es sólo una prueba: el ritmo y el centro reales se configuran en
              cada producto que use este paso.
            </div>
          )}
        </div>
      ) : (
        <div className={s.preview}>
          <div className={s.opcionTitulo}>El costo se ve al cotizar</div>
          <div className={s.previewAviso}>
            {draft.modoTiempo === "T-3"
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
