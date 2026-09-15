"use client";
import { useCallback, useMemo, useState } from "react";
import { CalendarDays, Plus, RefreshCw } from "lucide-react";
import { useDesignScope } from "@/components/design-system/appearance";
import { ActionButton } from "@/components/design-system/action-button";
import { FormDialog } from "@/components/design-system/form-dialog";
import theme from "@/components/design-system/theme.module.css";
import layout from "@/components/design-system/list-page.module.css";
import { useConfigRegional } from "@/components/navigation/config-regional-provider";
import { usePuede } from "@/components/navigation/permisos-provider";
import {
  useProduccionOperativa,
  type DatosProduccionOperativa,
} from "./use-produccion-operativa";
import { EstacionesOperativas } from "./estaciones-operativas";
import {
  StationForm,
  FeriadosSheet,
  type EmpleadoRef,
  type MaquinaRef,
} from "./estacion-form";
import { buildItemView } from "@/lib/produccion-item-view";
import { simularFlujo } from "@/lib/flujo-produccion";
import type {
  Estacion,
  EstacionPayload,
  FamiliaPasoCatalogo,
} from "@/lib/estaciones";
import {
  getEstaciones,
  getFamiliasPasos,
  getRecursosEstaciones,
  getDiasNoLaborables,
  getConfiguracionProduccion,
  createEstacion,
  updateEstacion,
  deleteEstacion,
  type DiaNoLaborable,
  type DuracionFamilia,
} from "@/lib/estaciones-api";
import s from "./estaciones-operativas.module.css";
import f from "./estacion-form.module.css";

export type EstacionesViewProps = DatosProduccionOperativa & {
  estaciones: Estacion[];
  duracionesFamilias: DuracionFamilia[];
  diasNoLaborables: DiaNoLaborable[];
  tiempoEntrePasosMin: number;
  initialPartialWarning?: string | null;
  initialFamilias: FamiliaPasoCatalogo[];
  empleados: EmpleadoRef[];
  maquinas: MaquinaRef[];
  configuracionDisponible: boolean;
};

