"use client";

import * as React from "react";
import { CheckIcon, TriangleAlertIcon, XIcon } from "lucide-react";

import s from "./cupon-aviso.module.css";

/**
 * Resultado de una operación con cupón, para mostrar al vendedor. NUNCA
 * lleva el código: el escaneo pasa con el cliente enfrente y el código es
 * dato interno (un sorteo se quema si alguien lo copia de la pantalla).
 */
export type AvisoCupon = {
  tipo: "ok" | "error" | "aviso";
  titulo: string;
  detalle?: string;
  /** Monto/porcentaje descontado, en grande: lo que se le canta al cliente. */
  monto?: string;
};

/** Cuánto queda en pantalla según el tipo: un error se lee más despacio. */
const DURACION_MS: Record<AvisoCupon["tipo"], number> = {
  ok: 2600,
  aviso: 3600,
  error: 4200,
};

const SALIDA_MS = 350;

export function CuponAvisoModal({
  aviso,
  onCerrar,
}: {
  aviso: AvisoCupon | null;
  onCerrar: () => void;
}) {
  const [saliendo, setSaliendo] = React.useState(false);
  // El callback en un ref: si dependiera de la función, cada render del padre
  // reiniciaría los timers y el aviso no se cerraría nunca.
  const onCerrarRef = React.useRef(onCerrar);
  onCerrarRef.current = onCerrar;

  React.useEffect(() => {
    if (!aviso) return;
    setSaliendo(false);
    const duracion = DURACION_MS[aviso.tipo];
    const irse = setTimeout(() => setSaliendo(true), duracion);
    const cerrar = setTimeout(() => onCerrarRef.current(), duracion + SALIDA_MS);
    return () => {
      clearTimeout(irse);
      clearTimeout(cerrar);
    };
    // `titulo` entra en las deps para que dos avisos seguidos del mismo tipo
    // (dos escaneos al hilo) reinicien los timers en vez de heredarlos.
  }, [aviso, aviso?.tipo, aviso?.titulo]);

  if (!aviso) return null;

  const Icono =
    aviso.tipo === "ok"
      ? CheckIcon
      : aviso.tipo === "error"
        ? XIcon
        : TriangleAlertIcon;

  return (
    <div
      className={`${s.overlay} ${s[aviso.tipo]}${saliendo ? ` ${s.saliendo}` : ""}`}
      onClick={onCerrar}
      role="alert"
      aria-live="assertive"
    >
      <div className={s.card} onClick={(event) => event.stopPropagation()}>
        <span className={s.ico}>
          <Icono />
        </span>
        <div className={s.titulo}>{aviso.titulo}</div>
        {aviso.detalle ? (
          <div className={s.detalle}>{aviso.detalle}</div>
        ) : null}
        {aviso.monto ? <div className={s.monto}>{aviso.monto}</div> : null}
        <div className={s.barra}>
          <span
            style={{ animationDuration: `${DURACION_MS[aviso.tipo]}ms` }}
          />
        </div>
      </div>
    </div>
  );
}
