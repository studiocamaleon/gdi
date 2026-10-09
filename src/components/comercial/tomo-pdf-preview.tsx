"use client";
import { useEffect, useRef, useState } from "react";
import { Download, FileText } from "lucide-react";
import { ActionButton } from "@/components/design-system/action-button";
import { FormDialog } from "@/components/design-system/form-dialog";
import { generarPdfTomo, type SegmentoTomoPdf } from "@/lib/tomo-pdf";
import styles from "./tomo-pdf-preview.module.css";

export function TomoPdfPreview({
  nombre,
  segmentos,
  configuracionMixta = false,
}: {
  nombre: string;
  segmentos: SegmentoTomoPdf[];
  configuracionMixta?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [resultado, setResultado] = useState<{
    url: string;
    paginas: number;
    blancos: number;
  } | null>(null);
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const solicitud = useRef<AbortController | null>(null);
  const urlActual = useRef<string | null>(null);
  const fuentesActuales = useRef(segmentos);
  fuentesActuales.current = segmentos;
  // Invalidar también si se reemplazó un File conservando su nombre.
  const version = JSON.stringify(
    segmentos.map(({ file, ...s }) => ({
      ...s,
      file: file ? [file.name, file.size, file.lastModified] : null,
    })),
  );
  useEffect(() => {
    setResultado(null);
    setError("");
    setOcupado(false);
    setAbierto(false);
    return () => {
      solicitud.current?.abort();
      if (urlActual.current) URL.revokeObjectURL(urlActual.current);
      urlActual.current = null;
    };
  }, [version]);
  const faltanPdf = segmentos.some(
    (s) =>
      !(s.file?.name ?? s.archivoNombre ?? s.nombre)
        .toLowerCase()
        .endsWith(".pdf"),
  );
  const carasMixtas = segmentos.some((s) => s.faz !== segmentos[0]?.faz);
  async function abrir() {
    if (ocupado) return;
    setAbierto(true);
    if (resultado) return;
    const control = new AbortController();
    solicitud.current = control;
    setOcupado(true);
    setError("");
    try {
      const pdf = await generarPdfTomo(fuentesActuales.current, control.signal);
      if (control.signal.aborted) return;
      const url = URL.createObjectURL(
        new Blob([new Uint8Array(pdf.bytes)], { type: "application/pdf" }),
      );
      urlActual.current = url;
      setResultado({ url, paginas: pdf.paginas, blancos: pdf.blancos });
    } catch (e) {
      if (!control.signal.aborted)
        setError(
          e instanceof Error ? e.message : "No se pudo preparar el tomo.",
        );
    } finally {
      if (!control.signal.aborted) setOcupado(false);
    }
  }
  return (
    <div className={styles.root}>
      <ActionButton
        variant="outline"
        onPress={abrir}
        isDisabled={!segmentos.length || faltanPdf || carasMixtas}
        isPending={ocupado}
      >
        <FileText data-icon="inline-start" /> Ver PDF del tomo
      </ActionButton>
      <span className={styles.ayuda}>
        {faltanPdf
          ? "Cargá todos los originales en PDF para unirlos."
          : carasMixtas
            ? "Separá los documentos de simple y doble faz para unirlos."
            : "Un solo PDF · rangos elegidos · originales conservados"}
      </span>
      <FormDialog
        isOpen={abierto}
        onOpenChange={setAbierto}
        title={nombre || "Tomo"}
        description="PDF unificado de un juego. Indicá la cantidad de copias al imprimir."
        className={styles.dialog}
      >
        {resultado ? (
          <>
            <div className={styles.toolbar}>
              <span>
                {resultado.paginas} páginas · {resultado.blancos} reversos en
                blanco
              </span>
              <a
                href={resultado.url}
                download={`${(nombre || "Tomo").replace(/[\\/:*?"<>|]/g, "-")}.pdf`}
              >
                <Download /> Descargar PDF
              </a>
            </div>
            {configuracionMixta && (
              <p className={styles.aviso}>
                Este tomo combina papeles o ajustes de impresión. Revisá la
                configuración de cada tramo antes de imprimir.
              </p>
            )}
            <iframe
              className={styles.visor}
              title={`Vista previa de ${nombre || "Tomo"}`}
              src={resultado.url}
            />
          </>
        ) : (
          <div className={styles.estado} role={error ? "alert" : "status"}>
            {error || "Preparando páginas y reversos…"}
            {error && (
              <ActionButton variant="outline" onPress={abrir}>
                Volver a intentar
              </ActionButton>
            )}
          </div>
        )}
      </FormDialog>
    </div>
  );
}
