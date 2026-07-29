"use client";

/**
 * G-F3 — Editor de un paso extra inline, embebido en el editor de pasos.
 *
 * Un paso extra vive en UNA ruta alternativa del producto (no en la ruta base
 * reusable). Acá se configura: familia, posición en el flujo, activación
 * (obligatorio / opcional / condicional con rule-builder), recurso (máquina+perfil
 * o centro de costo) y cómo se calcula el tiempo. Guarda vía los endpoints de
 * pasos-extras.
 */

import * as React from "react";
import { Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConfirmacionDestructiva } from "@/components/ui/confirmacion-destructiva";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LabelConTooltip } from "@/components/ui/label-con-tooltip";
import {
  HumanSelect,
  optionFromLabel,
  type HumanSelectOption,
} from "@/components/ui/human-select";
import { RuleBuilder } from "@/components/productos-servicios/rule-builder";
import {
  agregarPasoExtra,
  actualizarPasoExtra,
  eliminarPasoExtra,
  type LookupsConfigPaso,
} from "@/lib/productos-servicios-api";
import type {
  CatalogoFamilias,
  PasoExtra,
  RutaAlternativaDetalle,
} from "@/lib/productos-servicios";
import {
  categoriaFamiliaLabels,
  getLabel,
  modoActivacionLabels,
} from "@/lib/labels-humanos";
import type { RuleFieldDefinition } from "@/lib/rule-builder";

type ModoActivacion = "OBLIGATORIO" | "OPCIONAL" | "CONDICIONAL";
type TiempoModo = "estimado" | "productividad";
type RecursoTipo = "centro" | "maquina";

interface Props {
  productoId: string;
  rutaAlternativa: RutaAlternativaDetalle;
  catalogoFamilias: CatalogoFamilias;
  lookups: LookupsConfigPaso;
  includeMeasureFields: boolean;
  ruleExtraFields: RuleFieldDefinition[];
  /** null = alta de un paso extra nuevo; PasoExtra = edición. */
  extra: PasoExtra | null;
  onSaved: () => void;
  /** Alta mínima creada: el padre lo selecciona para configurarlo. */
  onCreated: (creado: PasoExtra) => void;
  onDeleted: () => void;
  onCancel: () => void;
}

const AL_INICIO = "__inicio__";

function getHorasEstimadas(paramsPasoJson: unknown): string {
  if (
    paramsPasoJson &&
    typeof paramsPasoJson === "object" &&
    !Array.isArray(paramsPasoJson)
  ) {
    const raw = (paramsPasoJson as Record<string, unknown>).horasEstimadas;
    if (typeof raw === "number" && Number.isFinite(raw)) return String(raw);
    if (typeof raw === "string" && raw.trim()) return raw;
  }
  return "";
}

