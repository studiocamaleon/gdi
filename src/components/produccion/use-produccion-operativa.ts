"use client";
import * as React from "react";
import { useCambiosSistema } from "@/components/notificaciones/notificaciones-provider";
import { usePuede } from "@/components/navigation/permisos-provider";
import {
  debeRefrescarTablero,
  type TableroItemData,
  type TableroPasoData,
  type TableroPasoAccion,
  type AlcanceTableroProduccion,
} from "@/lib/tablero-produccion";
import {
  accionPasoProduccion,
  getTableroProduccion,
  mesaPasoProduccion,
  resolverGatePasoProduccion,
} from "@/lib/ordenes-trabajo-api";
import type { ItemView } from "@/lib/produccion-item-view";
const POLL_TABLERO_MS = 15000;
type GateHandler = (
  paso: TableroPasoData,
  tipo: "MATERIAL" | "CALIDAD",
  estado: "CUMPLIDO" | "PENDIENTE",
) => Promise<void>;
export type DatosProduccionOperativa = {
  soloPendientes?: boolean;
  initialActualizadoEl?: string | null;
  initialItems: TableroItemData[];
  initialMeta: {
    alcance: AlcanceTableroProduccion;
    puedeGestionar: boolean;
    estacionIdsEjecutables: string[] | null;
    vendedorSinVinculo: boolean;
  };
  initialLoadError?: string | null;
};
/** Control único para Tablero y Estaciones: permisos, refresco vivo y mutaciones. */
export function useProduccionOperativa({
  soloPendientes = false,
  initialActualizadoEl,
  initialItems,
  initialMeta,
  initialLoadError = null,
}: DatosProduccionOperativa) {
  const [items, setItems] = React.useState<TableroItemData[]>(initialItems);
  const [meta, setMeta] = React.useState(initialMeta);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(
    initialLoadError,
  );
  const [syncError, setSyncError] = React.useState<string | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);
  const [actualizadoEl, setActualizadoEl] = React.useState<Date | null>(
    initialLoadError || !initialActualizadoEl ? null : new Date(initialActualizadoEl),
  );
  const permisoEjecutar = usePuede("produccion.ejecutar");
  const permisoSupervisar = usePuede("produccion.supervisar");
  const canManage =
    (permisoEjecutar || permisoSupervisar) && meta.puedeGestionar;
  // ── Tablero EN VIVO: lo que hace otro operario aparece sin recargar ────
  // Polling del dataset (es chico) cada POLL_TABLERO_MS, pausado con la
  // pestaña oculta y refrescado al volver al foco. Dos protecciones que el
  // tracking público no necesita: no se aplica un snapshot con mutaciones
  // propias EN VUELO (pisaría el update optimista) ni durante un DRAG (el
  // re-render reemplaza la card arrastrada y corta el drop).
  const mutacionesRef = React.useRef(0);
  const dragActivoRef = React.useRef(false);
  const ultimoSnapshotRef = React.useRef<string | null>(
    JSON.stringify(initialItems),
  );
  const montadoRef = React.useRef(true);

  React.useEffect(() => {
    montadoRef.current = true;
    return () => {
      montadoRef.current = false;
    };
  }, []);

  const refrescar = React.useCallback(async (forzar = false) => {
    if (
      !debeRefrescarTablero({
        pestanaOculta: !forzar && document.hidden,
        mutacionesEnCurso: mutacionesRef.current,
        arrastreActivo: dragActivoRef.current,
      })
    )
      return;
    if (forzar) setRefreshing(true);
    try {
      const respuesta = await getTableroProduccion({ soloPendientes });
      if (
        !montadoRef.current ||
        mutacionesRef.current > 0 ||
        dragActivoRef.current
      )
        return;
      const snapshot = JSON.stringify(respuesta.items);
      if (snapshot !== ultimoSnapshotRef.current) {
        ultimoSnapshotRef.current = snapshot;
        setItems(respuesta.items);
      }
      setMeta({
        alcance: respuesta.alcance,
        puedeGestionar: respuesta.puedeGestionar,
        estacionIdsEjecutables: respuesta.estacionIdsEjecutables,
        vendedorSinVinculo: respuesta.vendedorSinVinculo,
      });
      setLoadError(null);
      setSyncError(null);
      setActualizadoEl(new Date());
    } catch (err) {
      if (!montadoRef.current) return;
      setSyncError(
        err instanceof Error
          ? err.message
          : "No se pudo actualizar el tablero. Se conservan los últimos datos.",
      );
    } finally {
      if (montadoRef.current && forzar) setRefreshing(false);
    }
  }, [soloPendientes]);

  useCambiosSistema(
    (cambio) => {
      if (cambio.topicos.includes("tablero-produccion")) {
        void refrescar();
      }
    },
    [refrescar],
  );

  React.useEffect(() => {
    const id = window.setInterval(() => void refrescar(), POLL_TABLERO_MS);
    const onFocus = () => {
      if (!document.hidden) void refrescar();
    };
    const onDragStart = () => {
      dragActivoRef.current = true;
    };
    const onDragEnd = () => {
      dragActivoRef.current = false;
    };
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);
    window.addEventListener("dragstart", onDragStart);
    window.addEventListener("dragend", onDragEnd);
    window.addEventListener("drop", onDragEnd);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("dragstart", onDragStart);
      window.removeEventListener("dragend", onDragEnd);
      window.removeEventListener("drop", onDragEnd);
    };
  }, [refrescar]);

  /**
   * Acción sobre un paso: el backend devuelve el item re-proyectado, pero
   * la acción puede promover la orden (pendiente → produccion) y eso afecta
   * a los items hermanos: se refresca el dataset completo (es chico).
   */
  const handleAccion = React.useCallback(
    async (
      item: ItemView,
      paso: TableroPasoData,
      accion: TableroPasoAccion,
      opts?: {
        motivo?: string;
        motivoDetalle?: string;
        tiempoDeclaradoMin?: number;
        sinTiempoConfirmado?: boolean;
      },
    ) => {
      if (!canManage) return;
      setBusy(true);
      setError(null);
      mutacionesRef.current += 1;
      try {
        const actualizado = await accionPasoProduccion(
          item.data.ordenId,
          item.id,
          paso.id,
          { accion, ...opts },
        );
        setItems((current) =>
          current.map((entry) =>
            entry.id === actualizado.id ? actualizado : entry,
          ),
        );
        const { items: refrescados } = await getTableroProduccion({ soloPendientes });
        setItems(refrescados);
        ultimoSnapshotRef.current = JSON.stringify(refrescados);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "No se pudo ejecutar la acción.",
        );
        throw err;
      } finally {
        mutacionesRef.current -= 1;
        setBusy(false);
      }
    },
    [canManage, soloPendientes],
  );

  const handleGate = React.useCallback<GateHandler>(
    async (paso, tipo, estado) => {
      if (!permisoSupervisar) return;
      setBusy(true);
      setError(null);
      mutacionesRef.current += 1;
      try {
        await resolverGatePasoProduccion(paso.id, { tipo, estado });
        const respuesta = await getTableroProduccion({ soloPendientes });
        setItems(respuesta.items);
        ultimoSnapshotRef.current = JSON.stringify(respuesta.items);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "No se pudo actualizar la condición operativa.",
        );
      } finally {
        mutacionesRef.current -= 1;
        setBusy(false);
      }
    },
    [permisoSupervisar, soloPendientes],
  );

  /**
   * Tomar/soltar un paso de MI mesa (persistente por usuario). Optimista:
   * la card se mueve al soltar; el server confirma con el item
   * re-proyectado (trae el nombre real del dueño) o se revierte.
   */
  const handleMesa = React.useCallback(
    async (pasoId: string, en: boolean) => {
      if (!canManage) return;
      const previo = items;
      mutacionesRef.current += 1;
      setItems((current) =>
        current.map((item) => ({
          ...item,
          pasos: item.pasos.map((paso) =>
            paso.id === pasoId
              ? { ...paso, mesaEsMia: en, mesaUsuarioNombre: en ? "vos" : null }
              : paso,
          ),
        })),
      );
      try {
        const actualizado = await mesaPasoProduccion(pasoId, en);
        setItems((current) =>
          actualizado.pasos.length === 0
            ? current.filter((entry) => entry.id !== actualizado.id)
            : current.map((entry) =>
                entry.id === actualizado.id ? actualizado : entry,
              ),
        );
      } catch (err) {
        setItems(previo);
        setError(
          err instanceof Error ? err.message : "No se pudo mover el paso.",
        );
      } finally {
        mutacionesRef.current -= 1;
      }
    },
    [canManage, items],
  );

  return {
    items,
    meta,
    busy,
    error,
    loadError,
    syncError,
    refreshing,
    actualizadoEl,
    permisoSupervisar,
    canManage,
    refrescar,
    handleAccion,
    handleGate,
    handleMesa,
  };
}
