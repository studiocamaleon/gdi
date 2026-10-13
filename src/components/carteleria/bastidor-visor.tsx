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
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
    // El lado real del caño viene del despiece del motor (la variante elegida
    // en perfil_estructural); 40×40 sólo para snapshots anteriores al fix.
    perfilLadoM: e.perfilLadoM ?? 0.04,
    perfilProfundidadM: e.perfilProfundidadM ?? e.perfilLadoM ?? 0.04,
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

export function BastidorVisor({
  itemId,
  estructuraLocal,
}: {
  itemId: string;
  /**
   * Estructura ya presente en el cliente (la cotización en memoria del
   * cotizador). Con esto el visor dibuja SIN fetch — imprescindible mientras
   * el ítem se está componiendo y todavía no existe en la base.
   */
  estructuraLocal?: EstructuraBastidor | null;
}) {
  const [estructuraTrabajo, setEstructura] =
    React.useState<EstructuraBastidor | null>(estructuraLocal ?? null);
  const [cargando, setCargando] = React.useState(!estructuraLocal);
  const [indiceMedida, setIndiceMedida] = React.useState(0);

  React.useEffect(() => {
    // Con estructura local no hay nada que buscar (y el fetch fallaría: el
    // ítem puede no existir todavía en la base).
    if (estructuraLocal) {
      setEstructura(estructuraLocal);
      setCargando(false);
      return;
    }
    let vivo = true;
    setCargando(true);
    getEstructuraBastidor(itemId)
      .then((e) => vivo && setEstructura(e))
      .catch(() => vivo && setEstructura(null))
      .finally(() => vivo && setCargando(false));
    return () => {
      vivo = false;
    };
  }, [itemId, estructuraLocal]);

  // Sin estructura (no es bastidor, o el snapshot es viejo): no se muestra nada.
  if (!cargando && !estructuraTrabajo) return null;

  const variantes = estructuraTrabajo?.variantes ?? [];
  const indice = indiceMedida < variantes.length ? indiceMedida : 0;
  const estructura = variantes[indice] ?? estructuraTrabajo;
  const barras = estructuraTrabajo?.barras;
  const opcionesMedida = variantes.map((e, index) => ({
    value: String(index),
    label: `${e.cantidad} × ${(e.anchoM * 100).toLocaleString("es-AR")} × ${(e.altoM * 100).toLocaleString("es-AR")} cm`,
  }));
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

      {variantes.length > 1 ? (
        <Select
          items={opcionesMedida}
          value={String(indice)}
          onValueChange={(value) =>
            value !== null && setIndiceMedida(Number(value))
          }
        >
          <SelectTrigger aria-label="Medida del bastidor" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {opcionesMedida.map((opcion) => (
                <SelectItem key={opcion.value} value={opcion.value}>
                  {opcion.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      ) : null}

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
            {estructura ? ` · ${estructura.despieceMm.length} piezas` : ""}
            {variantes.length > 1 ? " por bastidor" : ""}
          </div>
          <ul className={s.despList}>
            {despiece.map((d) => (
              <li key={d.largoMm}>
                <span className={s.cant}>{d.cantidad}×</span>
                <span className={s.largo}>{d.largoMm} mm</span>
              </li>
            ))}
          </ul>
          {barras ? (
            <div className={s.meta}>
              Para todo el trabajo:
              <br />
              {barras.cantidad} barras de {barras.largoM} m ·{" "}
              {barras.metrosComerciales.toLocaleString("es-AR")} m comerciales
              <br />
              {barras.metrosUtiles.toLocaleString("es-AR", {
                maximumFractionDigits: 3,
              })}{" "}
              m de piezas ·{" "}
              {barras.sobranteM.toLocaleString("es-AR", {
                maximumFractionDigits: 3,
              })}{" "}
              m de sobrantes, descontados los cortes
            </div>
          ) : null}
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
