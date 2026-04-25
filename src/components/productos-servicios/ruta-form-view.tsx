"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  HistoryIcon,
  PlusIcon,
  SaveIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  actualizarRuta,
  crearRuta,
  eliminarRuta,
} from "@/lib/productos-servicios-api";
import type { CatalogoFamilias } from "@/lib/productos-servicios";

type Modo = "crear" | "editar";

interface RutaConPasos {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  versionActual: number;
  activo: boolean;
  pasos: Array<{ id: string; orden: number; familiaCodigo: string }>;
  versiones?: Array<{ version: number; cambios: string | null; createdAt: string }>;
  productosAlternativas?: Array<{
    id: string;
    nombre: string;
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
  /** ID interno solo del editor; null si es paso nuevo. */
  uiKey: string;
}

export function RutaFormView({ modo, rutaExistente, catalogoFamilias }: Props) {
  const router = useRouter();
  const [guardando, setGuardando] = React.useState(false);
  const [eliminando, setEliminando] = React.useState(false);

  const [codigo, setCodigo] = React.useState(rutaExistente?.codigo ?? "");
  const [nombre, setNombre] = React.useState(rutaExistente?.nombre ?? "");
  const [descripcion, setDescripcion] = React.useState(rutaExistente?.descripcion ?? "");
  const [activo, setActivo] = React.useState(rutaExistente?.activo ?? true);
  const [pasos, setPasos] = React.useState<PasoEditable[]>(
    rutaExistente?.pasos.map((p) => ({ familiaCodigo: p.familiaCodigo, uiKey: p.id })) ?? [],
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
    | { tipo: "CAMBIAR_ORDEN"; familia: string; antes: number; despues: number };

  const cambiosDetectados = React.useMemo<CambioTipado[]>(() => {
    if (modo === "crear") return [];
    const originales = pasosOriginales.current;
    const cambios: CambioTipado[] = [];
    const maxLen = Math.max(originales.length, pasos.length);
    for (let i = 0; i < maxLen; i++) {
      const orig = originales[i];
      const nuevo = pasos[i];
      if (!orig && nuevo) {
        cambios.push({ tipo: "AGREGAR_PASO", orden: i + 1, familia: nuevo.familiaCodigo });
        continue;
      }
      if (orig && !nuevo) {
        cambios.push({ tipo: "QUITAR_PASO", orden: i + 1, familia: orig.familiaCodigo });
        continue;
      }
      if (orig && nuevo && orig.familiaCodigo !== nuevo.familiaCodigo) {
        // Si la familia "nueva" en esta posición existe en otra posición original,
        // probablemente es un reorder — pero por simplicidad lo marcamos como CAMBIAR_FAMILIA.
        // El reorder verdadero requiere comparar conjuntos antes que posiciones.
        const eraEnOtraPosicion = originales.findIndex((p) => p.familiaCodigo === nuevo.familiaCodigo);
        if (eraEnOtraPosicion !== -1 && eraEnOtraPosicion !== i) {
          cambios.push({
            tipo: "CAMBIAR_ORDEN",
            familia: nuevo.familiaCodigo,
            antes: eraEnOtraPosicion + 1,
            despues: i + 1,
          });
        } else {
          cambios.push({
            tipo: "CAMBIAR_FAMILIA",
            orden: i + 1,
            antes: orig.familiaCodigo,
            despues: nuevo.familiaCodigo,
          });
        }
      }
    }
    return cambios;
  }, [pasos, modo]);

  const cambioEstructural = cambiosDetectados.length > 0;
  const productosAfectados = rutaExistente?.productosAlternativas?.length ?? 0;

  const [nuevaVersion, setNuevaVersion] = React.useState<boolean>(true);
  const [cambiosDescripcion, setCambiosDescripcion] = React.useState("");

  // Familias agrupadas por categoría para el selector
  const familiasPorCategoria = React.useMemo(() => {
    const map = new Map<string, typeof catalogoFamilias.familias>();
    for (const f of catalogoFamilias.familias) {
      const arr = map.get(f.categoria) ?? [];
      arr.push(f);
      map.set(f.categoria, arr);
    }
    return map;
  }, [catalogoFamilias]);

  const agregarPaso = () => {
    setPasos((prev) => [
      ...prev,
      { familiaCodigo: "pre_prensa", uiKey: `new-${Date.now()}-${Math.random()}` },
    ]);
  };

  const cambiarPaso = (idx: number, familiaCodigo: string) => {
    setPasos((prev) => prev.map((p, i) => (i === idx ? { ...p, familiaCodigo } : p)));
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
      }));
      if (modo === "crear") {
        const creado = (await crearRuta({
          codigo,
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
          pasos: cambioEstructural ? pasosPayload : undefined,
          nuevaVersion: cambioEstructural ? nuevaVersion : undefined,
          cambios: cambiosDescripcion || undefined,
        });
        toast.success(`Ruta "${nombre}" actualizada`);
      }
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error guardando");
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminar = async () => {
    if (!rutaExistente) return;
    if (!confirm(`¿Eliminar ruta "${rutaExistente.nombre}"?`)) return;
    setEliminando(true);
    try {
      await eliminarRuta(rutaExistente.id);
      toast.success("Ruta eliminada");
      router.push("/productos-servicios/rutas");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error eliminando");
      setEliminando(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <Link
          href="/productos-servicios/rutas"
          className="text-muted-foreground hover:text-foreground inline-flex items-center text-sm"
        >
          <ArrowLeftIcon className="mr-1 size-4" />
          Volver a Rutas
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {modo === "crear" ? "Nueva ruta" : `Editar ruta: ${rutaExistente?.nombre}`}
            </h1>
            {modo === "editar" && (
              <div className="text-muted-foreground mt-1 flex items-center gap-2 text-xs">
                <Badge variant="secondary">v{rutaExistente?.versionActual}</Badge>
                <span className="font-mono">{rutaExistente?.codigo}</span>
                {(rutaExistente?.productosAlternativas?.length ?? 0) > 0 && (
                  <span>
                    · usado por {rutaExistente?.productosAlternativas?.length} producto(s)
                  </span>
                )}
              </div>
            )}
          </div>
          {modo === "editar" && (
            <Switch checked={activo} onCheckedChange={setActivo} />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Identidad */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Identidad</CardTitle>
            <CardDescription>Código y nombre de la ruta reusable.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="codigo">Código *</Label>
              <Input
                id="codigo"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                disabled={modo === "editar"}
                placeholder="RUTA-TARJETA-DIGITAL-STD"
              />
            </div>
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
            {modo === "editar" && cambioEstructural && (
              <Card
                className={
                  productosAfectados > 0
                    ? "bg-orange-50 border-orange-300"
                    : "bg-yellow-50 border-yellow-200"
                }
              >
                <CardContent className="pt-4">
                  <p
                    className={
                      productosAfectados > 0
                        ? "text-orange-900 mb-2 text-sm font-semibold"
                        : "text-yellow-900 mb-2 text-sm font-medium"
                    }
                  >
                    {productosAfectados > 0
                      ? `⚠ Cambios estructurales con ${productosAfectados} producto(s) usando esta ruta`
                      : "Cambios estructurales detectados"}
                  </p>
                  <ul className="mb-3 ml-4 list-disc text-xs text-foreground/80 space-y-0.5">
                    {cambiosDetectados.map((c, idx) => (
                      <li key={idx}>
                        {c.tipo === "AGREGAR_PASO" &&
                          `Agregás paso ${c.orden}: ${c.familia}`}
                        {c.tipo === "QUITAR_PASO" &&
                          `Quitás paso ${c.orden}: ${c.familia}`}
                        {c.tipo === "CAMBIAR_FAMILIA" &&
                          `Paso ${c.orden}: ${c.antes} → ${c.despues}`}
                        {c.tipo === "CAMBIAR_ORDEN" &&
                          `${c.familia} cambia de paso ${c.antes} a ${c.despues}`}
                      </li>
                    ))}
                  </ul>
                  <p
                    className={
                      productosAfectados > 0
                        ? "text-orange-800 mb-3 text-xs"
                        : "text-yellow-800 mb-3 text-xs"
                    }
                  >
                    {productosAfectados > 0
                      ? `Recomendado: crear nueva versión. Patch in-place rompería los ${productosAfectados} producto(s) asociados.`
                      : "Recomendado: crear nueva versión para preservar trazabilidad histórica."}
                  </p>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={nuevaVersion}
                      onChange={(e) => setNuevaVersion(e.target.checked)}
                    />
                    <span>
                      Crear nueva versión (v{(rutaExistente?.versionActual ?? 0) + 1})
                    </span>
                  </label>
                  {!nuevaVersion && productosAfectados > 0 && (
                    <p className="mt-2 text-xs font-medium text-red-600">
                      ⚠ Patch in-place modificará los {productosAfectados} producto(s)
                      asociados sin aviso. Considerá crear nueva versión.
                    </p>
                  )}
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
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Pasos en orden</CardTitle>
                <CardDescription>
                  Cada paso es una familia del catálogo. El producto configura máquinas y
                  materiales después.
                </CardDescription>
              </div>
              <Button onClick={agregarPaso} variant="outline" size="sm">
                <PlusIcon className="mr-2 size-4" />
                Agregar paso
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {pasos.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center text-sm">
                Sin pasos. Agregá uno para arrancar.
              </p>
            ) : (
              pasos.map((paso, idx) => (
                <div
                  key={paso.uiKey}
                  className="bg-muted/30 flex items-center gap-2 rounded-md border p-2"
                >
                  <div className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                    {idx + 1}
                  </div>
                  <Select
                    value={paso.familiaCodigo}
                    onValueChange={(v) => cambiarPaso(idx, v ?? "pre_prensa")}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from(familiasPorCategoria.entries()).map(([catCodigo, fams]) => {
                        const cat = catalogoFamilias.categorias.find((c) => c.codigo === catCodigo);
                        return (
                          <SelectGroup key={catCodigo}>
                            <SelectLabel>{cat?.nombre ?? catCodigo}</SelectLabel>
                            {fams.map((f) => (
                              <SelectItem key={f.codigo} value={f.codigo}>
                                {f.nombre}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => moverPaso(idx, -1)}
                    disabled={idx === 0}
                  >
                    <ChevronUpIcon className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => moverPaso(idx, 1)}
                    disabled={idx === pasos.length - 1}
                  >
                    <ChevronDownIcon className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => eliminarPaso(idx)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <XIcon className="size-4" />
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Historial de versiones */}
        {modo === "editar" && (rutaExistente?.versiones?.length ?? 0) > 0 && (
          <Card className="lg:col-span-3">
            <CardHeader>
              <div className="flex items-center gap-2">
                <HistoryIcon className="size-4" />
                <CardTitle className="text-base">Historial de versiones</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                {rutaExistente?.versiones?.map((v) => (
                  <div key={v.version} className="bg-muted/50 flex items-center gap-2 rounded p-2">
                    <Badge variant="secondary">v{v.version}</Badge>
                    <span>{v.cambios ?? "sin descripción"}</span>
                    <span className="text-muted-foreground ml-auto text-xs">
                      {new Date(v.createdAt).toLocaleDateString("es-AR")}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="flex items-center justify-between">
        {modo === "editar" ? (
          <Button
            variant="destructive"
            onClick={handleEliminar}
            disabled={guardando || eliminando}
          >
            <Trash2Icon className="mr-2 size-4" />
            {eliminando ? "Eliminando..." : "Eliminar ruta"}
          </Button>
        ) : (
          <div />
        )}
        <Button onClick={handleGuardar} disabled={guardando || !codigo || !nombre} size="lg">
          <SaveIcon className="mr-2 size-4" />
          {guardando ? "Guardando..." : modo === "crear" ? "Crear ruta" : "Guardar cambios"}
        </Button>
      </div>
    </div>
  );
}
