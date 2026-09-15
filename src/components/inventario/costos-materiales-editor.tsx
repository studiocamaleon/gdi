"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  SaveIcon,
  PackageIcon,
  DollarSignIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Card, Chip, Input, Label, SearchField, Switch } from "@heroui/react";
import { ActionButton } from "@/components/design-system/action-button";
import { SelectField } from "@/components/design-system/select-field";
import theme from "@/components/design-system/theme.module.css";
import focus from "@/components/design-system/field-focus.module.css";
import layout from "@/components/design-system/list-page.module.css";
import materialStyles from "./materiales.module.css";
import s from "./costos-materiales.module.css";
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

type UnitDraft = {
  unidadStock: UnidadMateriaPrima;
  unidadCompra: UnidadMateriaPrima;
};

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
  const [precioDrafts, setPrecioDrafts] = React.useState<
    Record<string, string>
  >({});
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
        const patch: {
          id: string;
          unidadStock?: UnidadMateriaPrima;
          unidadCompra?: UnidadMateriaPrima;
        } = {
          id: materia.id,
        };
        if (draft.unidadStock !== base.unidadStock)
          patch.unidadStock = draft.unidadStock;
        if (draft.unidadCompra !== base.unidadCompra)
          patch.unidadCompra = draft.unidadCompra;
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
        error instanceof Error
          ? error.message
          : "No se pudieron guardar los costos.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section data-ui="heroui" className={`${theme.theme} ${layout.page}`}>
      <Link
        href="/inventario/materias-primas"
        className={materialStyles.backLink}
      >
        <ArrowLeftIcon size={14} /> Materiales
      </Link>
      <header className={layout.header}>
        <div>
          <h1>Editar costos de materiales</h1>
          <p className={layout.subtitle}>
            Precios de referencia por variante y unidades de consumo y compra
            por material.
          </p>
        </div>
        <ActionButton
          onPress={guardar}
          isPending={saving}
          isDisabled={saving || totalCambios === 0}
        >
          <SaveIcon size={16} />
          {saving
            ? "Guardando…"
            : `Guardar cambios${totalCambios > 0 ? ` (${totalCambios})` : ""}`}
        </ActionButton>
      </header>
      <Card className={layout.results}>
        <div className={layout.toolbar}>
          <SearchField
            aria-label="Buscar materiales y variantes"
            value={search}
            onChange={setSearch}
            className={materialStyles.search}
          >
            <SearchField.Group
              className={`${layout.searchGroup} ${focus.singleBorder}`}
            >
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="Buscar material, código o SKU…" />
            </SearchField.Group>
          </SearchField>
          <div className={materialStyles.toolbarEnd}>
            <span className={materialStyles.resultCount}>
              {materiasFiltradas.length} de {initialMateriasPrimas.length}{" "}
              materiales
            </span>
            <Switch
              size="sm"
              isSelected={soloConsumibles}
              onChange={setSoloConsumibles}
            >
              <Switch.Content>
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
                <Label>Solo consumibles</Label>
              </Switch.Content>
            </Switch>
          </div>
        </div>
        <p className={s.saveHint}>
          <DollarSignIcon size={15} aria-hidden />
          Los cambios se guardan juntos al presionar «Guardar cambios».
        </p>
        {materiasFiltradas.length === 0 ? (
          <div className={layout.empty}>
            <PackageIcon size={28} aria-hidden />
            <p>No hay materiales que coincidan con el filtro.</p>
          </div>
        ) : (
          <Table className={`${materialStyles.table} ${s.table}`}>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[38%]">Material / Variante</TableHead>
                <TableHead>Unidad de consumo</TableHead>
                <TableHead>Unidad de compra</TableHead>
                <TableHead className="w-[250px] text-right">
                  Precio de referencia
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {materiasFiltradas.map((materia) => {
                const unit = unitDrafts[materia.id];
                return (
                  <React.Fragment key={materia.id}>
                    <TableRow className={s.groupRow}>
                      <TableCell>
                        <div className={s.materialGroup}>
                          <PackageIcon size={18} aria-hidden />
                          <div>
                            <strong>{materia.nombre}</strong>
                            <span className="text-xs text-muted-foreground">
                              {materia.variantes.length} variante(s)
                              {materia.esConsumible ? " · consumible" : ""}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <SelectField
                          value={unit?.unidadStock ?? materia.unidadStock}
                          onChange={(value) =>
                            setUnitDrafts((prev) => ({
                              ...prev,
                              [materia.id]: {
                                unidadStock:
                                  (value as UnidadMateriaPrima) ??
                                  materia.unidadStock,
                                unidadCompra:
                                  prev[materia.id]?.unidadCompra ??
                                  materia.unidadCompra,
                              },
                            }))
                          }
                          aria-label={`Unidad de consumo de ${materia.nombre}`}
                          options={unidadMateriaPrimaItems}
                          className={s.unitSelect}
                        />
                      </TableCell>
                      <TableCell>
                        <SelectField
                          value={unit?.unidadCompra ?? materia.unidadCompra}
                          onChange={(value) =>
                            setUnitDrafts((prev) => ({
                              ...prev,
                              [materia.id]: {
                                unidadStock:
                                  prev[materia.id]?.unidadStock ??
                                  materia.unidadStock,
                                unidadCompra:
                                  (value as UnidadMateriaPrima) ??
                                  materia.unidadCompra,
                              },
                            }))
                          }
                          aria-label={`Unidad de compra de ${materia.nombre}`}
                          options={unidadMateriaPrimaItems}
                          className={s.unitSelect}
                        />
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
                          <TableCell className={s.variantName}>
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
                                    <Chip
                                      key={chip.key}
                                      size="sm"
                                      variant="soft"
                                      className={s.optionChip}
                                    >
                                      <span className="font-medium text-foreground/70">
                                        {chip.label}:
                                      </span>
                                      {chip.value}
                                    </Chip>
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
                            <div className={s.priceField}>
                              <span className="text-xs text-muted-foreground">
                                {variante.moneda || "ARS"}
                              </span>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                inputMode="decimal"
                                className={s.priceInput}
                                aria-label={`Precio de referencia de ${materia.nombre}, ${getVarianteDisplayName(materia, variante)}`}
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
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </section>
  );
}
