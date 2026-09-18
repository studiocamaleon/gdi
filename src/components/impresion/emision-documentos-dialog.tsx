"use client";
import { useEffect, useState } from "react";
import { Printer } from "lucide-react";
import { ActionButton } from "@/components/design-system/action-button";
import { DesignSystemProvider } from "@/components/design-system/appearance";
import { FormDialog } from "@/components/design-system/form-dialog";
import {
  getPerfilesImpresion,
  type ConfiguracionPerfiles,
  type DocumentoOrden,
} from "@/lib/impresion-api";
import { planDocumento, resolverPerfil } from "@/lib/perfiles-impresion";
import type { PropuestaItem } from "@/lib/propuestas";
import { DocumentosTabla } from "./documentos-tabla";
import s from "./documentos-impresion.module.css";

export function EmisionDocumentosDialog({
  items,
  onClose,
  onEmitir,
}: {
  items: PropuestaItem[];
  onClose: () => void;
  onEmitir: (imprimir: boolean) => void;
}) {
  const [config, setConfig] = useState<ConfiguracionPerfiles | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let vivo = true;
    getPerfilesImpresion()
      .then((c) => {
        if (vivo) setConfig(c);
      })
      .catch((e) => {
        if (vivo) setError(e.message);
      });
    return () => {
      vivo = false;
    };
  }, []);
  const documentos: DocumentoOrden[] = items.flatMap((item) => {
    const plan = planDocumento(item.jobContext);
    if (!plan) return [];
    const pasos = item.cotizacion.pasos.filter(
      (p) => p.activado && p.familiaCodigo.startsWith("impresion_"),
    );
    const maquinas = pasos.flatMap((p) =>
      p.tiempo?.maquinaId ? [p.tiempo.maquinaId] : [],
    );
    const ruta = resolverPerfil(
      plan.configuracion,
      config?.perfiles ?? [],
      maquinas,
    );
    const archivos = item.archivosPendientes ?? [];
    // Antes de emitir sólo existe una vista provisional. La OT guardada valida
    // archivos, máquina, bloqueos y revisión del perfil nuevamente.
    const motivo =
      plan.motivo ||
      (pasos.length !== 1 ? "Revisar la ruta de impresión." : null) ||
      ruta.motivo;
    return [
      {
        ...plan,
        itemId: item.id,
        documentos: plan.segmentos.length,
        archivos: archivos.map((a) => a.name),
        ruta:
          motivo && !ruta.motivo
            ? { ...ruta, estado: "REVISAR" as const, motivo }
            : ruta,
        motivo,
        configuracion: {
          ...plan.configuracion,
          papelNombre:
            config?.papeles.find(
              (p) => p.id === plan.configuracion.papelMateriaPrimaId,
            )?.nombre ?? plan.configuracion.papelNombre,
        },
        seleccionPaginas: plan.segmentos
          .filter((s) => s.rangoPaginas)
          .map((s) => ({
            nombre: s.nombre,
            rango: s.rangoPaginas!,
            paginasOriginales: s.paginasOriginales ?? s.paginas,
          })),
      },
    ];
  });
  const listos = documentos.filter((d) => !d.motivo).length;
  return (
    <DesignSystemProvider theme="brand" appearance="light">
      <FormDialog
        isOpen
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        title="Emitir e imprimir"
        description="Revisá el destino de cada documento antes de guardar la orden."
        className={s.dialog}
      >
        <div className={s.body}>
          {error && <p role="alert">{error}</p>}
          {!config && !error && (
            <p role="status">Consultando perfiles de impresión…</p>
          )}
          {config && (
            <>
              <DocumentosTabla documentos={documentos} provisional />
              <p className={s.nota}>
                {listos} listos por configuración · {documentos.length - listos}{" "}
                pendientes de preparación o revisión. Al guardar se validan los
                archivos y la disponibilidad de producción; sólo se envían los
                que cumplen todas las condiciones.
              </p>
            </>
          )}
        </div>
        <div className={s.footer}>
          <ActionButton variant="tertiary" onPress={onClose}>
            Volver
          </ActionButton>
          <ActionButton variant="outline" onPress={() => onEmitir(false)}>
            Emitir sin imprimir
          </ActionButton>
          <ActionButton
            isDisabled={!config || !documentos.length}
            onPress={() => onEmitir(true)}
          >
            <Printer data-icon="inline-start" />
            {listos ? "Emitir e imprimir" : "Emitir y dejar en cola"}
          </ActionButton>
        </div>
      </FormDialog>
    </DesignSystemProvider>
  );
}
