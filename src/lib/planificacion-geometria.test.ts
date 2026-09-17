import { describe, expect, it } from "vitest";
import { geometriaBarraPlan } from "./planificacion-geometria";

describe("duración visual de las tareas del Gantt", () => {
  it("conserva la proporción incluso en tareas menores a un píxel", () => {
    const breve = geometriaBarraPlan(100, 100.5, 900);
    const larga = geometriaBarraPlan(100, 150, 900);
    expect(breve.ancho).toBe(0.5);
    expect(larga.ancho / breve.ancho).toBe(100);
    expect(breve.finTemporal).toBe(100.5);
  });
  it("recorta sólo lo que queda fuera del calendario", () => {
    expect(geometriaBarraPlan(-100, 950, 900)).toEqual({ x: 0, finTemporal: 900, ancho: 900, corta: false });
    expect(geometriaBarraPlan(895, 898, 900)).toEqual({ x: 895, finTemporal: 898, ancho: 3, corta: true });
    expect(geometriaBarraPlan(950, 1000, 900).ancho).toBe(0);
  });
});

import { segmentosOperacionPlan, resumenOperacionPlan, recorridoDependenciaPlan } from './planificacion-geometria';
it("la flecha entra por la izquierda aunque haya menos de diez píxeles entre tareas", () => {
  expect(recorridoDependenciaPlan({fin:100,y:30},{x:104,y:110})).toBe('M100,30 H102 V110 H104');
  expect(recorridoDependenciaPlan({fin:100,y:30},{x:104,y:30})).toBe('M100,30 H104');
  expect(recorridoDependenciaPlan({fin:100,y:30},{x:90,y:110})).toBe('M100,30 H108 V70 H82 V110 H90');
});
it("dibuja operario y RUN por sus fechas, preservando huecos y fracciones menores a un píxel", () => {
  const fases = [
    {inicio:0,fin:60000,personas:1,tipo:'operario' as const},
    {inicio:120000,fin:240000,personas:0,tipo:'maquina' as const},
  ];
  const segmentos = segmentosOperacionPlan(fases,d=>d.getTime()/60000,{x:0,ancho:4});
  expect(segmentos).toEqual([{tipo:'operario',inicio:0,ancho:25},{tipo:'maquina',inicio:50,ancho:50}]);
  expect(resumenOperacionPlan(fases)).toEqual({operario:1,maquina:2,maquina_atendida:0,sin_verificar:0,personaMin:1});
  expect(segmentosOperacionPlan(fases,d=>d.getTime()/60000,{x:2.5,ancho:1.5})).toEqual([{tipo:'maquina',inicio:0,ancho:100}]);
});
