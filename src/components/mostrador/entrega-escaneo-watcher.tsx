"use client";

/**
 * Escucha el lector 2D en TODA la zona autenticada: el cliente llega al
 * mostrador con su QR, el operador escanea esté donde esté en el sistema y
 * se abre la entrega encima de lo que estaba haciendo.
 *
 * Sólo reacciona a códigos con forma de número de orden (OT-2026-0184). Ese
 * filtro es lo que evita pisarse con el escaneo de CUPONES, que vive en la
 * ficha de la propuesta y usa códigos libres: los dos listeners escuchan el
 * mismo teclado y cada uno se queda con lo suyo.
 */

import * as React from "react";

import { useEscaneoCodigo } from "@/lib/use-escaneo-codigo";
import {
  parsearDniArgentino,
  type DatosDocumento,
} from "@/lib/dni-argentino";
import { EntregaModal } from "./entrega-modal";
import { AltaDniModal } from "./alta-dni-modal";

/** OT-2026-0184, ya normalizado. */
const NUMERO_ORDEN = /^OT-\d{4}-\d+$/;

/**
 * ¿Lo escaneado es el QR de una orden? Lo usan también los listeners que
 * NO quieren órdenes (el de cupones de la ficha), para no pisarse.
 */
export function esNumeroOrden(crudo: string): boolean {
  return NUMERO_ORDEN.test(normalizarNumeroOrden(crudo));
}

/**
 * Arregla el guión que el lector no manda como guión.
 *
 * Los lectores 2D emulan un teclado **US**: mandan la POSICIÓN de la tecla,
 * no el carácter. Con el sistema en español/latinoamericano, la tecla que en
 * US es `-` produce `'`, y el código llega como `OT'2026'0009` (comprobado
 * 2026-08-09 con el lector de Lucas). Lo mismo puede pasar con otros
 * separadores según el layout.
 *
 * Como el formato de un número de orden es cerrado —letras, dígitos y
 * guiones— cualquier cosa que no sea alfanumérica se toma por el separador.
 * Es más confiable que pedirle a cada cliente que reconfigure su lector.
 */
export function normalizarNumeroOrden(crudo: string): string {
  return crudo
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function EntregaEscaneoWatcher() {
  const [codigo, setCodigo] = React.useState<string | null>(null);
  const [documento, setDocumento] = React.useState<DatosDocumento | null>(null);

  useEscaneoCodigo({
    // Con un modal abierto se apaga: el segundo escaneo tendría que
    // reemplazar lo que hay en pantalla y eso confunde más de lo que ayuda.
    activo: codigo == null && documento == null,
    onCodigo: (leido) => {
      // Dos cosas distintas entran por el mismo lector, y cada una se
      // reconoce por su forma: el QR de una orden es OT-AAAA-NNNN, y el
      // PDF417 de un DNI trae apellido, nombre y número separados.
      const numero = normalizarNumeroOrden(leido);
      if (NUMERO_ORDEN.test(numero)) {
        setCodigo(numero);
        return;
      }
      // Sobre el texto CRUDO: la normalización de arriba se come los
      // separadores que este parser necesita.
      const dni = parsearDniArgentino(leido);
      if (dni) setDocumento(dni);
    },
  });

  if (documento) {
    return (
      <AltaDniModal datos={documento} onClose={() => setDocumento(null)} />
    );
  }
  if (codigo) {
    return <EntregaModal codigo={codigo} onClose={() => setCodigo(null)} />;
  }
  return null;
}
