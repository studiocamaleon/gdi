"use client";

import { confirmarAsignacionPersonal } from "@/lib/asignacion-personal-api";
import * as React from "react";
import { useCambiosSistema, useNotificaciones } from "@/components/notificaciones/notificaciones-provider";
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
  type AvisoFinalizacionOrden,
} from "@/lib/ordenes-trabajo-api";
import { crearSincronizadorTablero } from "@/lib/sincronizacion-tablero";
import type { ItemView } from "@/lib/produccion-item-view";
const POLL_TABLERO_MS = 15000;
type GateHandler = (
  paso: TableroPasoData,
  tipo: "MATERIAL" | "CALIDAD",
  estado: "CUMPLIDO" | "PENDIENTE",
) => Promise<void>;
export type DatosProduccionOperativa = {
  onOrdenFinalizada?: (aviso: AvisoFinalizacionOrden) => void;
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
  onOrdenFinalizada,
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
  const { estado: conexion } = useNotificaciones();
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

  const sincronizador = React.useMemo(() => crearSincronizadorTablero({
    puedeActualizar: (forzar) => montadoRef.current && debeRefrescarTablero({
      pestanaOculta: !forzar && document.hidden,
      mutacionesEnCurso: mutacionesRef.current,
      arrastreActivo: dragActivoRef.current,
    }),
    consultar: () => getTableroProduccion({ soloPendientes }),
    aplicar: (respuesta) => {
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
    },
    fallo: (err) => setSyncError(err instanceof Error ? err.message : "No se pudo actualizar el tablero. Se conservan los últimos datos."),
  }), [soloPendientes]);

  const refrescar = React.useCallback(async (forzar = false) => {
    if (forzar) setRefreshing(true);
    try {
      await sincronizador.actualizar(forzar);
    } finally {
      if (montadoRef.current && forzar) setRefreshing(false);
    }
  }, [sincronizador]);

  React.useEffect(() => {
    if (conexion === "en_vivo") void refrescar();
  }, [conexion, refrescar]);

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
      void refrescar();
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
      if (!canManage || mutacionesRef.current > 0) return;
      let avisoFinalizacion: AvisoFinalizacionOrden | null = null;
      setBusy(true);
      setError(null);
      mutacionesRef.current += 1;
      sincronizador.invalidar();
      try {
        const actualizado = await accionPasoProduccion(
          item.data.ordenId,
          item.id,
          paso.id,
          { accion, ...opts },
        );
        avisoFinalizacion = actualizado.avisoFinalizacion ?? null;
        setItems((current) =>
          current.map((entry) =>
            entry.id === actualizado.id ? actualizado : entry,
          ),
        );
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "No se pudo ejecutar la acción.",
        );
        throw err;
      } finally {
        mutacionesRef.current -= 1;
        await refrescar();
        if (montadoRef.current) {
          setBusy(false);
          if (avisoFinalizacion) onOrdenFinalizada?.(avisoFinalizacion);
        }
      }
    },
    [canManage, sincronizador, refrescar, onOrdenFinalizada],
  );

  const handleGate = React.useCallback<GateHandler>(
    async (paso, tipo, estado) => {
      if (!permisoSupervisar) return;
      setBusy(true);
      setError(null);
      mutacionesRef.current += 1;
      sincronizador.invalidar();
      try {
        await resolverGatePasoProduccion(paso.id, { tipo, estado });
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "No se pudo actualizar la condición operativa.",
        );
      } finally {
        mutacionesRef.current -= 1;
        await refrescar();
        if (montadoRef.current) setBusy(false);
      }
    },
    [permisoSupervisar, sincronizador, refrescar],
  );

  /**
   * Tomar/soltar un paso de MI mesa (persistente por usuario). Optimista:
   * el servidor confirma con el item re-proyectado (trae el nombre real
   * del dueño) o se revierte.
   */
  const handleMesa = React.useCallback(
    async (pasoId: string, en: boolean) => {
      if (!canManage || mutacionesRef.current > 0) return;
      const previo = items;
      mutacionesRef.current += 1;
      sincronizador.invalidar();
      setBusy(true);
      setError(null);
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
        await refrescar();
        if (montadoRef.current) setBusy(false);
      }
    },
    [canManage, items, sincronizador, refrescar],
  );

  const handleAsignacionPersonal = React.useCallback(async (pasoId: string, token: string, motivo?: string) => {
    if (!permisoSupervisar) throw new Error("Necesitás permiso de supervisión.");
    if (mutacionesRef.current > 0) throw new Error("Esperá a que termine la operación en curso.");
    mutacionesRef.current += 1;
    sincronizador.invalidar();
    setBusy(true);
    try {
      await confirmarAsignacionPersonal(pasoId, token, motivo);
    } finally {
      mutacionesRef.current -= 1;
      await refrescar(true);
      if (montadoRef.current) setBusy(false);
    }
  }, [permisoSupervisar, sincronizador, refrescar]);

  return {
    items,
    meta,
    busy,
    error,
    loadError,
    syncError,
    refreshing,
    conexion,
    actualizadoEl,
    permisoSupervisar,
    canManage,
    refrescar,
    handleAccion,
    handleGate,
    handleMesa,
    handleAsignacionPersonal,
  };
}
