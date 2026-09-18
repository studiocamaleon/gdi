"use client";
import {
  getConfiguracionImpresion,
  getFirmaImpresoras,
  getFirmaEscucha,
  prepararPruebaDocumento,
  prepararEtiqueta,
  prepararDocumentoOrden,
  type EnvioDocumento,
  type FirmaQz,
} from "./impresion-api";
import { hostQzValido, type ImpresoraPuesto } from "./impresora-puesto";

type Qz = (typeof import("qz-tray"))["default"];
let sdk: Qz | undefined;
let conexion = "";
let firmaActual: FirmaQz | undefined;
let ocupado = false;
let solicitudEscucha: { impresora: string; error?: Error } | undefined;
type Monitor = {
  qz: Qz;
  impresora: string;
  evento: (event: unknown) => void;
  desconectado: () => void;
};
let monitor: Monitor | undefined;

/** startListening no acepta timestamp prefijado en el SDK 2.2.6. El hasher
 * público conserva SHA256 y autoriza sólo la escucha esperada, reconstruida
 * por el backend a partir de impresora + timestamp; nunca firma hashes libres. */
async function hashMensaje(mensaje: string) {
  const solicitud = solicitudEscucha;
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(mensaje),
  );
  const hash = Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
  if (solicitud) {
    const { call, params, timestamp } = JSON.parse(mensaje);
    if (
      call !== "printers.startListening" ||
      JSON.stringify(params) !==
        JSON.stringify({ printerNames: [solicitud.impresora] })
    )
      throw new Error("La solicitud no coincide con la escucha autorizada.");
    try {
      const firma = await getFirmaEscucha(solicitud.impresora, timestamp);
      if (solicitud !== solicitudEscucha)
        throw new Error("La solicitud de escucha venció.");
      if (firma.hash !== hash)
        throw new Error("La firma de escucha no coincide.");
      firmaActual = firma;
    } catch (error) {
      solicitud.error =
        error instanceof Error
          ? error
          : new Error("No se pudo autorizar la escucha.");
      throw error;
    }
  }
  return hash;
}

async function exclusivo<T>(accion: () => Promise<T>): Promise<T> {
  if (ocupado)
    throw new Error(
      "Hay otra operación de impresión en curso. Esperá a que termine.",
    );
  ocupado = true;
  try {
    return await accion();
  } finally {
    firmaActual = undefined;
    ocupado = false;
  }
}

async function conLimite<T>(qz: Qz, operacion: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operacion,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          if (qz.websocket.isActive())
            void qz.websocket.disconnect().catch(() => {});
          conexion = "";
          reject(
            new Error(
              "QZ Tray no respondió. Revisá la autorización en el equipo de impresión.",
            ),
          );
        }, 30000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function conectar(host: string, tenantId: string): Promise<Qz> {
  if (!hostQzValido(host))
    throw new Error(
      "Ingresá sólo la IP o el nombre del equipo, sin https:// ni puerto.",
    );
  const identidad = await getConfiguracionImpresion();
  if (identidad.tenantId !== tenantId)
    throw new Error("Cambiaste de empresa. Volvé a abrir la impresión.");
  if (!identidad.certificado)
    throw new Error(
      identidad.mensaje ??
        "La impresión todavía no está configurada en el servidor.",
    );
  if (!sdk) {
    sdk = (await import("qz-tray")).default;
    sdk.api.setSha256Type(hashMensaje);
    sdk.websocket.setClosedCallbacks(() => {
      const anterior = monitor;
      monitor = undefined;
      conexion = "";
      anterior?.desconectado();
    });
    sdk.printers.setPrinterCallbacks((evento) => monitor?.evento(evento));
  }
  const destino = `${tenantId}:${host}:${identidad.certificado}`;
  if (sdk.websocket.isActive() && conexion !== destino)
    await sdk.websocket.disconnect();
  sdk.security.setCertificatePromise((resolve) =>
    resolve(identidad.certificado!),
  );
  sdk.security.setSignatureAlgorithm("SHA512");
  // El servidor construye y firma el mensaje. El hash del SDK debe coincidir
  // exactamente: ni comandos adicionales ni cambios de impresora/copias.
  sdk.security.setSignaturePromise((hash) => (resolve, reject) => {
    if (!firmaActual || hash !== firmaActual.hash)
      return reject(
        new Error("La solicitud no coincide con la impresión autorizada."),
      );
    resolve(firmaActual.firma);
  });
  if (!sdk.websocket.isActive()) {
    try {
      await conLimite(
        sdk,
        sdk.websocket.connect({
          host,
          usingSecure: true,
          port: { secure: [8181] },
          retries: 0,
          delay: 0,
          keepAlive: 30,
        }),
      );
      conexion = destino;
    } catch {
      throw new Error(
        `No se pudo conectar con QZ Tray en ${host}. Revisá que esté abierto, el permiso de red local del navegador y la autorización en ese equipo.`,
      );
    }
  }
  const version = await conLimite(sdk, sdk.api.getVersion());
  const [mayor, menor] = version.split(".").map(Number);
  if (mayor < 2 || (mayor === 2 && menor < 2))
    throw new Error("Actualizá QZ Tray a la versión 2.2 o posterior.");
  return sdk;
}

