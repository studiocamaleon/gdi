"use client";
import { useEffect, useRef, useState } from "react";
import { Ruler, Plus, CheckCircle2, Circle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ActionButton } from "@/components/design-system/action-button";
import { SelectField } from "@/components/design-system/select-field";
import { FormDialog } from "@/components/design-system/form-dialog";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
} from "@/components/ui/field";
import { Input } from "@heroui/react";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { DestinoImpresion } from "@/lib/impresion-api";
import type { PerfilDisponible } from "@/lib/perfiles-impresion";
import {
  opcionesPerfilCad,
  guardarPerfilCad,
  cotizarMuestraCad,
  enlacePerfilCad,
  type OpcionPerfilCad,
  type DatosPerfilCad,
  type CotizacionMuestraCad,
} from "@/lib/perfiles-cad-api";
import { imprimirPruebaPerfilCad } from "@/lib/qz-impresion";
import s from "./perfiles-impresion.module.css";

const dinero = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(
    n,
  );
export function PerfilesCadPanel({
  destino,
  perfiles,
  tenantId,
  disabled,
  onSaved,
}: {
  destino: DestinoImpresion;
  perfiles: PerfilDisponible[];
  tenantId: string;
  disabled: boolean;
  onSaved: () => Promise<void>;
}) {
  const [opciones, setOpciones] = useState<OpcionPerfilCad[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const lock = useRef(false);
  const [editor, setEditor] = useState<{
    id?: string;
    datos: DatosPerfilCad;
  } | null>(null);
  const [muestra, setMuestra] = useState<{
    nombre: string;
    resultado: CotizacionMuestraCad;
  } | null>(null);
  useEffect(() => {
    let vivo = true;
    setCargando(true);
    opcionesPerfilCad(destino.id)
      .then((r) => {
        if (vivo) {
          setOpciones(r.opciones);
          setError("");
        }
      })
      .catch((e) => {
        if (vivo) setError(e.message);
      })
      .finally(() => {
        if (vivo) setCargando(false);
      });
    return () => {
      vivo = false;
    };
  }, [destino.id, destino.version]);
  const bloqueado = disabled || ocupado || cargando;
  async function ejecutar(fn: () => Promise<void>) {
    if (lock.current || disabled) return;
    lock.current = true;
    setOcupado(true);
    setError("");
    setMuestra(null);
    try {
      await fn();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo completar la operación.",
      );
    } finally {
      lock.current = false;
      setOcupado(false);
    }
  }
  function editar(p?: PerfilDisponible) {
    const enlace = enlacePerfilCad(p?.cad);
    const o = opciones.find(
      (o) =>
        o.rutaAlternativaId === enlace?.rutaAlternativaId &&
        o.materialVarianteId === enlace.materialVarianteId,
    );
    setError("");
    setEditor({
      id: p?.id,
      datos: {
        destinoId: destino.id,
        versionDestino: destino.version,
        version: p?.version,
        nombre: p?.nombre ?? "",
        rutaAlternativaId: enlace?.rutaAlternativaId ?? "",
        materialVarianteId: enlace?.materialVarianteId ?? "",
        gramaje: p?.gramaje ?? o?.gramaje ?? 0,
        color: p?.color === "COLOR" ? "COLOR" : "BN",
        modo: p?.modo ?? "PREPARACION",
        activo: p?.activo ?? true,
        probado: p?.probado ?? false,
        prioridad: p?.prioridad ?? 1,
      },
    });
  }
  function campo<K extends keyof DatosPerfilCad>(
    key: K,
    value: DatosPerfilCad[K],
  ) {
    setEditor((e) =>
      e
        ? {
            ...e,
            datos: {
              ...e.datos,
              [key]: value,
              ...([
                "rutaAlternativaId",
                "materialVarianteId",
                "gramaje",
                "color",
              ].includes(key)
                ? { probado: false }
                : {}),
            },
          }
        : e,
    );
  }
  const opcion = opciones.find(
    (o) =>
      o.rutaAlternativaId === editor?.datos.rutaAlternativaId &&
      o.materialVarianteId === editor?.datos.materialVarianteId,
  );
  const filas = perfiles.filter(
    (p) => p.tamano === "CAD" && p.bandeja.destino.id === destino.id,
  );
  return (
    <section className={s.bandeja} aria-label="Perfiles CAD">
      <div className={s.cabecera}>
        <div>
          <div className={s.seccionTitulo}>
            <span className={s.numero}>01</span>
            <h4>Perfiles CAD</h4>
          </div>
          <p>
            Material y color vinculados al producto que cotizás. Calidad:
            preferencias de Windows.
          </p>
        </div>
        <ActionButton
          variant="outline"
          isDisabled={bloqueado || !opciones.length}
          onPress={() => editar()}
        >
          <Plus /> Agregar perfil CAD
        </ActionButton>
      </div>
      {error && !editor && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {!cargando && !opciones.length && (
        <p className={s.ayuda}>
          No hay recetas compatibles. Configurá un producto con un único paso de
          impresión por área, este plotter y un material fijo en rollo del ancho
          cargado.
        </p>
      )}
      {!filas.length ? (
        <p className={s.vacio}>
          {cargando
            ? "Cargando recetas…"
            : "Agregá un perfil B/N y otro Color para el papel del plotter."}
        </p>
      ) : (
        <Table className={s.tabla}>
          <TableHeader>
            <TableRow>
              <TableHead>Perfil</TableHead>
              <TableHead>Material y producto</TableHead>
              <TableHead>Prueba</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filas.map((p) => {
              const e = enlacePerfilCad(p.cad);
              const o = opciones.find(
                (o) =>
                  o.rutaAlternativaId === e?.rutaAlternativaId &&
                  o.materialVarianteId === e?.materialVarianteId &&
                  o.colores.includes(p.color as "BN" | "COLOR"),
              );
              const prueba = {
                version: p.version,
                versionDestino: destino.version,
                formato: "A1" as const,
              };
              return (
                <TableRow key={p.id}>
                  <TableCell>
                    {p.nombre}
                    <small>
                      {p.color === "BN" ? "B/N" : "Color"} · {p.gramaje} g ·{" "}
                      {p.activo
                        ? p.modo === "AUTOMATICO"
                          ? "Automático con rollo preparado"
                          : "Requiere preparación"
                        : "Inactivo"}
                    </small>
                  </TableCell>
                  <TableCell>
                    {o?.materialNombre ??
                      (cargando
                        ? "Cargando material…"
                        : "Revisar receta o rollo")}
                    <small>{o?.productoNombre}</small>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={s.estado}
                      data-status={p.probado ? "ok" : "pending"}
                    >
                      {p.probado ? <CheckCircle2 /> : <Circle />}
                      {p.probado ? "Verificada" : "Pendiente"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className={s.acciones}>
                      <ActionButton
                        variant="outline"
                        isDisabled={
                          bloqueado || !o || !p.activo || !destino.activo
                        }
                        onPress={() =>
                          void ejecutar(async () =>
                            setMuestra({
                              nombre: p.nombre,
                              resultado: await cotizarMuestraCad(p.id, prueba),
                            }),
                          )
                        }
                      >
                        Cotizar A1
                      </ActionButton>
                      <ActionButton
                        variant="outline"
                        isDisabled={
                          bloqueado || !o || !p.activo || !destino.activo
                        }
                        onPress={() =>
                          void ejecutar(async () => {
                            await imprimirPruebaPerfilCad(
                              tenantId,
                              destino.host,
                              p.id,
                              prueba,
                            );
                            toast.success(
                              `Prueba A1 enviada · ${p.nombre}. Verificá la copia antes de marcar el perfil.`,
                            );
                          })
                        }
                      >
                        Imprimir prueba A1
                      </ActionButton>
                      <ActionButton
                        variant="tertiary"
                        isDisabled={bloqueado}
                        onPress={() => editar(p)}
                      >
                        Editar perfil
                      </ActionButton>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
      {muestra && (
        <Alert role="status" className="mt-3">
          <AlertTitle>{muestra.nombre} · A1 · 1 copia</AlertTitle>
          <AlertDescription className="grid gap-1">
            <span>
              Subtotal {dinero(muestra.resultado.subtotal)} · Impuestos{" "}
              {dinero(muestra.resultado.impuestos)} · Total{" "}
              {dinero(muestra.resultado.total)}
            </span>
            <span>
              Calculado con {muestra.resultado.productoNombre}. Es una
              simulación; no crea una OT ni envía papel.
            </span>
          </AlertDescription>
        </Alert>
      )}
      <p className={s.ayuda}>
        Estos perfiles preparan la integración con Centro de copiado. El envío
        de archivos de OT al plotter todavía no está habilitado.
      </p>
      {editor && (
        <FormDialog
          isOpen
          onOpenChange={(open) => {
            if (!open && !ocupado) {
              setEditor(null);
              setError("");
            }
          }}
          isDismissable={!ocupado}
          title={
            <span className={s.modalTitulo}>
              <Ruler />
              {editor.id ? "Editar perfil CAD" : "Agregar perfil CAD"}
            </span>
          }
          description={destino.nombre}
          className={s.dialog}
        >
          <div className={s.formulario}>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <FieldGroup className={s.campos}>
              <Field>
                <FieldLabel>Nombre</FieldLabel>
                <Input
                  aria-label="Nombre del perfil CAD"
                  disabled={ocupado}
                  value={editor.datos.nombre}
                  onChange={(e) => campo("nombre", e.target.value)}
                  placeholder="Planos B/N"
                />
              </Field>
              <Field className={s.cadAnchoCompleto}>
                <FieldLabel>Producto y material</FieldLabel>
                <SelectField
                  aria-label="Receta CAD"
                  disabled={ocupado}
                  value={
                    opcion
                      ? `${opcion.rutaAlternativaId}:${opcion.materialVarianteId}`
                      : ""
                  }
                  options={opciones.map((o) => ({
                    value: `${o.rutaAlternativaId}:${o.materialVarianteId}`,
                    label: `${o.productoNombre} · ${o.rutaNombre} · ${o.materialNombre}`,
                  }))}
                  onChange={(v) => {
                    const o = opciones.find(
                      (o) =>
                        `${o.rutaAlternativaId}:${o.materialVarianteId}` === v,
                    );
                    if (o)
                      setEditor((e) =>
                        e
                          ? {
                              ...e,
                              datos: {
                                ...e.datos,
                                rutaAlternativaId: o.rutaAlternativaId,
                                materialVarianteId: o.materialVarianteId,
                                gramaje: o.gramaje ?? e.datos.gramaje,
                                color: o.colores.includes(e.datos.color)
                                  ? e.datos.color
                                  : o.colores[0],
                                probado: false,
                              },
                            }
                          : e,
                      );
                  }}
                />
                <FieldDescription>
                  Usa la receta y el material existentes, con sus precios y
                  tiempos.
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel>Gramaje (g/m²)</FieldLabel>
                <Input
                  aria-label="Gramaje CAD"
                  type="number"
                  min={1}
                  max={1000}
                  disabled={ocupado || opcion?.gramaje != null}
                  value={editor.datos.gramaje || ""}
                  onChange={(e) => campo("gramaje", Number(e.target.value))}
                />
              </Field>
              <Field>
                <FieldLabel>Color</FieldLabel>
                <SelectField
                  aria-label="Color del perfil CAD"
                  disabled={ocupado}
                  value={editor.datos.color}
                  options={(opcion?.colores ?? ["BN", "COLOR"]).map((c) => ({
                    value: c,
                    label: c === "BN" ? "B/N · Escala de grises" : "Color",
                  }))}
                  onChange={(v) => campo("color", v as "BN" | "COLOR")}
                />
              </Field>
              <Field>
                <FieldLabel>Modo de envío</FieldLabel>
                <SelectField
                  aria-label="Modo de envío CAD"
                  disabled={ocupado}
                  value={editor.datos.modo}
                  options={[
                    {
                      value: "PREPARACION",
                      label: "Requiere preparación del operario",
                    },
                    {
                      value: "AUTOMATICO",
                      label: "Automático con rollo confirmado",
                    },
                  ]}
                  onChange={(v) => campo("modo", v)}
                />
              </Field>
              <Field>
                <FieldLabel>Prioridad</FieldLabel>
                <Input
                  aria-label="Prioridad CAD"
                  type="number"
                  min={1}
                  max={99}
                  disabled={ocupado}
                  value={editor.datos.prioridad}
                  onChange={(e) => campo("prioridad", Number(e.target.value))}
                />
              </Field>
              <p className={s.ayuda}>
                Escala 100% · Simple faz · Rollo {destino.cad?.anchoRolloMm} mm.
                La calidad Rápida se configura en Windows.
              </p>
              <Field orientation="horizontal" className={s.cadAnchoCompleto}>
                <Checkbox
                  aria-label="Perfil CAD activo"
                  checked={editor.datos.activo}
                  disabled={ocupado}
                  onCheckedChange={(v) => campo("activo", Boolean(v))}
                />
                <FieldLabel>Perfil activo</FieldLabel>
              </Field>
              <Field orientation="horizontal" className={s.cadAnchoCompleto}>
                <Checkbox
                  aria-label="Verifiqué la prueba física de este perfil CAD"
                  checked={editor.datos.probado}
                  disabled={ocupado}
                  onCheckedChange={(v) => campo("probado", Boolean(v))}
                />
                <FieldLabel>
                  Verifiqué material, color, calidad y escala en una prueba
                  física
                </FieldLabel>
              </Field>
            </FieldGroup>
          </div>
          <footer className={s.footer}>
            <ActionButton
              variant="tertiary"
              isDisabled={ocupado}
              onPress={() => {
                setEditor(null);
                setError("");
              }}
            >
              Cancelar
            </ActionButton>
            <ActionButton
              isDisabled={
                bloqueado ||
                !opcion ||
                !editor.datos.nombre.trim() ||
                editor.datos.gramaje < 1 ||
                editor.datos.gramaje > 1000
              }
              onPress={() =>
                void ejecutar(async () => {
                  await guardarPerfilCad(editor.datos, editor.id);
                  await onSaved();
                  setEditor(null);
                })
              }
            >
              {ocupado ? "Guardando…" : "Guardar perfil"}
            </ActionButton>
          </footer>
        </FormDialog>
      )}
    </section>
  );
}
