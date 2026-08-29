"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFecha } from "@/components/navigation/config-regional-provider";
import {
  ArrowLeftIcon,
  BookOpenIcon,
  CircleDotIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  FactoryIcon,
  HistoryIcon,
  LayersIcon,
  LayoutDashboardIcon,
  ListChecksIcon,
  PackageIcon,
  PaintbrushIcon,
  PlusIcon,
  PrinterIcon,
  RefreshCwIcon,
  SaveIcon,
  ScissorsIcon,
  ShieldCheckIcon,
  SunIcon,
  Trash2Icon,
  TruckIcon,
  WrenchIcon,
  XIcon,
  ZapIcon,
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
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  HumanSelect,
  type HumanSelectOption,
} from "@/components/ui/human-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmacionDestructiva } from "@/components/ui/confirmacion-destructiva";
import { FamiliasCapacidadesSheet } from "@/components/productos-servicios/familias-capacidades-sheet";
import {
  actualizarRuta,
  crearRuta,
  eliminarRuta,
  migrarProductosRuta,
} from "@/lib/productos-servicios-api";
import type { CatalogoFamilias } from "@/lib/productos-servicios";

type Modo = "crear" | "editar";
type IconComponent = React.ComponentType<React.SVGProps<SVGSVGElement>>;

const STEP_ICONS = [
  { key: "Layout", label: "Diseño", icon: LayoutDashboardIcon },
  { key: "Layers", label: "Capas", icon: LayersIcon },
  { key: "Printer", label: "Impresión", icon: PrinterIcon },
  { key: "Plot", label: "Plotter", icon: FactoryIcon },
  { key: "Cut", label: "Corte", icon: ScissorsIcon },
  { key: "Scissors", label: "Tijeras", icon: ScissorsIcon },
  { key: "Brush", label: "Acabado", icon: PaintbrushIcon },
  { key: "Stamp", label: "Troquel", icon: CircleDotIcon },
  { key: "Fold", label: "Plegado", icon: LayersIcon },
  { key: "Cnc", label: "CNC", icon: FactoryIcon },
  { key: "Beam", label: "Láser", icon: ZapIcon },
  { key: "Book", label: "Encuadernación", icon: BookOpenIcon },
  { key: "Tool", label: "Herramienta", icon: WrenchIcon },
  { key: "Shield", label: "QA", icon: ShieldCheckIcon },
  { key: "Package", label: "Empaque", icon: PackageIcon },
  { key: "Truck", label: "Despacho", icon: TruckIcon },
  { key: "Wrench", label: "Instalación", icon: WrenchIcon },
  { key: "Sun", label: "Secado", icon: SunIcon },
] satisfies Array<{ key: string; label: string; icon: IconComponent }>;

const STEP_ICON_BY_KEY = Object.fromEntries(
  STEP_ICONS.map((item) => [item.key, item.icon]),
) as Record<string, IconComponent>;

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

function getStepIcon(icono?: string | null) {
  return STEP_ICON_BY_KEY[icono ?? ""] ?? LayoutDashboardIcon;
}