export function buscarImpresoras(host: string, tenantId: string) {
  return exclusivo(async () => {
    const qz = await conectar(host, tenantId);
    firmaActual = await getFirmaImpresoras();
    return conLimite(
      qz,
      qz.printers.find(undefined, undefined, firmaActual.timestamp),
    );
  });
}

export function imprimirOrden(
  id: string,
  tenantId: string,
  config: ImpresoraPuesto,
  copias: number,
  onProgreso: (enviadas: number, total: number) => void,
) {
  return exclusivo(async () => {
    const qz = await conectar(config.host, tenantId);
    let enviadas = 0;
    let total = 1;
    do {
      try {
        const trabajo = await prepararEtiqueta(
          id,
          config.impresora,
          copias,
          enviadas,
        );
        total = trabajo.totalPaginas;
        firmaActual = trabajo;
        const { printer, options, data } = trabajo.params;
        // Config estructural: preserva el mensaje canónico firmado, sin agregar
        // defaults dependientes de la versión del SDK. QZ aplica sus defaults.
        await conLimite(
          qz,
          qz.print(
            { getPrinter: () => printer, getOptions: () => options },
            data,
            [],
            trabajo.timestamp,
          ),
        );
      } catch {
        throw new Error(
          `No se pudo confirmar el envío${enviadas ? `; ${enviadas} de ${total} páginas ya fueron enviadas` : ""}. Revisá la cola de la impresora antes de volver a imprimir para evitar duplicados.`,
        );
      }
      enviadas++;
      onProgreso(enviadas, total);
    } while (enviadas < total);
  });
}

export type EscuchaImpresora = {
  consultar: () => Promise<void>;
  cerrar: () => void;
};
export function escucharImpresora(
  tenantId: string,
  config: ImpresoraPuesto,
  evento: (event: unknown) => void,
  desconectado: () => void,
): Promise<EscuchaImpresora> {
  return exclusivo(async () => {
    const qz = await conectar(config.host, tenantId);
    if (monitor)
      throw new Error(
        "Ya hay una escucha activa. Detenela antes de cambiar de impresora.",
      );
    const actual: Monitor = {
      qz,
      impresora: config.impresora,
      evento,
      desconectado,
    };
    monitor = actual;
    const cerrar = () => {
      if (monitor !== actual) return;
      monitor = undefined;
      if (qz.websocket.isActive())
        void qz.printers.stopListening().catch(() => {});
    };
    try {
      const solicitud = {
        impresora: config.impresora,
        error: undefined as Error | undefined,
      };
      solicitudEscucha = solicitud;
      try {
        await conLimite(qz, qz.printers.startListening(config.impresora));
      } catch (error) {
        throw solicitud.error ?? error;
      } finally {
        solicitudEscucha = undefined;
      }
      if (monitor !== actual)
        throw new Error("Se perdió la conexión durante la escucha.");
      await conLimite(qz, qz.printers.getStatus());
      return {
        cerrar,
        consultar: () =>
          exclusivo(async () => {
            if (monitor !== actual || !qz.websocket.isActive())
              throw new Error("La escucha está desconectada.");
            await conLimite(qz, qz.printers.getStatus());
          }),
      };
    } catch (error) {
      cerrar();
      throw error;
    }
  });
}

export function imprimirPruebaDocumento(
  tenantId: string,
  config: ImpresoraPuesto,
  copias: number,
  dobleFaz: boolean,
  preparada: (jobName: string) => void,
) {
  return exclusivo(async () => {
    const qz = await conectar(config.host, tenantId);
    const trabajo = await prepararPruebaDocumento(
      config.impresora,
      copias,
      dobleFaz,
    );
    firmaActual = trabajo;
    const { printer, options, data } = trabajo.params;
    preparada(options.jobName);
    try {
      await conLimite(
        qz,
        qz.print(
          { getPrinter: () => printer, getOptions: () => options },
          data,
          [],
          trabajo.timestamp,
        ),
      );
    } catch {
      throw new Error(
        "No se pudo confirmar el envío. Revisá la cola antes de repetir la prueba para evitar copias duplicadas.",
      );
    }
    return options.jobName;
  });
}

/** Un intento por documento. Si QZ no responde, nunca reenviar automáticamente. */
export function imprimirDocumentoOrden(
  tenantId: string,
  config: ImpresoraPuesto,
  ordenId: string,
  itemId: string,
  intentoId: string,
  reimpresionDe: string | undefined,
  preparado: (envio: EnvioDocumento) => void,
) {
  return exclusivo(async () => {
    const qz = await conectar(config.host, tenantId);
    const trabajo = await prepararDocumentoOrden(ordenId, itemId, {
      intentoId,
      impresora: config.impresora,
      host: config.host,
      reimpresionDe,
    });
    preparado(trabajo.intento);
    firmaActual = trabajo;
    const { printer, options, data } = trabajo.params;
    await conLimite(
      qz,
      qz.print(
        { getPrinter: () => printer, getOptions: () => options },
        data,
        [],
        trabajo.timestamp,
      ),
    );
    return trabajo.intento;
  });
}
