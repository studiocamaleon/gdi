"use client";

/**
 * G-F3 — Editor mínimo de pasos extras inline del producto.
 *
 * Pasos extras NO son reusables: viven dentro del producto y se insertan
 * en la ruta heredada. Útil cuando un producto puntual necesita un paso
 * que no forma parte del esqueleto reusable de la ruta (ej. instalación
 * eléctrica luminosa solo en este cartel).
 *
 * UX: lista los pasos extras existentes + form para agregar uno nuevo
 * (familia + activación + tiempo). Configuración avanzada (slots,
 * máquinas, cargos) queda para iteraciones futuras — el comercial puede
 * configurar lo básico y refinar con el editor de la ruta si crece.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { agregarPasoExtra, eliminarPasoExtra } from "@/lib/productos-servicios-api";
import type { CatalogoFamilias, PasoExtra } from "@/lib/productos-servicios";

interface Props {
  productoId: string;
  pasosExtras: PasoExtra[];
  catalogoFamilias: CatalogoFamilias;
}

export function PasosExtrasPanel({ productoId, pasosExtras, catalogoFamilias }: Props) {
  const router = useRouter();
  const [familiaCodigo, setFamiliaCodigo] = React.useState("");
  const [modoActivacion, setModoActivacion] = React.useState<"OBLIGATORIO" | "OPCIONAL">("OBLIGATORIO");
  const [modoTiempo, setModoTiempo] = React.useState<"T-1" | "T-2">("T-2");
  const [agregando, setAgregando] = React.useState(false);

  const familias = catalogoFamilias.familias;
  const familiasPorCategoria = React.useMemo(() => {
    const map = new Map<string, typeof familias>();
    for (const f of familias) {
      const arr = map.get(f.categoria) ?? [];
      arr.push(f);
      map.set(f.categoria, arr);
    }
    return map;
  }, [familias]);

  const handleAgregar = async () => {
    if (!familiaCodigo) {
      toast.error("Elegí una familia");
      return;
    }
    setAgregando(true);
    try {
      await agregarPasoExtra(productoId, {
        familiaCodigo,
        modoActivacion,
        modoTiempo,
      });
      toast.success("Paso extra agregado");
      setFamiliaCodigo("");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error agregando paso");
    } finally {
      setAgregando(false);
    }
  };

  const handleEliminar = async (pasoExtraId: string, nombre: string) => {
    if (!confirm(`¿Eliminar paso extra "${nombre}"?`)) return;
    try {
      await eliminarPasoExtra(pasoExtraId);
      toast.success("Paso extra eliminado");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error eliminando");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pasos extras inline (G-F3)</CardTitle>
        <CardDescription>
          Pasos puntuales que solo este producto necesita y no forman parte de la ruta
          reusable. Útil para casos únicos (instalación especial, terminación a medida).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Lista actual */}
        {pasosExtras.length === 0 ? (
          <p className="text-muted-foreground text-sm italic">Sin pasos extras.</p>
        ) : (
          <div className="space-y-2">
            {pasosExtras.map((pe) => (
              <div
                key={pe.id}
                className="bg-muted/30 flex items-center justify-between gap-2 rounded border p-2 text-sm"
              >
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{pe.ordenInterno}</Badge>
                  <span className="font-medium">{pe.familiaCodigo}</span>
                  {pe.modoActivacion && (
                    <Badge variant="secondary" className="text-xs">
                      {pe.modoActivacion}
                    </Badge>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleEliminar(pe.id, pe.familiaCodigo)}
                  className="text-destructive hover:text-destructive size-7"
                >
                  <Trash2Icon className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Formulario de agregar */}
        <div className="border-t pt-4 space-y-3">
          <Label className="text-sm font-medium">Agregar nuevo paso extra</Label>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <div>
              <Label htmlFor="familia" className="text-xs text-muted-foreground">
                Familia
              </Label>
              <Select
                value={familiaCodigo}
                onValueChange={(v) => setFamiliaCodigo(v ?? "")}
              >
                <SelectTrigger id="familia">
                  <SelectValue placeholder="Elegí familia" />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  {Array.from(familiasPorCategoria.entries()).map(([categoria, fams]) => (
                    <React.Fragment key={categoria}>
                      <div className="text-muted-foreground px-2 py-1 text-xs uppercase">
                        {categoria}
                      </div>
                      {fams.map((f) => (
                        <SelectItem key={f.codigo} value={f.codigo}>
                          {f.nombre}
                        </SelectItem>
                      ))}
                    </React.Fragment>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="modoact" className="text-xs text-muted-foreground">
                Activación
              </Label>
              <Select
                value={modoActivacion}
                onValueChange={(v) =>
                  setModoActivacion((v ?? "OBLIGATORIO") as "OBLIGATORIO" | "OPCIONAL")
                }
              >
                <SelectTrigger id="modoact">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OBLIGATORIO">OBLIGATORIO</SelectItem>
                  <SelectItem value="OPCIONAL">OPCIONAL</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="modot" className="text-xs text-muted-foreground">
                Tiempo
              </Label>
              <Select
                value={modoTiempo}
                onValueChange={(v) => setModoTiempo((v ?? "T-2") as "T-1" | "T-2")}
              >
                <SelectTrigger id="modot">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="T-1">T-1 (fijo)</SelectItem>
                  <SelectItem value="T-2">T-2 (productividad propia)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={handleAgregar} disabled={agregando || !familiaCodigo} size="sm">
            <PlusIcon className="mr-2 size-4" />
            {agregando ? "Agregando..." : "Agregar paso extra"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
