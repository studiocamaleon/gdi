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
import { HumanSelect, optionFromLabel, type HumanSelectOption } from "@/components/ui/human-select";
import { Label } from "@/components/ui/label";
import { LabelConTooltip } from "@/components/ui/label-con-tooltip";
import { agregarPasoExtra, eliminarPasoExtra } from "@/lib/productos-servicios-api";
import type { CatalogoFamilias, PasoExtra } from "@/lib/productos-servicios";
import {
  categoriaFamiliaLabels,
  getLabel,
  modoActivacionLabels,
  modoTiempoLabels,
} from "@/lib/labels-humanos";

interface Props {
  productoId: string;
  pasosExtras: PasoExtra[];
  catalogoFamilias: CatalogoFamilias;
}

export function PasosExtrasPanel({ productoId, pasosExtras, catalogoFamilias }: Props) {
  const router = useRouter();
  const [familiaCodigo, setFamiliaCodigo] = React.useState("");
  const [modoActivacion, setModoActivacion] = React.useState<
    "OBLIGATORIO" | "OPCIONAL" | "CONDICIONAL"
  >("OBLIGATORIO");
  const [modoTiempo, setModoTiempo] = React.useState<"T-1" | "T-2" | "T-3" | "T-4">("T-2");
  const [agregando, setAgregando] = React.useState(false);

  const familias = catalogoFamilias.familias.filter(
    (familia) => familia.visibleEnSelector !== false,
  );
  const familiasPorCategoria = React.useMemo(() => {
    const map = new Map<string, typeof familias>();
    for (const f of familias) {
      const arr = map.get(f.categoria) ?? [];
      arr.push(f);
      map.set(f.categoria, arr);
    }
    return map;
  }, [familias]);
  const familiaSeleccionada = familias.find((f) => f.codigo === familiaCodigo);
  const familiaOptions = React.useMemo<HumanSelectOption[]>(() => {
    return Array.from(familiasPorCategoria.entries()).flatMap(([categoria, fams]) => {
      const lblCat = getLabel(categoriaFamiliaLabels, categoria);
      return fams.map((f) => ({
        value: f.codigo,
        label: f.nombre,
        code: f.codigo,
        description: f.descripcion,
        group: lblCat.label,
      }));
    });
  }, [familiasPorCategoria]);
  const modoActivacionOptions = (
    familiaSeleccionada?.modosActivacionSoportados ?? ["OBLIGATORIO", "OPCIONAL", "CONDICIONAL"]
  ).map((m) => optionFromLabel(m, modoActivacionLabels));
  const modoTiempoOptions = (
    familiaSeleccionada?.modosTiempoSoportados ?? ["T-1", "T-2", "T-3", "T-4"]
  ).map((m) => optionFromLabel(m, modoTiempoLabels));

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
            {pasosExtras.map((pe) => {
              const fam = familias.find((f) => f.codigo === pe.familiaCodigo);
              const lblAct = pe.modoActivacion
                ? getLabel(modoActivacionLabels, pe.modoActivacion)
                : null;
              return (
                <div
                  key={pe.id}
                  className="bg-muted/30 flex items-center justify-between gap-2 rounded border p-2 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{pe.ordenInterno}</Badge>
                    <span className="font-medium" title={pe.familiaCodigo}>
                      {fam?.nombre ?? pe.familiaCodigo}
                    </span>
                    {lblAct && (
                      <Badge
                        variant="secondary"
                        className="text-xs"
                        title={lblAct.descripcion}
                      >
                        {lblAct.label}
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
              );
            })}
          </div>
        )}

        {/* Formulario de agregar */}
        <div className="border-t pt-4 space-y-3">
          <Label className="text-sm font-medium">Agregar nuevo paso extra</Label>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <div className="space-y-1">
              <LabelConTooltip
                label="Familia"
                htmlFor="familia"
                tooltip="Tipo de operación (impresión, corte, laminado, encuadernación, etc.). Definí qué hace el paso, no qué máquina lo ejecuta."
              />
              <HumanSelect
                value={familiaCodigo}
                onValueChange={(v) => {
                  setFamiliaCodigo(v || "");
                  const fam = familias.find((f) => f.codigo === v);
                  if (fam?.modoActivacionDefault) {
                    setModoActivacion(
                      fam.modoActivacionDefault as "OBLIGATORIO" | "OPCIONAL" | "CONDICIONAL",
                    );
                  }
                }}
                options={familiaOptions}
                placeholder="Elegí familia"
                id="familia"
                contentClassName="max-h-80"
              />
            </div>
            <div className="space-y-1">
              <LabelConTooltip
                label="¿Cuándo se aplica?"
                htmlFor="modoact"
                tooltip={getLabel(modoActivacionLabels, modoActivacion).descripcion}
              />
              <HumanSelect
                value={modoActivacion}
                onValueChange={(v) =>
                  setModoActivacion(
                    (v || "OBLIGATORIO") as "OBLIGATORIO" | "OPCIONAL" | "CONDICIONAL",
                  )
                }
                options={modoActivacionOptions}
                id="modoact"
              />
            </div>
            <div className="space-y-1">
              <LabelConTooltip
                label="¿Cómo se calcula el tiempo?"
                htmlFor="modot"
                tooltip={getLabel(modoTiempoLabels, modoTiempo).descripcion}
                ejemplo={getLabel(modoTiempoLabels, modoTiempo).ejemplo}
              />
              <HumanSelect
                value={modoTiempo}
                onValueChange={(v) =>
                  setModoTiempo((v || "T-2") as "T-1" | "T-2" | "T-3" | "T-4")
                }
                options={modoTiempoOptions}
                id="modot"
              />
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
