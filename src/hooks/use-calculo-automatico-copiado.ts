"use client";

import { useEffect, useRef } from "react";

/** Una revisión por cambio comercial. Un error espera un reintento explícito;
 * una respuesta que renueva precios/snapshots no vuelve a iniciar el cálculo.
 * Al consultar una OT sin editar, se conserva su revisión histórica.
 */
export function useCalculoAutomaticoCopiado({
  clave,
  habilitado,
  vigente,
  ocupado,
  calcular,
}: {
  clave: string;
  habilitado: boolean;
  vigente: boolean;
  ocupado: boolean;
  calcular(): Promise<void>;
}) {
  const procesada = useRef<string | null>(null);
  useEffect(() => {
    if (!habilitado) {
      procesada.current = null;
      return;
    }
    if (vigente) {
      procesada.current = clave;
      return;
    }
    if (ocupado || procesada.current === clave) return;
    procesada.current = clave;
    void calcular();
  }, [clave, habilitado, vigente, ocupado, calcular]);
}
