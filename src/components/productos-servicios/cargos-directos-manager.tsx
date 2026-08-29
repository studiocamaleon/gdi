"use client";

import * as React from "react";
import { formatearMoneda, type Moneda } from "@/lib/moneda";
import { useConfigRegional } from "@/components/navigation/config-regional-provider";
import { useRouter } from "next/navigation";
import {
  BadgeCheckIcon,
  CircleDollarSignIcon,
  Layers3Icon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  SparklesIcon,
  Trash2Icon,
  WrenchIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { HumanSelect } from "@/components/ui/human-select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  actualizarCargoDirecto,
  crearCargoDirecto,
  eliminarCargoDirecto,
} from "@/lib/productos-servicios-api";
import type { CargoDirectoCatalogo } from "@/lib/productos-servicios";
import { ConfirmacionDestructiva } from "@/components/ui/confirmacion-destructiva";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import {
  getLabel,
  modoActivacionLabels,
  modoCalculoCargoLabels,
} from "@/lib/labels-humanos";

import styles from "./cargos-directos-manager.module.css";

type CargoModoUi =
  | "MONTO_FIJO_PLANO"
  | "TABLA_IMPORTES"
  | "PORCENTAJE_SOBRE_BASE"
  | "POR_UNIDAD_INPUT";

type ZonaCargoDraft = {
  id: string;
  codigo: string;
  nombre: string;
  monto: string;
};

const MODOS_CARGO_UI: Array<{
  value: CargoModoUi;
  label: string;
  description: string;
}> = [
  {
    value: "MONTO_FIJO_PLANO",
    label: "Monto fijo editable",
    description:
      "Un importe sugerido reutilizable, con override opcional por paso u orden.",
  },
  {
    value: "TABLA_IMPORTES",
    label: "Tabla de importes / zonas",
    description: "Importes predefinidos por zona, destino o categoría.",
  },
  {
    value: "PORCENTAJE_SOBRE_BASE",
    label: "Porcentaje sobre subtotal",
    description:
      "Un porcentaje aplicado sobre la base del alcance: paso u orden.",
  },
  {
    value: "POR_UNIDAD_INPUT",
    label: "Por unidad",
    description: "Precio por kilómetro, bulto, hora, viaje u otra unidad.",
  },
];

const INPUT_CANTIDAD_OPTIONS = [
  { value: "distanciaKm", label: "Distancia", unit: "km" },
  { value: "bultos", label: "Bultos", unit: "bultos" },
  { value: "horas", label: "Horas", unit: "h" },
  { value: "viajes", label: "Viajes", unit: "viajes" },
  { value: "paradas", label: "Paradas", unit: "paradas" },
  { value: "cajas", label: "Cajas", unit: "cajas" },
  { value: "metrosLineales", label: "Metros lineales", unit: "m" },
  { value: "metrosCuadrados", label: "Metros cuadrados", unit: "m²" },
  { value: "pliegos", label: "Pliegos", unit: "pliegos" },
  { value: "hojas", label: "Hojas", unit: "hojas" },
  { value: "unidadesCargo", label: "Unidades", unit: "u" },
  { value: "coloresCargo", label: "Colores", unit: "colores" },
  { value: "archivosCargo", label: "Archivos", unit: "archivos" },
  { value: "rollosCargo", label: "Rollos", unit: "rollos" },
];

const UNIDAD_OPTIONS = [
  { value: "km", label: "Kilómetros" },
  { value: "bultos", label: "Bultos" },
  { value: "h", label: "Horas" },
  { value: "viajes", label: "Viajes" },
  { value: "paradas", label: "Paradas" },
  { value: "cajas", label: "Cajas" },
  { value: "u", label: "Unidades" },
  { value: "m", label: "Metros lineales" },
  { value: "m²", label: "Metros cuadrados" },
  { value: "pliegos", label: "Pliegos" },
  { value: "hojas", label: "Hojas" },
  { value: "colores", label: "Colores" },
  { value: "archivos", label: "Archivos" },
  { value: "rollos", label: "Rollos" },
];

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asNumberString(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? String(parsed) : "";
}

