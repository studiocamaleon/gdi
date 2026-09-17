"use client";

import * as React from "react";
import { apiRequest } from "@/lib/api";
import type { cotizarYGuardar } from "@/lib/productos-servicios-api";
import { useMotorConTipoCambio } from "./tipo-cambio-documento";
import type { PropuestaItem } from "@/lib/propuestas";
import {
  huellaEntradaPlan,
  huellaFabricacionPlan,
  vinculoPlanPrevio,
  resumirDistribucion,
  fechaFinalDistribucion,
  type ResumenDistribucion,
  type EntregaPlan,
  type VistaPlanEntrega,
} from "@/lib/planificacion-entregas";

export type EntregasPreviasProps = {
  preparar: () => Promise<{
    path: string;
    entregas?: EntregaPlan[];
    editadoInicial?: boolean;
  }>;
  recibir: (
    vista: VistaPlanEntrega,
    entregas: EntregaPlan[],
    editado: boolean,
    escribiendo?: boolean,
    origenPath?: string,
  ) => void;
  quitar: () => void;
  resumen: string | null;
  distribucion: ResumenDistribucion | null;
};
type Entrada = Parameters<typeof cotizarYGuardar>[0];
type Preparada = {
  huella: string;
  huellaFabricacion: string;
  comercial?: { huella: string; cotizacionItemId: string };
  cotizacionItemId: string;
  vista: VistaPlanEntrega | null;
  entregas?: EntregaPlan[];
  editado: boolean;
  escribiendo?: boolean;
};
const ruta = (id: string) => `/cotizaciones/items/${id}/planificacion-entregas`;

/** Cotización preparatoria: nunca crea una OT ni reserva producción. */
export function useEntregasPrevias(
  entradaPara: (item: PropuestaItem) => Entrada,
) {
  const { cotizarYGuardar } = useMotorConTipoCambio();
  const preparadas = React.useRef(new Map<string, Preparada>());
  const pendientes = React.useRef(new Map<string, Promise<Preparada>>());
  const [, actualizar] = React.useReducer((n: number) => n + 1, 0);

  async function preparar(item: PropuestaItem) {
    const entrada = entradaPara(item);
    const huella = await huellaEntradaPlan(entrada);
    const huellaFabricacion = await huellaFabricacionPlan(entrada);
    const anterior = preparadas.current.get(item.id);
    if (anterior?.huellaFabricacion === huellaFabricacion) return anterior;
    const clave = `${item.id}:${huella}`;
    const existente = pendientes.current.get(clave);
    if (existente) return existente;
    const trabajo = (async () => {
      const r = await cotizarYGuardar(entrada);
      if (!r.result.exitoso || !r.cotizacionItemId)
        throw new Error(
          r.result.errores?.[0]?.mensaje ??
            "No se pudo preparar la cotización para distribuir sus entregas.",
        );
      const preparada: Preparada = {
        huella,
        huellaFabricacion,
        cotizacionItemId: r.cotizacionItemId,
        vista: null,
        entregas: anterior?.entregas,
        editado: anterior?.editado || !!anterior?.vista?.plan,
      };
      preparadas.current.set(item.id, preparada);
      actualizar();
      return preparada;
    })();
    pendientes.current.set(clave, trabajo);
    try {
      return await trabajo;
    } finally {
      pendientes.current.delete(clave);
    }
  }

  function propsPara(item: PropuestaItem): EntregasPreviasProps {
    const actual = preparadas.current.get(item.id);
    const plan = actual?.vista?.plan;
    return {
      preparar: async () => {
        const p = await preparar(item);
        return {
          path: ruta(p.cotizacionItemId),
          entregas: p.entregas,
          editadoInicial: p.editado,
        };
      },
      recibir: (vista, entregas, editado, escribiendo = false, origenPath) => {
        const p = preparadas.current.get(item.id);
        if (!p || (origenPath && ruta(p.cotizacionItemId) !== origenPath))
          return;
        p.vista = vista;
        p.entregas = entregas;
        p.editado = editado;
        p.escribiendo = escribiendo;
        actualizar();
      },
      quitar: () => {
        preparadas.current.delete(item.id);
        actualizar();
      },
      distribucion: resumirDistribucion(
        plan ?? null,
        actual?.entregas,
        actual?.editado,
      ),
      resumen: actual?.editado
        ? "Distribución pendiente de calcular"
        : plan
          ? `${plan.entregas.length} entregas · ${plan.estado === "LISTA" ? "preparadas para guardar" : plan.estado === "FALLIDA" ? "requieren revisión" : "calculando"}`
          : null,
    };
  }

  async function paraGuardar(item: PropuestaItem) {
    const p = preparadas.current.get(item.id);
    if (p?.escribiendo)
      throw new Error(
        "Se está guardando la distribución. Esperá un momento antes de guardar la OT.",
      );
    if (!p || (!p.editado && !p.vista?.plan)) return null;
    const entrada = entradaPara(item);
    if (p.huellaFabricacion !== (await huellaFabricacionPlan(entrada)))
      throw new Error(
        `Cambió la configuración de "${item.productoNombre}". Abrí Distribuir entregas y volvé a calcular antes de guardar la OT.`,
      );
    // La tarea continúa aunque se cierre el modal. Lee su estado final y
    // su versión actual antes de armar la creación atómica de la OT.
    const vista = await apiRequest<VistaPlanEntrega>(ruta(p.cotizacionItemId));
    const planEntrega = vinculoPlanPrevio(
      vista.plan,
      p.entregas ?? [],
      p.vista?.plan?.version,
    );
    p.vista = vista;
    // La distribución conserva su origen productivo. La OT utiliza un snapshot
    // comercial nuevo para respetar los precios del cliente elegido al guardar.
    const huella = await huellaEntradaPlan(entrada);
    let cotizacionItemId = p.cotizacionItemId;
    if (p.huella !== huella) {
      if (p.comercial?.huella !== huella) {
        const r = await cotizarYGuardar(entrada);
        if (!r.result.exitoso || !r.cotizacionItemId)
          throw new Error(r.result.errores?.[0]?.mensaje ??
            "No se pudo actualizar el precio para el cliente seleccionado. La distribución se conserva.");
        p.comercial = { huella, cotizacionItemId: r.cotizacionItemId };
      }
      cotizacionItemId = p.comercial.cotizacionItemId;
    }
    return { cotizacionItemId, planEntrega };
  }

  function fechaPara(item: PropuestaItem) {
    const p = preparadas.current.get(item.id);
    return fechaFinalDistribucion(
      resumirDistribucion(p?.vista?.plan ?? null, p?.entregas, p?.editado),
    );
  }

  return { propsPara, paraGuardar, fechaPara };
}
