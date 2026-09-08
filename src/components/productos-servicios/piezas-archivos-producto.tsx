"use client";

import * as React from "react";
import { FileUpIcon, PlusIcon, Trash2Icon, ShapesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/spinner";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
} from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { subirArchivo } from "@/lib/archivos-api";
import {
  guardarInterpretacionProducto,
  inspeccionarArchivoProducto,
  type InspeccionVector,
  type SeleccionVector,
} from "@/lib/geometrias-producto-api";
import {
  nuevaFuenteGeometria,
  type FuenteGeometriaComercial,
} from "@/lib/producto-geometrias";
import { DatosArchivoPieza, MiniaturaPieza } from "./pieza-vectorial-resumen";
import styles from "./piezas-diseno.module.css";
import { CapasFabricacionSelector } from "./capas-fabricacion-selector";
import { PiezaInterpretacionPreview } from "./pieza-interpretacion-preview";
import { UNIDADES_IMPORTACION_DXF } from "@/lib/escala-dxf";

const numero = (n: number) =>
  n.toLocaleString("es-AR", { maximumFractionDigits: 2 });
const unidades = [
  ...UNIDADES_IMPORTACION_DXF,
  { value: "dm", label: "Decímetros", factorMm: 100 },
  { value: "px", label: "Píxeles SVG (96 por pulgada)", factorMm: 25.4 / 96 },
  { value: "micrones", label: "Micrones", factorMm: 0.001 },
  { value: "mil", label: "Milésimas de pulgada", factorMm: 0.0254 },
];

