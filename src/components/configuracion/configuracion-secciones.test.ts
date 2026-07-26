import { describe, expect, it } from "vitest";

import { seccionesConfigVisibles } from "./configuracion-secciones";
import type { PermisoClave } from "@/lib/permisos";

/**
 * Qué secciones de Configuración se le ofrecen a cada uno.
 *
 * Esto lo cubría el sidebar mientras Configuración era un grupo con seis
 * hijos. Ahora el módulo es un ancla al pie y esta lista es la única que
 * filtra: de acá salen la columna de la vista, el ancla del sidebar y el
 * redirect de /configuracion.
 *
 * Lo que no puede fallar es la llave suelta del Administrativo: le abre Datos
 * fiscales y Métodos de pago —corregir un CUIT, cargar un medio de cobro— sin
 * abrirle Usuarios, o sea sin dejarlo crear cuentas y repartir roles.
 */
const labels = (permisos: string[], pais = "AR") =>
  seccionesConfigVisibles(
    (p: PermisoClave) => permisos.includes(p),
    pais,
  ).map((s) => s.label);

describe("las secciones de Configuración", () => {
  it("el Administrativo entra con SÓLO sus dos pantallas", () => {
    expect(labels(["administracion.configurar"])).toEqual([
      "Datos fiscales",
      "Métodos de pago",
    ]);
  });

  it("y no ve Usuarios", () => {
    expect(labels(["administracion.configurar"])).not.toContain("Usuarios");
  });

  it("con la llave del módulo se ve el resto, menos lo fiscal", () => {
    const config = labels(["configuracion.ver"]);
    expect(config).toEqual([
      "Empresa",
      "Usuarios",
      "Almacenamiento",
      "Integraciones",
    ]);
  });

  it("el Administrador ve las seis", () => {
    expect(labels(["configuracion.ver", "administracion.configurar"])).toEqual([
      "Empresa",
      "Usuarios",
      "Datos fiscales",
      "Métodos de pago",
      "Almacenamiento",
      "Integraciones",
    ]);
  });

  /** El circuito fiscal ARCA es argentino: un taller chileno no lo ve. */
  it("Datos fiscales no existe fuera de Argentina", () => {
    const chile = labels(["configuracion.ver", "administracion.configurar"], "CL");
    expect(chile).not.toContain("Datos fiscales");
    expect(chile).toContain("Métodos de pago");
  });

  /** Sin ninguna llave no hay módulo: el sidebar no muestra el ancla. */
  it("sin llaves no queda ninguna sección", () => {
    expect(labels(["comercial.ver"])).toEqual([]);
  });
});
