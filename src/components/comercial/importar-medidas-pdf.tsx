"use client";

import * as React from "react";
import { FileUpIcon } from "lucide-react";
import { ActionButton } from "@/components/design-system/action-button";
import { FormDialog } from "@/components/design-system/form-dialog";
import styles from "./importar-medidas-pdf.module.css";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldLabel,
  FieldDescription,
  FieldGroup,
} from "@/components/ui/field";
import { Alert, AlertDescription } from "@/components/ui/alert";

import { leerMedidasPdf, type MedidaArchivoPagina } from "@/lib/pdf-medidas";
import { cn } from "@/lib/utils";

export type PaginaPdfImportada = MedidaArchivoPagina & {
  anchoFinalMm: number;
  altoFinalMm: number;
};
type Fila = {
  id: string;
  archivo: File;
  pagina: MedidaArchivoPagina;
  elegida: boolean;
};
const cm = (mm: number) =>
  (mm / 10).toLocaleString("es-AR", { maximumFractionDigits: 2 });

export function ImportarMedidasPdf({
  onConfirmar,
  habilitada = true,
  className,
  children,
}: {
  onConfirmar: (paginas: PaginaPdfImportada[], archivos: File[]) => void;
  habilitada?: boolean;
  className?: string;
  children?: (importar: React.ReactNode) => React.ReactNode;
}) {
  const input = React.useRef<HTMLInputElement>(null);
  const lectura = React.useRef(0);
  const entradasDrag = React.useRef(0);
  const [arrastrando, setArrastrando] = React.useState(false);
  const [abierto, setAbierto] = React.useState(false);
  const [leyendo, setLeyendo] = React.useState(false);
  const [filas, setFilas] = React.useState<Fila[]>([]);
  const [errores, setErrores] = React.useState<string[]>([]);
  const [escala, setEscala] = React.useState("1");
  const id = React.useId();
  React.useEffect(
    () => () => {
      lectura.current++;
    },
    [],
  );
  const cerrar = () => {
    lectura.current++;
    setAbierto(false);
    setLeyendo(false);
  };
  const cargar = async (archivos: File[]) => {
    if (!habilitada || !archivos.length) return;
    const revision = ++lectura.current;
    setAbierto(true);
    setLeyendo(true);
    setFilas([]);
    setErrores([]);
    setEscala("1");
    try {
      const resultados = await leerMedidasPdf(archivos);
      if (revision !== lectura.current) return;
      setFilas(
        resultados.flatMap((r, index) =>
          r.ok
            ? r.paginas.map((pagina) => ({
                id: `${index}-${pagina.pagina}`,
                archivo: archivos[index],
                pagina,
                elegida: true,
              }))
            : [],
        ),
      );
      setErrores(
        resultados.flatMap((r) =>
          r.ok ? [] : [`${r.archivoNombre}: ${r.error}`],
        ),
      );
    } catch {
      if (revision === lectura.current)
        setErrores(["No se pudieron leer los archivos. Volvé a intentarlo."]);
    } finally {
      if (revision === lectura.current) setLeyendo(false);
    }
  };
  const factor = Number(escala.replace(",", "."));
  const escalaValida = Number.isFinite(factor) && factor > 0;
  const elegidas = filas.filter((f) => f.elegida);
  const medidasValidas =
    escalaValida &&
    elegidas.every((f) =>
      [f.pagina.anchoMm * factor, f.pagina.altoMm * factor].every(
        (n) => Number.isFinite(n) && n > 0,
      ),
    );
  const confirmar = () => {
    if (!elegidas.length || !medidasValidas || leyendo) return;
    onConfirmar(
      elegidas.map((f) => ({
        ...f.pagina,
        anchoFinalMm: f.pagina.anchoMm * factor,
        altoFinalMm: f.pagina.altoMm * factor,
      })),
      [...new Set(elegidas.map((f) => f.archivo))],
    );
    cerrar();
  };
  const esArrastreDeArchivos = (event: React.DragEvent) =>
    Array.from(event.dataTransfer.types).includes("Files");
  const resetDrag = () => {
    entradasDrag.current = 0;
    setArrastrando(false);
  };
  const importar = habilitada ? (
    <div className={styles.importar}>
      <ActionButton
        type="button"
        variant="outline"
        onPress={() => input.current?.click()}
      >
        <FileUpIcon data-icon="inline-start" /> Importar medidas desde PDF
      </ActionButton>
      <span className={styles.ayuda} role="status">
        {arrastrando
          ? "Soltá los PDF para revisar sus medidas"
          : "o arrastrá tus PDF a esta zona"}
      </span>
    </div>
  ) : null;
  return (
    <>
      <div
        className={cn(styles.zona, className)}
        data-arrastrando={habilitada && arrastrando || undefined}
        onDragEnter={(event) => {
          if (!habilitada || abierto || !esArrastreDeArchivos(event)) return;
          event.preventDefault();
          event.stopPropagation();
          entradasDrag.current++;
          setArrastrando(true);
        }}
        onDragOver={(event) => {
          if (!habilitada || abierto || !esArrastreDeArchivos(event)) return;
          event.preventDefault();
          event.stopPropagation();
          event.dataTransfer.dropEffect = "copy";
        }}
        onDragLeave={(event) => {
          if (!entradasDrag.current) return;
          event.stopPropagation();
          entradasDrag.current = Math.max(0, entradasDrag.current - 1);
          if (!entradasDrag.current) setArrastrando(false);
        }}
        onDrop={(event) => {
          if (!habilitada || !esArrastreDeArchivos(event)) return;
          event.preventDefault();
          event.stopPropagation();
          resetDrag();
          if (!abierto) void cargar(Array.from(event.dataTransfer.files));
        }}
      >
        {children ? children(importar) : importar}
      </div>
      <input
        ref={input}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        hidden
        disabled={!habilitada}
        aria-label="Archivos PDF para importar medidas"
        onChange={(event) => {
          void cargar(Array.from(event.target.files ?? []));
          event.target.value = "";
        }}
      />
      <FormDialog
        isOpen={abierto}
        onOpenChange={(open) => {
          if (!open) cerrar();
        }}
        title="Importar medidas desde PDF"
        description="Elegí las páginas que representan piezas independientes. Leemos el tamaño de la página, no los dibujos ni contornos de su interior."
      >
        <div className={styles.body}>
          {leyendo ? (
            <p role="status">Leyendo páginas…</p>
          ) : (
            <>
              {errores.length > 0 && (
                <Alert variant="destructive">
                  <AlertDescription>{errores.join(" · ")}</AlertDescription>
                </Alert>
              )}
              {filas.length > 0 && (
                <>
                  <FieldGroup>
                    <Field data-invalid={!escalaValida || undefined}>
                      <FieldLabel htmlFor={`${id}-escala`}>
                        Multiplicar las medidas por
                      </FieldLabel>
                      <Input
                        id={`${id}-escala`}
                        className="max-w-36"
                        inputMode="decimal"
                        value={escala}
                        aria-invalid={!escalaValida}
                        onChange={(e) => setEscala(e.target.value)}
                      />
                      <FieldDescription>
                        Usá 1 si el PDF está al tamaño final; 10 si fue
                        preparado a escala 1:10.
                      </FieldDescription>
                    </Field>
                    <Field orientation="horizontal">
                      <Checkbox
                        id={`${id}-todas`}
                        aria-label="Seleccionar todas las páginas"
                        checked={elegidas.length === filas.length}
                        indeterminate={
                          elegidas.length > 0 && elegidas.length < filas.length
                        }
                        onCheckedChange={(checked) =>
                          setFilas((prev) =>
                            prev.map((f) => ({
                              ...f,
                              elegida: Boolean(checked),
                            })),
                          )
                        }
                      />
                      <FieldLabel htmlFor={`${id}-todas`}>
                        Seleccionar todas las páginas
                      </FieldLabel>
                    </Field>
                  </FieldGroup>
                  <div className="flex flex-col gap-3">
                    {filas.map((f) => (
                      <Field key={f.id} orientation="horizontal">
                        <Checkbox
                          id={`${id}-${f.id}`}
                          aria-label={`Seleccionar ${f.pagina.archivoNombre}, página ${f.pagina.pagina}`}
                          checked={f.elegida}
                          onCheckedChange={(checked) =>
                            setFilas((prev) =>
                              prev.map((v) =>
                                v.id === f.id
                                  ? { ...v, elegida: Boolean(checked) }
                                  : v,
                              ),
                            )
                          }
                        />
                        <div className="min-w-0 flex-1">
                          <FieldLabel htmlFor={`${id}-${f.id}`}>
                            {f.pagina.archivoNombre} · Página {f.pagina.pagina}
                          </FieldLabel>
                          <FieldDescription>
                            {medidasValidas
                              ? `${cm(f.pagina.anchoMm * factor)} × ${cm(f.pagina.altoMm * factor)} cm`
                              : "Revisá la escala"}
                          </FieldDescription>
                        </div>
                      </Field>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
        <footer className={styles.footer}>
          <ActionButton type="button" variant="outline" onPress={cerrar}>
            Cancelar
          </ActionButton>
          <ActionButton
            type="button"
            onPress={confirmar}
            isDisabled={leyendo || !elegidas.length || !medidasValidas}
          >
            Agregar {elegidas.length}{" "}
            {elegidas.length === 1 ? "pieza" : "piezas"}
          </ActionButton>
        </footer>
      </FormDialog>
    </>
  );
}
