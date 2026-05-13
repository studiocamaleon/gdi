"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { PencilIcon, PlusIcon, Trash2Icon, WrenchIcon } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { HumanSelect, optionFromLabel } from "@/components/ui/human-select";
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
import { LabelConTooltip } from "@/components/ui/label-con-tooltip";
import { ConfirmacionDestructiva } from "@/components/ui/confirmacion-destructiva";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import {
  getLabel,
  modoActivacionLabels,
  modoCalculoCargoLabels,
} from "@/lib/labels-humanos";

const MODOS_CALCULO = ["MONTO_FIJO_PLANO", "PORCENTAJE_SOBRE_BASE", "POR_UNIDAD_INPUT"];
const MODOS_ACTIVACION = ["OBLIGATORIO", "OPCIONAL", "CONDICIONAL"];

export function CargosDirectosManager({ initialCargos }: { initialCargos: CargoDirectoCatalogo[] }) {
  const router = useRouter();
  const [editando, setEditando] = React.useState<CargoDirectoCatalogo | null>(null);
  const [openSheet, setOpenSheet] = React.useState(false);
  const [guardando, setGuardando] = React.useState(false);

  // Form state
  const [codigo, setCodigo] = React.useState("");
  const [nombre, setNombre] = React.useState("");
  const [descripcion, setDescripcion] = React.useState("");
  const [modoCalculo, setModoCalculo] = React.useState("MONTO_FIJO_PLANO");
  const [modosActivacion, setModosActivacion] = React.useState<string[]>(["OPCIONAL"]);
  const [configJsonStr, setConfigJsonStr] = React.useState("{}");

  const abrirNuevo = () => {
    setEditando(null);
    setCodigo("");
    setNombre("");
    setDescripcion("");
    setModoCalculo("MONTO_FIJO_PLANO");
    setModosActivacion(["OPCIONAL"]);
    setConfigJsonStr("{}");
    setOpenSheet(true);
  };

  const abrirEditar = (c: CargoDirectoCatalogo) => {
    setEditando(c);
    setCodigo(c.codigo);
    setNombre(c.nombre);
    setDescripcion(c.descripcion ?? "");
    setModoCalculo(c.modoCalculo);
    setModosActivacion(c.modosActivacionSoportados);
    setConfigJsonStr(JSON.stringify(c.configJson ?? {}, null, 2));
    setOpenSheet(true);
  };

  const handleGuardar = async () => {
    setGuardando(true);
    try {
      let configJson: Record<string, unknown> = {};
      try {
        configJson = JSON.parse(configJsonStr || "{}");
      } catch {
        toast.error("El JSON de configuración no es válido");
        setGuardando(false);
        return;
      }

      if (editando) {
        await actualizarCargoDirecto(editando.id, {
          nombre,
          descripcion: descripcion || undefined,
          modoCalculo: modoCalculo as "MONTO_FIJO_PLANO" | "PORCENTAJE_SOBRE_BASE" | "POR_UNIDAD_INPUT",
          modosActivacionSoportados: modosActivacion,
          configJson,
        });
        toast.success(`Cargo "${nombre}" actualizado`);
      } else {
        await crearCargoDirecto({
          codigo,
          nombre,
          descripcion: descripcion || undefined,
          modoCalculo: modoCalculo as "MONTO_FIJO_PLANO" | "PORCENTAJE_SOBRE_BASE" | "POR_UNIDAD_INPUT",
          modosActivacionSoportados: modosActivacion,
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

  const toggleModoActivacion = (m: string) => {
    setModosActivacion((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m],
    );
  };

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
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
                  ? "Editar los datos del cargo."
                  : "Crear un nuevo cargo en el catálogo del tenant."}
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-4 px-4">
              <div className="space-y-2">
                <Label htmlFor="codigo">Código *</Label>
                <Input
                  id="codigo"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  disabled={!!editando}
                  placeholder="recargo_urgencia"
                />
              </div>
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
                <LabelConTooltip
                  label="Modo de cálculo"
                  required
                  htmlFor="modoCalculo"
                  tooltip="Cómo se calcula el monto del cargo: monto fijo, porcentaje sobre subtotal, o precio por unidad de input."
                />
                <HumanSelect
                  id="modoCalculo"
                  value={modoCalculo}
                  onValueChange={(v) => setModoCalculo(v || "MONTO_FIJO_PLANO")}
                  options={MODOS_CALCULO.map((m) => optionFromLabel(m, modoCalculoCargoLabels))}
                />
                <p className="text-muted-foreground text-xs">
                  {getLabel(modoCalculoCargoLabels, modoCalculo).descripcion}
                </p>
              </div>
              <div className="space-y-2">
                <LabelConTooltip
                  label="¿Cuándo se aplica?"
                  tooltip="Marcá los modos de activación que el modelador podrá elegir cuando asocie este cargo a un producto/paso."
                />
                <div className="flex flex-wrap gap-2">
                  {MODOS_ACTIVACION.map((m) => {
                    const lbl = getLabel(modoActivacionLabels, m);
                    return (
                      <label
                        key={m}
                        className="hover:bg-accent flex items-center gap-2 rounded border px-2 py-1 text-xs"
                        title={lbl.descripcion}
                      >
                        <input
                          type="checkbox"
                          checked={modosActivacion.includes(m)}
                          onChange={() => toggleModoActivacion(m)}
                        />
                        <span>{lbl.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-2">
                <LabelConTooltip
                  label="Configuración (JSON)"
                  htmlFor="configJson"
                  tooltip="Valores default para este cargo. El formato depende del modo de cálculo elegido."
                />
                <Textarea
                  id="configJson"
                  value={configJsonStr}
                  onChange={(e) => setConfigJsonStr(e.target.value)}
                  rows={6}
                  className="font-mono text-xs"
                  placeholder={
                    modoCalculo === "MONTO_FIJO_PLANO"
                      ? '{"monto": 5000} o {"zonas": [{"codigo": "CABA", "monto": 3000}, ...]}'
                      : modoCalculo === "PORCENTAJE_SOBRE_BASE"
                        ? '{"porcentajeDefault": 30}'
                        : '{"precioPorUnidad": 80, "unidad": "km", "inputCantidad": "distanciaKm"}'
                  }
                />
                <p className="text-muted-foreground text-xs">
                  {modoCalculo === "MONTO_FIJO_PLANO" &&
                    "Ej. monto único: { monto: 500 }. Con zonas: { zonas: [{codigo, nombre, monto}, ...] }."}
                  {modoCalculo === "PORCENTAJE_SOBRE_BASE" &&
                    "Ej. { porcentajeDefault: 30 } aplica 30% sobre subtotal."}
                  {modoCalculo === "POR_UNIDAD_INPUT" &&
                    "Ej. { precioPorUnidad: 80, inputCantidad: 'distanciaKm' } cobra $80 × cantidad de km del JobContext."}
                </p>
              </div>
            </div>
            <SheetFooter>
              <Button variant="outline" onClick={() => setOpenSheet(false)}>
                Cancelar
              </Button>
              <Button onClick={handleGuardar} disabled={guardando || !nombre || !codigo}>
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
                  <TableHead>Código</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Modo cálculo</TableHead>
                  <TableHead>Modos activación</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {initialCargos.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs">{c.codigo}</TableCell>
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
                      <div className="flex flex-wrap gap-1">
                        {c.modosActivacionSoportados.map((m) => {
                          const lbl = getLabel(modoActivacionLabels, m);
                          return (
                            <Badge
                              key={m}
                              variant="secondary"
                              className="text-[10px]"
                              title={lbl.descripcion}
                            >
                              {lbl.label}
                            </Badge>
                          );
                        })}
                      </div>
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
