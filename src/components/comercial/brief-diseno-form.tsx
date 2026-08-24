"use client";

import * as React from "react";
import {
  CheckIcon,
  FileImageIcon,
  FileTextIcon,
  PaletteIcon,
  PaperclipIcon,
  SparklesIcon,
  Trash2Icon,
  UploadCloudIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatBytes, validarArchivo } from "@/lib/archivos";
import {
  briefDisenoEstaCompleto,
  prepararBriefDiseno,
  type BriefDiseno,
  type BriefDisenoArchivoPendiente,
} from "@/lib/brief-diseno";

import s from "./brief-diseno-form.module.css";

type CaraActiva = "frente" | "dorso";

type BriefDisenoFormProps = {
  productName: string;
  caras: 1 | 2;
  value: BriefDiseno;
  pendientes: BriefDisenoArchivoPendiente[];
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  draft: BriefDiseno;
  onDraftChange: (value: BriefDiseno) => void;
  pendientesDraft: BriefDisenoArchivoPendiente[];
  onPendientesDraftChange: (value: BriefDisenoArchivoPendiente[]) => void;
  onSave: () => void;
};

export function BriefDisenoForm({
  productName,
  caras,
  value,
  pendientes,
  open,
  onOpen,
  onClose,
  draft,
  onDraftChange,
  pendientesDraft,
  onPendientesDraftChange,
  onSave,
}: BriefDisenoFormProps) {
  const [caraActiva, setCaraActiva] = React.useState<CaraActiva>("frente");
  const inputArchivosRef = React.useRef<HTMLInputElement>(null);
  const preparado = prepararBriefDiseno(value, pendientes);
  const completo = briefDisenoEstaCompleto(preparado, caras);

  const actualizar = React.useCallback(
    (campo: "frente" | "dorso" | "colores" | "indicaciones", texto: string) =>
      onDraftChange({ ...draft, [campo]: texto }),
    [draft, onDraftChange],
  );

  const nombresPendientes = new Set(
    pendientesDraft.map(({ file }) => file.name),
  );
  const registrados = draft.archivos.filter(
    ({ nombre }) => !nombresPendientes.has(nombre),
  );

  const agregarArchivos = (files: FileList | null) => {
    if (!files) return;
    const existentes = new Set([
      ...draft.archivos.map(({ nombre }) => nombre),
      ...pendientesDraft.map(({ file }) => file.name),
    ]);
    const nuevos: BriefDisenoArchivoPendiente[] = [];
    for (const file of Array.from(files)) {
      const invalido = validarArchivo(file);
      if (invalido) {
        toast.error(`${file.name}: ${invalido}`);
        continue;
      }
      if (existentes.has(file.name)) {
        toast.warning(`${file.name} ya está incluido en el brief.`);
        continue;
      }
      existentes.add(file.name);
      nuevos.push({ file, requiereVectorizacion: false });
    }
    if (nuevos.length > 0) {
      onPendientesDraftChange([...pendientesDraft, ...nuevos]);
    }
  };

  const cambiarVectorizacionRegistrado = (nombre: string, checked: boolean) =>
    onDraftChange({
      ...draft,
      archivos: draft.archivos.map((archivo) =>
        archivo.nombre === nombre
          ? { ...archivo, requiereVectorizacion: checked }
          : archivo,
      ),
    });

  return (
    <div className={s.theme}>
      <section className={s.summary} aria-label="Brief de diseño">
        <span className={s.summaryTitle}>Brief de diseño</span>
        <div className={s.summaryBody}>
          <Badge variant={completo ? "secondary" : "destructive"}>
            {completo ? "Completo" : "Incompleto"}
          </Badge>
          <Button type="button" variant="outline" size="sm" onClick={onOpen}>
            Editar brief
          </Button>
        </div>
      </section>

      {open ? (
        <>
          <button
            type="button"
            className={s.shield}
            aria-label="Cerrar editor del brief"
            onClick={onClose}
          />
          <section
            className={s.panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby="brief-editor-title"
          >
            <header className={s.header}>
              <div className={s.headerIcon} aria-hidden="true">
                <SparklesIcon />
              </div>
              <div className={s.headerText}>
                <span className={s.eyebrow}>Diseño gráfico</span>
                <h2 id="brief-editor-title">Brief de diseño</h2>
                <p>{productName}</p>
              </div>
              <Badge variant="secondary">
                {caras === 2 ? "Doble faz" : "Una cara"}
              </Badge>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Cerrar brief"
                onClick={onClose}
              >
                <XIcon />
              </Button>
            </header>

            <div className={s.body}>
              <FieldGroup>
                <Card>
                  <CardHeader>
                    <CardTitle>Contenido de la pieza</CardTitle>
                    <CardDescription>
                      Copiá los textos exactamente como deben aparecer.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <FieldGroup>
                      {caras === 2 ? (
                        <Field>
                          <FieldLabel>Seleccionar cara</FieldLabel>
                          <ToggleGroup
                            multiple={false}
                            value={[caraActiva]}
                            onValueChange={(values) => {
                              const seleccionada = values.at(-1);
                              if (
                                seleccionada === "frente" ||
                                seleccionada === "dorso"
                              ) {
                                setCaraActiva(seleccionada);
                              }
                            }}
                            variant="outline"
                            className="grid w-full grid-cols-2"
                          >
                            <ToggleGroupItem value="frente">
                              Frente
                              {draft.frente.trim() ? <CheckIcon /> : null}
                            </ToggleGroupItem>
                            <ToggleGroupItem value="dorso">
                              Dorso
                              {draft.dorso.trim() ? <CheckIcon /> : null}
                            </ToggleGroupItem>
                          </ToggleGroup>
                        </Field>
                      ) : null}

                      <Field>
                        <FieldLabel htmlFor="brief-diseno-textos">
                          {caras === 1
                            ? "Textos que debe incluir"
                            : caraActiva === "frente"
                              ? "Textos e información del frente"
                              : "Textos e información del dorso"}
                        </FieldLabel>
                        <Textarea
                          id="brief-diseno-textos"
                          rows={7}
                          value={
                            caraActiva === "frente" ? draft.frente : draft.dorso
                          }
                          placeholder="Escribir aquí títulos, datos de contacto, precios y cualquier otro texto."
                          onChange={(event) =>
                            actualizar(caraActiva, event.target.value)
                          }
                        />
                        <FieldDescription>
                          Puede quedar vacío si toda la información ya está en
                          un archivo adjunto.
                        </FieldDescription>
                      </Field>
                    </FieldGroup>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Dirección visual</CardTitle>
                    <CardDescription>
                      Preferencias simples para orientar al diseñador.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <FieldGroup>
                      <Field>
                        <FieldLabel htmlFor="brief-diseno-colores">
                          <PaletteIcon aria-hidden="true" />
                          Colores de preferencia
                        </FieldLabel>
                        <Input
                          id="brief-diseno-colores"
                          value={draft.colores}
                          placeholder="Ej: azul oscuro, blanco y un acento naranja"
                          onChange={(event) =>
                            actualizar("colores", event.target.value)
                          }
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="brief-diseno-indicaciones">
                          <FileTextIcon aria-hidden="true" />
                          Otras indicaciones
                        </FieldLabel>
                        <Textarea
                          id="brief-diseno-indicaciones"
                          rows={3}
                          value={draft.indicaciones}
                          placeholder="Ej: destacar el teléfono y el código QR."
                          onChange={(event) =>
                            actualizar("indicaciones", event.target.value)
                          }
                        />
                      </Field>
                    </FieldGroup>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Logos, imágenes y referencias</CardTitle>
                    <CardDescription>
                      Marcá específicamente qué archivos necesitan
                      vectorización.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    <button
                      type="button"
                      className={s.upload}
                      onClick={() => inputArchivosRef.current?.click()}
                    >
                      <UploadCloudIcon aria-hidden="true" />
                      <span>
                        <strong>Agregar archivos</strong>
                        <small>Logos, fotos, PDF o referencias visuales</small>
                      </span>
                    </button>
                    <input
                      ref={inputArchivosRef}
                      type="file"
                      hidden
                      multiple
                      onChange={(event) => {
                        agregarArchivos(event.target.files);
                        event.target.value = "";
                      }}
                    />

                    {registrados.length > 0 || pendientesDraft.length > 0 ? (
                      <FieldSet>
                        <FieldLegend variant="label">
                          Archivos incluidos
                        </FieldLegend>
                        <FieldGroup data-slot="checkbox-group">
                          {registrados.map((archivo) => (
                            <Field
                              key={archivo.nombre}
                              orientation="horizontal"
                            >
                              <FileImageIcon aria-hidden="true" />
                              <FieldContent>
                                <FieldLabel>{archivo.nombre}</FieldLabel>
                                <FieldDescription>
                                  Archivo ya adjuntado
                                </FieldDescription>
                              </FieldContent>
                              <Field orientation="horizontal">
                                <Checkbox
                                  id={`vectorizar-registrado-${archivo.nombre}`}
                                  checked={archivo.requiereVectorizacion}
                                  onCheckedChange={(checked) =>
                                    cambiarVectorizacionRegistrado(
                                      archivo.nombre,
                                      checked,
                                    )
                                  }
                                />
                                <FieldLabel
                                  htmlFor={`vectorizar-registrado-${archivo.nombre}`}
                                >
                                  Vectorizar
                                </FieldLabel>
                              </Field>
                            </Field>
                          ))}

                          {pendientesDraft.map((pendiente, index) => (
                            <Field
                              key={`${pendiente.file.name}-${pendiente.file.size}`}
                              orientation="horizontal"
                            >
                              <PaperclipIcon aria-hidden="true" />
                              <FieldContent>
                                <FieldLabel>{pendiente.file.name}</FieldLabel>
                                <FieldDescription>
                                  {formatBytes(pendiente.file.size)}
                                </FieldDescription>
                              </FieldContent>
                              <Field orientation="horizontal">
                                <Checkbox
                                  id={`vectorizar-pendiente-${index}`}
                                  checked={pendiente.requiereVectorizacion}
                                  onCheckedChange={(checked) =>
                                    onPendientesDraftChange(
                                      pendientesDraft.map(
                                        (actual, actualIndex) =>
                                          actualIndex === index
                                            ? {
                                                ...actual,
                                                requiereVectorizacion: checked,
                                              }
                                            : actual,
                                      ),
                                    )
                                  }
                                />
                                <FieldLabel
                                  htmlFor={`vectorizar-pendiente-${index}`}
                                >
                                  Vectorizar
                                </FieldLabel>
                              </Field>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label={`Quitar ${pendiente.file.name}`}
                                onClick={() =>
                                  onPendientesDraftChange(
                                    pendientesDraft.filter(
                                      (_, actualIndex) => actualIndex !== index,
                                    ),
                                  )
                                }
                              >
                                <Trash2Icon />
                              </Button>
                            </Field>
                          ))}
                        </FieldGroup>
                      </FieldSet>
                    ) : null}
                  </CardContent>
                </Card>
              </FieldGroup>
            </div>

            <footer className={s.footer}>
              <span>Los cambios se aplicarán únicamente a este producto.</span>
              <div className={s.actions}>
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancelar
                </Button>
                <Button type="button" onClick={onSave}>
                  <CheckIcon data-icon="inline-start" />
                  Guardar brief
                </Button>
              </div>
            </footer>
          </section>
        </>
      ) : null}
    </div>
  );
}
