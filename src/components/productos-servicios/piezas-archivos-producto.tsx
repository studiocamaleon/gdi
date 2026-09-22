"use client";
import { useCapacidad } from "@/components/navigation/capacidades-provider";

import * as React from "react";
import { FileUpIcon, PlusIcon, Trash2Icon, ShapesIcon } from "lucide-react";
import { Button, useProductoVisual } from "./producto-ui";
import { Input } from "./producto-ui";
import { Checkbox } from "./producto-ui";
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
} from "./producto-ui";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./producto-ui";
import { subirArchivo } from "@/lib/archivos-api";
import {
  guardarInterpretacionesProducto,
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
import {
  incorporarPiezasArchivo,
  piezasDeCapa,
  seleccionarPiezasArchivo,
  seleccionInicialArchivo,
} from "@/lib/seleccion-piezas-archivo";

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
  paraCotizacion = false,
  idsReservados = [],
  contenidoAdicional,
  onProcesandoChange,
  titulo,
  descripcion,
}: {
  productoId: string;
  fuentes: FuenteGeometriaComercial[];
  onChange: (fuentes: FuenteGeometriaComercial[]) => void;
  paraComponente?: boolean;
  renderCantidad?: (fuenteId: string) => React.ReactNode;
  accionBiblioteca?: React.ReactNode;
  resumen?: string;
  paraCotizacion?: boolean;
  idsReservados?: string[];
  contenidoAdicional?: React.ReactNode;
  onProcesandoChange?: (procesando: boolean) => void;
  titulo?: string;
  descripcion?: string;
}) {
  const conAnalisis = useCapacidad("analisis_vectorial");
  const conGeometrias = useCapacidad("geometrias");
  const habilitado = conAnalisis && conGeometrias;
  const productoVisual = useProductoVisual();
  const accionesDeComponente = paraComponente && productoVisual;
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
  const avisoProcesando = React.useRef(onProcesandoChange);
  avisoProcesando.current = onProcesandoChange;
  React.useEffect(() => {
    avisoProcesando.current?.(ocupado || !!pendiente || cola.length > 0);
  }, [ocupado, pendiente, cola.length]);
  React.useEffect(() => () => avisoProcesando.current?.(false), []);
  const seleccionar = (fuenteId?: string) => {
    destino.current = fuenteId;
    if (input.current) {
      input.current.multiple = !fuenteId;
      input.current.click();
    }
  };

  async function abrir(file: File, fuenteId?: string) {
    if (!habilitado) return;
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
      setSeleccion(seleccionInicialArchivo(inspeccion));
      setPendiente({
        archivoId: archivo.id,
        nombre: file.name,
        fuenteId,
        inspeccion,
      });
    } catch (e) {
      setError(
        `${file.name}: ${e instanceof Error ? e.message : "No se pudo abrir el archivo."}`,
      );
    } finally {
      setOcupado(false);
    }
  }
  async function revisarCapas(fuente: FuenteGeometriaComercial) {
    if (!habilitado) return;
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
        excluidas: [
          ...new Set([
            ...(guardada.procedencia.entidadesExcluidas ?? []),
            ...(guardada.fabricacion?.entidades ?? [])
              .filter((e) => !e.conservar)
              .map((e) => e.entidadId),
          ]),
        ].flatMap((entidadId) => {
          const id = actualId(entidadId);
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
    if (!habilitado) return;
    if (!pendiente) return;
    setOcupado(true);
    setError("");
    try {
      const cantidadImportar = seleccion.exteriorIds?.length ?? 1;
      if (
        fuentes.filter((f) => f.predeterminada).length +
          cantidadImportar -
          (pendiente.fuenteId ? 1 : 0) >
        30
      )
        throw new Error(
          "Podés cargar hasta 30 piezas. Revisá la selección antes de importar.",
        );
      const { fuentes: interpretadas } = await guardarInterpretacionesProducto(
        productoId,
        pendiente.archivoId,
        seleccion,
      );
      onChange(
        incorporarPiezasArchivo(
          fuentes,
          interpretadas,
          pendiente.nombre,
          pendiente.fuenteId,
          idsReservados,
        ),
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
  const exterioresSeleccionados =
    pendiente?.inspeccion.entidades.filter((e) =>
      (seleccion.exteriorIds ?? [seleccion.exteriorId]).includes(e.id),
    ) ?? [];
  const exteriorAbierto = exterioresSeleccionados.find((e) => !e.cerrada);
  const factor = unidades.find((u) => u.value === seleccion.unidad)?.factorMm;
  const cambio = (id: string, patch: Partial<FuenteGeometriaComercial>) =>
    onChange(fuentes.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  // Las fuentes requeridas siguen reservadas para la carga por lotes, pero
  // en la cotización sólo se muestran tarjetas de archivos ya cargados.
  const fuentesVisibles = paraCotizacion
    ? fuentes.filter((f) => f.predeterminada)
    : fuentes;

  return (
    <fieldset
      disabled={!habilitado}
      className={styles.editor}
      data-cotizacion={paraCotizacion || undefined}
      aria-label={
        paraCotizacion
          ? "Piezas de esta cotización"
          : paraComponente
            ? "Piezas de este componente"
            : "Piezas y archivos"
      }
    >
      {!habilitado && <p className="text-sm text-muted-foreground">La edición de geometrías no está incluida en tu plan. Los diseños guardados se conservan.</p>}
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
              {titulo ??
                (paraCotizacion
                  ? "Piezas del producto"
                  : paraComponente
                    ? "Piezas de este componente"
                    : "Piezas y archivos")}
            </h3>
            <p>
              {descripcion ??
                (paraCotizacion
                  ? "Cargá varios SVG o DXF. Comparten material y procesos, con cantidades propias por diseño."
                  : paraComponente
                    ? "Una misma configuración de material y procesos para todos estos diseños."
                    : "Guardá los diseños una vez para reutilizarlos al cotizar o asignarlos a un componente.")}
            </p>
          </div>
        </div>
        <div className={styles.actions}>
          {!paraComponente && !paraCotizacion && (
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
            className={accionesDeComponente ? undefined : styles.primaryAction}
            disabled={
              ocupado ||
              fuentes.filter((f) => f.predeterminada).length +
                idsReservados.length >=
                30
            }
            onClick={() => seleccionar()}
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
            !destino.current &&
            archivos.length +
              fuentes.filter((f) => f.predeterminada).length +
              idsReservados.length >
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
        {contenidoAdicional}
        {!fuentesVisibles.length && !idsReservados.length && (
          <div className={styles.empty}>
            <ShapesIcon aria-hidden="true" />
            <div>
              <strong>Agregá los diseños que necesitás fabricar</strong>Podés
              seleccionar varios archivos juntos y revisar cada pieza antes de
              cotizar.
            </div>
          </div>
        )}
        {fuentesVisibles.map((f, index) => (
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
                  <Field data-invalid={!f.nombre.trim()}>
                    <FieldLabel htmlFor={`nombre-${f.id}`}>
                      Nombre de la pieza {String(index + 1).padStart(2, "0")}
                    </FieldLabel>
                    <Input
                      id={`nombre-${f.id}`}
                      value={f.nombre}
                      aria-invalid={!f.nombre.trim()}
                      maxLength={120}
                      onChange={(e) => cambio(f.id, { nombre: e.target.value })}
                    />
                    {!f.nombre.trim() && (
                      <FieldDescription>
                        Ingresá un nombre para esta pieza.
                      </FieldDescription>
                    )}
                  </Field>
                  {f.predeterminada ? (
                    <DatosArchivoPieza fuente={f.predeterminada} />
                  ) : (
                    <p className={styles.pending}>
                      {paraCotizacion
                        ? "Cargá el archivo requerido por este producto."
                        : "El archivo y su medida se definirán al cotizar."}
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
                disabled={
                  (!paraCotizacion && fuentes.length === 1) ||
                  ocupado ||
                  (paraCotizacion &&
                    f.requerida &&
                    !!f.predeterminada &&
                    !f.permitirReemplazo)
                }
                onClick={() => onChange(fuentes.filter((p) => p.id !== f.id))}
              >
                <Trash2Icon />
              </Button>
            </div>
            <div className={styles.pieceFooter}>
              <Button
                type="button"
                variant="outline"
                className={
                  accionesDeComponente ? undefined : styles.secondaryAction
                }
                disabled={
                  ocupado ||
                  (paraCotizacion && !!f.predeterminada && !f.permitirReemplazo)
                }
                onClick={() => seleccionar(f.id)}
              >
                <FileUpIcon data-icon="inline-start" />
                {f.predeterminada ? "Reemplazar archivo" : "Cargar DXF / SVG"}
              </Button>
              {f.predeterminada?.procedencia?.archivoId &&
                (!paraCotizacion || f.permitirReemplazo) && (
                  <Button
                    type="button"
                    variant="outline"
                    className={
                      accionesDeComponente ? undefined : styles.secondaryAction
                    }
                    disabled={ocupado}
                    onClick={() => void revisarCapas(f)}
                  >
                    Revisar capas
                  </Button>
                )}
              {!paraComponente && !paraCotizacion && (
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
      {error && !pendiente && cola.length > 0 && (
        <div className={styles.actions}>
          <Button
            type="button"
            variant="outline"
            disabled={ocupado}
            onClick={() => setCola([])}
          >
            Cancelar archivos pendientes
          </Button>
          <Button
            type="button"
            disabled={ocupado}
            onClick={() => {
              const [siguiente, ...resto] = cola;
              setCola(resto);
              if (siguiente) void abrir(siguiente);
            }}
          >
            Continuar con los {cola.length} archivos restantes
          </Button>
        </div>
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
          overlayClassName={styles.dialogOverlay}
          initialFocus={selectorContorno}
        >
          <DialogHeader className={styles.dialogHeader}>
            <span className={styles.eyebrow}>
              GrafoNest · Importación vectorial
            </span>
            <DialogTitle>Interpretar archivo</DialogTitle>
            <DialogDescription>
              {pendiente?.nombre} · Cada silueta naranja se acomoda como una
              pieza independiente en la placa.
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
                    ? exterioresSeleccionados.length > 1
                      ? `${exterioresSeleccionados.length} piezas para nesting · Medidas en mm`
                      : `${numero(exterior.ancho * factor)} × ${numero(exterior.alto * factor)} mm`
                    : "Confirmá la unidad para ver las medidas"}
                </p>
                <small>
                  Naranja: exterior · Azul: operaciones · Gris: referencia
                </small>
              </div>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="pieza-contorno-exterior">
                    Piezas para nesting
                  </FieldLabel>
                  <Select
                    value={
                      seleccion.exteriorIds
                        ? new Set(exterioresSeleccionados.map((e) => e.capa))
                            .size > 1
                          ? "archivo"
                          : `capa:${exterior?.capa ?? ""}`
                        : seleccion.exteriorId
                    }
                    onValueChange={(v) => {
                      if (v === "archivo") {
                        setSeleccion((s) =>
                          seleccionarPiezasArchivo(
                            pendiente.inspeccion,
                            pendiente.inspeccion.piezasSugeridas ?? [],
                            s,
                          ),
                        );
                      } else if (v?.startsWith("capa:")) {
                        const piezas = piezasDeCapa(
                          pendiente.inspeccion,
                          v.slice(5),
                        );
                        setSeleccion((s) =>
                          seleccionarPiezasArchivo(
                            pendiente.inspeccion,
                            piezas.map((p) => p.exteriorId),
                            s,
                          ),
                        );
                      } else if (v)
                        setSeleccion((s) => ({
                          ...s,
                          exteriorId: v,
                          exteriorIds: undefined,
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
                          ? seleccion.exteriorIds
                            ? `${exterioresSeleccionados.length} piezas · ${exterior.capa || "Sin capa"}`
                            : `${exterior.capa || "Sin capa"} · ${numero(exterior.ancho)} × ${numero(exterior.alto)} u.`
                          : "Elegir contorno"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent
                      className={styles.selectMenu}
                      positionerClassName={styles.selectLayer}
                    >
                      <SelectGroup>
                        {!!pendiente.inspeccion.piezasSugeridas?.length && (
                          <SelectItem value="archivo">
                            Todas las piezas detectadas ·{" "}
                            {pendiente.inspeccion.piezasSugeridas.length}
                          </SelectItem>
                        )}
                        {[
                          ...new Set(
                            pendiente.inspeccion.entidades.map((e) => e.capa),
                          ),
                        ].map((capa) => {
                          const piezas = piezasDeCapa(
                            pendiente.inspeccion,
                            capa,
                          );
                          return piezas.length > 0 ? (
                            <SelectItem
                              key={`capa:${capa}`}
                              value={`capa:${capa}`}
                            >
                              Todas las piezas · {capa || "Sin capa"} ·{" "}
                              {piezas.length}
                            </SelectItem>
                          ) : null;
                        })}
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
                    Se incluyen todas las piezas detectadas. Podés limitar la
                    selección a una capa. Los huecos se conservan como cortes
                    internos; después podés ajustar el nombre y la cantidad de
                    cada pieza.
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
                    <SelectContent
                      className={styles.selectMenu}
                      positionerClassName={styles.selectLayer}
                    >
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
                {exteriorAbierto && (
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
                        Abertura:{" "}
                        {numero(exteriorAbierto.apertura * (factor ?? 1))}{" "}
                        {factor ? "mm" : "unidades"}. Este cierre modifica la
                        silueta de fabricación.
                      </FieldDescription>
                    </div>
                  </Field>
                )}
                <CapasFabricacionSelector
                  menuLayerClassName={styles.selectLayer}
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
                (!!exteriorAbierto && !seleccion.cerrarExterior)
              }
              onClick={() => void confirmar()}
            >
              {ocupado && <Spinner />}
              {seleccion.exteriorIds
                ? `Importar ${seleccion.exteriorIds.length} ${seleccion.exteriorIds.length === 1 ? "pieza" : "piezas"}`
                : "Guardar interpretación"}
              {cola.length ? " y seguir" : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </fieldset>
  );
}
