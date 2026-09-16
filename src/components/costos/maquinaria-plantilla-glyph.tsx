import type { ReactNode } from "react";
import type { PlantillaMaquinaria } from "@/lib/maquinaria";

// La misma tinta, papel y volumen que ProductoCatalogoGlyph. La imagen depende
// de la plantilla estable; los nombres, marcas y estados no cambian el dibujo.
const tinta = "var(--brand-graphite)";
const naranja = "var(--accent)";
const canto = "var(--accent-soft-foreground)";
const papel = "var(--surface)";
const linea = "var(--border-strong)";
const gris = "var(--muted-text)";

const dibujos: Record<PlantillaMaquinaria, ReactNode> = {
  impresora_laser: (
    <>
      <path d="m12 22 27-9 14 8-27 10Z" fill={papel} stroke={linea} />
      <path d="m12 22 14 9v27l-14-9Z" fill={naranja} />
      <path d="m26 31 27-10v27L26 58Z" fill={tinta} />
      <path d="m18 12 23-7 8 5v11l-23 8-8-5Z" fill={papel} stroke={linea} />
      <path d="m18 12 8 5 23-7M26 17v12" stroke={gris} />
      <path d="m30 34 18-6v6l-18 6Z" fill={gris} />
      <path d="m31 35 15-5 6 7-15 5Z" fill={papel} />
      <path d="m31 47 17-6m-17 11 17-6" stroke={gris} />
      <path d="m15 28 7 4v5l-7-4Z" fill={tinta} />
    </>
  ),
  duplicadora_digital: (
    <>
      <path d="m9 28 26-9 16 9-26 10Z" fill={papel} stroke={linea} />
      <path d="m9 28 16 10v19L9 47Z" fill={naranja} />
      <path d="m25 38 26-10v19L25 57Z" fill={tinta} />
      <path d="m13 18 23-8 12 7-23 8Z" fill={tinta} />
      <path d="M13 18v8l12 7v-8Z" fill={gris} />
      <path d="m25 25 23-8v8l-23 8Z" fill={naranja} />
      <path d="m29 39 18-6v4l-18 6Z" fill={gris} />
      <path d="m30 41 17-6 12 8-17 6Z" fill={papel} stroke={linea} />
      <path d="m43 52 16-6m-15 9 15-6" stroke={gris} />
      <path d="m17 17 15-5 6 4-15 5Z" fill={papel} />
      <path d="m13 34 7 4m-7 4 7 4" stroke={canto} />
    </>
  ),
  impresora_gran_formato_por_area: (
    <>
      <path
        d="M14 35v18m35-26v23M9 55l12-4m22 2 12-4"
        stroke={tinta}
        strokeWidth="3"
      />
      <path d="m5 21 39-11 15 9-39 12Z" fill={papel} stroke={linea} />
      <path d="M5 21v13l15 9V31Z" fill={tinta} />
      <path d="m20 31 39-12v13L20 44Z" fill={naranja} />
      <path d="m24 34 30-9v5l-30 9Z" fill={tinta} />
      <path
        d="m26 37 23-7v15c0 5-8 8-13 9l-10 3Z"
        fill={papel}
        stroke={linea}
      />
      <path d="m31 40 13-4v9l-13 4Z" fill={naranja} />
      <path d="m34 44 4-5 4 3" stroke={tinta} />
      <path d="m8 24 7 4v5l-7-4Z" fill={naranja} />
    </>
  ),
  guillotina: (
    <>
      <path d="m10 41 29-10 16 10-29 11Z" fill={papel} stroke={linea} />
      <path d="M10 41v8l16 10v-7Z" fill={naranja} />
      <path d="m26 52 29-11v8L26 60Z" fill={tinta} />
      <path d="M13 39V17l28-9 11 6v23l-7 2V20l-24 8v16Z" fill={tinta} />
      <path d="m13 17 28-9 11 6-28 10Z" fill={naranja} />
      <path d="m24 24 21-7v10l-21 9Z" fill={papel} stroke={linea} />
      <path d="m25 32 19-8v5l-19 8Z" fill={naranja} />
      <path d="m19 42 20-7 11 6-20 8Z" fill={papel} stroke={linea} />
      <path d="m30 45 12-4m-12 8 20-7M17 53v5m33-7v5" stroke={gris} />
    </>
  ),
  plotter_de_corte: (
    <>
      <path
        d="M13 31v20m36-29v25M7 55l13-5m22 2 13-5"
        stroke={tinta}
        strokeWidth="3"
      />
      <path d="m5 19 40-11 14 8-40 12Z" fill={tinta} />
      <path d="M5 19v10l14 8v-9Z" fill={gris} />
      <path d="m19 28 40-12v9L19 37Z" fill={naranja} />
      <path d="m24 34 27-8v20l-27 9Z" fill={papel} stroke={linea} />
      <path d="m30 47 5-13 6-2 5 10-5 2-1-3-5 2-1 3Z" fill={naranja} />
      <path d="m24 20 7-2 5 3v9l-7 2-5-3Z" fill={papel} stroke={linea} />
      <path d="m29 32 3 4 2-6" fill={tinta} />
      <path d="m23 58 31-10" stroke={gris} strokeDasharray="2 3" />
    </>
  ),
  plotter_cad: (
    <>
      <path
        d="M15 33v20m33-28v25M9 56l13-5m21 3 12-4"
        stroke={tinta}
        strokeWidth="3"
      />
      <path d="m6 18 39-10 13 8-39 11Z" fill={papel} stroke={linea} />
      <path d="M6 18v13l13 8V27Z" fill={tinta} />
      <path d="m19 27 39-11v12L19 40Z" fill={papel} stroke={linea} />
      <path d="m23 30 29-8v5l-29 9Z" fill={tinta} />
      <path d="m26 33 24-7v26l-24 8Z" fill={papel} stroke={linea} />
      <path d="m31 39 14-4v13l-14 5Zm6-2v8l8-3m-14 3 6-2" stroke={canto} />
      <path d="m9 22 7 4v5l-7-4Z" fill={naranja} />
    </>
  ),
  laminadora_bopp_rollo: (
    <>
      <path d="m9 41 31-10 16 10-31 11Z" fill={papel} stroke={linea} />
      <path d="M9 41v9l16 9v-7Z" fill={naranja} />
      <path d="m25 52 31-11v9L25 60Z" fill={tinta} />
      <path d="M13 39V18m35 16V8" stroke={tinta} strokeWidth="4" />
      <path d="m16 10 29-8c8-2 13 13 6 16l-30 9Z" fill={papel} stroke={linea} />
      <ellipse
        cx="18"
        cy="19"
        rx="6"
        ry="9"
        transform="rotate(-20 18 19)"
        fill={naranja}
      />
      <ellipse cx="18" cy="19" rx="2" ry="3" fill={tinta} />
      <path
        d="m24 24 24-7v25l-24 9Z"
        fill={papel}
        fillOpacity="0.8"
        stroke={linea}
      />
      <path d="m16 35 34-11c5-2 8 7 4 9L20 45Z" fill={tinta} />
      <ellipse cx="18" cy="40" rx="4" ry="5" fill={naranja} />
      <path d="m32 39 13-4v6l-13 4Z" fill={naranja} />
    </>
  ),
  corte_laser: (
    <>
      <path d="m6 35 32-11 20 12-32 12Z" fill={papel} stroke={linea} />
      <path d="M6 35v13l20 12V48Z" fill={naranja} />
      <path d="m26 48 32-12v13L26 60Z" fill={tinta} />
      <path d="m10 18 28-10 15 9v19L25 46 10 37Z" fill={tinta} />
      <path d="m10 18 28-10 15 9-28 10Z" fill={naranja} />
      <path d="m16 18 21-7 10 6-21 7Z" fill={papel} />
      <path d="m15 35 22-8 14 9-24 8Z" fill={papel} stroke={linea} />
      <path d="m20 28 23-8" stroke={gris} strokeWidth="3" />
      <path d="m31 23 6-2v7l-3 3-3-1Z" fill={naranja} />
      <path d="M34 30v7m-3 1 6-2m-5-1 4 4" stroke={canto} />
      <path d="m10 41 9 5v4l-9-5Z" fill={tinta} />
    </>
  ),
  router_cnc: (
    <>
      <path d="M12 42v11m37-10v12m-19-3v9" stroke={tinta} strokeWidth="4" />
      <path d="m6 34 31-12 21 13-31 13Z" fill={papel} stroke={linea} />
      <path d="M6 34v8l21 13v-7Z" fill={naranja} />
      <path d="m27 48 31-13v8L27 55Z" fill={tinta} />
      <path d="m13 35 28-10m-22 14 28-10m-22 14 28-10" stroke={linea} />
      <path d="M14 35V14l31-9 9 6v22l-7 3V19l-25 8v12Z" fill={tinta} />
      <path d="m14 14 31-9 9 6-31 10Z" fill={naranja} />
      <path d="m29 17 7-2 6 4v13l-7 3-6-4Z" fill={papel} stroke={linea} />
      <path d="m35 35 3 3v5" stroke={canto} strokeWidth="2" />
      <path d="m33 43 9-3 5 3-9 4Z" stroke={canto} />
    </>
  ),
  corte_hilo_caliente: (
    <>
      <path d="m7 40 30-11 20 12-30 12Z" fill={papel} stroke={linea} />
      <path d="M7 40v7l20 12v-6Z" fill={tinta} />
      <path d="m27 53 30-12v7L27 59Z" fill={gris} />
      <path d="M12 41V13l27-9 13 7v27" stroke={tinta} strokeWidth="4" />
      <path d="m12 13 27-9 13 7-27 9Z" fill={naranja} />
      <path d="m19 36 18-6 13 8-18 7Z" fill={papel} stroke={linea} />
      <path d="M19 36v9l13 8v-8Z" fill={naranja} />
      <path d="m32 45 18-7v9l-18 6Z" fill={papel} stroke={linea} />
      <path d="m23 18 19-6M23 18v31m19-37v31" stroke={canto} />
      <path d="m27 36 6-2 5 3-6 2Z" stroke={canto} strokeDasharray="2 2" />
    </>
  ),
  anilladora: (
    <>
      <path d="m7 34 33-11 18 11-33 12Z" fill={papel} stroke={linea} />
      <path d="M7 34v12l18 11V46Z" fill={naranja} />
      <path d="m25 46 33-12v12L25 57Z" fill={tinta} />
      <path d="m12 26 28-9 12 7-28 10Z" fill={tinta} />
      <path d="m12 26 12 8v6l-12-7Z" fill={gris} />
      <path d="M15 25V13l30-9v15" stroke={tinta} strokeWidth="3" />
      <path d="m16 13 28-9" stroke={naranja} strokeWidth="5" />
      <path d="m24 35 18-6 11 7-18 7Z" fill={papel} stroke={linea} />
      <path
        d="m26 34 2 4m3-6 2 4m3-6 2 4m3-6 2 4"
        stroke={canto}
        strokeWidth="2"
      />
      <path d="m31 38 9-3" stroke={gris} />
    </>
  ),
  mesa_de_corte: (
    <>
      <path
        d="M9 34v16m28-27v17m-9 4v15m26-24v14"
        stroke={tinta}
        strokeWidth="3"
      />
      <path d="m4 27 32-13 24 14-32 14Z" fill={papel} stroke={linea} />
      <path d="M4 27v7l24 14v-6Z" fill={naranja} />
      <path d="m28 42 32-14v7L28 48Z" fill={tinta} />
      <path d="m12 28 23-9 17 10-23 10Z" fill={naranja} />
      <path d="m18 27 16 9m-8-12 16 9m-26-2 23-9m-16 13 23-9" stroke={canto} />
      <path d="m8 25 31-13 4 3-31 13Z" fill={tinta} />
      <path d="m31 23 13-11 4 3-13 11-5 1Z" fill={papel} stroke={linea} />
      <path d="m44 12 4 3" stroke={naranja} strokeWidth="3" />
    </>
  ),
  plancha_termica: (
    <>
      <path d="m8 43 29-10 21 12-29 11Z" fill={tinta} />
      <path d="M8 43v7l21 12v-6Z" fill={naranja} />
      <path d="m29 56 29-11v7L29 62Z" fill={gris} />
      <path d="m13 40 24-8 15 9-24 9Z" fill={papel} stroke={linea} />
      <path d="M47 34V20l-8-5v17" stroke={tinta} strokeWidth="5" />
      <path d="m9 18 28-8 18 9-28 10Z" fill={naranja} />
      <path d="M9 18v6l18 11v-6Z" fill={canto} />
      <path d="m27 29 28-10v6L27 35Z" fill={tinta} />
      <path d="m29 15-7-9 13-3 7 9" stroke={tinta} strokeWidth="3" />
      <path d="m22 6 13-3" stroke={naranja} strokeWidth="4" />
      <path d="m20 34 3 3m4-2 3 3" stroke={canto} />
    </>
  ),
  impresora_3d: (
    <>
      <path d="m10 46 28-10 18 10-28 12Z" fill={papel} stroke={linea} />
      <path d="M10 46v6l18 10v-4Z" fill={naranja} />
      <path d="m28 58 28-12v6L28 62Z" fill={tinta} />
      <path
        d="M13 45V15l25-8 15 9v29M28 55V24l25-8M13 15l15 9"
        stroke={tinta}
        strokeWidth="3"
      />
      <path d="m29 25 23-8" stroke={naranja} strokeWidth="4" />
      <path d="m35 23 8-3v7l-4 4-4-2Z" fill={tinta} />
      <path d="M39 30v5" stroke={canto} />
      <path d="m28 42 12-4 8 5-12 5Z" fill={naranja} />
      <path d="M28 42v8l8 5v-7Z" fill={canto} />
      <path d="m36 48 12-5v8l-12 4Z" fill={naranja} />
      <path d="m30 46 4 3m-4 1 4 3" stroke={papel} strokeOpacity="0.5" />
      <ellipse cx="18" cy="8" rx="7" ry="5" fill={naranja} stroke={canto} />
      <ellipse cx="18" cy="8" rx="2" ry="1.5" fill={tinta} />
      <path d="M25 8c12-4 15 5 14 14" stroke={gris} />
    </>
  ),
};

const equipoGenerico = (
  <>
    <path d="m10 22 26-10 18 11-26 11Z" fill={papel} stroke={linea} />
    <path d="M10 22v25l18 11V34Z" fill={naranja} />
    <path d="m28 34 26-11v25L28 58Z" fill={tinta} />
    <path d="m33 36 15-6v8l-15 6Z" fill={papel} />
    <path d="m15 32 7 4m-7 3 7 4m11 7 15-6" stroke={gris} />
  </>
);

export function MaquinariaPlantillaGlyph({
  plantilla,
}: {
  plantilla: PlantillaMaquinaria;
}) {
  const conocida = Object.hasOwn(dibujos, plantilla);
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      data-illustration={conocida ? plantilla : "maquinaria"}
    >
      {conocida ? dibujos[plantilla] : equipoGenerico}
    </svg>
  );
}
