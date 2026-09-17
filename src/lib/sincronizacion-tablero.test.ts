import { describe, expect, it, vi } from "vitest";
import { crearSincronizadorTablero, estadoMonitorProduccion } from "./sincronizacion-tablero";

function diferida<T>() {
  let resolver!: (valor: T) => void;
  const promise = new Promise<T>((resolve) => { resolver = resolve; });
  return { promise, resolver };
}

describe("sincronización en vivo del tablero", () => {
  it("agrupa una ráfaga de eventos en una sola lectura posterior sin consultas superpuestas", async () => {
    const primera = diferida<string>();
    const consultar = vi.fn().mockReturnValueOnce(primera.promise).mockResolvedValue("último estado");
    const aplicar = vi.fn();
    const sync = crearSincronizadorTablero({ puedeActualizar: () => true, consultar, aplicar, fallo: vi.fn() });
    const lectura = sync.actualizar();
    void sync.actualizar(); void sync.actualizar(); void sync.actualizar();
    expect(consultar).toHaveBeenCalledTimes(1);
    primera.resolver("estado previo");
    await lectura;
    expect(consultar).toHaveBeenCalledTimes(2);
    expect(aplicar).toHaveBeenLastCalledWith("último estado");
  });

  it("descarta una respuesta anterior a una acción local aunque ésta ya haya terminado", async () => {
    const anterior = diferida<string>();
    const aplicar = vi.fn();
    const sync = crearSincronizadorTablero({ puedeActualizar: () => true,
      consultar: vi.fn().mockReturnValueOnce(anterior.promise).mockResolvedValue("paso completado"), aplicar, fallo: vi.fn() });
    const lectura = sync.actualizar();
    sync.invalidar();
    anterior.resolver("paso pendiente");
    await lectura;
    expect(aplicar.mock.calls).toEqual([["paso completado"]]);
  });

  it("retiene lo pendiente durante una mutación y lo consulta al terminar", async () => {
    let bloqueado = true;
    const consultar = vi.fn().mockResolvedValue("actualizado");
    const sync = crearSincronizadorTablero({ puedeActualizar: () => !bloqueado, consultar, aplicar: vi.fn(), fallo: vi.fn() });
    await sync.actualizar();
    expect(consultar).not.toHaveBeenCalled();
    bloqueado = false;
    await sync.actualizar();
    expect(consultar).toHaveBeenCalledOnce();
  });

  it("no publica una lectura al ocultarse la pestaña y vuelve a consultar al recuperar foco", async () => {
    let visible = true;
    const anterior = diferida<string>();
    const aplicar = vi.fn();
    const sync = crearSincronizadorTablero({ puedeActualizar: (forzar) => visible || forzar,
      consultar: vi.fn().mockReturnValueOnce(anterior.promise).mockResolvedValue("actual"), aplicar, fallo: vi.fn() });
    const lectura = sync.actualizar();
    visible = false;
    anterior.resolver("viejo");
    await lectura;
    expect(aplicar).not.toHaveBeenCalled();
    visible = true;
    await sync.actualizar();
    expect(aplicar).toHaveBeenCalledWith("actual");
  });

  it("conserva datos ante un fallo y permite recuperar la conexión", async () => {
    const error = new Error("Sin conexión");
    const aplicar = vi.fn(), fallo = vi.fn();
    const sync = crearSincronizadorTablero({ puedeActualizar: () => true,
      consultar: vi.fn().mockRejectedValueOnce(error).mockResolvedValue("recuperado"), aplicar, fallo });
    await sync.actualizar();
    expect(aplicar).not.toHaveBeenCalled();
    expect(fallo).toHaveBeenCalledWith(error);
    await sync.actualizar();
    expect(aplicar).toHaveBeenCalledWith("recuperado");
  });
});

describe("señal de sincronización del monitor", () => {
  it("distingue conexión de respaldo, datos vencidos y conexión en vivo", () => {
    expect(estadoMonitorProduccion("en_vivo", 1000, 2000, false).etiqueta).toBe("En vivo");
    expect(estadoMonitorProduccion("respaldo", 1000, 2000, false).etiqueta).toBe("Actualización automática");
    expect(estadoMonitorProduccion("en_vivo", 1000, 47000, false).etiqueta).toBe("Datos sin actualizar");
    expect(estadoMonitorProduccion("en_vivo", 1000, 2000, true).etiqueta).toBe("Datos sin actualizar");
    expect(estadoMonitorProduccion("conectando", null, null, false).etiqueta).toBe("Conectando");
  });
});
