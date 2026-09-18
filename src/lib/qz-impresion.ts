"use client";
import {
  getConfiguracionImpresion,
  getFirmaImpresoras,
  prepararEtiqueta,
  type FirmaQz,
} from "./impresion-api";
import { hostQzValido, type ImpresoraPuesto } from "./impresora-puesto";

type Qz = (typeof import("qz-tray"))["default"];
let sdk: Qz | undefined;
let conexion = "";
let firmaActual: FirmaQz | undefined;
let ocupado = false;

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
  sdk ??= (await import("qz-tray")).default;
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
        new Error("La solicitud no coincide con la etiqueta autorizada."),
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
