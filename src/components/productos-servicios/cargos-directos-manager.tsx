"use client";

import * as React from "react";
import { formatearMoneda, type Moneda } from "@/lib/moneda";
import { useConfigRegional } from "@/components/navigation/config-regional-provider";
import { useRouter } from "next/navigation";
import { PencilIcon, PlusIcon, Trash2Icon, WrenchIcon } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { getLabel, modoCalculoCargoLabels } from "@/lib/labels-humanos";

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

const MODOS_CARGO_UI: Array<{ value: CargoModoUi; label: string; description: string }> = [
  {
    value: "MONTO_FIJO_PLANO",
    label: "Monto fijo editable",
    description: "Un importe sugerido que el comercial puede ajustar al agregarlo a la OT.",
  },
  {
    value: "TABLA_IMPORTES",
    label: "Tabla de importes / zonas",
    description: "Importes predefinidos por zona, destino o categoría.",
  },
  {
    value: "PORCENTAJE_SOBRE_BASE",
    label: "Porcentaje sobre subtotal",
    description: "Un porcentaje aplicado sobre el subtotal neto de productos.",
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
];

const UNIDAD_OPTIONS = [
  { value: "km", label: "Kilómetros" },
  { value: "bultos", label: "Bultos" },
  { value: "h", label: "Horas" },
  { value: "viajes", label: "Viajes" },
  { value: "paradas", label: "Paradas" },
  { value: "cajas", label: "Cajas" },
  { value: "u", label: "Unidades" },
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

function generarCodigoCargo(nombre: string, existentes: CargoDirectoCatalogo[]) {
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

function selectClassName() {
  return "border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none";
}

function formatConfigResumen(cargo: CargoDirectoCatalogo, moneda: Moneda) {
  const config = asRecord(cargo.configJson);
  if (cargo.modoCalculo === "MONTO_FIJO_PLANO") {
    const zonas = Array.isArray(config.zonas) ? config.zonas : [];
    if (zonas.length > 0) return `${zonas.length} importe${zonas.length === 1 ? "" : "s"}`;
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

export function CargosDirectosManager({ initialCargos }: { initialCargos: CargoDirectoCatalogo[] }) {
  const { moneda } = useConfigRegional();
  const router = useRouter();
  const [editando, setEditando] = React.useState<CargoDirectoCatalogo | null>(null);
  const [openSheet, setOpenSheet] = React.useState(false);
  const [guardando, setGuardando] = React.useState(false);

  // Form state
  const [codigo, setCodigo] = React.useState("");
  const [nombre, setNombre] = React.useState("");
  const [descripcion, setDescripcion] = React.useState("");
  const [modoCalculo, setModoCalculo] = React.useState<CargoModoUi>("MONTO_FIJO_PLANO");
  const [montoFijo, setMontoFijo] = React.useState("");
  const [zonas, setZonas] = React.useState<ZonaCargoDraft[]>([]);
  const [porcentaje, setPorcentaje] = React.useState("");
  const [precioPorUnidad, setPrecioPorUnidad] = React.useState("");
  const [inputCantidad, setInputCantidad] = React.useState("cantidad");
  const [unidad, setUnidad] = React.useState("");

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
    setPorcentaje(asNumberString(config.porcentaje ?? config.porcentajeDefault));
    setPrecioPorUnidad(asNumberString(config.precioPorUnidad));
    setInputCantidad(typeof config.inputCantidad === "string" ? config.inputCantidad : "cantidad");
    setUnidad(typeof config.unidad === "string" ? config.unidad : "");
    setOpenSheet(true);
  };

  const handleGuardar = async () => {
    setGuardando(true);
    try {
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
          .filter((zona) => zona.codigo && zona.nombre && Number.isFinite(zona.monto) && zona.monto > 0);
        if (zonasValidas.length === 0) {
          toast.error("Agregá al menos una zona con código, nombre y monto.");
          setGuardando(false);
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
          baseDeCalculo: "SUBTOTAL_PRODUCTOS",
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
        configJson = {
          precioPorUnidad: precio,
          unidad: unidad.trim(),
          inputCantidad: inputCantidad.trim(),
        };
      }

      if (editando) {
        await actualizarCargoDirecto(editando.id, {
          nombre,
          descripcion: descripcion || undefined,
          modoCalculo: modoMotorFromUi(modoCalculo),
          modosActivacionSoportados: ["OPCIONAL"],
          configJson,
        });
        toast.success(`Cargo "${nombre}" actualizado`);
      } else {
        await crearCargoDirecto({
          codigo: generarCodigoCargo(nombre, initialCargos),
          nombre,
          descripcion: descripcion || undefined,
          modoCalculo: modoMotorFromUi(modoCalculo),
          modosActivacionSoportados: ["OPCIONAL"],
          configJson,
        });
        toast.success(`Cargo "${nombre}" creado`);
      }
      setOpenSheet(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error guardando");
    } finally {
      setGuardando(false);
    }
  };

  const [aBorrar, setABorrar] = React.useState<CargoDirectoCatalogo | null>(null);

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

  return (
    <div className="flex-1 min-h-0 space-y-6 overflow-y-auto p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cargos directos</h1>
          <p className="text-muted-foreground text-sm">
            Catálogo de cargos directos del tenant. Se asocian a productos a nivel paso o cotización.
          </p>
        </div>
        <Sheet open={openSheet} onOpenChange={setOpenSheet}>
          <SheetTrigger
            render={(props) => (
              <Button {...props} onClick={abrirNuevo}>
                <PlusIcon className="mr-2 size-4" />
                Nuevo cargo
              </Button>
            )}
          />
          <SheetContent>
            <SheetHeader>
              <SheetTitle>{editando ? "Editar cargo" : "Nuevo cargo directo"}</SheetTitle>
              <SheetDescription>
                {editando
                  ? "Editá los valores sugeridos que luego podrá aplicar el comercial."
                  : "Creá una plantilla de cargo para usarla en órdenes de trabajo."}
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-4 px-4">
              {editando ? (
                <div className="space-y-2">
                  <Label htmlFor="codigo">Código del sistema</Label>
                  <Input id="codigo" value={codigo} disabled />
                  <p className="text-muted-foreground text-xs">
                    Se generó automáticamente al crear el cargo.
                  </p>
                </div>
              ) : null}
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
                <select
                  id="modoCalculo"
                  value={modoCalculo}
                  onChange={(event) => setModoCalculo(event.target.value as CargoModoUi)}
                  className={selectClassName()}
                >
                  {MODOS_CARGO_UI.map((modo) => (
                    <option key={modo.value} value={modo.value}>
                      {modo.label}
                    </option>
                  ))}
                </select>
                <p className="text-muted-foreground text-xs">
                  {MODOS_CARGO_UI.find((modo) => modo.value === modoCalculo)?.description}
                </p>
              </div>

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
                    Al aplicarlo en una OT, el comercial puede ajustar este importe.
                  </p>
                </div>
              ) : null}

              {modoCalculo === "TABLA_IMPORTES" ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <Label>Zonas o importes</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addZona}>
                      <PlusIcon className="mr-2 size-3" />
                      Agregar zona
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {zonas.length === 0 ? (
                      <div className="text-muted-foreground rounded-md border border-dashed p-3 text-xs">
                        Agregá opciones como CABA, GBA Norte, Retiro en taller o Fuera de zona.
                      </div>
                    ) : null}
                    {zonas.map((zona) => (
                      <div key={zona.id} className="grid grid-cols-[88px_1fr_96px_32px] gap-2">
                        <Input
                          value={zona.codigo}
                          onChange={(event) => updateZona(zona.id, { codigo: event.target.value })}
                          placeholder="CABA"
                          aria-label="Código de zona"
                        />
                        <Input
                          value={zona.nombre}
                          onChange={(event) => updateZona(zona.id, { nombre: event.target.value })}
                          placeholder="CABA"
                          aria-label="Nombre de zona"
                        />
                        <Input
                          type="number"
                          min="0"
                          value={zona.monto}
                          onChange={(event) => updateZona(zona.id, { monto: event.target.value })}
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
                    Se aplica sobre el subtotal neto de productos de la OT.
                  </p>
                </div>
              ) : null}

              {modoCalculo === "POR_UNIDAD_INPUT" ? (
                <div className="grid gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="inputCantidad">Dato que cargará el comercial *</Label>
                    <select
                      id="inputCantidad"
                      value={inputCantidad}
                      onChange={(event) => {
                        const next = event.target.value;
                        setInputCantidad(next);
                        const option = INPUT_CANTIDAD_OPTIONS.find((item) => item.value === next);
                        if (option) setUnidad(option.unit);
                      }}
                      className={selectClassName()}
                    >
                      {INPUT_CANTIDAD_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <p className="text-muted-foreground text-xs">
                      Este dato se pedirá al aplicar el cargo en la OT.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="unidad">Unidad visible</Label>
                      <select
                        id="unidad"
                        value={unidad}
                        onChange={(event) => setUnidad(event.target.value)}
                        className={selectClassName()}
                      >
                        {UNIDAD_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="precioPorUnidad">Precio por unidad *</Label>
                      <Input
                        id="precioPorUnidad"
                        type="number"
                        min="0"
                        value={precioPorUnidad}
                        onChange={(event) => setPrecioPorUnidad(event.target.value)}
                        placeholder="80"
                      />
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
            <SheetFooter>
              <Button variant="outline" onClick={() => setOpenSheet(false)}>
                Cancelar
              </Button>
              <Button onClick={handleGuardar} disabled={guardando || !nombre}>
                {guardando ? "Guardando..." : editando ? "Guardar cambios" : "Crear"}
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <WrenchIcon className="size-5" />
            <CardTitle>Catálogo</CardTitle>
          </div>
          <CardDescription>{initialCargos.length} cargos directos.</CardDescription>
        </CardHeader>
        <CardContent>
          {initialCargos.length === 0 ? (
            <EstadoVacio
              variant="compacto"
              icon={<WrenchIcon />}
              titulo="Sin cargos cargados"
              descripcion="Los cargos directos son extras que se aplican al cotizar (viático, recargo urgencia, tercerización). Empezá creando el primero."
              cta={{ label: "Nuevo cargo", onClick: abrirNuevo, icon: PlusIcon }}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Modo cálculo</TableHead>
                  <TableHead>Valor sugerido</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {initialCargos.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="font-medium">{c.nombre}</div>
                      {c.descripcion && (
                        <div className="text-muted-foreground text-xs">{c.descripcion}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        title={getLabel(modoCalculoCargoLabels, c.modoCalculo).descripcion}
                      >
                        {getLabel(modoCalculoCargoLabels, c.modoCalculo).label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{formatConfigResumen(c, moneda)}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={c.activo ? "default" : "secondary"}>
                        {c.activo ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => abrirEditar(c)}>
                        <PencilIcon className="size-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setABorrar(c)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2Icon className="size-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ConfirmacionDestructiva
        open={!!aBorrar}
        onOpenChange={(open) => !open && setABorrar(null)}
        titulo="Eliminar cargo del catálogo"
        descripcion={
          aBorrar ? (
            <>
              Vas a eliminar el cargo <strong>{aBorrar.nombre}</strong>{" "}
              (<code className="text-xs">{aBorrar.codigo}</code>) del catálogo del tenant.
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
    </div>
  );
}
