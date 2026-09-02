"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFecha } from "@/components/navigation/config-regional-provider";
import {
  ArrowLeftIcon,
  HistoryIcon,
  RefreshCwIcon,
  RouteIcon,
  SaveIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmacionDestructiva } from "@/components/ui/confirmacion-destructiva";
import {
  actualizarRuta,
  crearRuta,
  eliminarRuta,
  migrarProductosRuta,
  getPasosTenant,
  getProductos,
} from "@/lib/productos-servicios-api";
import type {
  CatalogoFamilias,
  PasoTenant,
  ProductoListItem,
  RutaWorkflow,
} from "@/lib/productos-servicios";
import { RutaWorkflowEditor } from "@/components/productos-servicios/ruta-workflow-editor";
import styles from "./ruta-form-view.module.css";

type Modo = "crear" | "editar";

const DEFAULT_ICON_BY_FAMILY: Record<string, string> = {
  diseno_grafico: "Layout",
  pre_prensa: "Layers",
  impresion_por_hoja: "Printer",
  impresion_por_area: "Plot",
  plotter_corte: "Cut",
  corte_guillotina: "Scissors",
  laminado: "Brush",
  plastificado_pouch: "Brush",
  troquelado: "Stamp",
  plegado: "Fold",
  router_cnc: "Cnc",
  corte_laser: "Beam",
  encuadernacion: "Book",
  engomado_emblocado: "Book",
  colocacion_raspadita: "Stamp",
  embalaje: "Package",
  instalacion_in_situ: "Wrench",
};

function getDefaultStepIcon(familiaCodigo: string) {
  return DEFAULT_ICON_BY_FAMILY[familiaCodigo] ?? "Layout";
}

interface RutaConPasos {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  versionActual: number;
  activo: boolean;
  pasos: Array<{
    id: string;
    orden: number;
    familiaCodigo: string;
    nombreVisible?: string | null;
    icono?: string | null;
  }>;
  workflow?: RutaWorkflow;
  versiones?: Array<{
    version: number;
    cambios: string | null;
    createdAt: string;
  }>;
  productosAlternativas?: Array<{
    id: string;
    nombre: string;
    rutaVersion: number;
    producto: { id: string; codigo: string; nombre: string };
  }>;
}

interface Props {
  modo: Modo;
  rutaExistente?: RutaConPasos;
  catalogoFamilias: CatalogoFamilias;
}

interface PasoEditable {
  familiaCodigo: string;
  nombreVisible: string;
  icono: string;
  /** ID interno solo del editor; null si es paso nuevo. */
  uiKey: string;
}

