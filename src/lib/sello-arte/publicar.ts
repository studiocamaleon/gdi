"use client";

/**
 * Publica el arte del sello como archivos del ítem de la orden.
 *
 * Antes de esto el editor generaba los dos EPS y el comercial los bajaba a su
 * máquina: el taller dependía de que se los mandara por otro lado. Ahora, al
 * guardar la orden, el mismo motor los vuelve a dibujar y los sube a los
 * Archivos del ítem — donde el operario ya los ve desde el tablero.
 *
 * Se genera en el navegador y no en el servidor porque el motor y las
 * tipografías ya viven acá, y porque subir por este camino es lo que hace que
 * el arte sea un adjunto normal: valida la cuota del plan, valida el contenido
 * real y aparece en el tab como cualquier archivo que sube una persona.
 *
 * Nunca lanza: la orden ya está guardada cuando esto corre, así que un fallo
 * de red no puede hacer fracasar el guardado. Devuelve qué pasó para que la
 * ficha lo cuente.
 */

import { epsSello, layoutSello } from "./engine";
import { cargarTipografiasSello } from "./fonts";
import {
  esDisenoCompleto,
  nombreArteSello,
  type DisenoSelloCompleto,
  type ItemConSello,
} from "./diseno";
import { eliminarArchivo, listarArchivos, subirArchivo } from "@/lib/archivos-api";

/** Valor de `autogeneradoPor`: identifica los artes que puso el configurador. */
export const AUTOGENERADO_SELLO = "sello";

const MIME_EPS = "application/postscript";

export type { ItemConSello };

export type ResultadoArtes = {
  /** Ítems a los que se les subió el arte. */
  publicados: number;
  /** Ítems que no se pudieron publicar, con el motivo. */
  fallidos: Array<{ productoNombre: string; motivo: string }>;
  /** Diseños viejos sin medidas guardadas: hay que reabrir el editor. */
  sinMedidas: string[];
};

/**
 * Los dos EPS de un sello: positivo para el grabado láser y negativo para el
 * polímero líquido. Es lo mismo que descargaban los dos botones del editor.
 */
export async function generarArtesDeSello(
  diseno: DisenoSelloCompleto,
): Promise<Array<{ nombre: string; contenido: string }>> {
  const resolver = await cargarTipografiasSello();
  const layout = layoutSello(
    diseno.modelo,
    diseno.lineas.map((l) => ({ ...l, fontKey: diseno.fontKey })),
    resolver,
    { align: diseno.align },
  );
  return [false, true].map((negativo) => ({
    nombre: nombreArteSello(diseno, negativo),
    contenido: epsSello(layout, {
      negative: negativo,
      meta: { modeloNombre: diseno.modelo.nombre },
    }),
  }));
}

/**
 * Reemplaza el arte de un ítem: borra el que había puesto el sistema y sube el
 * nuevo. Sólo toca lo autogenerado — lo que subió una persona no se mueve.
 *
 * Se borra ANTES de subir a propósito: si el diseño cambió de nombre (cambió
 * la primera línea o el modelo), dejar el viejo significaría dos artes
 * distintos en el mismo ítem y el taller no sabría cuál grabar.
 */
async function publicarItem(item: ItemConSello): Promise<void> {
  if (!esDisenoCompleto(item.diseno)) return;
  const artes = await generarArtesDeSello(item.diseno);

  const previos = await listarArchivos("ORDEN_ITEM", item.ordenItemId);
  for (const archivo of previos) {
    if (archivo.autogeneradoPor === AUTOGENERADO_SELLO) {
      await eliminarArchivo(archivo.id);
    }
  }

  for (const arte of artes) {
    const file = new File([arte.contenido], arte.nombre, { type: MIME_EPS });
    await subirArchivo(file, {
      scope: "ORDEN_ITEM",
      entidadId: item.ordenItemId,
      descripcion: `Arte del sello · ${item.diseno.modelo?.nombre ?? "matriz"}`,
      autogeneradoPor: AUTOGENERADO_SELLO,
    });
  }
}

/**
 * Publica el arte de todos los ítems con sello de una orden recién guardada.
 * Un ítem que falla no frena a los demás.
 */
export async function publicarArtesDeSello(
  items: ItemConSello[],
): Promise<ResultadoArtes> {
  const resultado: ResultadoArtes = {
    publicados: 0,
    fallidos: [],
    sinMedidas: [],
  };
  for (const item of items) {
    if (!esDisenoCompleto(item.diseno)) {
      resultado.sinMedidas.push(item.productoNombre);
      continue;
    }
    try {
      await publicarItem(item);
      resultado.publicados += 1;
    } catch (error) {
      resultado.fallidos.push({
        productoNombre: item.productoNombre,
        motivo:
          error instanceof Error ? error.message : "no se pudo subir el arte",
      });
    }
  }
  return resultado;
}

/** El aviso para la ficha, o null si no hay nada que contar. */
export function mensajeDeArtes(resultado: ResultadoArtes): string | null {
  const partes: string[] = [];
  if (resultado.fallidos.length > 0) {
    partes.push(
      `No se pudo guardar el arte de ${resultado.fallidos
        .map((f) => `"${f.productoNombre}" (${f.motivo})`)
        .join(" · ")}. Volvé a guardar la orden para reintentarlo.`,
    );
  }
  if (resultado.sinMedidas.length > 0) {
    partes.push(
      `El sello de ${resultado.sinMedidas
        .map((n) => `"${n}"`)
        .join(" · ")} se diseñó antes de que el arte se guardara solo: abrí el editor y guardá el diseño de nuevo para generarlo.`,
    );
  }
  return partes.length > 0 ? partes.join(" ") : null;
}
