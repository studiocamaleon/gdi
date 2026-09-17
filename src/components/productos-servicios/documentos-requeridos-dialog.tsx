"use client";

import * as React from "react";
import {
  FileCheck2Icon,
  FilePlus2Icon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ProductoRecetaDocumentoInput } from "@/lib/productos-servicios-api";

import styles from "./documentos-requeridos-dialog.module.css";

type ContextoDocumental =
  { tipo: "GENERAL" } | { tipo: "NODO"; nodoClave: string; nodoNombre: string };

const PROPOSITOS = [
  { value: "PRINT", label: "Arte de impresión" },
  { value: "CUT", label: "Archivo de corte" },
  { value: "RENDER", label: "Render" },
  { value: "PLANO", label: "Plano técnico" },
  { value: "INSTRUCTIVO", label: "Instructivo" },
  { value: "OTRO", label: "Otro" },
] as const;

const ETAPAS = [
  { value: "BRIEF", label: "Brief" },
  { value: "DISENO", label: "Diseño" },
  { value: "PROTOTIPO", label: "Prototipo" },
  { value: "MUESTRA", label: "Muestra" },
  { value: "PRODUCCION", label: "Producción" },
] as const;

const APROBACIONES = [
  { value: "NINGUNA", label: "Sin aprobación" },
  { value: "CLIENTE", label: "Cliente" },
  { value: "DISENO", label: "Diseño" },
  { value: "COLOR_MUESTRA", label: "Color / muestra" },
  { value: "INGENIERIA", label: "Ingeniería" },
  { value: "LIBERACION_PRODUCTIVA", label: "Liberación productiva" },
] as const;

