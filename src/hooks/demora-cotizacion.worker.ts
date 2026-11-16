import { estimarDemoraNuevos } from "@/lib/flujo-produccion";
import type { EntradaDemora, RespuestaDemora } from "./use-demora-cotizacion";

self.onmessage = (evento: MessageEvent<EntradaDemora>) => {
  let respuesta: RespuestaDemora;
  try {
    respuesta = { resultado: estimarDemoraNuevos(evento.data) };
  } catch {
    respuesta = { error: "No se pudo estimar la entrega." };
  }
  self.postMessage(respuesta);
};
