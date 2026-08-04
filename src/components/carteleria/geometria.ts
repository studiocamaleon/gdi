/**
 * Configurador 3D de cartelería — derivación geométrica CLIENT-SIDE.
 *
 * Espejo de los helpers del motor (apps/api/src/motor-universal/
 * estructura-bastidor.ts e iluminacion-led.ts) para que el 3D responda a
 * 60 fps mientras se arrastra un slider. El PRECIO nunca sale de acá: lo
 * calcula el motor server-side (docs/carteleria-configurador-diseno.md §2);
 * esto sólo alimenta la escena y la leyenda.
 */

export type CarteleriaVista = {
  tipoCartel: "backlight" | "frontlight";
  /** Medidas en metros (el 3D trabaja en metros). */
  width: number;
  height: number;
  depth: number;
  sepRefuerzoVcm: number;
  sepRefuerzoHcm: number;
  cenefa: boolean;
  solapaCenefaCm: number;
  /** Pinta el perfil en el 3D (esmalte negro vs caño crudo). */
  pintura: boolean;
  /** Chapa trasera: si es false, la contra queda abierta en el 3D. */
  fondo: boolean;
  /** Lado del caño en metros (para el dibujo; 40×40 → 0.04). */
  perfilLadoM: number;
  /** Densidad de sembrado LED (1 = la recomendada del módulo). */
  densidadLed: number;
  /** Cobertura del módulo LED en m² (atributo de la variante). */
  coberturaLedM2: number;
};

export type MetricasCartel = {
  refuerzosV: number;
  refuerzosH: number;
  mlTotal: number;
  puntosSoldadura: number;
  cenefaM2: number;
  ledCols: number;
  ledRows: number;
  ledCount: number;
};

/** Mismas fórmulas que calcularEstructuraBastidor + grilla LED del prototipo. */
export function derivarMetricas(v: CarteleriaVista): MetricasCartel {
  const { width: W, height: H } = v;
  const esDoble = v.tipoCartel === "backlight";
  const D = esDoble ? v.depth : 0;

  const refuerzosV =
    v.sepRefuerzoVcm > 0
      ? Math.max(0, Math.floor((W * 100 - 1) / v.sepRefuerzoVcm))
      : 0;
  const refuerzosH =
    v.sepRefuerzoHcm > 0
      ? Math.max(0, Math.floor((H * 100 - 1) / v.sepRefuerzoHcm))
      : 0;

  const mlPerimetro = esDoble ? 2 * (2 * (W + H)) + 4 * D : 2 * (W + H);
  const mlRefuerzos = (refuerzosV * H + refuerzosH * W) * (esDoble ? 2 : 1);
  const mlConectores = esDoble ? (refuerzosV + refuerzosH) * D : 0;

  const puntosSoldadura =
    (esDoble ? 8 : 4) +
    refuerzosV * 2 +
    refuerzosH * 2 +
    (esDoble ? (refuerzosV + refuerzosH) * 2 : 0);

  const cenefaM2 =
    v.cenefa && D > 0
      ? 2 * (W + H) * (D + (2 * v.solapaCenefaCm) / 100) * 1.08
      : 0;

  // Grilla LED como la dibuja el prototipo (cols × rows parejos por cara).
  let ledCols = 0;
  let ledRows = 0;
  if (esDoble && v.coberturaLedM2 > 0) {
    const spacing = Math.sqrt(v.coberturaLedM2 / v.densidadLed);
    ledCols = Math.max(2, Math.round(W / spacing));
    ledRows = Math.max(2, Math.round(H / spacing));
  }

  return {
    refuerzosV,
    refuerzosH,
    mlTotal: mlPerimetro + mlRefuerzos + mlConectores,
    puntosSoldadura,
    cenefaM2,
    ledCols,
    ledRows,
    ledCount: ledCols * ledRows,
  };
}
