import { describe, expect, it } from "vitest";

import { medidasDestino, svgConMedidas } from "@/lib/rasterizar-logo";

/**
 * La parte del rasterizado que se puede romper en silencio.
 *
 * El dibujo en canvas necesita un navegador, pero lo frágil no es eso: es
 * calcular las medidas. Un SVG sin `width`/`height` no tiene tamaño intrínseco
 * y el `<img>` lo dibuja en 300×150 o en cero — el logo saldría aplastado o
 * vacío, sin ningún error a la vista.
 */

const svg = (attrs: string) => `<svg ${attrs} xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>`;
const medidas = (salida: string) => ({
  ancho: Number(/width="(\d+)"/.exec(salida)?.[1]),
  alto: Number(/height="(\d+)"/.exec(salida)?.[1]),
});

describe("svgConMedidas", () => {
  it("saca las medidas del viewBox respetando la proporción", () => {
    // 400×100 = apaisado 4:1 → el ancho toca el tope.
    expect(medidas(svgConMedidas(svg('viewBox="0 0 400 100"'), 1024))).toEqual({
      ancho: 1024,
      alto: 256,
    });
  });

  it("con un logo vertical, el alto toca el tope", () => {
    expect(medidas(svgConMedidas(svg('viewBox="0 0 100 400"'), 1024))).toEqual({
      ancho: 256,
      alto: 1024,
    });
  });

  /** El caso que motivó todo: el logo del tenant es un SVG sin medidas. */
  it("le agrega medidas al que no las tiene", () => {
    const salida = svgConMedidas(svg('viewBox="0 0 200 200"'), 512);
    expect(salida).toMatch(/width="512"/);
    expect(salida).toMatch(/height="512"/);
  });

  /** Las medidas viejas se van: dos `width` en el mismo tag es un lío. */
  it("reemplaza las medidas que ya estaban", () => {
    const salida = svgConMedidas(
      svg('width="30" height="10" viewBox="0 0 300 100"'),
      1024,
    );
    expect(salida.match(/width=/g)).toHaveLength(1);
    expect(medidas(salida)).toEqual({ ancho: 1024, alto: 341 });
  });

  it("sin viewBox usable cae a un cuadrado", () => {
    expect(medidas(svgConMedidas(svg('id="x"'), 800))).toEqual({
      ancho: 800,
      alto: 800,
    });
  });

  /** viewBox con comas y decimales: pasa en los SVG que exporta Illustrator. */
  it("entiende separadores por coma y decimales", () => {
    expect(
      medidas(svgConMedidas(svg('viewBox="0,0,283.5,70.875"'), 1024)),
    ).toEqual({ ancho: 1024, alto: 256 });
  });

  it("no toca el contenido del SVG", () => {
    expect(svgConMedidas(svg('viewBox="0 0 10 10"'), 100)).toContain(
      '<path d="M0 0"/>',
    );
  });
});

describe("medidasDestino", () => {
  it("achica lo grande sin deformar", () => {
    expect(medidasDestino(2000, 1000, 1024)).toEqual({ ancho: 1024, alto: 512 });
  });

  /** Agrandar un raster chico sólo lo haría borroso y pesado. */
  it("no agranda lo que ya entra", () => {
    expect(medidasDestino(300, 120, 1024)).toEqual({ ancho: 300, alto: 120 });
  });

  it("nunca devuelve cero", () => {
    expect(medidasDestino(1, 4000, 1024).ancho).toBeGreaterThanOrEqual(1);
  });

  it("con medidas inválidas cae al cuadrado", () => {
    expect(medidasDestino(0, 0, 640)).toEqual({ ancho: 640, alto: 640 });
  });
});