export function PasoExtraEditor({
  productoId,
  rutaAlternativa,
  catalogoFamilias,
  lookups,
  includeMeasureFields,
  ruleExtraFields,
  extra,
  onSaved,
  onCreated,
  onDeleted,
  onCancel,
}: Props) {
  const esCreacion = extra === null;
  const familias = React.useMemo(
    () =>
      catalogoFamilias.familias.filter((f) => f.visibleEnSelector !== false),
    [catalogoFamilias],
  );

  const [confirmandoEliminar, setConfirmandoEliminar] = React.useState(false);
  const [familiaCodigo, setFamiliaCodigo] = React.useState(
    extra?.familiaCodigo ?? "",
  );
  const [posicion, setPosicion] = React.useState(
    extra?.insertarDespuesDeRutaPasoId ?? AL_INICIO,
  );
  const [modoActivacion, setModoActivacion] = React.useState<ModoActivacion>(
    (extra?.modoActivacion as ModoActivacion) ?? "OBLIGATORIO",
  );
  const [condicion, setCondicion] = React.useState<Record<
    string,
    unknown
  > | null>(
    (extra?.condicionActivacionJson as Record<string, unknown> | null) ?? null,
  );
  const [recursoTipo, setRecursoTipo] = React.useState<RecursoTipo>(
    extra?.maquinaM1Id ? "maquina" : "centro",
  );
  const [maquinaM1Id, setMaquinaM1Id] = React.useState(extra?.maquinaM1Id ?? "");
  const [perfilM1Id, setPerfilM1Id] = React.useState(extra?.perfilM1Id ?? "");
  const [centroCostoId, setCentroCostoId] = React.useState(
    extra?.centroCostoId ?? "",
  );
  const [tiempoModo, setTiempoModo] = React.useState<TiempoModo>(
    extra?.modoTiempo === "T-3" ? "productividad" : "estimado",
  );
  const [horasEstimadas, setHorasEstimadas] = React.useState(
    getHorasEstimadas(extra?.paramsPasoJson),
  );
  const [guardando, setGuardando] = React.useState(false);
  const [borrando, setBorrando] = React.useState(false);

  const familiaOptions = React.useMemo<HumanSelectOption[]>(() => {
    // Los pasos creados por la empresa van PRIMERO, en su propio grupo: si
    // alguien se tomó el trabajo de crear "Serigrafía manual", es porque lo
    // usa — no debería tener que bucearlo entre 42 del catálogo.
    const propios = familias
      .filter((f) => f.origen === "tenant")
      .map((f) => ({
        value: f.codigo,
        label: f.nombre,
        description: f.descripcion,
        group: "Tus pasos",
      }));

    const porCategoria = new Map<string, typeof familias>();
    for (const f of familias) {
      if (f.origen === "tenant") continue;
      const arr = porCategoria.get(f.categoria) ?? [];
      arr.push(f);
      porCategoria.set(f.categoria, arr);
    }
    const sistema = Array.from(porCategoria.entries()).flatMap(
      ([categoria, fams]) => {
        const lblCat = getLabel(categoriaFamiliaLabels, categoria);
        return fams.map((f) => ({
          value: f.codigo,
          label: f.nombre,
          code: f.codigo,
          description: f.descripcion,
          group: lblCat.label,
        }));
      },
    );
    return [...propios, ...sistema];
  }, [familias]);

  const posicionOptions = React.useMemo<HumanSelectOption[]>(() => {
    const pasos = [...rutaAlternativa.ruta.pasos].sort(
      (a, b) => a.orden - b.orden,
    );
    return [
      { value: AL_INICIO, label: "Al inicio del flujo" },
      ...pasos.map((paso) => {
        const fam = familias.find((f) => f.codigo === paso.familiaCodigo);
        return {
          value: paso.id,
          label: `Después de: ${fam?.nombre ?? paso.familiaCodigo}`,
        };
      }),
    ];
  }, [rutaAlternativa.ruta.pasos, familias]);

  const maquinaOptions = React.useMemo<HumanSelectOption[]>(
    () =>
      lookups.maquinas.map((m) => ({
        value: m.id,
        label: m.nombre,
        code: m.codigo,
        description: m.plantilla,
      })),
    [lookups.maquinas],
  );
  const maquinaSel = lookups.maquinas.find((m) => m.id === maquinaM1Id);
  const perfilOptions = React.useMemo<HumanSelectOption[]>(
    () =>
      (maquinaSel?.perfilesOperativos ?? []).map((p) => ({
        value: p.id,
        label: p.nombre,
        description: p.tipoPerfil,
      })),
    [maquinaSel],
  );
  const centroOptions = React.useMemo<HumanSelectOption[]>(
    () =>
      lookups.centrosCosto.map((c) => ({
        value: c.id,
        label: c.nombre,
        code: c.codigo,
      })),
    [lookups.centrosCosto],
  );

  const modoActivacionOptions = (["OBLIGATORIO", "OPCIONAL", "CONDICIONAL"] as const).map(
    (m) => optionFromLabel(m, modoActivacionLabels),
  );

  const handleGuardar = async () => {
    if (!familiaCodigo) {
      toast.error("Elegí una familia");
      return;
    }
    // Alta mínima: solo familia + posición. El resto se configura después,
    // con el mismo panel que el resto de los pasos.
    if (esCreacion) {
      setGuardando(true);
      try {
        const creado = (await agregarPasoExtra(productoId, {
          familiaCodigo,
          rutaAlternativaId: rutaAlternativa.id,
          insertarDespuesDeRutaPasoId: posicion === AL_INICIO ? null : posicion,
          modoActivacion: "OBLIGATORIO",
        })) as PasoExtra;
        toast.success("Paso extra agregado al flujo");
        onCreated(creado);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error agregando");
      } finally {
        setGuardando(false);
      }
      return;
    }
    if (recursoTipo === "maquina" && !maquinaM1Id) {
      toast.error("Elegí una máquina");
      return;
    }
    if (recursoTipo === "centro" && !centroCostoId) {
      toast.error("Elegí un centro de costo");
      return;
    }
    if (tiempoModo === "productividad" && recursoTipo !== "maquina") {
      toast.error("La productividad requiere una máquina con perfil.");
      return;
    }

    const modoTiempo = tiempoModo === "productividad" ? "T-3" : "T-2";
    const paramsPasoJson =
      tiempoModo === "estimado"
        ? { horasEstimadas: Number(horasEstimadas) || 0 }
        : {};
    const esMaquina = recursoTipo === "maquina";

    setGuardando(true);
    try {
      if (extra) {
        await actualizarPasoExtra(extra.id, {
          insertarDespuesDeRutaPasoId:
            posicion === AL_INICIO ? null : posicion,
          modoActivacion,
          condicionActivacionJson:
            modoActivacion === "CONDICIONAL" ? condicion : null,
          modoTiempo,
          mecanismoCantidad: "DIRECT_FROM_JOBCONTEXT",
          paramsPasoJson,
          maquinaM1Id: esMaquina ? maquinaM1Id : null,
          perfilM1Id: esMaquina ? perfilM1Id || null : null,
          centroCostoId: esMaquina ? null : centroCostoId,
        });
        toast.success("Paso extra actualizado");
      } else {
        await agregarPasoExtra(productoId, {
          familiaCodigo,
          rutaAlternativaId: rutaAlternativa.id,
          insertarDespuesDeRutaPasoId:
            posicion === AL_INICIO ? null : posicion,
          modoActivacion,
          condicionActivacionJson:
            modoActivacion === "CONDICIONAL" ? condicion : null,
          modoTiempo,
          mecanismoCantidad: "DIRECT_FROM_JOBCONTEXT",
          paramsPasoJson,
          maquinaM1Id: esMaquina ? maquinaM1Id : undefined,
          perfilM1Id: esMaquina ? perfilM1Id || undefined : undefined,
          centroCostoId: esMaquina ? undefined : centroCostoId,
        });
        toast.success("Paso extra agregado");
      }
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error guardando");
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminar = () => {
    if (!extra) return;
    setConfirmandoEliminar(true);
  };

  const confirmarEliminar = async () => {
    if (!extra) return;
    setConfirmandoEliminar(false);
    setBorrando(true);
    try {
      await eliminarPasoExtra(extra.id);
      toast.success("Paso extra eliminado");
      onDeleted();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error eliminando");
    } finally {
      setBorrando(false);
    }
  };

  return (
    <div className="paso-extra-editor space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">
            {extra ? "Editar paso extra" : "Nuevo paso extra"}
          </h2>
          <p className="text-muted-foreground text-sm">
            {esCreacion
              ? "Elegí la familia del paso y dónde se inserta en el flujo. El resto se configura después, igual que los demás pasos."
              : "Paso puntual solo para este producto en esta ruta. No modifica la ruta base reusable ni a otros productos."}
          </p>
        </div>
        {extra ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleEliminar}
            disabled={borrando}
            className="text-destructive hover:text-destructive"
          >
            <Trash2Icon className="mr-1 size-4" />
            {borrando ? "Eliminando…" : "Eliminar"}
          </Button>
        ) : null}
      </div>

      {/* Identidad + posición */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-1">
          <LabelConTooltip
            label="Familia"
            htmlFor="pe-familia"
            tooltip="Tipo de operación (impresión, corte, laminado, instalación, etc.)."
          />
          <HumanSelect
            id="pe-familia"
            value={familiaCodigo}
            onValueChange={(v) => setFamiliaCodigo(v || "")}
            options={familiaOptions}
            placeholder="Elegí familia"
            contentClassName="max-h-80"
            disabled={Boolean(extra)}
          />
          {extra ? (
            <p className="text-muted-foreground text-xs">
              La familia no se cambia; creá otro paso si necesitás otra.
            </p>
          ) : null}
        </div>
        <div className="space-y-1">
          <LabelConTooltip
            label="Posición en el flujo"
            htmlFor="pe-pos"
            tooltip="Dónde se inserta este paso dentro de la secuencia de la ruta."
          />
          <HumanSelect
            id="pe-pos"
            value={posicion}
            onValueChange={(v) => setPosicion(v || AL_INICIO)}
            options={posicionOptions}
          />
        </div>
      </div>

      {!esCreacion ? (
        <>
      {/* Activación */}
      <div className="space-y-3 rounded-lg border p-4">
        <Label className="text-sm font-medium">Activación</Label>
        <div className="space-y-1">
          <LabelConTooltip
            label="¿Cuándo se aplica?"
            htmlFor="pe-modoact"
            tooltip={getLabel(modoActivacionLabels, modoActivacion).descripcion}
          />
          <HumanSelect
            id="pe-modoact"
            value={modoActivacion}
            onValueChange={(v) =>
              setModoActivacion((v || "OBLIGATORIO") as ModoActivacion)
            }
            options={modoActivacionOptions}
          />
        </div>
        {modoActivacion === "CONDICIONAL" ? (
          <div className="space-y-1">
            <Label className="text-xs font-medium">Regla de activación</Label>
            <RuleBuilder
              value={condicion}
              includeMeasureFields={includeMeasureFields}
              extraFields={ruleExtraFields}
              onChange={(value) => setCondicion(value)}
            />
          </div>
        ) : null}
      </div>

      {/* Recurso */}
      <div className="space-y-3 rounded-lg border p-4">
        <Label className="text-sm font-medium">Recurso que ejecuta el paso</Label>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={recursoTipo === "centro" ? "default" : "outline"}
            size="sm"
            onClick={() => setRecursoTipo("centro")}
          >
            Centro de costo (manual)
          </Button>
          <Button
            type="button"
            variant={recursoTipo === "maquina" ? "default" : "outline"}
            size="sm"
            onClick={() => setRecursoTipo("maquina")}
          >
            Máquina y perfil
          </Button>
        </div>
        {recursoTipo === "centro" ? (
          <div className="space-y-1">
            <Label className="text-xs font-medium">Centro de costo</Label>
            <HumanSelect
              value={centroCostoId}
              onValueChange={(v) => setCentroCostoId(v || "")}
              options={centroOptions}
              placeholder="Elegí centro de costo"
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs font-medium">Máquina</Label>
              <HumanSelect
                value={maquinaM1Id}
                onValueChange={(v) => {
                  setMaquinaM1Id(v || "");
                  setPerfilM1Id("");
                }}
                options={maquinaOptions}
                placeholder="Elegí máquina"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">Perfil</Label>
              <HumanSelect
                value={perfilM1Id}
                onValueChange={(v) => setPerfilM1Id(v || "")}
                options={perfilOptions}
                placeholder="Perfil de la máquina"
                disabled={!maquinaM1Id}
              />
            </div>
          </div>
        )}
      </div>

      {/* Tiempo */}
      <div className="space-y-3 rounded-lg border p-4">
        <Label className="text-sm font-medium">¿Cómo se calcula el tiempo?</Label>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={tiempoModo === "estimado" ? "default" : "outline"}
            size="sm"
            onClick={() => setTiempoModo("estimado")}
          >
            Tiempo estimado fijo
          </Button>
          <Button
            type="button"
            variant={tiempoModo === "productividad" ? "default" : "outline"}
            size="sm"
            onClick={() => setTiempoModo("productividad")}
            disabled={recursoTipo !== "maquina"}
          >
            Productividad de la máquina y perfil
          </Button>
        </div>
        {tiempoModo === "estimado" ? (
          <div className="space-y-1">
            <LabelConTooltip
              label="Horas estimadas"
              htmlFor="pe-horas"
              tooltip="Duración fija del paso en horas, independiente de la cantidad. Ej: instalación 3 h."
            />
            <Input
              id="pe-horas"
              type="number"
              min={0}
              step="0.25"
              value={horasEstimadas}
              onChange={(e) => setHorasEstimadas(e.target.value)}
              placeholder="Ej: 2"
              className="max-w-40"
            />
          </div>
        ) : (
          <p className="text-muted-foreground text-xs">
            El tiempo sale de la productividad del perfil elegido y la cantidad
            cotizada (igual que un paso de impresión).
          </p>
        )}
      </div>
        </>
      ) : null}

      <div className="flex items-center justify-end gap-2 border-t pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="button" onClick={handleGuardar} disabled={guardando}>
          {guardando
            ? "Guardando…"
            : esCreacion
              ? "Agregar al flujo"
              : "Guardar cambios"}
        </Button>
      </div>

      <ConfirmacionDestructiva
        open={confirmandoEliminar}
        onOpenChange={(open) => {
          if (!open) setConfirmandoEliminar(false);
        }}
        titulo="Eliminar paso extra"
        descripcion="¿Eliminar este paso extra?"
        requiereTipear={false}
        accionLabel="Eliminar"
        onConfirmar={confirmarEliminar}
      />
    </div>
  );
}