function modoUiFromCargo(cargo: CargoDirectoCatalogo): CargoModoUi {
  const config = asRecord(cargo.configJson);
  if (cargo.modoCalculo === "MONTO_FIJO_PLANO" && Array.isArray(config.zonas)) {
    return "TABLA_IMPORTES";
  }
  return cargo.modoCalculo as CargoModoUi;
}

function zonasFromConfig(config: Record<string, unknown>): ZonaCargoDraft[] {
  const zonas = Array.isArray(config.zonas) ? config.zonas : [];
  return zonas
    .map((zona, index) => {
      const item = asRecord(zona);
      return {
        id: `zona-${Date.now()}-${index}`,
        codigo: String(item.codigo ?? ""),
        nombre: String(item.nombre ?? ""),
        monto: asNumberString(item.monto),
      };
    })
    .filter((zona) => zona.codigo || zona.nombre || zona.monto);
}

function modoMotorFromUi(
  modo: CargoModoUi,
): "MONTO_FIJO_PLANO" | "PORCENTAJE_SOBRE_BASE" | "POR_UNIDAD_INPUT" {
  if (modo === "TABLA_IMPORTES") return "MONTO_FIJO_PLANO";
  return modo;
}

function slugifyCodigo(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 44);
  return normalized || "cargo";
}

function generarCodigoCargo(
  nombre: string,
  existentes: CargoDirectoCatalogo[],
) {
  const base = slugifyCodigo(nombre);
  const codigos = new Set(existentes.map((cargo) => cargo.codigo));
  if (!codigos.has(base)) return base;

  for (let index = 2; index < 1000; index += 1) {
    const suffix = `_${index}`;
    const candidate = `${base.slice(0, 50 - suffix.length)}${suffix}`;
    if (!codigos.has(candidate)) return candidate;
  }

  return `${base.slice(0, 37)}_${Date.now().toString(36)}`;
}

function formatConfigResumen(cargo: CargoDirectoCatalogo, moneda: Moneda) {
  const config = asRecord(cargo.configJson);
  if (cargo.modoCalculo === "MONTO_FIJO_PLANO") {
    const zonas = Array.isArray(config.zonas) ? config.zonas : [];
    if (zonas.length > 0)
      return `${zonas.length} importe${zonas.length === 1 ? "" : "s"}`;
    const monto = Number(config.monto ?? 0);
    return monto > 0
      ? formatearMoneda(monto, moneda, { decimales: 0 })
      : "Sin monto";
  }
  if (cargo.modoCalculo === "PORCENTAJE_SOBRE_BASE") {
    const pct = Number(config.porcentaje ?? config.porcentajeDefault ?? 0);
    return pct > 0 ? `${pct}% sobre subtotal` : "Sin porcentaje";
  }
  if (cargo.modoCalculo === "POR_UNIDAD_INPUT") {
    const precio = Number(config.precioPorUnidad ?? 0);
    const unidad = typeof config.unidad === "string" ? config.unidad : "";
    const formatted = formatearMoneda(precio, moneda, { decimales: 0 });
    return `${formatted}${unidad ? ` / ${unidad}` : ""}`;
  }
  return "Sin configuración";
}

