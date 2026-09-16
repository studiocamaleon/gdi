import { simularFlujo } from "@/lib/flujo-produccion";

// El mismo motor, en un hilo del navegador. Maps y Dates conservan su tipo
// mediante structured clone; no se usa una segunda implementación del ETA.
self.onmessage = (evento: MessageEvent<Parameters<typeof simularFlujo>[0]>) => {
  try {
    self.postMessage({ resultado: simularFlujo(evento.data) });
  } catch {
    self.postMessage({
      error:
        "No se pudo calcular la planificación. Volvé a actualizar la vista.",
    });
  }
};
