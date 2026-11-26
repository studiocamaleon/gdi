"use client";

import { toast } from "sonner";
import { getCurrentUser } from "./auth";
import { ApiError, apiRequest } from "./api";
import { listarArchivos, subirArchivo } from "./archivos-api";
import { metaCentroCopiado } from "./centro-copiado-api";
import type { ComprobanteEmisionOt } from "./ordenes-trabajo-api";
import { AUTOGENERADO_MEDIDA } from "./planos-persistir";
import type { PropuestaItem } from "./propuestas";
import {
  itemsConSelloDe,
  esDisenoCompleto,
  nombreArteSello,
  type DisenoSelloCompleto,
} from "./sello-arte/diseno";

type Fuente =
  | { file: File }
  | { diseno: DisenoSelloCompleto; negativo: boolean };
type Adjunto = {
  id: string;
  ordenId: string;
  numero: string;
  itemId: string;
  nombre: string;
  fuente: Fuente;
  descripcion?: string;
  marca?: string;
  reserva?: string;
  estado: "pendiente" | "error";
};

export function prepararAdjuntos(
  orden: ComprobanteEmisionOt,
  items: Array<{ item: PropuestaItem; cotizacionItemId?: string }>,
) {
  const porCotizacion = new Map(
    orden.productos.map((p) => [p.cotizacionItemId, p.id]),
  );
  const adjuntos: Adjunto[] = [];
  for (const [i, { item, cotizacionItemId }] of items.entries()) {
    const itemId = cotizacionItemId
      ? porCotizacion.get(cotizacionItemId)
      : orden.productos[i]?.id;
    if (!itemId) {
      if (
        item.archivosPendientes?.length ||
        item.planosPendientes?.length ||
        item.briefDisenoArchivosPendientes?.length
      )
        throw new Error(
          "No se encontró el producto emitido para vincular sus archivos.",
        );
      continue;
    }
    const agregar = (
      nombre: string,
      fuente: Fuente,
      marca?: string,
      descripcion?: string,
    ) => {
      adjuntos.push({
        id: crypto.randomUUID(),
        ordenId: orden.id,
        numero: orden.numero,
        itemId,
        nombre,
        fuente,
        marca,
        descripcion,
        estado: "pendiente",
      });
    };
    const copiado = metaCentroCopiado(item.jobContext);
    for (const file of item.archivosPendientes ?? [])
      agregar(
        file.name,
        { file },
        copiado ? "centro-copiado" : undefined,
        copiado ? `Documento · ${file.name}` : undefined,
      );
    for (const {
      file,
      requiereVectorizacion,
    } of item.briefDisenoArchivosPendientes ?? [])
      agregar(
        file.name,
        { file },
        "brief-diseno",
        requiereVectorizacion
          ? "Brief de diseño · Requiere vectorización"
          : "Brief de diseño",
      );
    for (const file of item.planosPendientes ?? [])
      agregar(file.name, { file }, AUTOGENERADO_MEDIDA);
    const [sello] = itemsConSelloDe([
      {
        id: itemId,
        nombre: item.productoNombre,
        snapshot: { jobContext: item.jobContext },
      },
    ]);
    if (sello && esDisenoCompleto(sello.diseno)) {
      for (const negativo of [false, true])
        agregar(
          nombreArteSello(sello.diseno, negativo),
          { diseno: sello.diseno, negativo },
          "sello",
          `Arte del sello · ${sello.diseno.modelo.nombre}`,
        );
    } else if (sello)
      toast.warning(
        `Abrí el editor de ${item.productoNombre} y guardá las medidas para generar el arte.`,
      );
  }
  return adjuntos;
}

const cambio = "grafoprint:archivos-emision";
const bases = new Map<string, Promise<IDBDatabase>>();
function base(ambito: string) {
  let abierta = bases.get(ambito);
  if (!abierta) {
    abierta = new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open("grafoprint-archivos-ot-" + ambito, 1);
      req.onupgradeneeded = () => {
        const jobs = req.result.createObjectStore("adjuntos", {
          keyPath: "id",
        });
        jobs.createIndex("porOrden", ["ordenId", "estado"]);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    }).catch((error: unknown) => {
      bases.delete(ambito);
      throw error;
    });
    bases.set(ambito, abierta);
  }
  return abierta;
}

async function transaccion<T>(
  ambito: string,
  modo: IDBTransactionMode,
  operar: (s: IDBObjectStore) => IDBRequest<T>,
) {
  const db = await base(ambito);
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction("adjuntos", modo);
    let req: IDBRequest<T>;
    try {
      req = operar(tx.objectStore("adjuntos"));
    } catch (error) {
      tx.abort();
      reject(error);
      return;
    }
    tx.oncomplete = () => resolve(req.result);
    tx.onabort = () =>
      reject(
        tx.error ??
          req.error ??
          new Error("No se pudo guardar la carga local."),
      );
    tx.onerror = () => reject(tx.error ?? req.error);
  });
}

function canalDeCambios(ambito: string) {
  try {
    return typeof BroadcastChannel === "undefined"
      ? null
      : new BroadcastChannel(cambio + ambito);
  } catch {
    return null;
  }
}

