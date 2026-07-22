"use client";

import * as React from "react";
import { toast } from "sonner";

import { ArchivoUploader } from "@/components/archivos/archivo-uploader";
import type { Archivo } from "@/lib/archivos";
import { getArchivosDeOrden, type ArchivosDeOrden } from "@/lib/archivos-api";

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
  }, [ordenId]);

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