export function CargosDirectosManager({
  initialCargos,
}: {
  initialCargos: CargoDirectoCatalogo[];
}) {
  const { moneda } = useConfigRegional();
  const router = useRouter();
  const [editando, setEditando] = React.useState<CargoDirectoCatalogo | null>(
    null,
  );
  const [openSheet, setOpenSheet] = React.useState(false);
  const [guardando, setGuardando] = React.useState(false);
  const [busqueda, setBusqueda] = React.useState("");

  // Form state
  const [codigo, setCodigo] = React.useState("");
  const [nombre, setNombre] = React.useState("");
  const [descripcion, setDescripcion] = React.useState("");
  const [modoCalculo, setModoCalculo] =
    React.useState<CargoModoUi>("MONTO_FIJO_PLANO");
  const [montoFijo, setMontoFijo] = React.useState("");
  const [zonas, setZonas] = React.useState<ZonaCargoDraft[]>([]);
  const [porcentaje, setPorcentaje] = React.useState("");
  const [precioPorUnidad, setPrecioPorUnidad] = React.useState("");
  const [inputCantidad, setInputCantidad] = React.useState("cantidad");
  const [unidad, setUnidad] = React.useState("");
  const [aplicaMargen, setAplicaMargen] = React.useState(true);
  const [modosActivacion, setModosActivacion] = React.useState<string[]>([
    "OBLIGATORIO",
    "OPCIONAL",
    "CONDICIONAL",
  ]);

  const abrirNuevo = () => {
    setEditando(null);
    setCodigo("");
    setNombre("");
    setDescripcion("");
    setModoCalculo("MONTO_FIJO_PLANO");
    setMontoFijo("");
    setZonas([]);
    setPorcentaje("");
    setPrecioPorUnidad("");
    setInputCantidad("cantidad");
    setUnidad("");
    setAplicaMargen(true);
    setModosActivacion(["OBLIGATORIO", "OPCIONAL", "CONDICIONAL"]);
    setOpenSheet(true);
  };

  const abrirEditar = (c: CargoDirectoCatalogo) => {
    const config = asRecord(c.configJson);
    setEditando(c);
    setCodigo(c.codigo);
    setNombre(c.nombre);
    setDescripcion(c.descripcion ?? "");
    setModoCalculo(modoUiFromCargo(c));
    setMontoFijo(asNumberString(config.monto));
    setZonas(zonasFromConfig(config));
    setPorcentaje(
      asNumberString(config.porcentaje ?? config.porcentajeDefault),
    );
    setPrecioPorUnidad(asNumberString(config.precioPorUnidad));
    setInputCantidad(
      typeof config.inputCantidad === "string"
        ? config.inputCantidad
        : "cantidad",
    );
    setUnidad(typeof config.unidad === "string" ? config.unidad : "");
    setAplicaMargen(c.aplicaMargen !== false);
    setModosActivacion(
      c.modosActivacionSoportados.length > 0
        ? c.modosActivacionSoportados
        : ["OBLIGATORIO", "OPCIONAL", "CONDICIONAL"],
    );
    setOpenSheet(true);
  };

  const handleGuardar = async () => {
    setGuardando(true);
    try {
      const nombreLimpio = nombre.trim();
      if (!nombreLimpio) {
        toast.error("Ingresá un nombre para el costo.");
        return;
      }
      if (modosActivacion.length === 0) {
        toast.error("Elegí al menos una forma de activación.");
        setGuardando(false);
        return;
      }
      let configJson: Record<string, unknown> = {};
      if (modoCalculo === "MONTO_FIJO_PLANO") {
        const monto = Number(montoFijo);
        if (!Number.isFinite(monto) || monto <= 0) {
          toast.error("Ingresá un monto fijo mayor a cero.");
          setGuardando(false);
          return;
        }
        configJson = { monto };
      }
      if (modoCalculo === "TABLA_IMPORTES") {
        const zonasValidas = zonas
          .map((zona) => ({
            codigo: zona.codigo.trim(),
            nombre: zona.nombre.trim(),
            monto: Number(zona.monto),
          }))
          .filter(
            (zona) =>
              zona.codigo &&
              zona.nombre &&
              Number.isFinite(zona.monto) &&
              zona.monto > 0,
          );
        if (zonasValidas.length === 0) {
          toast.error("Agregá al menos una zona con código, nombre y monto.");
          setGuardando(false);
          return;
        }
        if (
          new Set(zonasValidas.map((zona) => zona.codigo)).size !==
          zonasValidas.length
        ) {
          toast.error("Cada opción de la tabla necesita un código distinto.");
          return;
        }
        configJson = { zonas: zonasValidas };
      }
      if (modoCalculo === "PORCENTAJE_SOBRE_BASE") {
        const porcentajeValor = Number(porcentaje);
        if (!Number.isFinite(porcentajeValor) || porcentajeValor <= 0) {
          toast.error("Ingresá un porcentaje mayor a cero.");
          setGuardando(false);
          return;
        }
        configJson = {
          porcentajeDefault: porcentajeValor,
          baseDeCalculo: "SUBTOTAL",
        };
      }
      if (modoCalculo === "POR_UNIDAD_INPUT") {
        const precio = Number(precioPorUnidad);
        if (!Number.isFinite(precio) || precio <= 0) {
          toast.error("Ingresá un precio por unidad mayor a cero.");
          setGuardando(false);
          return;
        }
        if (!inputCantidad.trim()) {
          toast.error("Ingresá el nombre del dato a cargar.");
          setGuardando(false);
          return;
        }
        if (!unidad.trim()) {
          toast.error("Elegí la unidad que verá el comercial.");
          return;
        }
        configJson = {
          precioPorUnidad: precio,
          unidad: unidad.trim(),
          inputCantidad: inputCantidad.trim(),
        };
      }

      if (editando) {
        await actualizarCargoDirecto(editando.id, {
          nombre: nombreLimpio,
          descripcion: descripcion.trim() || undefined,
          modoCalculo: modoMotorFromUi(modoCalculo),
          modosActivacionSoportados: modosActivacion,
          aplicaMargen,
          configJson,
        });
        toast.success(`Cargo "${nombreLimpio}" actualizado`);
      } else {
        await crearCargoDirecto({
          codigo: generarCodigoCargo(nombreLimpio, initialCargos),
          nombre: nombreLimpio,
          descripcion: descripcion.trim() || undefined,
          modoCalculo: modoMotorFromUi(modoCalculo),
          modosActivacionSoportados: modosActivacion,
          aplicaMargen,
          configJson,
        });
        toast.success(`Cargo "${nombreLimpio}" creado`);
      }
      setOpenSheet(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error guardando");
    } finally {
      setGuardando(false);
    }
  };

  const [aBorrar, setABorrar] = React.useState<CargoDirectoCatalogo | null>(
    null,
  );

  const ejecutarBorrado = async () => {
    if (!aBorrar) return;
    try {
      await eliminarCargoDirecto(aBorrar.id);
      toast.success("Cargo eliminado");
      setABorrar(null);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    }
  };

  const addZona = () => {
    setZonas((current) => [
      ...current,
      { id: `zona-${Date.now()}`, codigo: "", nombre: "", monto: "" },
    ]);
  };

  const updateZona = (id: string, patch: Partial<ZonaCargoDraft>) => {
    setZonas((current) =>
      current.map((zona) => (zona.id === id ? { ...zona, ...patch } : zona)),
    );
  };

  const removeZona = (id: string) => {
    setZonas((current) => current.filter((zona) => zona.id !== id));
  };

  const cargosVisibles = React.useMemo(() => {
    const query = busqueda.trim().toLocaleLowerCase("es-AR");
    if (!query) return initialCargos;
    return initialCargos.filter((cargo) => {
      const modo = getLabel(modoCalculoCargoLabels, cargo.modoCalculo).label;
      return `${cargo.nombre} ${cargo.descripcion ?? ""} ${cargo.codigo} ${modo}`
        .toLocaleLowerCase("es-AR")
        .includes(query);
    });
  }, [busqueda, initialCargos]);

  const activos = initialCargos.filter((cargo) => cargo.activo).length;
  const conMargen = initialCargos.filter(
    (cargo) => cargo.activo && cargo.aplicaMargen,
  ).length;
  const modosConfigurados = new Set(
    initialCargos.map((cargo) => modoUiFromCargo(cargo)),
  ).size;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Estructura de costos</span>
          <h1>Costos directos</h1>
          <p>
            Desembolsos reutilizables que pueden asociarse a un paso o agregarse
            a una orden.
          </p>
        </div>
        <Sheet open={openSheet} onOpenChange={setOpenSheet}>
          <SheetTrigger
            render={(props) => (
              <Button
                {...props}
                className={styles.primaryAction}
                onClick={abrirNuevo}
              >
                <PlusIcon className="mr-2 size-4" />
                Nuevo costo
              </Button>
            )}
          />
          <SheetContent
            className={`${styles.sheet} overflow-y-auto sm:max-w-xl`}
            overlayClassName={styles.sheetOverlay}
          >
            <SheetHeader className={styles.sheetHeader}>
              <SheetTitle>
                {editando ? "Editar costo" : "Nuevo costo directo"}
              </SheetTitle>
              <SheetDescription>
                {editando
                  ? "Editá los valores sugeridos que se reutilizan en pasos y órdenes."
                  : "Creá una plantilla de costo para asociar a pasos u órdenes de trabajo."}
              </SheetDescription>
            </SheetHeader>
            <div className={`${styles.sheetBody} space-y-4 px-4`}>
              <Alert className={styles.scopeNotice}>
                <AlertTitle>El alcance se elige al asociarlo</AlertTitle>
                <AlertDescription>
                  Acá definís cómo se calcula. Después decidís si corresponde a
                  toda la cotización, a un paso o a un nivel del paso.
                </AlertDescription>
              </Alert>
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre *</Label>
                <Input
                  id="nombre"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Recargo por urgencia"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="descripcion">Descripción</Label>
                <Textarea
                  id="descripcion"
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="modoCalculo">Modo de cálculo *</Label>
                <HumanSelect
                  value={modoCalculo}
                  onValueChange={(value) =>
                    setModoCalculo((value ?? "MONTO_FIJO_PLANO") as CargoModoUi)
                  }
                  options={MODOS_CARGO_UI.map((modo) => ({
                    value: modo.value,
                    label: modo.label,
                    description: modo.description,
                  }))}
                  placeholder="Elegí cómo se calcula"
                />
                <p className="text-muted-foreground text-xs">
                  {
                    MODOS_CARGO_UI.find((modo) => modo.value === modoCalculo)
                      ?.description
                  }
                </p>
              </div>
              <div className="space-y-2">
                <Label>Formas de activación permitidas</Label>
                <div className="grid gap-2 sm:grid-cols-3">
                  {["OBLIGATORIO", "OPCIONAL", "CONDICIONAL"].map((modo) => (
                    <label
                      key={modo}
                      className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-xs"
                    >
                      <input
                        type="checkbox"
                        checked={modosActivacion.includes(modo)}
                        onChange={(event) =>
                          setModosActivacion((current) =>
                            event.target.checked
                              ? [...current, modo]
                              : current.filter((item) => item !== modo),
                          )
                        }
                      />
                      {getLabel(modoActivacionLabels, modo).label}
                    </label>
                  ))}
                </div>
              </div>

              <Field>
                <FieldLabel>Tratamiento comercial</FieldLabel>
                <ToggleGroup
                  multiple={false}
                  value={[aplicaMargen ? "con_margen" : "sin_margen"]}
                  onValueChange={(value) => {
                    const selected = value.at(-1);
                    if (selected) setAplicaMargen(selected === "con_margen");
                  }}
                  variant="outline"
                  className="grid w-full grid-cols-2"
                >
                  <ToggleGroupItem value="con_margen">
                    Aplicar margen
                  </ToggleGroupItem>
                  <ToggleGroupItem value="sin_margen">
                    Trasladar sin margen
                  </ToggleGroupItem>
                </ToggleGroup>
                <FieldDescription>
                  {aplicaMargen
                    ? "El costo integra la base sobre la que se calcula la utilidad del producto."
                    : "Se recupera completo después de impuestos internos y comisiones, pero no genera utilidad. El IVA y demás impuestos trasladables se agregan normalmente."}
                </FieldDescription>
              </Field>

              {modoCalculo === "MONTO_FIJO_PLANO" ? (
                <div className="space-y-2">
                  <Label htmlFor="montoFijo">Monto sugerido *</Label>
                  <Input
                    id="montoFijo"
                    type="number"
                    min="0"
                    value={montoFijo}
                    onChange={(event) => setMontoFijo(event.target.value)}
                    placeholder="5000"
                  />
                  <p className="text-muted-foreground text-xs">
                    Al asociarlo a un paso o cotización podés conservar este
                    valor o reemplazarlo.
                  </p>
                </div>
              ) : null}

              {modoCalculo === "TABLA_IMPORTES" ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <Label>Zonas o importes</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addZona}
                    >
                      <PlusIcon className="mr-2 size-3" />
                      Agregar zona
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {zonas.length === 0 ? (
                      <div className="text-muted-foreground rounded-md border border-dashed p-3 text-xs">
                        Agregá opciones como CABA, GBA Norte, Retiro en taller o
                        Fuera de zona.
                      </div>
                    ) : null}
                    {zonas.map((zona) => (
                      <div
                        key={zona.id}
                        className="grid grid-cols-[88px_1fr_96px_32px] gap-2"
                      >
                        <Input
                          value={zona.codigo}
                          onChange={(event) =>
                            updateZona(zona.id, { codigo: event.target.value })
                          }
                          placeholder="CABA"
                          aria-label="Código de zona"
                        />
                        <Input
                          value={zona.nombre}
                          onChange={(event) =>
                            updateZona(zona.id, { nombre: event.target.value })
                          }
                          placeholder="CABA"
                          aria-label="Nombre de zona"
                        />
                        <Input
                          type="number"
                          min="0"
                          value={zona.monto}
                          onChange={(event) =>
                            updateZona(zona.id, { monto: event.target.value })
                          }
                          placeholder="3000"
                          aria-label="Monto de zona"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeZona(zona.id)}
                          aria-label="Eliminar zona"
                        >
                          <Trash2Icon className="size-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {modoCalculo === "PORCENTAJE_SOBRE_BASE" ? (
                <div className="space-y-2">
                  <Label htmlFor="porcentaje">Porcentaje sugerido *</Label>
                  <Input
                    id="porcentaje"
                    type="number"
                    min="0"
                    step="0.1"
                    value={porcentaje}
                    onChange={(event) => setPorcentaje(event.target.value)}
                    placeholder="30"
                  />
                  <p className="text-muted-foreground text-xs">
                    La base será el costo del paso o el subtotal de la
                    cotización, según dónde lo asocies.
                  </p>
                </div>
              ) : null}

              {modoCalculo === "POR_UNIDAD_INPUT" ? (
                <div className="grid gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="inputCantidad">
                      Dato que cargará el comercial *
                    </Label>
                    <HumanSelect
                      value={inputCantidad}
                      onValueChange={(value) => {
                        const next = value ?? "";
                        setInputCantidad(next);
                        const option = INPUT_CANTIDAD_OPTIONS.find(
                          (item) => item.value === next,
                        );
                        if (option) setUnidad(option.unit);
                      }}
                      options={INPUT_CANTIDAD_OPTIONS.map((option) => ({
                        value: option.value,
                        label: option.label,
                        code: option.value,
                      }))}
                      placeholder="Elegí el dato"
                    />
                    <p className="text-muted-foreground text-xs">
                      Este dato se pedirá al aplicar el cargo en la OT.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="unidad">Unidad visible</Label>
                      <HumanSelect
                        value={unidad}
                        onValueChange={(value) => setUnidad(value ?? "")}
                        options={UNIDAD_OPTIONS}
                        placeholder="Elegí la unidad"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="precioPorUnidad">
                        Precio por unidad *
                      </Label>
                      <Input
                        id="precioPorUnidad"
                        type="number"
                        min="0"
                        value={precioPorUnidad}
                        onChange={(event) =>
                          setPrecioPorUnidad(event.target.value)
                        }
                        placeholder="80"
                      />
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
            <SheetFooter className={styles.sheetFooter}>
              <Button variant="outline" onClick={() => setOpenSheet(false)}>
                Cancelar
              </Button>
              <Button onClick={handleGuardar} disabled={guardando || !nombre}>
                {guardando
                  ? "Guardando..."
                  : editando
                    ? "Guardar cambios"
                    : "Crear"}
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </header>

      <section className={styles.metrics} aria-label="Resumen del catálogo">
        <article className={`${styles.metric} ${styles.metricPrimary}`}>
          <span className={styles.metricIcon} aria-hidden="true">
            <CircleDollarSignIcon />
          </span>
          <div>
            <span>Catálogo total</span>
            <strong>{initialCargos.length}</strong>
            <small>costos reutilizables</small>
          </div>
        </article>
        <article className={styles.metric}>
          <span className={styles.metricIcon} aria-hidden="true">
            <BadgeCheckIcon />
          </span>
          <div>
            <span>Activos</span>
            <strong>{activos}</strong>
            <small>disponibles para asociar</small>
          </div>
        </article>
        <article className={styles.metric}>
          <span className={styles.metricIcon} aria-hidden="true">
            <SparklesIcon />
          </span>
          <div>
            <span>Con margen</span>
            <strong>{conMargen}</strong>
            <small>generan utilidad comercial</small>
          </div>
        </article>
        <article className={styles.metric}>
          <span className={styles.metricIcon} aria-hidden="true">
            <Layers3Icon />
          </span>
          <div>
            <span>Formas de cálculo</span>
            <strong>{modosConfigurados}</strong>
            <small>modalidades configuradas</small>
          </div>
        </article>
      </section>

      <section className={styles.catalogPanel}>
        <header className={styles.catalogHeader}>
          <div className={styles.catalogIdentity}>
            <span className={styles.catalogIcon} aria-hidden="true">
              <WrenchIcon />
            </span>
            <div>
              <h2>Catálogo de costos</h2>
              <p>
                Definí una vez cómo se calcula cada desembolso y reutilizalo en
                productos y órdenes.
              </p>
            </div>
          </div>
          {initialCargos.length > 0 ? (
            <label className={styles.search}>
              <SearchIcon aria-hidden="true" />
              <span className="sr-only">Buscar costos directos</span>
              <input
                value={busqueda}
                onChange={(event) => setBusqueda(event.target.value)}
                placeholder="Buscar por nombre, código o cálculo…"
              />
            </label>
          ) : null}
        </header>

        <div className={styles.catalogBody}>
          {initialCargos.length === 0 ? (
            <EstadoVacio
              variant="compacto"
              icon={<WrenchIcon />}
              titulo="Sin costos directos"
              descripcion="Usalos para desembolsos como peajes, alquileres, matrices o servicios externos. El tiempo y la tercerización completa se modelan dentro del paso."
              cta={{
                label: "Nuevo costo",
                onClick: abrirNuevo,
                icon: PlusIcon,
              }}
            />
          ) : cargosVisibles.length === 0 ? (
            <div className={styles.noResults}>
              <SearchIcon aria-hidden="true" />
              <strong>No encontramos costos</strong>
              <span>Probá con otro nombre, código o modo de cálculo.</span>
            </div>
          ) : (
            <div className={styles.tableFrame}>
              <Table className={styles.table}>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Modo cálculo</TableHead>
                    <TableHead>Valor sugerido</TableHead>
                    <TableHead>Margen</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cargosVisibles.map((c) => (
                    <TableRow key={c.id} data-inactive={!c.activo || undefined}>
                      <TableCell className={styles.nameCell}>
                        <div className={styles.costIdentity}>
                          <span aria-hidden="true">
                            <CircleDollarSignIcon />
                          </span>
                          <strong>{c.nombre}</strong>
                        </div>
                        {c.descripcion && (
                          <div className={styles.description}>
                            {c.descripcion}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <span
                          className={styles.modePill}
                          title={
                            getLabel(modoCalculoCargoLabels, c.modoCalculo)
                              .descripcion
                          }
                        >
                          {
                            getLabel(modoCalculoCargoLabels, c.modoCalculo)
                              .label
                          }
                        </span>
                      </TableCell>
                      <TableCell className={styles.valueCell}>
                        {formatConfigResumen(c, moneda)}
                      </TableCell>
                      <TableCell>
                        <span
                          className={styles.marginPill}
                          data-margin={c.aplicaMargen ? "si" : "no"}
                        >
                          {c.aplicaMargen ? "Con margen" : "Sin margen"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span
                          className={styles.statusPill}
                          data-active={c.activo}
                        >
                          {c.activo ? "Activo" : "Inactivo"}
                        </span>
                      </TableCell>
                      <TableCell className={styles.actionsCell}>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className={styles.rowAction}
                          onClick={() => abrirEditar(c)}
                          aria-label={`Editar ${c.nombre}`}
                          title="Editar costo"
                        >
                          <PencilIcon />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setABorrar(c)}
                          className={`${styles.rowAction} ${styles.deleteAction}`}
                          aria-label={`Eliminar ${c.nombre}`}
                          title="Eliminar costo"
                        >
                          <Trash2Icon />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </section>

      <ConfirmacionDestructiva
        open={!!aBorrar}
        onOpenChange={(open) => !open && setABorrar(null)}
        titulo="Eliminar cargo del catálogo"
        descripcion={
          aBorrar ? (
            <>
              Vas a eliminar el cargo <strong>{aBorrar.nombre}</strong> del
              catálogo.
            </>
          ) : null
        }
        impacto={[
          "Si está asociado a productos, se marca como inactivo en vez de borrarse.",
          "Si no está en uso, se elimina definitivamente.",
        ]}
        nombreItem={aBorrar?.nombre}
        accionLabel="Eliminar cargo"
        onConfirmar={ejecutarBorrado}
      />
    </main>
  );
}
