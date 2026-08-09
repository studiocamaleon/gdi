"use client";

/**
 * Visor 3D del bastidor a fabricar, para el tab de Producción de un ítem de
 * cartelería. Es OUTPUT, no configurador: rendea la estructura que quedó en el
 * snapshot (lo cotizado, con overrides del sheet) en modo solo-estructura, más
 * el despiece al costado como guía de herrería.
 *
 * three.js se carga lazy: sólo pesa cuando el ítem es un bastidor de verdad.
 */

import * as React from "react";

import {
  getEstructuraBastidor,
  type EstructuraBastidor,
} from "@/lib/estructura-bastidor-api";
import type { CarteleriaVista } from "./geometria";
import s from "./bastidor-visor.module.css";

const CarteleriaViewport = React.lazy(() =>
  import("./viewport-3d").then((m) => ({ default: m.CarteleriaViewport })),
);

/** La estructura del snapshot al view-model que consume el viewport 3D. */
function vistaDeEstructura(e: EstructuraBastidor): CarteleriaVista {
  return {
    tipoCartel: e.tipoBastidor === "doble" ? "backlight" : "frontlight",
    width: e.anchoM,
    height: e.altoM,
    depth: e.profundidadM,
    sepRefuerzoVcm: e.sepRefuerzoVcm,
    sepRefuerzoHcm: e.sepRefuerzoHcm,
    cenefa: false,
    solapaCenefaCm: 0,
    pintura: false,
    fondo: false,
    // 40×40 por defecto (MVP): el lado real del perfil saldrá del material del
    // paso en una mejora posterior. Sólo afecta el grosor dibujado del caño.
    perfilLadoM: 0.04,
    densidadLed: 1,
    coberturaLedM2: 0,
  };
}

/** Despiece agrupado por largo, de mayor a menor (como lo lee la herrería). */
function agruparDespiece(despieceMm: number[]) {
  const porLargo = new Map<number, number>();
  for (const mm of despieceMm) porLargo.set(mm, (porLargo.get(mm) ?? 0) + 1);
  return [...porLargo.entries()]
    .map(([largoMm, cantidad]) => ({ largoMm, cantidad }))
    .sort((a, b) => b.largoMm - a.largoMm);
}

export function BastidorVisor({ itemId }: { itemId: string }) {
  const [estructura, setEstructura] = React.useState<EstructuraBastidor | null>(
    null,
  );
  const [cargando, setCargando] = React.useState(true);

  React.useEffect(() => {
    let vivo = true;
    setCargando(true);
    getEstructuraBastidor(itemId)
      .then((e) => vivo && setEstructura(e))
      .catch(() => vivo && setEstructura(null))
      .finally(() => vivo && setCargando(false));
    return () => {
      vivo = false;
    };
  }, [itemId]);

  // Sin estructura (no es bastidor, o el snapshot es viejo): no se muestra nada.
  if (!cargando && !estructura) return null;

  const vista = estructura ? vistaDeEstructura(estructura) : null;
  const despiece = estructura ? agruparDespiece(estructura.despieceMm) : [];
  const esDoble = estructura?.tipoBastidor === "doble";

  return (
    <div className={s.wrap}>
      <div className={s.head}>
        <span className={s.ttl}>Bastidor a fabricar</span>
        {estructura ? (
          <span className={s.sub}>
            {esDoble ? "Cajón (backlight)" : "Marco (frontlight)"} ·{" "}
            {(estructura.anchoM * 100).toFixed(0)}×
            {(estructura.altoM * 100).toFixed(0)}
            {esDoble ? `×${(estructura.profundidadM * 100).toFixed(0)}` : ""} cm
          </span>
        ) : null}
      </div>

      <div className={s.grid}>
        <div className={s.canvas}>
          {vista ? (
            <React.Suspense
              fallback={<div className={s.loading}>Cargando 3D…</div>}
            >
              <CarteleriaViewport vista={vista} soloEstructura />
            </React.Suspense>
          ) : (
            <div className={s.loading}>Cargando…</div>
          )}
        </div>

        <aside className={s.despiece}>
          <div className={s.despTtl}>
            Despiece
            {estructura ? ` · ${estructura.despieceMm.length} barras` : ""}
          </div>
          <ul className={s.despList}>
            {despiece.map((d) => (
              <li key={d.largoMm}>
                <span className={s.cant}>{d.cantidad}×</span>
                <span className={s.largo}>{d.largoMm} mm</span>
              </li>
            ))}
          </ul>
          {estructura ? (
            <div className={s.meta}>
              {estructura.refuerzosV + estructura.refuerzosH} refuerzos ·{" "}
              {estructura.puntosSoldadura} soldaduras
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