function avisar(ambito: string, ordenId: string) {
  window.dispatchEvent(
    new CustomEvent(cambio, { detail: { ambito, ordenId } }),
  );
  const canal = canalDeCambios(ambito);
  canal?.postMessage(ordenId);
  canal?.close();
}

export function observarAdjuntos(
  ambito: string,
  ordenId: string,
  actualizar: () => void,
) {
  const local = (e: Event) => {
    const d = (e as CustomEvent<{ ambito: string; ordenId: string }>).detail;
    if (d.ambito === ambito && d.ordenId === ordenId) actualizar();
  };
  window.addEventListener(cambio, local);
  const canal = canalDeCambios(ambito);
  if (canal)
    canal.onmessage = (e) => {
      if (e.data === ordenId) actualizar();
    };
  return () => {
    window.removeEventListener(cambio, local);
    canal?.close();
  };
}

export async function estadoAdjuntos(ambito: string, ordenId: string) {
  const contar = (estado: Adjunto["estado"]) =>
    transaccion(ambito, "readonly", (s) =>
      s.index("porOrden").count([ordenId, estado]),
    );
  const [pendientes, errores] = await Promise.all([
    contar("pendiente"),
    contar("error"),
  ]);
  return { pendientes, errores };
}

async function transferir(ambito: string, a: Adjunto) {
  if (a.reserva) {
    // Cancelar sólo afecta a PENDIENTE. Si la confirmación llegó al servidor
    // antes de un cierre de pestaña, reconocer su id evita una segunda copia.
    await apiRequest(`/archivos/${a.reserva}/cancelar-subida`, {
      method: "POST",
    }).catch((e: unknown) => {
      if (!(e instanceof ApiError && e.status === 404)) throw e;
    });
    if (
      (await listarArchivos("ORDEN_ITEM", a.itemId)).some(
        (f) => f.id === a.reserva,
      )
    )
      return;
  }
  const fuente = a.fuente;
  let file: File;
  if ("file" in fuente) file = fuente.file;
  else {
    const { generarArtesDeSello } = await import("./sello-arte/publicar");
    const artes = await generarArtesDeSello(fuente.diseno);
    file = new File([artes[fuente.negativo ? 1 : 0].contenido], a.nombre, {
      type: "application/postscript",
    });
  }
  await subirArchivo(
    file,
    {
      scope: "ORDEN_ITEM",
      entidadId: a.itemId,
      descripcion: a.descripcion,
      autogeneradoPor: a.marca,
    },
    undefined,
    undefined,
    async (id) => {
      a.reserva = id;
      await transaccion(ambito, "readwrite", (s) => s.put(a));
    },
  );
}

export function procesarAdjuntos(
  ambito: string,
  reintentar = false,
  soloOrden?: string,
) {
  if (!ambito || !navigator.locks || !window.indexedDB) return;
  void navigator.locks
    .request(cambio + ambito, async () => {
      const ids = await transaccion(ambito, "readonly", (s) => s.getAllKeys());
      if (!ids.length) return;
      const { currentUser } = await getCurrentUser();
      if (`${currentUser.tenantActual?.id}/${currentUser.id}` !== ambito)
        return;
      for (const id of ids) {
        const a: Adjunto | undefined = await transaccion(
          ambito,
          "readonly",
          (s) => s.get(id),
        );
        if (
          !a ||
          (soloOrden && a.ordenId !== soloOrden) ||
          (a.estado === "error" && !reintentar)
        )
          continue;
        try {
          if (a.estado === "error") {
            a.estado = "pendiente";
            await transaccion(ambito, "readwrite", (s) => s.put(a));
            avisar(ambito, a.ordenId);
          }
          await transferir(ambito, a);
          await transaccion(ambito, "readwrite", (s) => s.delete(id));
        } catch (error) {
          a.estado = "error";
          await transaccion(ambito, "readwrite", (s) => s.put(a));
          toast.error(
            `${a.numero} · ${a.nombre}: ${error instanceof Error ? error.message : "Carga pendiente"}. Podés reintentar desde Archivos.`,
          );
        }
        avisar(ambito, a.ordenId);
      }
    })
    .catch(() =>
      toast.error(
        "No se pudo acceder a las cargas pendientes en este navegador.",
      ),
    );
}

/** Confirmar la copia local antes de salir del formulario. La red queda fuera de la emisión. */
export async function encolarAdjuntos(ambito: string, adjuntos: Adjunto[]) {
  if (!adjuntos.length) return true;
  if (!ambito || !window.indexedDB || !navigator.locks) return false;
  try {
    await transaccion(ambito, "readwrite", (s) => {
      const peticiones = adjuntos.map((a) => s.add(a));
      return peticiones[peticiones.length - 1];
    });
  } catch {
    return false;
  }
  toast.info(
    `Los archivos de ${adjuntos[0].numero} se están cargando en segundo plano.`,
  );
  avisar(ambito, adjuntos[0].ordenId);
  procesarAdjuntos(ambito);
  return true;
}
