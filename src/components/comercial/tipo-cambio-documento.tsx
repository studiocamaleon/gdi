"use client";

import * as React from "react";
import {
  crearTipoCambio,
  type TipoCambioSnapshot,
} from "@/lib/tipo-cambio-api";
import * as copiado from "@/lib/centro-copiado-api";
import * as motor from "@/lib/productos-servicios-api";

type Contexto = {
  cambio: TipoCambioSnapshot | null;
  resolver: () => Promise<TipoCambioSnapshot>;
  establecer: (cambio: TipoCambioSnapshot | null) => void;
};
const ContextoCambio = React.createContext<Contexto | null>(null);

/** Una captura por documento, compartida por todos sus configuradores. */
export function TipoCambioDocumentoProvider({
  inicial,
  children,
}: {
  inicial?: TipoCambioSnapshot | null;
  children: React.ReactNode;
}) {
  const [cambio, setCambio] = React.useState(inicial ?? null);
  const actual = React.useRef(cambio);
  const pendiente = React.useRef<Promise<TipoCambioSnapshot> | null>(null);
  const establecer = React.useCallback((valor: TipoCambioSnapshot | null) => {
    actual.current = valor;
    pendiente.current = null;
    setCambio(valor);
  }, []);
  React.useEffect(() => {
    establecer(inicial ?? null);
  }, [inicial, establecer]);
  const resolver = React.useCallback(async () => {
    if (actual.current) return actual.current;
    if (!pendiente.current) {
      const solicitud = crearTipoCambio();
      pendiente.current = solicitud;
      solicitud.then(
        (valor) => {
          if (pendiente.current === solicitud) establecer(valor);
        },
        () => {
          if (pendiente.current === solicitud) pendiente.current = null;
        },
      );
    }
    return pendiente.current!;
  }, [establecer]);
  return (
    <ContextoCambio.Provider
      value={React.useMemo(
        () => ({ cambio, resolver, establecer }),
        [cambio, resolver, establecer],
      )}
    >
      {children}
    </ContextoCambio.Provider>
  );
}

export function useTipoCambioDocumento() {
  return React.useContext(ContextoCambio);
}

export function useMotorConTipoCambio() {
  const contexto = useTipoCambioDocumento();
  const resolver = contexto?.resolver;
  return React.useMemo(() => {
    async function preparar<
      T extends { tipoCambioId?: string; jobContext: Record<string, unknown> },
    >(request: T): Promise<T> {
      const id =
        request.tipoCambioId ?? (resolver ? (await resolver()).id : undefined);
      return id
        ? {
            ...request,
            tipoCambioId: id,
            jobContext: { ...request.jobContext, tipoCambioId: id },
          }
        : request;
    }
    async function prepararCopiado<T extends { tipoCambioId?: string }>(
      request: T,
    ): Promise<T> {
      const id =
        request.tipoCambioId ?? (resolver ? (await resolver()).id : undefined);
      return id ? { ...request, tipoCambioId: id } : request;
    }
    return {
      cotizarCentroCopiado: async (
        ...[request]: Parameters<typeof copiado.cotizarCentroCopiado>
      ) => copiado.cotizarCentroCopiado(await prepararCopiado(request)),
      construirItemsCentroCopiado: async (
        ...[request]: Parameters<typeof copiado.construirItemsCentroCopiado>
      ) => copiado.construirItemsCentroCopiado(await prepararCopiado(request)),
      guardarTomoCentroCopiado: async (
        ...[request]: Parameters<typeof copiado.guardarTomoCentroCopiado>
      ) => copiado.guardarTomoCentroCopiado(await prepararCopiado(request)),
      cotizar: async (...[request, signal]: Parameters<typeof motor.cotizar>) =>
        motor.cotizar(await preparar(request), signal),
      cotizarEnSegundoPlano: async (
        ...[request, options]: Parameters<typeof motor.cotizarEnSegundoPlano>
      ) => motor.cotizarEnSegundoPlano(await preparar(request), options),
      cotizarYGuardar: async (
        ...[request]: Parameters<typeof motor.cotizarYGuardar>
      ) => motor.cotizarYGuardar(await preparar(request)),
      recotizarCotizacionItem: async (
        ...[id, request]: Parameters<typeof motor.recotizarCotizacionItem>
      ) => motor.recotizarCotizacionItem(id, await preparar(request)),
    };
  }, [resolver]);
}
