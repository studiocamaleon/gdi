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

import {
  Card,
  Checkbox,
  Chip,
  Input,
  Modal,
  Switch,
  TextArea as Textarea,
} from "@heroui/react";
import { ActionButton as Button } from "@/components/design-system/action-button";
import { FormDialog } from "@/components/design-system/form-dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { useDesignScope } from "@/components/design-system/appearance";
import theme from "@/components/design-system/theme.module.css";
import listPage from "@/components/design-system/list-page.module.css";
import focus from "@/components/design-system/field-focus.module.css";
import shared from "./flujos.module.css";
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
  const scope = useDesignScope();
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
      toast.error("El flujo debe tener al menos un nodo o una etapa");
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
        toast.success(`Flujo "${nombre}" creado`);
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
        toast.success(`Flujo "${nombre}" actualizado`);
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
  const [textoConfirmacion, setTextoConfirmacion] = React.useState("");
  React.useEffect(() => {
    if (!confirmandoBorrado) setTextoConfirmacion("");
  }, [confirmandoBorrado]);

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
      toast.success("Flujo eliminado");
      setConfirmandoBorrado(false);
      router.push("/productos-servicios/rutas");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error eliminando");
      setEliminando(false);
    }
  };

  return (
    <main {...scope} className={`${theme.theme} ${listPage.page}`}>
      <Link href="/productos-servicios/rutas" className={styles.backLink}>
        <ArrowLeftIcon className="size-4" />
        Flujos de producción
      </Link>
      <header className={listPage.header}>
        <div>
          <h1>
            {modo === "crear"
              ? "Nuevo flujo"
              : (rutaExistente?.nombre ?? "Editar flujo")}
          </h1>
          <div className={`${listPage.subtitle} ${styles.subtitle}`}>
            {modo === "editar" ? (
              <>
                <Chip size="sm" variant="soft">
                  v{rutaExistente?.versionActual}
                </Chip>
                {(rutaExistente?.productosAlternativas?.length ?? 0) > 0
                  ? `Usado por ${rutaExistente?.productosAlternativas?.length} producto(s)`
                  : "Flujo reutilizable · Secuencia y configuración de producción"}
              </>
            ) : (
              "Organizá las operaciones y sus conexiones para reutilizarlas en tus productos."
            )}
          </div>
        </div>
        {modo === "editar" && (
          <Switch
            id="ruta-activa"
            aria-label="Flujo activo"
            isSelected={activo}
            onChange={setActivo}
            size="sm"
          >
            <Switch.Content>
              <span>Flujo activo</span>
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
            </Switch.Content>
          </Switch>
        )}
      </header>
      <div className={styles.editor}>
        <div className={styles.routeColumns}>
          <Card className={styles.identityCard}>
            <Card.Header className={styles.identityHeader}>
              <span className={styles.identityIcon} aria-hidden="true">
                <RouteIcon />
              </span>
              <div className={styles.identityCopy}>
                <span className={styles.eyebrow}>Flujo reutilizable</span>
                <Card.Title>Identidad</Card.Title>
                <Card.Description>
                  Definí cómo se reconocerá este flujo en el catálogo y al
                  incorporarlo a un producto.
                </Card.Description>
              </div>
            </Card.Header>
            <Card.Content className={styles.identityContent}>
              <FieldGroup className={styles.fieldGroup}>
                <Field>
                  <FieldLabel htmlFor="nombre">
                    Nombre <span className={styles.required}>*</span>
                  </FieldLabel>
                  <Input
                    className={focus.singleBorder}
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
                    className={focus.singleBorder}
                    id="descripcion"
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                    rows={3}
                    placeholder="Explicá brevemente cuándo conviene usar este flujo."
                  />
                </Field>
              </FieldGroup>
              {modo === "editar" && requiereVersionadoPorUso && (
                <Card className={styles.versionNotice}>
                  <Card.Content className="pt-4">
                    <p className="mb-2 text-sm font-semibold">
                      ⚠ Cambios en un flujo usado por {productosAfectados}{" "}
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
                          Cambia la estructura del flujo de producción, sus
                          paralelismos o sus componentes fabricados.
                        </li>
                      ) : null}
                      {cambioIconos ? (
                        <li>Cambian íconos de uno o más pasos.</li>
                      ) : null}
                    </ul>
                    <p className="mb-3 text-xs">
                      Se creará obligatoriamente la versión v
                      {(rutaExistente?.versionActual ?? 0) + 1}. Los productos
                      asociados conservarán su versión actual hasta que elijas
                      migrarlos desde esta ficha.
                    </p>
                    <Input
                      className={`${focus.singleBorder} mt-2`}
                      value={cambiosDescripcion}
                      onChange={(e) => setCambiosDescripcion(e.target.value)}
                      placeholder="Descripción del cambio (opcional, queda en el historial)"
                    />
                  </Card.Content>
                </Card>
              )}
            </Card.Content>
          </Card>

          <div className={styles.workflowSlot}>
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
          <Card className={styles.history}>
            <Card.Header className={styles.sectionHeader}>
              <span className="inline-flex items-center gap-2">
                <HistoryIcon className="size-4" />
                <strong>Historial de versiones</strong>
              </span>
            </Card.Header>
            {rutaExistente!.versiones?.map((v) => (
              <div key={v.version} className={styles.versionRow}>
                <Chip size="sm" variant="soft">
                  v{v.version}
                </Chip>
                <span className={styles.versionName}>
                  {v.version === 1 &&
                  productosAfectados === 0 &&
                  v.cambios?.startsWith("Copia de ")
                    ? "Versión inicial"
                    : v.cambios === "Actualización del Workflow"
                      ? "Actualización del flujo de producción"
                      : (v.cambios ?? "Versión inicial")}
                </span>
                <span className={styles.versionDate}>
                  {fechaNumerica(v.createdAt)}
                </span>
              </div>
            ))}
          </Card>
        )}

        {modo === "editar" && productosDesactualizados.length > 0 ? (
          <Card className={styles.migration}>
            <Card.Header className={styles.sectionHeader}>
              <Card.Title>Productos en versiones anteriores</Card.Title>
              <Card.Description>
                Elegí qué asociaciones querés llevar a la versión v
                {rutaExistente?.versionActual}. Se preserva la configuración de
                los pasos cuya familia continúa en la nueva versión.
              </Card.Description>
            </Card.Header>
            <Card.Content className="flex flex-col gap-3">
              {productosDesactualizados.map((alternativa) => {
                const checked = productosSeleccionados.includes(alternativa.id);
                const checkboxId = `migrar-ruta-${alternativa.id}`;
                return (
                  <Checkbox
                    key={alternativa.id}
                    id={checkboxId}
                    isSelected={checked}
                    className={styles.productChoice}
                    onChange={(next) =>
                      setProductosSeleccionados((actuales) =>
                        next
                          ? [...new Set([...actuales, alternativa.id])]
                          : actuales.filter((id) => id !== alternativa.id),
                      )
                    }
                  >
                    <Checkbox.Content>
                      <Checkbox.Control>
                        <Checkbox.Indicator />
                      </Checkbox.Control>
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate font-medium">
                          {alternativa.producto.nombre}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {alternativa.nombre} · v{alternativa.rutaVersion} → v
                          {rutaExistente?.versionActual}
                        </span>
                      </span>
                    </Checkbox.Content>
                  </Checkbox>
                );
              })}
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  isDisabled={productosSeleccionados.length === 0}
                  onClick={() => setConfirmandoMigracion(true)}
                >
                  <RefreshCwIcon data-icon="inline-start" />
                  Migrar seleccionados ({productosSeleccionados.length})
                </Button>
              </div>
            </Card.Content>
          </Card>
        ) : null}

        <div className={styles.actionsBar}>
          {modo === "editar" ? (
            <Button
              type="button"
              variant="danger-soft"
              onClick={() => setConfirmandoBorrado(true)}
              isDisabled={guardando || eliminando}
            >
              <Trash2Icon className="size-4" />
              {eliminando ? "Eliminando..." : "Eliminar flujo"}
            </Button>
          ) : (
            <div />
          )}
          <span className={styles.actionsCopy}>
            {modo === "crear"
              ? "Se guardará como V1 y quedará disponible para reutilizarlo en distintos productos."
              : (rutaExistente?.productosAlternativas?.length ?? 0) === 0
                ? "Los cambios se aplican sobre este flujo. Todavía no está asociado a productos."
                : `Los cambios estructurales crearán automáticamente v${
                    (rutaExistente?.versionActual ?? 1) + 1
                  } para preservar los productos existentes.`}
          </span>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/productos-servicios/rutas")}
            isDisabled={guardando || eliminando}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleGuardar}
            isDisabled={guardando || !nombre || workflow.nodos.length === 0}
          >
            <SaveIcon className="size-4" />
            {guardando
              ? "Guardando..."
              : modo === "crear"
                ? "Crear flujo"
                : "Guardar cambios"}
          </Button>
        </div>
      </div>

      <FormDialog
        isOpen={confirmandoMigracion}
        isDismissable={!migrando}
        onOpenChange={(open) => {
          if (!migrando) setConfirmandoMigracion(open);
        }}
        title={
          <>
            Migrar {productosSeleccionados.length} asociación(es) a v
            {rutaExistente?.versionActual}
          </>
        }
        description="Se conservarán las configuraciones de familias equivalentes. Las configuraciones de pasos eliminados se descartarán y los pasos nuevos quedarán señalados para completar en cada producto."
      >
        <Modal.Footer className={shared.dialogFooter}>
          <Button
            variant="outline"
            isDisabled={migrando}
            onPress={() => setConfirmandoMigracion(false)}
          >
            Cancelar
          </Button>
          <Button
            isPending={migrando}
            isDisabled={migrando}
            onPress={ejecutarMigracion}
          >
            Confirmar migración
          </Button>
        </Modal.Footer>
      </FormDialog>
      {rutaExistente && (
        <FormDialog
          isOpen={confirmandoBorrado}
          isDismissable={!eliminando}
          onOpenChange={setConfirmandoBorrado}
          title="Eliminar flujo"
          description={
            <>
              Vas a eliminar el flujo <strong>{rutaExistente.nombre}</strong>.
            </>
          }
        >
          <Modal.Body className={shared.dialogBody}>
            <div className={shared.dangerNote}>
              <strong>Esto va a:</strong>
              <ul className="mt-1 ml-4 list-disc">
                {(productosAfectados > 0
                  ? [
                      `Hay ${productosAfectados} producto(s) usando este flujo.`,
                      "Primero quitá el flujo de los productos que lo usan para poder eliminarlo.",
                    ]
                  : ["El flujo y todos sus nodos se borran del catálogo."]
                ).map((impacto) => (
                  <li key={impacto}>{impacto}</li>
                ))}
              </ul>
            </div>
            <Field className="mt-4">
              <FieldLabel htmlFor="confirmacion-flujo">
                Para confirmar, escribí {rutaExistente.nombre} abajo:
              </FieldLabel>
              <Input
                className={focus.singleBorder}
                id="confirmacion-flujo"
                value={textoConfirmacion}
                onChange={(event) => setTextoConfirmacion(event.target.value)}
                placeholder={rutaExistente.nombre}
                autoFocus
                autoComplete="off"
                spellCheck={false}
              />
            </Field>
          </Modal.Body>
          <Modal.Footer className={shared.dialogFooter}>
            <Button
              variant="outline"
              isDisabled={eliminando}
              onPress={() => setConfirmandoBorrado(false)}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              isPending={eliminando}
              isDisabled={
                eliminando ||
                textoConfirmacion.trim() !== rutaExistente.nombre.trim()
              }
              onPress={() => {
                if (
                  !eliminando &&
                  textoConfirmacion.trim() === rutaExistente.nombre.trim()
                )
                  void ejecutarEliminar();
              }}
            >
              Eliminar flujo
            </Button>
          </Modal.Footer>
        </FormDialog>
      )}
    </main>
  );
}