export function EstacionesView(props: EstacionesViewProps) {
  const scope = useDesignScope();
  const puedeConfigurar = usePuede("produccion.configurar");
  const operacion = useProduccionOperativa({ ...props, soloPendientes: true });
  const { zonaHoraria } = useConfigRegional();
  const [estaciones, setEstaciones] = useState(props.estaciones);
  const [familias, setFamilias] = useState(props.initialFamilias);
  const [empleados, setEmpleados] = useState(props.empleados);
  const [dias, setDias] = useState(props.diasNoLaborables);
  const [entrePasos, setEntrePasos] = useState(props.tiempoEntrePasosMin);
  const [sheet, setSheet] = useState<Estacion | "new" | null>(null);
  const [calendarioOpen, setCalendarioOpen] = useState(false);
  const [aEliminar, setAEliminar] = useState<Estacion | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [configRefreshing, setConfigRefreshing] = useState(false);
  const puedeEditar = puedeConfigurar && props.configuracionDisponible;

  const refrescarConfiguracion = useCallback(async () => {
    const [ests, cal, cfg] = await Promise.all([
      getEstaciones(),
      getDiasNoLaborables(),
      getConfiguracionProduccion(),
    ]);
    setEstaciones(ests);
    setDias(cal);
    setEntrePasos(cfg.tiempoEntrePasosMin);
    if (puedeConfigurar) {
      const [fams, recursos] = await Promise.all([
        getFamiliasPasos(),
        getRecursosEstaciones(),
      ]);
      setFamilias(fams);
      setEmpleados(recursos.empleados);
    }
    setConfigError(null);
  }, [puedeConfigurar]);
  const refrescarTodo = async () => {
    setConfigRefreshing(true);
    try {
      await Promise.all([refrescarConfiguracion(), operacion.refrescar(true)]);
    } catch (e) {
      setConfigError(
        e instanceof Error
          ? e.message
          : "No se pudo actualizar la configuración.",
      );
    } finally {
      setConfigRefreshing(false);
    }
  };
  const guardar = async (draft: EstacionPayload) => {
    if (!puedeEditar || saving) return;
    setSaving(true);
    setError(null);
    try {
      const guardada =
        sheet && sheet !== "new"
          ? await updateEstacion(sheet.id, draft)
          : await createEstacion(draft);
      // Si falla la recarga, el próximo intento actualiza la estación ya creada.
      setSheet(guardada);
      await refrescarConfiguracion();
      await operacion.refrescar(true);
      setSheet(null);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo guardar la estación.",
      );
    } finally {
      setSaving(false);
    }
  };
  const eliminar = async () => {
    if (!aEliminar || !puedeEditar || saving) return;
    setSaving(true);
    setError(null);
    try {
      await deleteEstacion(aEliminar.id);
      setAEliminar(null);
      setSheet(null);
      await refrescarConfiguracion();
      await operacion.refrescar(true);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo eliminar la estación.",
      );
    } finally {
      setSaving(false);
    }
  };
  const abrirEditor = (id: string) => {
    if (!puedeEditar) return;
    const est = estaciones.find((e) => e.id === id);
    if (est) {
      setError(null);
      setSheet(est);
    }
  };
  const views = useMemo(
    () =>
      operacion.items.map((item) =>
        buildItemView(item, estaciones, zonaHoraria),
      ),
    [operacion.items, estaciones, zonaHoraria],
  );
  const medianas = useMemo(
    () =>
      new Map(
        props.duracionesFamilias.map((d) => [d.familiaCodigo, d.medianaMin]),
      ),
    [props.duracionesFamilias],
  );
  const noLaborables = useMemo(() => new Set(dias.map((d) => d.fecha)), [dias]);
  const sim = useMemo(
    () =>
      simularFlujo({
        items: operacion.items,
        estaciones,
        medianas,
        noLaborables,
        tiempoEntrePasosMin: entrePasos,
        zona: zonaHoraria,
      }),
    [
      operacion.items,
      estaciones,
      medianas,
      noLaborables,
      entrePasos,
      zonaHoraria,
    ],
  );
  const llegadasHoyMin = useMemo(() => {
    const result = new Map<string, number>(),
      hoy = new Date().toDateString();
    for (const [key, lista] of sim.llegadasPorEstacion) {
      const min = lista
        .filter((l) => l.llegada.toDateString() === hoy)
        .reduce((acc, l) => acc + l.duracionMin, 0);
      if (min > 0) result.set(key, min);
    }
    return result;
  }, [sim]);
  const maquinaEnEstacion = useMemo(
    () =>
      new Map(
        estaciones.flatMap((e) =>
          e.maquinas.map((m) => [m.id, e.nombre] as const),
        ),
      ),
    [estaciones],
  );
  const maquinasPendientes = props.maquinas.filter(
    (m) =>
      !estaciones.some(
        (e) => e.activo && e.maquinas.some((a) => a.id === m.id),
      ),
  );
  return (
    <div {...scope} className={`${theme.theme} ${layout.page} ${s.page}`}>
      <header className={layout.header}>
        <div>
          <p className={s.eyebrow}>Producción</p>
          <h1>Estaciones</h1>
          <p className={layout.subtitle}>
            Carga de trabajo, personal asignado y configuración del taller.
          </p>
        </div>
        <div className={s.headerActions}>
          <ActionButton
            variant="outline"
            isDisabled={operacion.refreshing || configRefreshing}
            onPress={() => void refrescarTodo()}
          >
            <RefreshCw />
            Actualizar
          </ActionButton>
          {puedeConfigurar && (
            <>
              <ActionButton
                variant="outline"
                onPress={() => setCalendarioOpen(true)}
              >
                <CalendarDays />
                Calendario del taller
              </ActionButton>
              <ActionButton
                isDisabled={!puedeEditar}
                onPress={() => {
                  setError(null);
                  setSheet("new");
                }}
              >
                <Plus />
                Nueva estación
              </ActionButton>
            </>
          )}
        </div>
      </header>
      {[
        props.initialPartialWarning,
        configError,
        operacion.loadError,
        operacion.syncError,
        operacion.error,
      ]
        .filter(Boolean)
        .map((message, i) => (
          <div key={i} role="alert" className={`${s.notice} ${s.error}`}>
            {message}
          </div>
        ))}
      {puedeConfigurar && !props.configuracionDisponible && (
        <div className={s.notice} role="alert">
          No se pudieron cargar todos los recursos de configuración. Recargá la
          página antes de editar una estación.
        </div>
      )}
      {puedeEditar && maquinasPendientes.length > 0 && (
        <details className={s.notice}>
          <summary>
            {maquinasPendientes.length} máquinas sin estación activa
          </summary>
          <p>
            Asignales una estación desde su configuración para ubicar sus
            trabajos.
          </p>
          <ul>
            {maquinasPendientes.map((m) => (
              <li key={m.id}>{m.nombre}</li>
            ))}
          </ul>
        </details>
      )}
      {operacion.meta.vendedorSinVinculo && (
        <p className={s.notice}>
          Tu usuario vendedor no está vinculado a un empleado. Vinculalo desde
          Configuración para ver tus órdenes.
        </p>
      )}
      <EstacionesOperativas
        items={views}
        estaciones={estaciones}
        medianas={medianas}
        noLaborables={noLaborables}
        llegadasHoyMin={llegadasHoyMin}
        onConfigure={puedeEditar ? abrirEditor : undefined}
      />
      {sheet && puedeEditar && (
        <StationForm
          key={sheet === "new" ? "new" : sheet.id}
          initial={sheet === "new" ? undefined : sheet}
          estaciones={estaciones}
          familias={familias}
          empleados={empleados}
          maquinas={props.maquinas}
          maquinaEnEstacion={maquinaEnEstacion}
          entrePasosDefault={entrePasos}
          saving={saving}
          error={error}
          onSave={(draft) => void guardar(draft)}
          onCancel={() => {
            setSheet(null);
            setError(null);
          }}
          onDelete={(est) => {
            setError(null);
            setAEliminar(est);
          }}
        />
      )}
      {calendarioOpen && puedeConfigurar && (
        <FeriadosSheet
          onClose={() => setCalendarioOpen(false)}
          onSaved={refrescarConfiguracion}
        />
      )}
      <FormDialog
        isOpen={aEliminar !== null}
        onOpenChange={(open) => {
          if (!open && !saving) setAEliminar(null);
        }}
        isDismissable={!saving}
        title="Eliminar estación"
        description={`Se eliminará ${aEliminar?.nombre ?? "la estación"} del taller.`}
      >
        <div className={s.notice}>
          <p>
            Las máquinas y los pasos manuales quedan sin estación asignada. Los
            empleados dejan de estar habilitados en ella.
          </p>
          {error && (
            <p className={f.error} role="alert">
              {error}
            </p>
          )}
        </div>
        <div className={`${s.headerActions} p-4 justify-end`}>
          <ActionButton
            variant="outline"
            isDisabled={saving}
            onPress={() => setAEliminar(null)}
          >
            Cancelar
          </ActionButton>
          <ActionButton
            variant="danger"
            isDisabled={saving}
            onPress={() => void eliminar()}
          >
            {saving ? "Eliminando…" : "Eliminar estación"}
          </ActionButton>
        </div>
      </FormDialog>
    </div>
  );
}
