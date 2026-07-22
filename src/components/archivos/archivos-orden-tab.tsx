"use client";

import * as React from "react";
import { toast } from "sonner";

import { RotateCcwIcon, Trash2Icon } from "lucide-react";

import { ArchivoUploader } from "@/components/archivos/archivo-uploader";
import { formatBytes, type Archivo } from "@/lib/archivos";
import {
  getArchivosDeOrden,
  getPapelera,
  restaurarArchivo,
  type ArchivoEnPapelera,
  type ArchivosDeOrden,
} from "@/lib/archivos-api";

/**
 * Lo borrado que todavía se puede recuperar. Va colapsada y sólo aparece si
 * hay algo: el diálogo de borrado promete 30 días de gracia, y hasta ahora esa
 * promesa no se podía cumplir — el objeto seguía en el bucket pero no había
 * ninguna forma de traerlo de vuelta.
 */
function PapeleraOrden({
  ordenId,
  onRestaurado,
}: {
  ordenId: string;
  onRestaurado: () => void;
}) {
  const [items, setItems] = React.useState<ArchivoEnPapelera[]>([]);
  const [abierta, setAbierta] = React.useState(false);

  React.useEffect(() => {
    let vivo = true;
    getPapelera("ORDEN", ordenId)
      .then((r) => {
        if (vivo) setItems(r);
      })
      .catch(() => {
        // La papelera es accesoria: si falla, el tab sigue sirviendo.
      });
    return () => {
      vivo = false;
    };
  }, [ordenId]);

  if (items.length === 0) return null;

  const restaurar = async (a: ArchivoEnPapelera) => {
    try {
      await restaurarArchivo(a.id);
      setItems((s) => s.filter((x) => x.id !== a.id));
      toast.success(`${a.nombre} restaurado.`);
      onRestaurado();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo restaurar.",
      );
    }
  };

  return (
    <div className="arch-bloque">
      <button
        type="button"
        className="arch-papelera-head"
        onClick={() => setAbierta((v) => !v)}
        aria-expanded={abierta}
      >
        <Trash2Icon />
        <span>Papelera</span>
        <span className="n">{items.length}</span>
        <span className="s">
          {abierta ? "Ocultar" : "Se borran solos a los 30 días"}
        </span>
      </button>
      {abierta ? (
        <div className="arch-lista">
          {items.map((a) => (
            <div key={a.id} className="arch-row">
              <span className="arch-ico">
                <Trash2Icon />
              </span>
              <div className="arch-nom">
                <b>{a.nombre}</b>
                <span>
                  {formatBytes(a.bytes)} · quedan {a.diasRestantes}{" "}
                  {a.diasRestantes === 1 ? "día" : "días"}
                </span>
              </div>
              <div className="arch-acc">
                <button
                  type="button"
                  title="Restaurar"
                  onClick={() => void restaurar(a)}
                >
                  <RotateCcwIcon />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Archivos de una orden: los del documento entero arriba, y un bloque por
 * item debajo.
 *
 * La separación no es cosmética. El arte de producción es **del item** — es
 * lo que el operario abre en la mesa cuando ejecuta ese paso — mientras que
 * la orden de compra del cliente o el remito son del documento y no le
 * corresponden a ningún producto en particular. Mezclarlos obligaría al
 * operario a adivinar cuál de siete PDFs es el suyo.
 */
export function ArchivosOrdenTab({
  ordenId,
  soloLectura = false,
  onTotalCambio,
}: {
  ordenId: string;
  soloLectura?: boolean;
  /** Para que la pestaña muestre el contador real. */
  onTotalCambio?: (total: number) => void;
}) {
  const [data, setData] = React.useState<ArchivosDeOrden | null>(null);
  const [cargando, setCargando] = React.useState(true);
  const [token, setToken] = React.useState(0);
  const recargar = React.useCallback(() => setToken((n) => n + 1), []);

  React.useEffect(() => {
    let vivo = true;
    setCargando(true);
    getArchivosDeOrden(ordenId)
      .then((r) => {
        if (vivo) setData(r);
      })
      .catch((error: unknown) => {
        if (vivo) {
          toast.error(
            error instanceof Error
              ? error.message
              : "No se pudieron cargar los archivos.",
          );
        }
      })
      .finally(() => {
        if (vivo) setCargando(false);
      });
    return () => {
      vivo = false;
    };
  }, [ordenId, token]);

  const total = React.useMemo(
    () =>
      data
        ? data.documento.length +
          data.items.reduce((n, i) => n + i.archivos.length, 0)
        : 0,
    [data],
  );

  React.useEffect(() => {
    if (data) onTotalCambio?.(total);
  }, [data, total, onTotalCambio]);

  const setDocumento = (archivos: Archivo[]) =>
    setData((d) => (d ? { ...d, documento: archivos } : d));

  const setItem = (itemId: string, archivos: Archivo[]) =>
    setData((d) =>
      d
        ? {
            ...d,
            items: d.items.map((i) =>
              i.itemId === itemId ? { ...i, archivos } : i,
            ),
          }
        : d,
    );

  if (cargando) {
    return <div className="otd-noprod">Cargando archivos…</div>;
  }
  if (!data) {
    return <div className="otd-noprod">No se pudieron cargar los archivos.</div>;
  }

  return (
    <div className="arch-tab">
      <div className="arch-bloque">
        <div className="arch-bloque-head">
          <span className="t">Archivos de la orden</span>
          {data.documento.length > 0 ? (
            <span className="n">{data.documento.length}</span>
          ) : null}
          <span className="s">
            Orden de compra, referencias, lo que no es de un producto puntual
          </span>
        </div>
        <ArchivoUploader
          scope="ORDEN"
          entidadId={ordenId}
          archivos={data.documento}
          onCambio={setDocumento}
          soloLectura={soloLectura}
          permitirPublico
          titulo="Arrastrá archivos de la orden"
          vacio="Todavía no hay archivos generales de esta orden."
        />
      </div>

      <PapeleraOrden ordenId={ordenId} onRestaurado={recargar} />

      {data.items.map((item) => (
        <div key={item.itemId} className="arch-bloque">
          <div className="arch-bloque-head">
            <span className="t">{item.nombre}</span>
            {item.archivos.length > 0 ? (
              <span className="n">{item.archivos.length}</span>
            ) : null}
            <span className="s">Arte de producción de este producto</span>
          </div>
          <ArchivoUploader
            scope="ORDEN_ITEM"
            entidadId={item.itemId}
            archivos={item.archivos}
            onCambio={(a) => setItem(item.itemId, a)}
            soloLectura={soloLectura}
            permitirPublico
            titulo="Arrastrá el arte de este producto"
            vacio="Sin arte cargado. Producción va a llegar a este paso sin el archivo."
          />
        </div>
      ))}
    </div>
  );
}
