import { describe, expect, it } from "vitest";
import { modoTableroGuardado } from "./tablero-modos";
import { modoTableroEnUrl, urlTableroEstacion } from "./tablero-navegacion";

describe("navegación entre Estaciones y Tablero", () => {
  it("abre Lista desde una estación aunque la preferencia guardada sea Kanban", () => {
    const url = new URL(urlTableroEstacion("corte / láser"), "https://grafo.test");
    expect(url.searchParams.get("estacion")).toBe("corte / láser");
    expect(modoTableroEnUrl(url.searchParams) ?? modoTableroGuardado("kanban")).toBe("items");
    expect(modoTableroEnUrl(new URLSearchParams()) ?? modoTableroGuardado("kanban")).toBe("kanban");
  });
  it("conserva el filtro al cambiar de vista y los parámetros de otros accesos", () => {
    const url = new URL(urlTableroEstacion("corte", "kanban", "item=trabajo&estado=blocked"), "https://grafo.test");
    expect(modoTableroEnUrl(url.searchParams)).toBe("kanban");
    expect(url.searchParams.get("estacion")).toBe("corte");
    expect(url.searchParams.get("item")).toBe("trabajo");
    expect(url.searchParams.get("estado")).toBe("blocked");
  });
  it("limpia la estación de la URL para que no reaparezca al recargar", () => {
    const url = new URL(urlTableroEstacion("", "items", "estacion=corte&vista=kanban"), "https://grafo.test");
    expect(url.searchParams.has("estacion")).toBe(false);
    expect(modoTableroEnUrl(url.searchParams)).toBe("items");
  });
  it("mantiene los accesos simples y el foco en Bloqueados del panel", () => {
    expect(modoTableroEnUrl(new URLSearchParams("estacion=corte"))).toBe("items");
    expect(modoTableroEnUrl(new URLSearchParams("estado=blocked"))).toBe("items");
    expect(modoTableroEnUrl(new URLSearchParams("vista=desconocida"))).toBeNull();
  });
});