export function PiezasArchivosProducto({
  productoId,
  fuentes,
  onChange,
  paraComponente = false,
  renderCantidad,
  accionBiblioteca,
  resumen,
}: {
  productoId: string;
  fuentes: FuenteGeometriaComercial[];
  onChange: (fuentes: FuenteGeometriaComercial[]) => void;
  paraComponente?: boolean;
  renderCantidad?: (fuenteId: string) => React.ReactNode;
  accionBiblioteca?: React.ReactNode;
  resumen?: string;
}) {
  const [pendiente, setPendiente] = React.useState<{
    archivoId: string;
    nombre: string;
    fuenteId?: string;
    inspeccion: InspeccionVector;
  } | null>(null);
  const [seleccion, setSeleccion] = React.useState<SeleccionVector>({
    exteriorId: "",
    unidad: "",
    cerrarExterior: false,
    operaciones: [],
    excluidas: [],
  });
  const [cola, setCola] = React.useState<File[]>([]);
  const [ocupado, setOcupado] = React.useState(false);
  const [error, setError] = React.useState("");
  const input = React.useRef<HTMLInputElement>(null);
  const selectorContorno = React.useRef<HTMLButtonElement>(null);
  const destino = React.useRef<string | undefined>(undefined);

  async function abrir(file: File, fuenteId?: string) {
    setOcupado(true);
    setError("");
    try {
      if (file.size > 524288)
        throw new Error("El vector supera el máximo de 512 KB.");
      const archivo = await subirArchivo(file, {
        scope: "PRODUCTO",
        entidadId: productoId,
        calcularHash: true,
      });
      const inspeccion = await inspeccionarArchivoProducto(
        productoId,
        archivo.id,
      );
      setSeleccion({
        exteriorId: inspeccion.sugeridaId,
        unidad: inspeccion.unidadDeclarada ?? "",
        cerrarExterior: false,
        operaciones: [],
        excluidas: [],
      });
      setPendiente({
        archivoId: archivo.id,
        nombre: file.name,
        fuenteId,
        inspeccion,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo abrir el archivo.");
      setCola([]);
    } finally {
      setOcupado(false);
    }
  }
  async function revisarCapas(fuente: FuenteGeometriaComercial) {
    const guardada = fuente.predeterminada;
    if (!guardada?.procedencia?.archivoId) return;
    setOcupado(true);
    setError("");
    try {
      const inspeccion = await inspeccionarArchivoProducto(
        productoId,
        guardada.procedencia.archivoId,
      );
      const actualId = (id: string) =>
        inspeccion.entidades.find((e) => e.id === id)?.id ??
        inspeccion.entidades.find((e) => e.id === id.split("_")[0])?.id;
      const factorOriginal =
        unidades.find((u) => u.value === guardada.unidadOrigen)?.factorMm ?? 1;
      const porMedida = inspeccion.entidades
        .filter((e) => e.area > 0 && e.exportable !== false)
        .map((e) => ({
          id: e.id,
          diferencia:
            Math.abs((e.ancho * factorOriginal) / guardada.anchoFinalMm - 1) +
            Math.abs((e.alto * factorOriginal) / guardada.altoFinalMm - 1),
        }))
        .sort((a, b) => a.diferencia - b.diferencia)[0];
      setSeleccion({
        exteriorId:
          actualId(guardada.procedencia.exteriorId) ??
          (porMedida && porMedida.diferencia < 0.01 ? porMedida.id : ""),
        unidad: guardada.unidadOrigen,
        cerrarExterior: guardada.procedencia.cierreConfirmado,
        operaciones: guardada.operaciones.flatMap((o) => {
          const entidadId = actualId(o.entidadId);
          return entidadId ? [{ entidadId, tipo: o.tipo }] : [];
        }),
        excluidas: (guardada.fabricacion?.entidades ?? [])
          .filter((e) => !e.conservar)
          .flatMap((e) => {
            const id = actualId(e.entidadId);
            return id ? [id] : [];
          }),
      });
      setPendiente({
        archivoId: guardada.procedencia.archivoId,
        nombre: guardada.nombreArchivo,
        fuenteId: fuente.id,
        inspeccion,
      });
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "No se pudo recuperar el archivo original.",
      );
    } finally {
      setOcupado(false);
    }
  }
  async function confirmar() {
    if (!pendiente) return;
    setOcupado(true);
    setError("");
    try {
      const predeterminada = await guardarInterpretacionProducto(
        productoId,
        pendiente.archivoId,
        seleccion,
      );
      const existente =
        fuentes.find((f) => f.id === pendiente.fuenteId) ??
        (!pendiente.fuenteId
          ? fuentes.find((f) => !f.predeterminada)
          : undefined);
      const nueva = existente ?? {
        ...nuevaFuenteGeometria(fuentes),
        nombre: pendiente.nombre.replace(/\.(dxf|svg)$/i, "").slice(0, 120),
      };
      const actualizada = {
        ...nueva,
        predeterminada,
        permitirReemplazo: nueva.permitirReemplazo ?? false,
      };
      onChange(
        existente
          ? fuentes.map((f) => (f.id === existente.id ? actualizada : f))
          : [...fuentes, actualizada],
      );
      setPendiente(null);
      const [siguiente, ...resto] = cola;
      setCola(resto);
      if (siguiente) await abrir(siguiente);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "No se pudo guardar la interpretación.",
      );
    } finally {
      setOcupado(false);
    }
  }
  const exterior = pendiente?.inspeccion.entidades.find(
    (e) => e.id === seleccion.exteriorId,
  );
  const factor = unidades.find((u) => u.value === seleccion.unidad)?.factorMm;
  const cambio = (id: string, patch: Partial<FuenteGeometriaComercial>) =>
    onChange(fuentes.map((f) => (f.id === id ? { ...f, ...patch } : f)));

  return (
    <section
      className={styles.editor}
      aria-label={
        paraComponente ? "Piezas de este componente" : "Piezas y archivos"
      }
    >
      <header className={styles.sectionHead}>
        <div className={styles.heading}>
          <span className={styles.sectionIcon}>
            <ShapesIcon aria-hidden="true" />
          </span>
          <div>
            <span className={styles.eyebrow}>
              GrafoNest · Diseños de fabricación
            </span>
            <h3>
              {paraComponente
                ? "Piezas de este componente"
                : "Piezas y archivos"}
            </h3>
            <p>
              {paraComponente
                ? "Una misma configuración de material y procesos para todos estos diseños."
                : "Guardá los diseños una vez para reutilizarlos al cotizar o asignarlos a un componente."}
            </p>
          </div>
        </div>
        <div className={styles.actions}>
          {!paraComponente && (
            <Button
              type="button"
              variant="outline"
              className={styles.secondaryAction}
              disabled={fuentes.length >= 30 || ocupado}
              onClick={() =>
                onChange([...fuentes, nuevaFuenteGeometria(fuentes)])
              }
            >
              <PlusIcon data-icon="inline-start" /> Definir al cotizar
            </Button>
          )}
          <Button
            type="button"
            className={styles.primaryAction}
            disabled={ocupado || fuentes.length >= 30}
            onClick={() => {
              destino.current = undefined;
              input.current?.click();
            }}
          >
            {ocupado ? <Spinner /> : <FileUpIcon data-icon="inline-start" />}
            {ocupado ? "Preparando archivo…" : "Cargar archivos"}
          </Button>
        </div>
      </header>
      <div className={styles.toolbar}>
        <p>
          {resumen ??
            `${fuentes.length} ${fuentes.length === 1 ? "diseño" : "diseños"}`}{" "}
          · SVG / DXF · hasta 512 KB por archivo
        </p>
        {accionBiblioteca}
      </div>
      <input
        ref={input}
        type="file"
        multiple
        accept=".svg,.dxf"
        className="sr-only"
        aria-label="Archivos de las piezas"
        onChange={(e) => {
          const archivos = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (
            archivos.length + fuentes.filter((f) => f.predeterminada).length >
            30
          ) {
            setError("Se admiten hasta 30 diseños por producto.");
            return;
          }
          const [primero, ...resto] = archivos;
          setCola(destino.current ? [] : resto);
          if (primero) void abrir(primero, destino.current);
        }}
      />
      <div className={styles.list}>
        {!fuentes.length && (
          <div className={styles.empty}>
            <ShapesIcon aria-hidden="true" />
            <div>
              <strong>El conjunto empieza con sus piezas</strong>Cargá los
              vectores o reutilizá los diseños guardados del producto.
            </div>
          </div>
        )}
        {fuentes.map((f, index) => (
          <article
            key={f.id}
            className={styles.piece}
            aria-label={`Pieza ${index + 1}: ${f.nombre}`}
          >
            <div className={styles.pieceMain}>
              <MiniaturaPieza fuente={f.predeterminada} nombre={f.nombre} />
              <FieldGroup
                className={styles.pieceFields}
                data-quantity={Boolean(renderCantidad)}
              >
                <div className={styles.identity}>
                  <Field>
                    <FieldLabel htmlFor={`nombre-${f.id}`}>
                      Nombre de la pieza {String(index + 1).padStart(2, "0")}
                    </FieldLabel>
                    <Input
                      id={`nombre-${f.id}`}
                      value={f.nombre}
                      maxLength={120}
                      onChange={(e) => cambio(f.id, { nombre: e.target.value })}
                    />
                  </Field>
                  {f.predeterminada ? (
                    <DatosArchivoPieza fuente={f.predeterminada} />
                  ) : (
                    <p className={styles.pending}>
                      El archivo y su medida se definirán al cotizar.
                    </p>
                  )}
                </div>
                {renderCantidad?.(f.id)}
              </FieldGroup>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className={styles.removeAction}
                aria-label={`Eliminar ${f.nombre}`}
                disabled={fuentes.length === 1 || ocupado}
                onClick={() => onChange(fuentes.filter((p) => p.id !== f.id))}
              >
                <Trash2Icon />
              </Button>
            </div>
            <div className={styles.pieceFooter}>
              <Button
                type="button"
                variant="outline"
                className={styles.secondaryAction}
                disabled={ocupado}
                onClick={() => {
                  destino.current = f.id;
                  input.current?.click();
                }}
              >
                <FileUpIcon data-icon="inline-start" />
                {f.predeterminada ? "Cambiar archivo" : "Cargar DXF / SVG"}
              </Button>
              {f.predeterminada?.procedencia?.archivoId && (
                <Button
                  type="button"
                  variant="outline"
                  className={styles.secondaryAction}
                  disabled={ocupado}
                  onClick={() => void revisarCapas(f)}
                >
                  Revisar capas
                </Button>
              )}
              {!paraComponente && (
                <div className={styles.options}>
                  <Field orientation="horizontal">
                    <Checkbox
                      id={`req-${f.id}`}
                      checked={f.requerida}
                      onCheckedChange={(v) => cambio(f.id, { requerida: v })}
                    />
                    <FieldLabel htmlFor={`req-${f.id}`}>
                      Obligatoria al cotizar
                    </FieldLabel>
                  </Field>
                  {f.predeterminada && (
                    <Field orientation="horizontal">
                      <Checkbox
                        id={`override-${f.id}`}
                        checked={f.permitirReemplazo === true}
                        onCheckedChange={(v) =>
                          cambio(f.id, { permitirReemplazo: v })
                        }
                      />
                      <FieldLabel htmlFor={`override-${f.id}`}>
                        Permitir reemplazo al cotizar
                      </FieldLabel>
                    </Field>
                  )}
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
      {error && !pendiente && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <Dialog
        open={!!pendiente}
        onOpenChange={(open) => {
          if (!open && !ocupado) {
            setPendiente(null);
            setCola([]);
          }
        }}
      >
        <DialogContent
          className={styles.dialog}
          initialFocus={selectorContorno}
        >
          <DialogHeader className={styles.dialogHeader}>
            <span className={styles.eyebrow}>
              GrafoNest · Importación vectorial
            </span>
            <DialogTitle>Interpretar pieza</DialogTitle>
            <DialogDescription>
              {pendiente?.nombre} · El naranja muestra la silueta que ocupará
              lugar en la placa.
              {cola.length ? ` Quedan ${cola.length} archivos.` : ""}
            </DialogDescription>
          </DialogHeader>
          {pendiente && (
            <div className={styles.interpretation}>
              <div className={styles.interpretationPreview}>
                <PiezaInterpretacionPreview
                  key={pendiente.archivoId}
                  entidades={pendiente.inspeccion.entidades}
                  seleccion={seleccion}
                />
                <p>
                  {exterior && factor
                    ? `${numero(exterior.ancho * factor)} × ${numero(exterior.alto * factor)} mm`
                    : "Confirmá la unidad para ver las medidas"}
                </p>
                <small>
                  Naranja: exterior · Azul: operaciones · Gris: referencia
                </small>
              </div>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="pieza-contorno-exterior">
                    Contorno exterior para nesting
                  </FieldLabel>
                  <Select
                    value={seleccion.exteriorId}
                    onValueChange={(v) => {
                      if (v)
                        setSeleccion((s) => ({
                          ...s,
                          exteriorId: v,
                          cerrarExterior: false,
                          excluidas: s.excluidas?.filter((id) => id !== v),
                          operaciones: s.operaciones.filter(
                            (o) => o.entidadId !== v,
                          ),
                        }));
                    }}
                  >
                    <SelectTrigger
                      id="pieza-contorno-exterior"
                      ref={selectorContorno}
                    >
                      <SelectValue>
                        {exterior
                          ? `${exterior.capa || "Sin capa"} · ${numero(exterior.ancho)} × ${numero(exterior.alto)} u.`
                          : "Elegir contorno"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className={styles.selectMenu}>
                      <SelectGroup>
                        {pendiente.inspeccion.entidades
                          .filter((e) => e.area > 0)
                          .map((e) => (
                            <SelectItem key={e.id} value={e.id}>
                              {e.capa} · {e.id} · {numero(e.ancho)} ×{" "}
                              {numero(e.alto)} u.
                            </SelectItem>
                          ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FieldDescription>
                    Seleccioná una pieza. Los demás contornos no se anidan como
                    piezas independientes.
                  </FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="pieza-unidad-coordenadas">
                    Unidad de las coordenadas
                  </FieldLabel>
                  <Select
                    value={seleccion.unidad || null}
                    onValueChange={(v) =>
                      setSeleccion((s) => ({ ...s, unidad: v ?? "" }))
                    }
                  >
                    <SelectTrigger id="pieza-unidad-coordenadas">
                      <SelectValue placeholder="Elegir unidad">
                        {
                          unidades.find((u) => u.value === seleccion.unidad)
                            ?.label
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className={styles.selectMenu}>
                      <SelectGroup>
                        {unidades.map((u) => (
                          <SelectItem key={u.value} value={u.value}>
                            {u.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FieldDescription>
                    Declarada por el archivo:{" "}
                    {pendiente.inspeccion.unidadDeclarada ?? "sin declarar"}.
                  </FieldDescription>
                </Field>
                {exterior && !exterior.cerrada && (
                  <Field orientation="horizontal">
                    <Checkbox
                      id="cerrar-exterior"
                      checked={seleccion.cerrarExterior}
                      onCheckedChange={(v) =>
                        setSeleccion((s) => ({ ...s, cerrarExterior: v }))
                      }
                    />
                    <div>
                      <FieldLabel htmlFor="cerrar-exterior">
                        Confirmo cerrar el exterior con un segmento recto
                      </FieldLabel>
                      <FieldDescription>
                        Abertura: {numero(exterior.apertura * (factor ?? 1))}{" "}
                        {factor ? "mm" : "unidades"}. Este cierre modifica la
                        silueta de fabricación.
                      </FieldDescription>
                    </div>
                  </Field>
                )}
                <CapasFabricacionSelector
                  inspeccion={pendiente.inspeccion}
                  seleccion={seleccion}
                  onChange={setSeleccion}
                />
                {pendiente.inspeccion.avisos.map((aviso, i) => (
                  <p key={i} className="text-xs text-muted-foreground">
                    {aviso}
                  </p>
                ))}
              </FieldGroup>
            </div>
          )}
          {error && (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          )}
          <DialogFooter className={styles.dialogFooter}>
            <Button
              type="button"
              variant="outline"
              className={styles.secondaryAction}
              disabled={ocupado}
              onClick={() => {
                setPendiente(null);
                setCola([]);
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className={styles.primaryAction}
              disabled={
                ocupado ||
                !factor ||
                !exterior ||
                pendiente?.inspeccion.entidades.some(
                  (e) =>
                    e.exportable === false &&
                    !seleccion.excluidas?.includes(e.id),
                ) ||
                (!exterior.cerrada && !seleccion.cerrarExterior)
              }
              onClick={() => void confirmar()}
            >
              {ocupado && <Spinner />}Guardar interpretación
              {cola.length ? " y seguir" : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
