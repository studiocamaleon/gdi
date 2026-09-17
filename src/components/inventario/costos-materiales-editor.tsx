"use client";

import * as React from "react";
import {
  useDesignScope,
  useDesignTheme,
} from "@/components/design-system/appearance";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  SaveIcon,
  PackageIcon,
  DollarSignIcon,
  LayersIcon,
  SlidersHorizontalIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Card, Label, SearchField, Switch } from "@heroui/react";
import { ActionButton } from "@/components/design-system/action-button";
import { ListMetric } from "@/components/design-system/list-metric";
import focus from "@/components/design-system/field-focus.module.css";
import layout from "@/components/design-system/list-page.module.css";
import materialStyles from "./materiales.module.css";
import s from "./costos-materiales.module.css";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { bulkUpdateCostosMateriasPrimas } from "@/lib/materias-primas-api";
import {
  type MateriaPrima,
  type UnidadMateriaPrima,
} from "@/lib/materias-primas";
import { useConfigRegional } from "@/components/navigation/config-regional-provider";
import {
  materialUnitColumns,
  type MaterialUnitDraft,
} from "@/lib/material-unit-drafts";
import {
  buildMaterialCostChanges,
  changeMaterialCostUnit,
  changeMaterialVariantCost,
  type MaterialCostDraft,
  type MaterialVariantCostDraft,
} from "@/lib/material-cost-drafts";
import { MaterialCostRows } from "./costos-materiales-rows";

interface Props {
  initialMateriasPrimas: MateriaPrima[];
}

export function CostosMaterialesEditor({ initialMateriasPrimas }: Props) {
  const { moneda } = useConfigRegional();
  const scope = useDesignScope();
  const themeClass = useDesignTheme();
  const router = useRouter();
  const [saving, setSaving] = React.useState(false);
  const [drafts, setDrafts] = React.useState<Record<string, MaterialCostDraft>>(
    {},
  );
  const [search, setSearch] = React.useState("");
  const deferredSearch = React.useDeferredValue(search);
  const [soloConsumibles, setSoloConsumibles] = React.useState(false);

  React.useEffect(() => {
    setDrafts({});
  }, [initialMateriasPrimas]);

  const changeUnit = React.useCallback(
    (
      material: MateriaPrima,
      key: keyof MaterialUnitDraft,
      value: UnidadMateriaPrima,
    ) => {
      setDrafts((previous) => ({
        ...previous,
        [material.id]: changeMaterialCostUnit(
          material,
          previous[material.id] ?? {},
          key,
          value,
        ),
      }));
    },
    [],
  );

  const changeVariant = React.useCallback(
    (
      materialId: string,
      variantId: string,
      patch: MaterialVariantCostDraft,
    ) => {
      setDrafts((previous) => ({
        ...previous,
        [materialId]: changeMaterialVariantCost(
          previous[materialId] ?? {},
          variantId,
          patch,
        ),
      }));
    },
    [],
  );

  const materiasFiltradas = React.useMemo(() => {
    const text = deferredSearch.trim().toLowerCase();
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
  }, [initialMateriasPrimas, deferredSearch, soloConsumibles]);

  const cambios = React.useMemo(
    () =>
      buildMaterialCostChanges(initialMateriasPrimas, drafts, moneda.codigo),
    [initialMateriasPrimas, drafts, moneda.codigo],
  );

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
    <section
      {...scope}
      data-visual="brand"
      className={`${themeClass} ${layout.page} ${materialStyles.page}`}
    >
      <Link
        href="/inventario/materias-primas"
        className={materialStyles.backLink}
      >
        <ArrowLeftIcon size={14} /> Materiales
      </Link>
      <header className={layout.header}>
        <div>
          <p className={materialStyles.eyebrow}>Inventario · Costos</p>
          <h1>
            Editor de costos<span className={materialStyles.titleDot}>.</span>
          </h1>
          <p className={layout.subtitle}>
            Precios por variante y unidades de compra, stock y consumo por
            material.
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
      <div className={materialStyles.metrics}>
        <ListMetric
          label="Materiales"
          value={initialMateriasPrimas.length}
          hint="Catálogo de tu empresa"
          icon={PackageIcon}
        />
        <ListMetric
          label="Variantes"
          value={initialMateriasPrimas.reduce(
            (total, item) => total + item.variantes.length,
            0,
          )}
          hint="Precios de referencia individuales"
          icon={LayersIcon}
        />
        <ListMetric
          label="Cambios pendientes"
          value={totalCambios}
          hint="Se aplican al guardar"
          icon={SlidersHorizontalIcon}
          tone={totalCambios > 0 ? "brand" : "neutral"}
        />
      </div>
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
              <SearchField.Input placeholder="Buscar materiales y variantes…" />
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
                <TableHead>Material / Variante</TableHead>
                {materialUnitColumns.map(({ key, label }) => (
                  <TableHead key={key}>{label}</TableHead>
                ))}
                <TableHead className="text-right">
                  Precio de referencia
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {materiasFiltradas.map((materia) => (
                <MaterialCostRows
                  key={materia.id}
                  materia={materia}
                  draft={drafts[materia.id]}
                  monedaCodigo={moneda.codigo}
                  onUnitChange={changeUnit}
                  onVariantChange={changeVariant}
                />
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </section>
  );
}
