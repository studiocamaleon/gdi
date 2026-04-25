"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { PencilIcon, PlusIcon, Trash2Icon, WrenchIcon } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

const MODOS_CALCULO = [
  { value: "MONTO_FIJO_PLANO", label: "Monto fijo plano (puede tener zonas)" },
  { value: "PORCENTAJE_SOBRE_BASE", label: "% sobre base (subtotal/venta/costo)" },
  { value: "POR_UNIDAD_INPUT", label: "Por unidad de input ($/km, $/copia, etc.)" },
];

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

  const handleEliminar = async (c: CargoDirectoCatalogo) => {
    if (!confirm(`¿Eliminar cargo "${c.nombre}"?\nSi está en uso se marcará como inactivo.`)) return;
    try {
      await eliminarCargoDirecto(c.id);
      toast.success("Cargo eliminado");
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
                <Label htmlFor="modoCalculo">Modo de cálculo *</Label>
                <Select value={modoCalculo} onValueChange={(v) => setModoCalculo(v ?? "MONTO_FIJO_PLANO")}>
                  <SelectTrigger id="modoCalculo">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MODOS_CALCULO.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Modos de activación soportados</Label>
                <div className="flex flex-wrap gap-2">
                  {MODOS_ACTIVACION.map((m) => (
                    <label
                      key={m}
                      className="hover:bg-accent flex items-center gap-2 rounded border px-2 py-1 text-xs"
                    >
                      <input
                        type="checkbox"
                        checked={modosActivacion.includes(m)}
                        onChange={() => toggleModoActivacion(m)}
                      />
                      <span>{m}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="configJson">Config JSON</Label>
                <Textarea
                  id="configJson"
                  value={configJsonStr}
                  onChange={(e) => setConfigJsonStr(e.target.value)}
                  rows={6}
                  className="font-mono text-xs"
                  placeholder='{"monto": 5000, "zonas": [...]}'
                />
                <p className="text-muted-foreground text-xs">
                  Defaults según modo: MONTO_FIJO_PLANO → {"{monto: N}"} o {"{zonas: [...]}"};
                  PORCENTAJE_SOBRE_BASE → {"{porcentajeDefault: N, baseDeCalculo: 'SUBTOTAL'}"};
                  POR_UNIDAD_INPUT → {"{precioPorUnidad: N, unidad: 'km', inputCantidad: 'distanciaKm'}"}
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
            <p className="text-muted-foreground py-8 text-center text-sm">
              Sin cargos cargados. Creá el primero.
            </p>
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
                      <Badge variant="outline">{c.modoCalculo}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {c.modosActivacionSoportados.map((m) => (
                          <Badge key={m} variant="secondary" className="text-[10px]">
                            {m}
                          </Badge>
                        ))}
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
                        onClick={() => handleEliminar(c)}
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
    </div>
  );
}