function selector(
  value: string,
  onValueChange: (value: string) => void,
  options: ReadonlyArray<{ value: string; label: string }>,
  ariaLabel: string,
) {
  return (
    <Select
      value={value}
      onValueChange={(next) => onValueChange(String(next ?? ""))}
    >
      <SelectTrigger className={styles.selectTrigger} aria-label={ariaLabel}>
        <SelectValue>
          {options.find((option) => option.value === value)?.label ??
            "Seleccionar"}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

function siguienteCodigo(documentos: ProductoRecetaDocumentoInput[]) {
  let numero = documentos.length + 1;
  const existentes = new Set(documentos.map((item) => item.codigo));
  while (existentes.has(`DOC-${numero}`)) numero += 1;
  return `DOC-${numero}`;
}

function normalizarParaContexto(
  item: ProductoRecetaDocumentoInput,
  contexto: ContextoDocumental,
): ProductoRecetaDocumentoInput {
  if (contexto.tipo === "NODO") {
    return {
      ...item,
      alcance: "PASO",
      pasoClave: contexto.nodoClave,
      requerido: true,
    };
  }
  return {
    ...item,
    alcance: item.alcance === "ORDEN" ? "ORDEN" : "ITEM",
    pasoClave: null,
    requerido: true,
  };
}

export function DocumentosRequeridosDialog({
  open,
  contexto,
  documentos,
  onOpenChange,
  onApply,
}: {
  open: boolean;
  contexto: ContextoDocumental;
  documentos: ProductoRecetaDocumentoInput[];
  onOpenChange: (open: boolean) => void;
  onApply: (documentos: ProductoRecetaDocumentoInput[]) => void;
}) {
  const [borrador, setBorrador] = React.useState(() =>
    documentos.map((item) => normalizarParaContexto(item, contexto)),
  );

  const invalido = borrador.some((item) => !item.nombre.trim());
  const general = contexto.tipo === "GENERAL";

  const agregar = () => {
    const base: ProductoRecetaDocumentoInput = {
      codigo: siguienteCodigo([...documentos, ...borrador]),
      nombre: "",
      alcance: general ? "ITEM" : "PASO",
      pasoClave: general ? null : contexto.nodoClave,
      proposito: "PRINT",
      etapa: "DISENO",
      tipoAprobacion: "CLIENTE",
      requerido: true,
    };
    setBorrador((current) => [...current, base]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={styles.dialog}>
        <DialogHeader className={styles.header}>
          <span className={styles.headerIcon} aria-hidden>
            <FileCheck2Icon />
          </span>
          <div className={styles.heading}>
            <span className={styles.eyebrow}>
              Producción · Documentación requerida
            </span>
            <DialogTitle>
              {general
                ? "Requisitos generales de la ruta de producción"
                : `Documentos antes de ${contexto.nodoNombre}`}
            </DialogTitle>
            <DialogDescription>
              {general
                ? "Definí qué documentos condicionan esta ruta o la OT completa."
                : "Estos requisitos bloquean solamente este nodo; las ramas independientes pueden continuar."}
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className={styles.body}>
          <div className={styles.summary}>
            <div>
              <strong>
                {borrador.length} requisito{borrador.length === 1 ? "" : "s"}
              </strong>
              <span>
                Una aprobación seleccionada exige una revisión liberada para
                producir.
              </span>
            </div>
            <Button type="button" variant="outline" onClick={agregar}>
              <PlusIcon data-icon="inline-start" />
              Agregar documento
            </Button>
          </div>

          {borrador.length ? (
            <div className={styles.list}>
              {borrador.map((item, index) => (
                <article className={styles.document} key={item.codigo}>
                  <div className={styles.documentHeader}>
                    <span className={styles.documentNumber}>
                      DOC {String(index + 1).padStart(2, "0")}
                    </span>
                    <strong>
                      {item.nombre.trim() || "Documento sin nombre"}
                    </strong>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className={styles.removeButton}
                      aria-label={`Quitar documento ${index + 1}`}
                      onClick={() =>
                        setBorrador((current) =>
                          current.filter((_, itemIndex) => itemIndex !== index),
                        )
                      }
                    >
                      <Trash2Icon />
                    </Button>
                  </div>

                  <FieldGroup>
                    <div
                      className={styles.fields}
                      data-general={String(general)}
                    >
                      <Field data-invalid={!item.nombre.trim()}>
                        <FieldLabel className={styles.fieldLabel}>
                          Nombre visible
                        </FieldLabel>
                        <Input
                          value={item.nombre}
                          aria-invalid={!item.nombre.trim()}
                          placeholder="Ej. Arte final aprobado"
                          onChange={(event) =>
                            setBorrador((current) =>
                              current.map((documento, itemIndex) =>
                                itemIndex === index
                                  ? { ...documento, nombre: event.target.value }
                                  : documento,
                              ),
                            )
                          }
                        />
                      </Field>
                      <Field>
                        <FieldLabel className={styles.fieldLabel}>
                          Propósito
                        </FieldLabel>
                        {selector(
                          item.proposito,
                          (value) =>
                            setBorrador((current) =>
                              current.map((documento, itemIndex) =>
                                itemIndex === index
                                  ? {
                                      ...documento,
                                      proposito:
                                        value as ProductoRecetaDocumentoInput["proposito"],
                                    }
                                  : documento,
                              ),
                            ),
                          PROPOSITOS,
                          `Propósito del documento ${index + 1}`,
                        )}
                      </Field>
                      <Field>
                        <FieldLabel className={styles.fieldLabel}>
                          Aprobación
                        </FieldLabel>
                        {selector(
                          item.tipoAprobacion ?? "NINGUNA",
                          (value) =>
                            setBorrador((current) =>
                              current.map((documento, itemIndex) =>
                                itemIndex === index
                                  ? {
                                      ...documento,
                                      tipoAprobacion:
                                        value === "NINGUNA"
                                          ? null
                                          : (value as ProductoRecetaDocumentoInput["tipoAprobacion"]),
                                    }
                                  : documento,
                              ),
                            ),
                          APROBACIONES,
                          `Aprobación del documento ${index + 1}`,
                        )}
                      </Field>
                      {general ? (
                        <Field>
                          <FieldLabel className={styles.fieldLabel}>
                            Alcance
                          </FieldLabel>
                          {selector(
                            item.alcance === "ORDEN" ? "ORDEN" : "ITEM",
                            (value) =>
                              setBorrador((current) =>
                                current.map((documento, itemIndex) =>
                                  itemIndex === index
                                    ? {
                                        ...documento,
                                        alcance: value as "ORDEN" | "ITEM",
                                        pasoClave: null,
                                      }
                                    : documento,
                                ),
                              ),
                            [
                              {
                                value: "ITEM",
                                label: "Toda esta ruta",
                              },
                              {
                                value: "ORDEN",
                                label: "Toda la OT",
                              },
                            ],
                            `Alcance del documento ${index + 1}`,
                          )}
                        </Field>
                      ) : null}
                    </div>
                    <Field>
                      <FieldLabel className={styles.fieldLabel}>
                        Momento documental
                      </FieldLabel>
                      {selector(
                        item.etapa,
                        (value) =>
                          setBorrador((current) =>
                            current.map((documento, itemIndex) =>
                              itemIndex === index
                                ? {
                                    ...documento,
                                    etapa:
                                      value as ProductoRecetaDocumentoInput["etapa"],
                                  }
                                : documento,
                            ),
                          ),
                        ETAPAS,
                        `Momento del documento ${index + 1}`,
                      )}
                    </Field>
                  </FieldGroup>
                </article>
              ))}
            </div>
          ) : (
            <div className={styles.empty}>
              <div>
                <FilePlus2Icon />
                <strong>Todavía no hay documentos requeridos</strong>
                <span>
                  Agregá solamente los archivos que el trabajo necesita para
                  avanzar con seguridad.
                </span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className={styles.footer}>
          <p>
            Guardar actualiza el borrador local. La receta se persiste con
            “Guardar modelo” y se aplica a nuevas OTs al publicarla.
          </p>
          <div className={styles.footerActions}>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={invalido}
              onClick={() => {
                onApply(
                  borrador.map((item) =>
                    normalizarParaContexto(item, contexto),
                  ),
                );
                onOpenChange(false);
              }}
            >
              Aplicar requisitos
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DocumentosHeredadosDialog({
  open,
  componenteNombre,
  documentos,
  loading,
  onOpenChange,
  onEditarOrigen,
}: {
  open: boolean;
  componenteNombre: string;
  documentos: ProductoRecetaDocumentoInput[];
  loading?: boolean;
  onOpenChange: (open: boolean) => void;
  onEditarOrigen?: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={styles.dialog}>
        <DialogHeader className={styles.header}>
          <span className={styles.headerIcon} aria-hidden>
            <FileCheck2Icon />
          </span>
          <div className={styles.heading}>
            <span className={styles.eyebrow}>
              Componente · Contrato heredado
            </span>
            <DialogTitle>Documentos de {componenteNombre}</DialogTitle>
            <DialogDescription>
              Pertenecen a la receta del componente y se aplican cada vez que
              esta revisión se utiliza dentro de otro producto.
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className={styles.body}>
          {loading ? (
            <div className={styles.empty}>Cargando contrato documental…</div>
          ) : documentos.length ? (
            <div className={styles.readonlyList}>
              {documentos.map((item) => (
                <article className={styles.readonlyItem} key={item.codigo}>
                  <span className={styles.readonlyIcon} aria-hidden>
                    <FileCheck2Icon />
                  </span>
                  <div className={styles.readonlyMain}>
                    <strong>{item.nombre}</strong>
                    <span>
                      {item.proposito === "PRINT"
                        ? "Arte de impresión"
                        : item.proposito === "CUT"
                          ? "Archivo de corte"
                          : item.proposito === "PLANO"
                            ? "Plano técnico"
                            : item.proposito === "INSTRUCTIVO"
                              ? "Instructivo"
                              : item.proposito === "RENDER"
                                ? "Render"
                                : "Otro documento"}
                    </span>
                  </div>
                  <span className={styles.readonlyMeta}>
                    {item.alcance === "PASO"
                      ? "Antes de un paso"
                      : item.alcance === "ORDEN"
                        ? "Toda la OT"
                        : "Toda la subruta"}
                    <br />
                    {item.tipoAprobacion
                      ? `Aprobación: ${item.tipoAprobacion
                          .toLocaleLowerCase("es-AR")
                          .replace("_", " ")}`
                      : "Sin aprobación bloqueante"}
                  </span>
                </article>
              ))}
            </div>
          ) : (
            <div className={styles.empty}>
              <div>
                <FileCheck2Icon />
                <strong>Este componente no exige documentos</strong>
                <span>
                  Podés agregarlos desde la ruta de producción de{" "}
                  {componenteNombre}.
                </span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className={styles.footer}>
          <p>
            Esta vista es de sólo lectura para evitar modificar la receta del
            componente desde su producto padre.
          </p>
          <div className={styles.footerActions}>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cerrar
            </Button>
            {onEditarOrigen ? (
              <Button type="button" onClick={onEditarOrigen}>
                Abrir producto de origen
              </Button>
            ) : null}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
