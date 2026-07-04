"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, SaveIcon, SearchIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  bulkUpdateCostosMateriasPrimas,
  type BulkUpdateCostosPayload,
} from "@/lib/materias-primas-api";
import {
  type MateriaPrima,
  type UnidadMateriaPrima,
  unidadMateriaPrimaItems,
} from "@/lib/materias-primas";
import {
  getVarianteDisplayName,
  getVarianteOptionChips,
} from "@/lib/materias-primas-variantes-display";

interface Props {
  initialMateriasPrimas: MateriaPrima[];
}

type UnitDraft = { unidadStock: UnidadMateriaPrima; unidadCompra: UnidadMateriaPrima };

const unidadLabel = (value: string) =>
  unidadMateriaPrimaItems.find((item) => item.value === value)?.label ?? value;

/** "" para null; number → string sin ceros sobrantes. */
function precioToInput(precio: number | null): string {
  return precio === null || precio === undefined ? "" : String(precio);
}

function parsePrecio(value: string): number | null {
  const normalized = value.replace(",", ".").trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function CostosMaterialesEditor({ initialMateriasPrimas }: Props) {
  const router = useRouter();
  const [saving, setSaving] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [soloConsumibles, setSoloConsumibles] = React.useState(false);

  // Baseline: valores originales para calcular qué cambió.
  const baseline = React.useMemo(() => {
    const precios = new Map<string, number | null>();
    const unidades = new Map<string, UnitDraft>();
    for (const materia of initialMateriasPrimas) {
      unidades.set(materia.id, {
        unidadStock: materia.unidadStock,
        unidadCompra: materia.unidadCompra,
      });
      for (const variante of materia.variantes) {
        precios.set(variante.id, variante.precioReferencia);
      }
    }
    return { precios, unidades };
  }, [initialMateriasPrimas]);

  // Drafts editables (se re-siembran cuando cambia el baseline tras guardar).
  const [precioDrafts, setPrecioDrafts] = React.useState<Record<string, string>>(
    {},
  );
  const [unitDrafts, setUnitDrafts] = React.useState<Record<string, UnitDraft>>(
    {},
  );

  React.useEffect(() => {
    const precios: Record<string, string> = {};
    const unidades: Record<string, UnitDraft> = {};
    for (const materia of initialMateriasPrimas) {
      unidades[materia.id] = {
        unidadStock: materia.unidadStock,
        unidadCompra: materia.unidadCompra,
      };
      for (const variante of materia.variantes) {
        precios[variante.id] = precioToInput(variante.precioReferencia);
      }
    }
    setPrecioDrafts(precios);
    setUnitDrafts(unidades);
  }, [initialMateriasPrimas]);

  const materiasFiltradas = React.useMemo(() => {
    const text = search.trim().toLowerCase();
    return initialMateriasPrimas.filter((materia) => {
      if (soloConsumibles && !materia.esConsumible) return false;
      if (!text) return true;
      if (
        materia.nombre.toLowerCase().includes(text) ||
        materia.codigo.toLowerCase().includes(text)
      ) {
        return true;
      }
      return materia.variantes.some(
        (variante) =>
          variante.sku.toLowerCase().includes(text) ||
          variante.nombreVariante.toLowerCase().includes(text),
      );
    });
  }, [initialMateriasPrimas, search, soloConsumibles]);

  // Cálculo del payload de cambios (solo lo que difiere del baseline).
  const cambios = React.useMemo<BulkUpdateCostosPayload>(() => {
    const variantes: NonNullable<BulkUpdateCostosPayload["variantes"]> = [];
    const materiales: NonNullable<BulkUpdateCostosPayload["materiales"]> = [];

    for (const materia of initialMateriasPrimas) {
      const draft = unitDrafts[materia.id];
      const base = baseline.unidades.get(materia.id);
      if (draft && base) {
        const patch: { id: string; unidadStock?: UnidadMateriaPrima; unidadCompra?: UnidadMateriaPrima } = {
          id: materia.id,
        };
        if (draft.unidadStock !== base.unidadStock) patch.unidadStock = draft.unidadStock;
        if (draft.unidadCompra !== base.unidadCompra) patch.unidadCompra = draft.unidadCompra;
        if (patch.unidadStock || patch.unidadCompra) materiales.push(patch);
      }

      for (const variante of materia.variantes) {
        const raw = precioDrafts[variante.id];
        if (raw === undefined) continue;
        const parsed = parsePrecio(raw);
        const base = baseline.precios.get(variante.id) ?? null;
        // No podemos "borrar" un precio a null vía el endpoint; solo enviamos
        // valores válidos que cambian respecto al baseline.
        if (parsed !== null && parsed !== base) {
          variantes.push({ id: variante.id, precioReferencia: parsed });
        }
      }
    }
    return { variantes, materiales };
  }, [initialMateriasPrimas, precioDrafts, unitDrafts, baseline]);

  const totalCambios =
    (cambios.variantes?.length ?? 0) + (cambios.materiales?.length ?? 0);

  const guardar = async () => {
    if (totalCambios === 0) return;
    setSaving(true);
    try {
      const res = await bulkUpdateCostosMateriasPrimas(cambios);
      toast.success(
        `Costos actualizados: ${res.variantesActualizadas} precio(s), ${res.materialesActualizados} material(es).`,
      );
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudieron guardar los costos.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/inventario/materias-primas")}
              >
                <ArrowLeftIcon className="size-4" />
                Volver
              </Button>
              <CardTitle>Editar costos de materiales</CardTitle>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 rounded-md border px-3 py-1.5">
                <span className="text-xs text-muted-foreground">Solo consumibles</span>
                <Switch checked={soloConsumibles} onCheckedChange={setSoloConsumibles} />
              </div>
              <div className="relative">
                <SearchIcon className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="w-[240px] pl-8"
                  placeholder="Buscar material, SKU..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <Button onClick={guardar} loading={saving} disabled={totalCambios === 0} loadingText="Guardando...">
                <SaveIcon className="size-4" />
                Guardar cambios{totalCambios > 0 ? ` (${totalCambios})` : ""}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            Editá precios de referencia por variante y las unidades de consumo y
            compra por material, todo en una pantalla. Los cambios se guardan
            juntos al presionar «Guardar cambios».
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[38%]">Material / Variante</TableHead>
                <TableHead>Unidad de consumo</TableHead>
                <TableHead>Unidad de compra</TableHead>
                <TableHead className="w-[250px] text-right">Precio de referencia</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {materiasFiltradas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    No hay materiales que coincidan con el filtro.
                  </TableCell>
                </TableRow>
              ) : (
                materiasFiltradas.map((materia) => {
                  const unit = unitDrafts[materia.id];
                  return (
                    <React.Fragment key={materia.id}>
                      <TableRow className="bg-muted/40">
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium">{materia.nombre}</span>
                            <span className="text-xs text-muted-foreground">
                              {materia.variantes.length} variante(s)
                              {materia.esConsumible ? " · consumible" : ""}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={unit?.unidadStock ?? materia.unidadStock}
                            onValueChange={(value) =>
                              setUnitDrafts((prev) => ({
                                ...prev,
                                [materia.id]: {
                                  unidadStock: (value as UnidadMateriaPrima) ?? materia.unidadStock,
                                  unidadCompra:
                                    prev[materia.id]?.unidadCompra ?? materia.unidadCompra,
                                },
                              }))
                            }
                          >
                            <SelectTrigger className="h-8 w-[150px]">
                              <SelectValue>
                                {unidadLabel(unit?.unidadStock ?? materia.unidadStock)}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {unidadMateriaPrimaItems.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={unit?.unidadCompra ?? materia.unidadCompra}
                            onValueChange={(value) =>
                              setUnitDrafts((prev) => ({
                                ...prev,
                                [materia.id]: {
                                  unidadStock:
                                    prev[materia.id]?.unidadStock ?? materia.unidadStock,
                                  unidadCompra: (value as UnidadMateriaPrima) ?? materia.unidadCompra,
                                },
                              }))
                            }
                          >
                            <SelectTrigger className="h-8 w-[150px]">
                              <SelectValue>
                                {unidadLabel(unit?.unidadCompra ?? materia.unidadCompra)}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {unidadMateriaPrimaItems.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell />
                      </TableRow>
                      {materia.variantes.map((variante) => {
                        const chips = getVarianteOptionChips(materia, variante, {
                          maxDimensiones: 6,
                        });
                        const nombre = variante.nombreVariante?.trim();
                        return (
                        <TableRow key={variante.id}>
                          <TableCell className="pl-8">
                            <div className="flex flex-col gap-1">
                              {nombre ? (
                                <span className="text-sm">{nombre}</span>
                              ) : chips.length === 0 ? (
                                <span className="text-sm text-muted-foreground">
                                  {getVarianteDisplayName(materia, variante)}
                                </span>
                              ) : null}
                              {chips.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {chips.map((chip) => (
                                    <span
                                      key={chip.key}
                                      className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] text-muted-foreground"
                                    >
                                      <span className="font-medium text-foreground/70">
                                        {chip.label}:
                                      </span>
                                      {chip.value}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {variante.unidadStock
                              ? unidadLabel(variante.unidadStock)
                              : "— (usa la del material)"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {variante.unidadCompra
                              ? unidadLabel(variante.unidadCompra)
                              : "— (usa la del material)"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <span className="text-xs text-muted-foreground">
                                {variante.moneda || "ARS"}
                              </span>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                inputMode="decimal"
                                className="h-8 w-[110px] text-right"
                                placeholder="—"
                                value={precioDrafts[variante.id] ?? ""}
                                onChange={(event) =>
                                  setPrecioDrafts((prev) => ({
                                    ...prev,
                                    [variante.id]: event.target.value,
                                  }))
                                }
                              />
                              <span className="w-[64px] text-left text-xs text-muted-foreground">
                                /{" "}
                                {unidadLabel(
                                  variante.unidadCompra ??
                                    unit?.unidadCompra ??
                                    materia.unidadCompra,
                                )}
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                        );
                      })}
                    </React.Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
