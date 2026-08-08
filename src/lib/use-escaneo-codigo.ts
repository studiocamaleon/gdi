"use client";

import * as React from "react";

/**
 * Detecta un código escaneado con lector 2D en cualquier parte de la vista,
 * sin que el usuario tenga que abrir nada ni enfocar un input.
 *
 * Cómo distingue el lector de una persona: el lector "tipea" el código como
 * teclado a una velocidad que un humano no alcanza (10–30 ms por carácter;
 * alguien rápido tipea a 100–150 ms). Si llegan varios caracteres seguidos
 * con menos de `maxGapMs` entre uno y otro y cierra con Enter/Tab, es un
 * escaneo. Cualquier pausa humana reinicia el buffer, así que teclear el
 * mismo código a mano NO dispara — y los atajos de una tecla (P, C) siguen
 * funcionando porque nunca acumulan largo ni terminador.
 *
 * No escucha cuando el foco está en un campo editable: ahí el lector escribe
 * en ese campo, que es lo que se espera (el modo escaneo del modal tiene su
 * propio input).
 */
/**
 * Teclas que no son parte del código y no lo interrumpen. Shift es la clave:
 * los lectores escriben las mayúsculas como Shift+letra.
 */
const TECLAS_MODIFICADORAS = new Set([
  "Shift",
  "Control",
  "Alt",
  "Meta",
  "CapsLock",
  "AltGraph",
  "NumLock",
  "ScrollLock",
  "Dead",
]);

export function useEscaneoCodigo({
  activo,
  onCodigo,
  maxGapMs = 50,
  // 3 y no 4: un código corto ("TEST") queda al filo, y si se pierde el
  // primer carácter por un cambio de foco se descartaba en silencio. Tres
  // caracteres en ráfaga de <50 ms cerrada con Enter no los tipea un humano.
  minLargo = 3,
}: {
  /** Con false no engancha nada (vista en lectura, modal abierto, etc.). */
  activo: boolean;
  onCodigo: (codigo: string) => void;
  /** Máximo entre teclas para seguir considerándolo una ráfaga del lector. */
  maxGapMs?: number;
  /** Largo mínimo para tomarlo por código y no por pulsación suelta. */
  minLargo?: number;
}) {
  // El callback vive en un ref para que el efecto dependa sólo de `activo`:
  // si dependiera de la función, cada render reengancharía el listener y
  // perdería el buffer a mitad de un escaneo.
  const onCodigoRef = React.useRef(onCodigo);
  onCodigoRef.current = onCodigo;

  React.useEffect(() => {
    // Diagnóstico: `localStorage.setItem("debug:escaneo", "1")` en la consola.
    // Se lee en CADA tecla (no al montar) para que prenda sin recargar.
    // Loguea el gap de cada tecla y por qué se descartó: es lo único que
    // permite saber si el lector tipea lento, si no manda Enter, o si el foco
    // estaba en un campo.
    const hayDebug = () =>
      typeof window !== "undefined" &&
      window.localStorage.getItem("debug:escaneo") === "1";
    if (hayDebug()) {
      console.info(
        `[escaneo] listener ${activo ? "ACTIVO" : "APAGADO"} (gap<=${maxGapMs}ms, largo>=${minLargo})`,
      );
    }
    if (!activo) return;
    let buffer = "";
    let ultimaTecla = 0;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Las modificadoras se ignoran SIN tocar el buffer: el lector escribe
      // las mayúsculas como Shift+letra, así que llegan intercaladas
      // (Shift, T, Shift, E, …) y resetear ahí dejaba el código en una sola
      // letra. Tampoco mueven `ultimaTecla`: el gap se mide entre caracteres
      // reales, que es lo que distingue al lector de una persona.
      if (TECLAS_MODIFICADORAS.has(event.key)) return;
      // Un atajo del usuario (Ctrl+C) no es un código. Shift NO cuenta acá:
      // es parte normal de escribir en mayúsculas.
      if (event.metaKey || event.ctrlKey || event.altKey) {
        buffer = "";
        return;
      }
      const target = event.target as HTMLElement | null;
      if (
        target?.closest("input, textarea, select, [contenteditable='true']")
      ) {
        if (hayDebug()) {
          console.info(
            `[escaneo] "${event.key}" IGNORADA: el foco está en ${target.tagName.toLowerCase()}`,
          );
        }
        buffer = "";
        return;
      }
      if (hayDebug()) {
        const gapDbg = Math.round(event.timeStamp - ultimaTecla);
        console.info(
          `[escaneo] "${event.key}" gap=${gapDbg}ms buffer="${buffer}"`,
        );
      }

      const ahora = event.timeStamp;
      const gap = ahora - ultimaTecla;
      ultimaTecla = ahora;

      if (event.key === "Enter" || event.key === "Tab") {
        const codigo = buffer;
        buffer = "";
        // El terminador también tiene que llegar en ráfaga: si alguien deja
        // el foco quieto y aprieta Enter mucho después, no es un escaneo.
        if (codigo.length >= minLargo && gap <= maxGapMs) {
          event.preventDefault();
          onCodigoRef.current(codigo);
        } else if (hayDebug()) {
          console.warn(
            `[escaneo] Enter DESCARTADO: código="${codigo}" (largo ${codigo.length}, mínimo ${minLargo}) gap=${Math.round(gap)}ms (máximo ${maxGapMs})`,
          );
        }
        return;
      }

      // Sólo caracteres imprimibles (`key` de largo 1 descarta Shift, F5…).
      if (event.key.length !== 1) {
        buffer = "";
        return;
      }
      // Una pausa humana corta el código en curso y empieza uno nuevo.
      buffer = gap > maxGapMs ? event.key : buffer + event.key;
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activo, maxGapMs, minLargo]);
}
