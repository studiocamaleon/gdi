"use client";
import {
  getConfiguracionImpresion,
  getFirmaImpresoras,
  getFirmaDetallesImpresoras,
  getFirmaEscucha,
  prepararPruebaDocumento,
  prepararPruebaPerfil,
  prepararPruebaCad,
  prepararEtiqueta,
  prepararDocumentoOrden,
  type EnvioDocumento,
  type FirmaQz,
} from "./impresion-api";
import { hostQzValido, type ImpresoraPuesto } from "./impresora-puesto";
import {
  prepararPruebaPerfilCad,
  type PruebaPerfilCad,
} from "./perfiles-cad-api";

type Qz = (typeof import("qz-tray"))["default"];
let sdk: Qz | undefined;
let conexion = "";
let firmaActual: FirmaQz | undefined;
let ocupado = false;
type SolicitudLectura = (
  | { tipo: "escucha"; impresora: string | string[] }
  | { tipo: "detalle" }
) & { error?: Error };
let solicitudLectura: SolicitudLectura | undefined;
type Monitor = {
  qz: Qz;
  impresora: string;
  evento: (event: unknown) => void;
  desconectado: () => void;
};
let monitor: Monitor | undefined;

/** Estas consultas no aceptan timestamp prefijado en el SDK 2.2.6.
 * El backend reconstruye sólo la operación esperada; nunca firma hashes libres. */
async function hashMensaje(mensaje: string) {
  const solicitud = solicitudLectura;
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(mensaje),
  );
  const hash = Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
  if (solicitud) {
    const { call, params, timestamp } = JSON.parse(mensaje);
    try {
      const coincide =
        solicitud.tipo === "escucha"
          ? call === "printers.startListening" &&
            JSON.stringify(params) ===
              JSON.stringify({
                printerNames: Array.isArray(solicitud.impresora)
                  ? solicitud.impresora
                  : [solicitud.impresora],
              })
          : call === "printers.detail" && params === undefined;
      if (!coincide)
        throw new Error("La solicitud no coincide con la consulta autorizada.");
      const firma =
        solicitud.tipo === "escucha"
          ? await getFirmaEscucha(solicitud.impresora, timestamp)
          : await getFirmaDetallesImpresoras(timestamp);
      if (solicitud !== solicitudLectura)
        throw new Error("La solicitud de consulta venció.");
      if (firma.hash !== hash)
        throw new Error("La firma de la consulta no coincide.");
      firmaActual = firma;
    } catch (error) {
      solicitud.error =
        error instanceof Error
          ? error
          : new Error("No se pudo autorizar la consulta.");
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

export function buscarBandejas(
  host: string,
  tenantId: string,
  impresora: string,
): Promise<string[]> {
  return exclusivo(async () => {
    const qz = await conectar(host, tenantId);
    const solicitud: SolicitudLectura = { tipo: "detalle" };
    solicitudLectura = solicitud;
    try {
      const detalles = await conLimite(qz, qz.printers.details());
      if (!Array.isArray(detalles))
        throw new Error(
          "QZ Tray no devolvió los datos de las impresoras. Volvé a consultar.",
        );
      const seleccionada = detalles.find((p) => p && p.name === impresora);
      if (!seleccionada)
        throw new Error(
          `No se encontró «${impresora}» en el equipo de impresión. Revisá la impresora configurada.`,
        );
      if (seleccionada.trays == null) return [];
      if (
        !Array.isArray(seleccionada.trays) ||
        seleccionada.trays.some(
          (v: unknown) => typeof v !== "string" || !v.trim(),
        )
      )
        throw new Error(
          "QZ Tray devolvió una lista de bandejas inválida. Revisá el controlador de la impresora.",
        );
      // Conservar el identificador literal: es el valor que espera printerTray.
      return [...new Set<string>(seleccionada.trays)];
    } catch (error) {
      throw solicitud.error ?? error;
    } finally {
      solicitudLectura = undefined;
    }
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
  cerrar: () => void | Promise<void>;
};
export function escucharImpresora(
  tenantId: string,
  config: ImpresoraPuesto,
  evento: (event: unknown) => void,
  desconectado: () => void,
  impresoras?: string[],
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
    const cerrar = async () => {
      if (monitor !== actual) return;
      monitor = undefined;
      if (qz.websocket.isActive())
        await qz.printers.stopListening().catch(() => {});
    };
    try {
      const solicitud: SolicitudLectura = {
        tipo: "escucha",
        impresora: impresoras ?? config.impresora,
      };
      solicitudLectura = solicitud;
      try {
        await conLimite(
          qz,
          qz.printers.startListening(impresoras ?? config.impresora),
        );
      } catch (error) {
        throw solicitud.error ?? error;
      } finally {
        solicitudLectura = undefined;
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
      await cerrar();
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
  config: ImpresoraPuesto & { perfilId: string; revisionPerfil: string },
  ordenId: string,
  itemId: string,
  intentoId: string,
  reimpresionDe: string | undefined,
  preparado: (envio: EnvioDocumento) => void,
  pagina?: number,
) {
  return exclusivo(async () => {
    const qz = await conectar(config.host, tenantId);
    const trabajo = await prepararDocumentoOrden(ordenId, itemId, {
      intentoId,
      impresora: config.impresora,
      host: config.host,
      reimpresionDe,
      perfilId: config.perfilId,
      revisionPerfil: config.revisionPerfil,
      ...(pagina ? { pagina } : {}),
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

/** Prueba fija de dos páginas; el backend fija bandeja, faz e impresora. */
export function imprimirPruebaPerfil(
  tenantId: string,
  host: string,
  perfilId: string,
) {
  return exclusivo(async () => {
    const qz = await conectar(host, tenantId);
    const trabajo = await prepararPruebaPerfil(perfilId);
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
    return options.jobName;
  });
}

export function imprimirPruebaCad(
  tenantId: string,
  host: string,
  destinoId: string,
  version: number,
  formato: "A1" | "PERSONALIZADO",
  color: "BN" | "COLOR" = "COLOR",
) {
  return exclusivo(async () => {
    const qz = await conectar(host, tenantId);
    const trabajo = await prepararPruebaCad(destinoId, version, formato, color);
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
    return trabajo.plan;
  });
}

export function imprimirPruebaPerfilCad(
  tenantId: string,
  host: string,
  id: string,
  datos: PruebaPerfilCad,
) {
  return exclusivo(async () => {
    const qz = await conectar(host, tenantId);
    const trabajo = await prepararPruebaPerfilCad(id, datos);
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
  });
}