function IconoPasoPicker({
  value,
  onChange,
}: {
  value?: string | null;
  onChange: (value: string) => void;
}) {
  const selected = STEP_ICONS.find((item) => item.key === value);
  const label = selected?.label ?? "Diseño";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="route-step-icon-trigger"
            title={`Ícono: ${label}`}
            aria-label={`Elegir ícono del paso. Actual: ${label}`}
          />
        }
      >
        {React.createElement(getStepIcon(value))}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="route-step-icon-menu">
        <div className="route-step-icon-grid" aria-label="Íconos disponibles">
          {STEP_ICONS.map((item) => {
            const Icon = item.icon;
            const active = value === item.key;
            return (
              <DropdownMenuItem
                key={item.key}
                className={`route-step-icon-option ${active ? "on" : ""}`}
                onClick={() => onChange(item.key)}
              >
                <Icon />
                <span>{item.label}</span>
              </DropdownMenuItem>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
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
  const [familiasOpen, setFamiliasOpen] = React.useState(false);

  const [nombre, setNombre] = React.useState(rutaExistente?.nombre ?? "");
  const [descripcion, setDescripcion] = React.useState(
    rutaExistente?.descripcion ?? "",
  );
  const [activo, setActivo] = React.useState(rutaExistente?.activo ?? true);
  const [pasos, setPasos] = React.useState<PasoEditable[]>(
    rutaExistente?.pasos.map((p) => ({
      familiaCodigo: p.familiaCodigo,
      nombreVisible: p.nombreVisible ?? "",
      icono: p.icono ?? getDefaultStepIcon(p.familiaCodigo),
      uiKey: p.id,
    })) ?? [],
  );

  // Diff respecto a inicial: detectar cambio estructural (heurística)
  const pasosOriginales = React.useRef(rutaExistente?.pasos ?? []);

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
    const originales = pasosOriginales.current;
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
  }, [pasos, modo]);

  const cambioEstructural = cambiosDetectados.length > 0;
  const cambioIconos = React.useMemo(() => {
    if (modo === "crear") return false;
    return pasos.some((paso) => {
      const original = pasosOriginales.current.find(
        (item) => item.id === paso.uiKey,
      );
      if (!original) return false;
      return (
        (original.icono ?? getDefaultStepIcon(original.familiaCodigo)) !==
        paso.icono
      );
    });
  }, [modo, pasos]);
  const cambioNombres = React.useMemo(() => {
    if (modo === "crear") return false;
    return pasos.some((paso) => {
      const original = pasosOriginales.current.find(
        (item) => item.id === paso.uiKey,
      );
      if (!original) return false;
      return (
        (original.nombreVisible?.trim() ?? "") !== paso.nombreVisible.trim()
      );
    });
  }, [modo, pasos]);
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

  // Familias agrupadas por categoría para el selector
  const familiasPorCategoria = React.useMemo(() => {
    const map = new Map<string, typeof catalogoFamilias.familias>();
    const familiasUsadas = new Set(pasos.map((paso) => paso.familiaCodigo));
    for (const f of catalogoFamilias.familias.filter(
      (familia) =>
        familia.visibleEnSelector !== false ||
        familiasUsadas.has(familia.codigo),
    )) {
      const arr = map.get(f.categoria) ?? [];
      arr.push(f);
      map.set(f.categoria, arr);
    }
    return map;
  }, [catalogoFamilias, pasos]);

  const familiaNombre = React.useCallback(
    (codigo: string): string => {
      return (
        catalogoFamilias.familias.find((f) => f.codigo === codigo)?.nombre ??
        codigo
      );
    },
    [catalogoFamilias],
  );

  const familiaOptions = React.useMemo<HumanSelectOption[]>(() => {
    // Los pasos creados por la empresa van PRIMERO en su propio grupo, igual
    // que en el selector de pasos extra: si alguien creó "Serigrafía manual"
    // es para usarla en rutas, no para bucearla entre las del catálogo.
    const propios: HumanSelectOption[] = [];
    const sistema: HumanSelectOption[] = [];
    for (const [catCodigo, fams] of familiasPorCategoria.entries()) {
      const cat = catalogoFamilias.categorias.find(
        (c) => c.codigo === catCodigo,
      );
      for (const f of fams) {
        if (f.origen === "tenant") {
          propios.push({
            value: f.codigo,
            label: f.nombre,
            description: f.descripcion,
            group: "Tus pasos",
          });
        } else {
          sistema.push({
            value: f.codigo,
            label: f.nombre,
            code: f.codigo,
            description: f.descripcion,
            group: cat?.nombre ?? catCodigo,
          });
        }
      }
    }
    return [...propios, ...sistema];
  }, [catalogoFamilias.categorias, familiasPorCategoria]);

  const agregarPaso = () => {
    setPasos((prev) => [
      ...prev,
      {
        familiaCodigo: "pre_prensa",
        nombreVisible: "",
        icono: getDefaultStepIcon("pre_prensa"),
        uiKey: `new-${Date.now()}-${Math.random()}`,
      },
    ]);
  };

  const cambiarPaso = (idx: number, familiaCodigo: string) => {
    setPasos((prev) =>
      prev.map((p, i) => {
        if (i !== idx) return p;
        const icono =
          p.icono === getDefaultStepIcon(p.familiaCodigo)
            ? getDefaultStepIcon(familiaCodigo)
            : p.icono;
        return { ...p, familiaCodigo, icono };
      }),
    );
  };

  const cambiarIconoPaso = (idx: number, icono: string) => {
    setPasos((prev) => prev.map((p, i) => (i === idx ? { ...p, icono } : p)));
  };

  const cambiarNombrePaso = (idx: number, nombreVisible: string) => {
    setPasos((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, nombreVisible } : p)),
    );
  };

  const eliminarPaso = (idx: number) => {
    setPasos((prev) => prev.filter((_, i) => i !== idx));
  };

  const moverPaso = (idx: number, dir: -1 | 1) => {
    setPasos((prev) => {
      const newPasos = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= newPasos.length) return prev;
      [newPasos[idx], newPasos[target]] = [newPasos[target], newPasos[idx]];
      return newPasos;
    });
  };

  const handleGuardar = async () => {
    if (pasos.length === 0) {
      toast.error("La ruta debe tener al menos 1 paso");
      return;
    }
    setGuardando(true);
    try {
      const pasosPayload = pasos.map((p, idx) => ({
        orden: idx + 1,
        familiaCodigo: p.familiaCodigo,
        nombreVisible: p.nombreVisible.trim() || null,
        icono: p.icono,
      }));
      if (modo === "crear") {
        const creado = (await crearRuta({
          nombre,
          descripcion: descripcion || undefined,
          pasos: pasosPayload,
        })) as { id: string };
        toast.success(`Ruta "${nombre}" creada`);
        router.push(`/productos-servicios/rutas/${creado.id}`);
      } else {
        await actualizarRuta(rutaExistente!.id, {
          nombre,
          descripcion: descripcion || undefined,
          activo,
          pasos:
            cambioEstructural || cambioIconos || cambioNombres
              ? pasosPayload
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
        <div className="route-cols">
          {/* Identidad */}
          <Card className="wiz-section">
            <CardHeader>
              <CardTitle>Identidad</CardTitle>
              <CardDescription>Nombre de la ruta reusable.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre *</Label>
                <Input
                  id="nombre"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Tarjeta digital standard"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="descripcion">Descripción</Label>
                <Textarea
                  id="descripcion"
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  rows={3}
                />
              </div>
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

          {/* Pasos */}
          <Card className="wiz-section">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Pasos en orden</CardTitle>
                  <CardDescription>
                    Cada paso es una familia del catálogo. El producto configura
                    máquinas y materiales después.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => setFamiliasOpen(true)}
                    variant="outline"
                    size="sm"
                  >
                    <ListChecksIcon className="mr-2 size-4" />
                    Ver familias
                  </Button>
                  <Button onClick={agregarPaso} variant="outline" size="sm">
                    <PlusIcon className="mr-2 size-4" />
                    Agregar paso
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {pasos.length === 0 ? (
                <p className="section-empty">
                  Sin pasos. Agregá uno para arrancar.
                </p>
              ) : (
                pasos.map((paso, idx) => (
                  <div key={paso.uiKey} className="step-row">
                    <div className="step-num">{idx + 1}</div>
                    <IconoPasoPicker
                      value={paso.icono}
                      onChange={(icono) => cambiarIconoPaso(idx, icono)}
                    />
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      <HumanSelect
                        value={paso.familiaCodigo}
                        onValueChange={(v) =>
                          cambiarPaso(idx, v || "pre_prensa")
                        }
                        options={familiaOptions}
                        triggerClassName="w-full"
                        contentClassName="max-h-80"
                      />
                      <Field>
                        <FieldLabel
                          htmlFor={`nombre-paso-${paso.uiKey}`}
                          className="sr-only"
                        >
                          Nombre personalizado del paso {idx + 1}
                        </FieldLabel>
                        <Input
                          id={`nombre-paso-${paso.uiKey}`}
                          value={paso.nombreVisible}
                          maxLength={120}
                          onChange={(event) =>
                            cambiarNombrePaso(idx, event.target.value)
                          }
                          placeholder={`Nombre personalizado (opcional) · ${familiaNombre(paso.familiaCodigo)}`}
                        />
                      </Field>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => moverPaso(idx, -1)}
                      disabled={idx === 0}
                      aria-label={`Subir paso ${idx + 1}`}
                    >
                      <ChevronUpIcon className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => moverPaso(idx, 1)}
                      disabled={idx === pasos.length - 1}
                      aria-label={`Bajar paso ${idx + 1}`}
                    >
                      <ChevronDownIcon className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => eliminarPaso(idx)}
                      className="text-red-600 hover:text-red-700"
                      aria-label={`Eliminar paso ${idx + 1}`}
                    >
                      <XIcon className="size-4" />
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

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
            {modo === "editar" &&
            (rutaExistente?.productosAlternativas?.length ?? 0) === 0
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
            disabled={guardando || !nombre}
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

      <FamiliasCapacidadesSheet
        catalogoFamilias={catalogoFamilias}
        open={familiasOpen}
        onOpenChange={setFamiliasOpen}
      />
    </div>
  );
}