export function RutaFormView({ modo, rutaExistente, catalogoFamilias }: Props) {
  const router = useRouter();
  const { fechaNumerica } = useFecha();
  const [guardando, setGuardando] = React.useState(false);
  const [eliminando, setEliminando] = React.useState(false);

  const [nombre, setNombre] = React.useState(rutaExistente?.nombre ?? "");
  const [descripcion, setDescripcion] = React.useState(
    rutaExistente?.descripcion ?? "",
  );
  const [activo, setActivo] = React.useState(rutaExistente?.activo ?? true);
  const workflowInicial = React.useMemo<RutaWorkflow>(() => {
    if (rutaExistente?.workflow) return rutaExistente.workflow;
    const nodos =
      rutaExistente?.pasos.map((paso, index) => ({
        clave: `ruta:${paso.id}`,
        tipo: "PASO" as const,
        orden: index,
        familiaCodigo: paso.familiaCodigo,
        nombreVisible: paso.nombreVisible ?? null,
        icono: paso.icono ?? "Layout",
      })) ?? [];
    return {
      contractVersion: 1,
      topologia: "LINEAL",
      nodos,
      aristas: nodos.slice(1).map((nodo, index) => ({
        desdeClave: nodos[index].clave,
        haciaClave: nodo.clave,
      })),
    };
  }, [rutaExistente]);
  const [workflow, setWorkflow] = React.useState<RutaWorkflow>(workflowInicial);
  const [productos, setProductos] = React.useState<ProductoListItem[]>([]);
  const [pasosTenant, setPasosTenant] = React.useState<PasoTenant[]>([]);
  const [pasos, setPasos] = React.useState<PasoEditable[]>(
    workflowInicial.nodos
      .filter((nodo) => nodo.tipo !== "COMPONENTE")
      .map((nodo) => ({
        familiaCodigo: nodo.familiaCodigo,
        nombreVisible: nodo.nombreVisible ?? "",
        icono: nodo.icono ?? getDefaultStepIcon(nodo.familiaCodigo),
        uiKey: nodo.clave.replace(/^ruta:/, ""),
      })),
  );

  React.useEffect(() => {
    let activo = true;
    void Promise.all([getProductos(true), getPasosTenant()])
      .then(([productosDisponibles, pasosDisponibles]) => {
        if (!activo) return;
        setProductos(productosDisponibles);
        setPasosTenant(pasosDisponibles.filter((paso) => paso.activo));
      })
      .catch(() => {
        if (!activo) return;
        toast.error("No se pudo cargar el catálogo de nodos reutilizables.");
      });
    return () => {
      activo = false;
    };
  }, []);

  const actualizarWorkflow = React.useCallback((siguiente: RutaWorkflow) => {
    setWorkflow(siguiente);
    setPasos(
      siguiente.nodos
        .filter((nodo) => nodo.tipo !== "COMPONENTE")
        .map((nodo) => ({
          familiaCodigo: nodo.familiaCodigo,
          nombreVisible: nodo.nombreVisible ?? "",
          icono: nodo.icono ?? getDefaultStepIcon(nodo.familiaCodigo),
          uiKey: nodo.clave.replace(/^ruta:/, ""),
        })),
    );
  }, []);

  // Diff respecto a inicial: detectar cambio estructural (heurística)
  const pasosOriginales = React.useMemo(
    () => rutaExistente?.pasos ?? [],
    [rutaExistente],
  );
  const workflowOriginal = React.useMemo(
    () => JSON.stringify(workflowInicial),
    [workflowInicial],
  );

  // G-F1 — heurística fina (doc §7.6): detecta cambios tipados estructurales.
  // - AGREGAR_PASO / QUITAR_PASO / CAMBIAR_FAMILIA / CAMBIAR_ORDEN → sugerencia: nueva versión.
  // - Cambios de meta (nombre/descripción) → patch in-place.
  type CambioTipado =
    | { tipo: "AGREGAR_PASO"; orden: number; familia: string }
    | { tipo: "QUITAR_PASO"; orden: number; familia: string }
    | { tipo: "CAMBIAR_FAMILIA"; orden: number; antes: string; despues: string }
    | {
        tipo: "CAMBIAR_ORDEN";
        familia: string;
        antes: number;
        despues: number;
      };

  const cambiosDetectados = React.useMemo<CambioTipado[]>(() => {
    if (modo === "crear") return [];
    const originales = pasosOriginales;
    const cambios: CambioTipado[] = [];
    const usadosNuevos = new Set<number>();

    originales.forEach((orig, origIndex) => {
      const nuevoIndex = pasos.findIndex(
        (paso, idx) =>
          !usadosNuevos.has(idx) && paso.familiaCodigo === orig.familiaCodigo,
      );
      if (nuevoIndex === -1) {
        cambios.push({
          tipo: "QUITAR_PASO",
          orden: origIndex + 1,
          familia: orig.familiaCodigo,
        });
        return;
      }
      usadosNuevos.add(nuevoIndex);
      if (nuevoIndex !== origIndex) {
        cambios.push({
          tipo: "CAMBIAR_ORDEN",
          familia: orig.familiaCodigo,
          antes: origIndex + 1,
          despues: nuevoIndex + 1,
        });
      }
    });

    pasos.forEach((nuevo, nuevoIndex) => {
      if (usadosNuevos.has(nuevoIndex)) return;
      const orig = originales[nuevoIndex];
      if (
        orig &&
        !pasos.some((paso) => paso.familiaCodigo === orig.familiaCodigo)
      ) {
        cambios.push({
          tipo: "CAMBIAR_FAMILIA",
          orden: nuevoIndex + 1,
          antes: orig.familiaCodigo,
          despues: nuevo.familiaCodigo,
        });
        return;
      }
      cambios.push({
        tipo: "AGREGAR_PASO",
        orden: nuevoIndex + 1,
        familia: nuevo.familiaCodigo,
      });
    });

    return cambios;
  }, [pasos, modo, pasosOriginales]);

  const cambioWorkflow =
    modo === "editar" && JSON.stringify(workflow) !== workflowOriginal;
  const cambioEstructural = cambiosDetectados.length > 0 || cambioWorkflow;
  const cambioIconos = React.useMemo(() => {
    if (modo === "crear") return false;
    return pasos.some((paso) => {
      const original = pasosOriginales.find((item) => item.id === paso.uiKey);
      if (!original) return false;
      return (
        (original.icono ?? getDefaultStepIcon(original.familiaCodigo)) !==
        paso.icono
      );
    });
  }, [modo, pasos, pasosOriginales]);
  const cambioNombres = React.useMemo(() => {
    if (modo === "crear") return false;
    return pasos.some((paso) => {
      const original = pasosOriginales.find((item) => item.id === paso.uiKey);
      if (!original) return false;
      return (
        (original.nombreVisible?.trim() ?? "") !== paso.nombreVisible.trim()
      );
    });
  }, [modo, pasos, pasosOriginales]);
  const productosAfectados = rutaExistente?.productosAlternativas?.length ?? 0;
  const requiereVersionadoPorUso =
    (cambioEstructural || cambioIconos || cambioNombres) &&
    productosAfectados > 0;
  const productosDesactualizados = React.useMemo(
    () =>
      (rutaExistente?.productosAlternativas ?? []).filter(
        (alternativa) =>
          alternativa.rutaVersion < (rutaExistente?.versionActual ?? 1),
      ),
    [rutaExistente],
  );
  const [productosSeleccionados, setProductosSeleccionados] = React.useState<
    string[]
  >(() => productosDesactualizados.map((alternativa) => alternativa.id));
  const [confirmandoMigracion, setConfirmandoMigracion] = React.useState(false);
  const [migrando, setMigrando] = React.useState(false);

  const [cambiosDescripcion, setCambiosDescripcion] = React.useState("");

  const familiaNombre = React.useCallback(
    (codigo: string): string => {
      return (
        catalogoFamilias.familias.find((f) => f.codigo === codigo)?.nombre ??
        codigo
      );
    },
    [catalogoFamilias],
  );

  const handleGuardar = async () => {
    if (pasos.length === 0) {
      toast.error("La ruta debe tener al menos un Paso o una Etapa");
      return;
    }
    setGuardando(true);
    try {
      if (modo === "crear") {
        const creado = (await crearRuta({
          nombre,
          descripcion: descripcion || undefined,
          workflow,
        })) as { id: string };
        toast.success(`Ruta "${nombre}" creada`);
        router.push(`/productos-servicios/rutas/${creado.id}`);
      } else {
        await actualizarRuta(rutaExistente!.id, {
          nombre,
          descripcion: descripcion || undefined,
          activo,
          workflow:
            cambioEstructural || cambioIconos || cambioNombres
              ? workflow
              : undefined,
          cambios: cambiosDescripcion || undefined,
        });
        toast.success(`Ruta "${nombre}" actualizada`);
        router.push("/productos-servicios/rutas");
      }
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error guardando");
    } finally {
      setGuardando(false);
    }
  };

  const [confirmandoBorrado, setConfirmandoBorrado] = React.useState(false);

  const ejecutarMigracion = async () => {
    if (!rutaExistente || productosSeleccionados.length === 0) return;
    setMigrando(true);
    try {
      const resultado = await migrarProductosRuta(
        rutaExistente.id,
        productosSeleccionados,
      );
      toast.success(
        `${resultado.migradas} asociación(es) migrada(s) a v${rutaExistente.versionActual}`,
      );
      if (resultado.requierenConfiguracion > 0) {
        toast.warning(
          `${resultado.requierenConfiguracion} producto(s) tienen pasos nuevos para configurar.`,
        );
      }
      setConfirmandoMigracion(false);
      setProductosSeleccionados([]);
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "No se pudieron migrar los productos",
      );
    } finally {
      setMigrando(false);
    }
  };

  const ejecutarEliminar = async () => {
    if (!rutaExistente) return;
    setEliminando(true);
    try {
      await eliminarRuta(rutaExistente.id);
      toast.success("Ruta eliminada");
      setConfirmandoBorrado(false);
      router.push("/productos-servicios/rutas");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error eliminando");
      setEliminando(false);
    }
  };

  return (
    <div className="content">
      <div className="space-y-3">
        <Link href="/productos-servicios/rutas" className="back-link">
          <ArrowLeftIcon className="size-4" />
          Rutas de producción
        </Link>
        <div className="page-head wizard-head">
          <div className="title-block">
            <h1>
              {modo === "crear"
                ? "Nueva ruta"
                : `Editar ruta: ${rutaExistente?.nombre}`}
            </h1>
            {modo === "editar" && (
              <div className="sub mt-1 flex items-center gap-2">
                <span className="tag version">
                  v{rutaExistente?.versionActual}
                </span>
                {(rutaExistente?.productosAlternativas?.length ?? 0) > 0 && (
                  <span>
                    usado por {rutaExistente?.productosAlternativas?.length}{" "}
                    producto(s)
                  </span>
                )}
              </div>
            )}
          </div>
          {modo === "editar" && (
            <div className="flex items-center gap-2">
              <Label htmlFor="ruta-activa">Ruta activa</Label>
              <Switch
                id="ruta-activa"
                checked={activo}
                onCheckedChange={setActivo}
              />
            </div>
          )}
        </div>
      </div>

      <div className="route-editor">
        <div className={`route-cols ${styles.routeColumns}`}>
          <Card className={`wiz-section ${styles.identityCard}`}>
            <CardHeader className={styles.identityHeader}>
              <span className={styles.identityIcon} aria-hidden="true">
                <RouteIcon />
              </span>
              <div className={styles.identityCopy}>
                <span className={styles.eyebrow}>Ruta reusable</span>
                <CardTitle>Identidad</CardTitle>
                <CardDescription>
                  Definí cómo se reconocerá esta ruta en el catálogo y al
                  incorporarla a un producto.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className={styles.identityContent}>
              <FieldGroup className={styles.fieldGroup}>
                <Field>
                  <FieldLabel htmlFor="nombre">
                    Nombre <span className={styles.required}>*</span>
                  </FieldLabel>
                  <Input
                    id="nombre"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Ej. Impresión y terminación estándar"
                    autoComplete="off"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="descripcion">Descripción</FieldLabel>
                  <Textarea
                    id="descripcion"
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                    rows={3}
                    placeholder="Explicá brevemente cuándo conviene usar esta ruta."
                  />
                </Field>
              </FieldGroup>
              {modo === "editar" && requiereVersionadoPorUso && (
                <Card className="bg-orange-50 border-orange-300">
                  <CardContent className="pt-4">
                    <p className="text-orange-900 mb-2 text-sm font-semibold">
                      ⚠ Cambios en una ruta usada por {productosAfectados}{" "}
                      producto(s)
                    </p>
                    <ul className="mb-3 ml-4 list-disc text-xs text-foreground/80 space-y-0.5">
                      {cambiosDetectados.map((c, idx) => (
                        <li key={idx}>
                          {c.tipo === "AGREGAR_PASO" &&
                            `Agregás paso ${c.orden}: ${familiaNombre(c.familia)}`}
                          {c.tipo === "QUITAR_PASO" &&
                            `Quitás paso ${c.orden}: ${familiaNombre(c.familia)}`}
                          {c.tipo === "CAMBIAR_FAMILIA" &&
                            `Paso ${c.orden}: ${familiaNombre(c.antes)} → ${familiaNombre(c.despues)}`}
                          {c.tipo === "CAMBIAR_ORDEN" &&
                            `${familiaNombre(c.familia)} cambia de paso ${c.antes} a ${c.despues}`}
                        </li>
                      ))}
                      {cambioNombres ? (
                        <li>Cambian nombres operativos de uno o más pasos.</li>
                      ) : null}
                      {cambioWorkflow ? (
                        <li>
                          Cambia la estructura del Workflow, sus paralelismos o
                          sus componentes fabricados.
                        </li>
                      ) : null}
                      {cambioIconos ? (
                        <li>Cambian íconos de uno o más pasos.</li>
                      ) : null}
                    </ul>
                    <p className="text-orange-800 mb-3 text-xs">
                      Se creará obligatoriamente la versión v
                      {(rutaExistente?.versionActual ?? 0) + 1}. Los productos
                      asociados conservarán su versión actual hasta que elijas
                      migrarlos desde esta ficha.
                    </p>
                    <Input
                      className="mt-2"
                      value={cambiosDescripcion}
                      onChange={(e) => setCambiosDescripcion(e.target.value)}
                      placeholder="Descripción del cambio (opcional, queda en el historial)"
                    />
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>

          <div className="route-workflow-slot">
            <RutaWorkflowEditor
              value={workflow}
              onChange={actualizarWorkflow}
              catalogoFamilias={catalogoFamilias}
              pasosTenant={pasosTenant}
              productos={productos}
            />
          </div>

          {/* Historial de versiones */}
        </div>

        {modo === "editar" && (rutaExistente?.versiones?.length ?? 0) > 0 && (
          <div className="card versions-block">
            <div className="card-head">
              <span className="inline-flex items-center gap-2">
                <HistoryIcon className="size-4" />
                <span className="title">Historial de versiones</span>
              </span>
            </div>
            {rutaExistente!.versiones?.map((v) => (
              <div key={v.version} className="versions-row">
                <span className="vtag">v{v.version}</span>
                <span className="vname">
                  {v.version === 1 &&
                  productosAfectados === 0 &&
                  v.cambios?.startsWith("Copia de ")
                    ? "Versión inicial"
                    : (v.cambios ?? "Versión inicial")}
                </span>
                <span className="vdate">{fechaNumerica(v.createdAt)}</span>
              </div>
            ))}
          </div>
        )}

        {modo === "editar" && productosDesactualizados.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Productos en versiones anteriores</CardTitle>
              <CardDescription>
                Elegí qué asociaciones querés llevar a la versión v
                {rutaExistente?.versionActual}. Se preserva la configuración de
                los pasos cuya familia continúa en la nueva versión.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {productosDesactualizados.map((alternativa) => {
                const checked = productosSeleccionados.includes(alternativa.id);
                const checkboxId = `migrar-ruta-${alternativa.id}`;
                return (
                  <Label
                    key={alternativa.id}
                    htmlFor={checkboxId}
                    className="flex items-center gap-3 rounded-lg border p-3"
                  >
                    <Checkbox
                      id={checkboxId}
                      checked={checked}
                      onCheckedChange={(next) =>
                        setProductosSeleccionados((actuales) =>
                          next
                            ? [...new Set([...actuales, alternativa.id])]
                            : actuales.filter((id) => id !== alternativa.id),
                        )
                      }
                    />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate font-medium">
                        {alternativa.producto.nombre}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {alternativa.nombre} · v{alternativa.rutaVersion} → v
                        {rutaExistente?.versionActual}
                      </span>
                    </span>
                  </Label>
                );
              })}
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  disabled={productosSeleccionados.length === 0}
                  onClick={() => setConfirmandoMigracion(true)}
                >
                  <RefreshCwIcon data-icon="inline-start" />
                  Migrar seleccionados ({productosSeleccionados.length})
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <div className="route-actions-bar">
          {modo === "editar" ? (
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => setConfirmandoBorrado(true)}
              disabled={guardando || eliminando}
            >
              <Trash2Icon className="size-4" />
              {eliminando ? "Eliminando..." : "Eliminar ruta"}
            </button>
          ) : (
            <div />
          )}
          <span className="route-actions-copy">
            {modo === "crear"
              ? "Se guardará como V1 y quedará disponible para reutilizarla en distintos productos."
              : (rutaExistente?.productosAlternativas?.length ?? 0) === 0
                ? "Los cambios se aplican sobre esta ruta. Todavía no está asociada a productos."
                : `Los cambios estructurales crearán automáticamente v${
                    (rutaExistente?.versionActual ?? 1) + 1
                  } para preservar los productos existentes.`}
          </span>
          <button
            type="button"
            className="btn"
            onClick={() => router.push("/productos-servicios/rutas")}
            disabled={guardando || eliminando}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleGuardar}
            disabled={guardando || !nombre || workflow.nodos.length === 0}
          >
            <SaveIcon className="size-4" />
            {guardando
              ? "Guardando..."
              : modo === "crear"
                ? "Crear ruta"
                : "Guardar cambios"}
          </button>
        </div>
      </div>

      <AlertDialog
        open={confirmandoMigracion}
        onOpenChange={(open) => {
          if (!migrando) setConfirmandoMigracion(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Migrar {productosSeleccionados.length} asociación(es) a v
              {rutaExistente?.versionActual}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Se conservarán las configuraciones de familias equivalentes. Las
              configuraciones de pasos eliminados se descartarán y los pasos
              nuevos quedarán señalados para completar en cada producto.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={migrando}
              onClick={() => setConfirmandoMigracion(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              loading={migrando}
              onClick={ejecutarMigracion}
            >
              Confirmar migración
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {rutaExistente && (
        <ConfirmacionDestructiva
          open={confirmandoBorrado}
          onOpenChange={setConfirmandoBorrado}
          titulo="Eliminar ruta"
          descripcion={
            <>
              Vas a eliminar la ruta <strong>{rutaExistente.nombre}</strong>.
            </>
          }
          impacto={
            productosAfectados > 0
              ? [
                  `Hay ${productosAfectados} producto(s) usando esta ruta.`,
                  "El backend rechaza el borrado si la ruta está en uso — primero quitala de los productos.",
                ]
              : ["La ruta y todos sus pasos se borran del catálogo."]
          }
          nombreItem={rutaExistente.nombre}
          accionLabel="Eliminar ruta"
          onConfirmar={ejecutarEliminar}
        />
      )}
    </div>
  );
}
