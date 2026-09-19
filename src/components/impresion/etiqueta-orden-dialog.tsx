"use client";
import { useEffect, useRef, useState } from "react";
import { Printer, Settings2, Download } from "lucide-react";
import { ActionButton } from "@/components/design-system/action-button";
import { DesignSystemProvider } from "@/components/design-system/appearance";
import { FormDialog } from "@/components/design-system/form-dialog";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  getConfiguracionImpresion,
  getVistaEtiqueta,
  type ConfiguracionImpresion,
  type VistaEtiqueta,
} from "@/lib/impresion-api";
import { leerImpresora, type ImpresoraPuesto } from "@/lib/impresora-puesto";
import dynamic from "next/dynamic";
import { useImpresionDirecta } from "@/components/navigation/capacidades-provider";
import { descargarEtiquetaPdf } from "@/lib/etiqueta-pdf";
const ImpresoraPuestoForm = dynamic(() =>
  import("./impresora-puesto-form").then((m) => m.ImpresoraPuestoForm),
);
import s from "./impresion.module.css";

export function EtiquetaOrdenDialog({
  ordenId,
  onClose,
}: {
  ordenId: string;
  onClose: () => void;
}) {
  const impresionDirecta = useImpresionDirecta();
  const [vista, setVista] = useState<VistaEtiqueta | null>(null);
  const [identidad, setIdentidad] = useState<ConfiguracionImpresion | null>(
    null,
  );
  const [config, setConfig] = useState<ImpresoraPuesto | null>(null);
  const [configurando, setConfigurando] = useState(false);
  const [copias, setCopias] = useState("1");
  const [pagina, setPagina] = useState(0);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [imprimiendo, setImprimiendo] = useState(false);
  const enviando = useRef(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let cancelado = false;
    Promise.all([
      getVistaEtiqueta(ordenId),
      impresionDirecta ? getConfiguracionImpresion() : Promise.resolve(null),
    ])
      .then(([v, i]) => {
        if (cancelado) return;
        setError("");
        setPagina(0);
        setVista(v);
        setIdentidad(i);
        if (!i) {
          setConfig(null);
          setConfigurando(false);
          return;
        }
        const guardada = leerImpresora(i.tenantId);
        setConfig(guardada);
        setConfigurando(!guardada.impresora);
      })
      .catch((e) => {
        if (!cancelado)
          setError(
            e instanceof Error ? e.message : "No se pudo cargar la etiqueta.",
          );
      });
    return () => {
      cancelado = true;
    };
  }, [ordenId, revision, impresionDirecta]);
  const cantidad = Number(copias);
  const cantidadValida =
    Number.isInteger(cantidad) && cantidad >= 1 && cantidad <= 20;
  async function imprimir() {
    if (
      !impresionDirecta ||
      !config ||
      !identidad ||
      !cantidadValida ||
      enviando.current
    )
      return;
    enviando.current = true;
    setImprimiendo(true);
    setError("");
    setMensaje("Conectando con la impresora…");
    try {
      const { imprimirOrden } = await import("@/lib/qz-impresion");
      await imprimirOrden(
        ordenId,
        identidad.tenantId,
        config,
        cantidad,
        (enviadas, total) =>
          setMensaje(`Enviadas ${enviadas} de ${total} páginas.`),
      );
      setMensaje(
        `Etiqueta${cantidad > 1 ? "s" : ""} enviada${cantidad > 1 ? "s" : ""} a ${config.impresora}.`,
      );
    } catch (e) {
      setMensaje("");
      setError(
        e instanceof Error ? e.message : "No se pudo enviar la etiqueta.",
      );
    } finally {
      enviando.current = false;
      setImprimiendo(false);
    }
  }
  return (
    <DesignSystemProvider theme="brand" appearance="light">
      <FormDialog
        isOpen
        onOpenChange={(open) => {
          if (!open && !enviando.current) onClose();
        }}
        isDismissable={!imprimiendo}
        title={impresionDirecta ? "Imprimir etiqueta" : "Etiqueta de la orden"}
        description={
          vista
            ? `${vista.numero} · 100 × 150 mm · QR de entrega`
            : "Preparando la etiqueta de la orden…"
        }
        className={s.dialog}
      >
        <div className={s.body}>
          {vista && (
            <div className={s.preview}>
              {/* La imagen es el mismo raster monocromo enviado a la impresora. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={vista.paginas[pagina]}
                alt={`Etiqueta ${pagina + 1} de ${vista.paginas.length} para ${vista.numero}`}
              />
              {vista.paginas.length > 1 && (
                <div className={s.pagination}>
                  <ActionButton
                    variant="outline"
                    isDisabled={pagina === 0 || imprimiendo}
                    onPress={() => setPagina(pagina - 1)}
                  >
                    Anterior
                  </ActionButton>
                  <span>
                    {pagina + 1} / {vista.paginas.length}
                  </span>
                  <ActionButton
                    variant="outline"
                    isDisabled={
                      pagina === vista.paginas.length - 1 || imprimiendo
                    }
                    onPress={() => setPagina(pagina + 1)}
                  >
                    Siguiente
                  </ActionButton>
                </div>
              )}
            </div>
          )}
          {!vista && !error && <p role="status">Preparando vista previa…</p>}
          {impresionDirecta && identidad && !identidad.firmaDisponible && (
            <p role="alert" className={s.error}>
              {identidad.mensaje}
            </p>
          )}
          {impresionDirecta && identidad && config && configurando && (
            <ImpresoraPuestoForm
              tenantId={identidad.tenantId}
              inicial={config}
              disabled={imprimiendo || !identidad.firmaDisponible}
              onGuardar={(c) => {
                setConfig(c);
                setConfigurando(false);
              }}
            />
          )}
          {impresionDirecta && config?.impresora && !configurando && (
            <div className={s.selected}>
              <div>
                <strong>{config.impresora}</strong>
                <p>{config.host}</p>
              </div>
              <ActionButton
                variant="tertiary"
                isDisabled={imprimiendo}
                onPress={() => setConfigurando(true)}
              >
                <Settings2 aria-hidden="true" />
                Cambiar
              </ActionButton>
            </div>
          )}
          {impresionDirecta && vista && (
            <Field className={s.copies}>
              <FieldLabel htmlFor="etiqueta-copias">
                Copias de cada etiqueta
              </FieldLabel>
              <Input
                id="etiqueta-copias"
                type="number"
                inputMode="numeric"
                min={1}
                max={20}
                step={1}
                value={copias}
                disabled={imprimiendo}
                onChange={(e) => setCopias(e.target.value)}
                aria-invalid={!cantidadValida}
              />
              <span className={s.help}>
                {cantidadValida
                  ? `${vista.paginas.length * cantidad} etiqueta${vista.paginas.length * cantidad === 1 ? "" : "s"} en total`
                  : "Ingresá de 1 a 20 copias."}
              </span>
            </Field>
          )}
          {error && (
            <p role="alert" className={s.error}>
              {error}
            </p>
          )}
          {mensaje && (
            <p role="status" className={s.help}>
              {mensaje}
            </p>
          )}
        </div>
        <div className={s.footer}>
          <ActionButton
            variant="outline"
            onPress={onClose}
            isDisabled={imprimiendo}
          >
            Cerrar
          </ActionButton>
          {!vista && error && (
            <ActionButton
              variant="outline"
              onPress={() => {
                setError("");
                setVista(null);
                setRevision(revision + 1);
              }}
            >
              Reintentar carga
            </ActionButton>
          )}
          {vista && (
            <ActionButton
              variant="outline"
              isDisabled={imprimiendo}
              onPress={async () => {
                try {
                  await descargarEtiquetaPdf(vista);
                } catch {
                  setError(
                    "No se pudo descargar la etiqueta. Intentá nuevamente.",
                  );
                }
              }}
            >
              <Download aria-hidden="true" />
              Descargar PDF
            </ActionButton>
          )}
          {impresionDirecta && (
            <ActionButton
              onPress={imprimir}
              isDisabled={
                !vista ||
                !identidad?.firmaDisponible ||
                !config?.impresora ||
                configurando ||
                !cantidadValida ||
                imprimiendo
              }
            >
              <Printer aria-hidden="true" />
              {imprimiendo ? "Enviando…" : "Imprimir etiqueta"}
            </ActionButton>
          )}
        </div>
      </FormDialog>
    </DesignSystemProvider>
  );
}
