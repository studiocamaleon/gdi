"use client";
import { tandasDeOrden } from "@/lib/tandas-copiado";
import type { CentroCopiadoMeta } from "@/lib/centro-copiado-api";
import { TomoPdfPreview } from "./tomo-pdf-preview";

export function TandasCopiadoPanel({
  items,
  metas,
}: {
  items: { itemId: string; archivosPendientes?: File[] }[];
  metas: Record<string, CentroCopiadoMeta | null>;
}) {
  return (
    <>
      {tandasDeOrden(items, metas).map((tanda, n) => (
        <div key={tanda.id} className="arch-bloque">
          <div className="arch-bloque-head">
            <span className="t">Tanda de impresión {n + 1}</span>
            <span className="s">
              Papel: {tanda.meta.papelLabel} · Formato: {tanda.meta.tamano} ·{" "}
              {tanda.meta.color === "BN" ? "B/N" : "Color"} ·{" "}
              {tanda.meta.faz === 2 ? "Doble faz" : "Simple faz"} · Cobertura{" "}
              {tanda.meta.cobertura ?? "alta"}
            </span>
          </div>
          <p>
            Preparación compartida · {tanda.segmentos.length} originales ·
            Imprimir 1 copia del PDF; las cantidades ya están incluidas.
          </p>
          <ul>
            {tanda.segmentos.map((s) => (
              <li key={s.origenItemIds![0]}>
                {s.nombre} · {s.copias} {s.copias === 1 ? "copia" : "copias"}
              </li>
            ))}
          </ul>
          {tanda.completa ? (
            <TomoPdfPreview
              nombre={`Tanda ${n + 1}`}
              segmentos={tanda.segmentos}
              tanda
            />
          ) : (
            <p role="alert">
              Esta tanda cambió. Volvé a cotizar y guardar la orden antes de
              imprimir.
            </p>
          )}
        </div>
      ))}
    </>
  );
}
