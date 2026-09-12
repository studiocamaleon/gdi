import { describe, expect, it } from "vitest";
import * as front from "./demanda-humana";
import * as api from "../../apps/api/src/eta/motor/demanda-humana";

const tiempo = { maquinaId: "m", totalMin: 74, setupMin: 5, runMin: 64, cleanupMin: 5, tiempoFijoMin: 0, dotacionOperarios: 2,
  fasesRun: [{ minutos: 30, operario: false }, { minutos: 4, operario: true }, { minutos: 30, operario: false }] };

describe.each([["navegador", front], ["API", api]] as const)("operación de máquina — %s", (_, motor) => {
  it("mantiene toda la dotación ocupada en operación atendida y conserva minutos", () => {
    const d = motor.demandaDesdeTiempo({ ...tiempo, operacionMaquina: "con_operario" })!;
    expect(d.verificada).toBe(true);
    expect(d.fases.map(f => f.personas)).toEqual([2, 2, 2, 2, 2]);
    expect(d.fases.reduce((sum, f) => sum + f.minutos, 0)).toBe(74);
    expect(d.fases.filter(f => f.operacionMaquina).map(f => f.minutos)).toEqual([30, 30]);
  });
  it("libera solamente la operación autónoma y mantiene las recargas", () => {
    const d = motor.demandaDesdeTiempo({ ...tiempo, operacionMaquina: "autonoma" })!;
    expect(d.fases.map(f => f.personas)).toEqual([2, 0, 2, 0, 2]);
    expect(d.verificada).toBe(true);
  });
  it("permite cambiar ida y vuelta usando la base congelada incluso después de serializar", () => {
    const d = motor.demandaDesdeTiempo({ ...tiempo, operacionMaquina: "autonoma" })!;
    const antes = JSON.stringify(d);
    const atendida = motor.aplicarOperacionMaquina(d, "con_operario")!;
    const recuperada = motor.leerDemandaHumana(JSON.parse(JSON.stringify(atendida)), 74)!;
    expect(motor.aplicarOperacionMaquina(recuperada, "autonoma")).toEqual(d);
    expect(JSON.stringify(d)).toBe(antes);
    expect(motor.leerDemandaHumana({ ...d, baseOperacion: { fases: [{ minutos: 1, personas: 0 }] } }, 74)).toBeNull();
  });
  it("sin configuración reserva al equipo y conserva el aviso orientativo", () => {
    const d = motor.demandaDesdeTiempo({ ...tiempo, operacionMaquina: null })!;
    expect(d.fases.every(f => f.personas === 2)).toBe(true);
    expect(d.verificada).toBe(false);
    expect(motor.aplicarOperacionMaquina(d, "autonoma")?.verificada).toBe(true);
  });
  it("confirma una guillotina histórica sólo con dotación conocida; autónoma no inventa su secuencia", () => {
    const d: front.DemandaHumana = { version: 1, verificada: false, dotacionOperarios: 2, fases: [{ minutos: 12, personas: 2 }] };
    expect(motor.aplicarOperacionMaquina(d, "con_operario")?.verificada).toBe(true);
    expect(motor.aplicarOperacionMaquina(d, "autonoma")?.verificada).toBe(false);
    expect(motor.aplicarOperacionMaquina({ ...d, dotacionOperarios: undefined }, "con_operario")?.verificada).toBe(false);
  });
  it("conserva la base y las recargas al consolidar una tanda", () => {
    const d = motor.demandaDesdeTiempo({ ...tiempo, operacionMaquina: "con_operario" })!;
    const conjunto = motor.combinarDemandas([d, d], 148);
    const autonomo = motor.aplicarOperacionMaquina(conjunto, "autonoma")!;
    expect(autonomo.fases.filter(f => !f.personas).reduce((s,f) => s+f.minutos,0)).toBe(120);
    expect(autonomo.fases.filter(f => f.personas).reduce((s,f) => s+f.minutos,0)).toBe(28);
  });
});
