"use client";

/**
 * Panel de gestión de máquinas — modelo v3.0 (2026-04-26).
 *
 * Diseño template-driven: cada plantilla del catálogo
 * (`maquinaria-templates.ts`) declara qué secciones y campos pide. Este
 * componente renderiza dinámicamente esos campos sin hardcodear plantillas
 * específicas. Funcional pero minimalista — la UX rica se trabaja en
 * iteraciones siguientes.
 *
 * Reemplaza el componente legacy de 6266 LOC que hardcodeaba campos como
 * printMode, printSides, dobleFaz, sheetThicknessMm, etc. Esos campos
 * ahora viven en `perfil.detalle` JSON con los discriminantes que la
 * plantilla declara (caras, colores, tipoCorte, gramajeMinGr, etc.).
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2Icon,
  ChevronDownIcon,
  ChevronRightIcon,
  CircleIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  SheetHeader,
  SheetTitle,
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
  createMaquina,
  toggleMaquina,
  updateMaquina,
} from "@/lib/maquinaria-api";
import type { CentroCosto, Planta } from "@/lib/costos";
import {
  estadoMaquinaItems,
  geometriaTrabajoMaquinaItems,
  getEstadoMaquinaLabel,
  tipoPerfilOperativoMaquinaItems,
  type Maquina,
  type MaquinaPayload,
  type MaquinariaTemplateDefinition,
  type MaquinariaTemplateField,
  type PlantillaMaquinaria,
} from "@/lib/maquinaria";
import {
  getMaquinariaTemplate,
  getPlantillaMaquinariaLabel,
  maquinariaTemplates,
} from "@/lib/maquinaria-templates";
import { LabelConTooltip } from "@/components/ui/label-con-tooltip";

// ─── Props ──────────────────────────────────────────────────────────

type MaquinariaPanelProps = {
  initialMaquinas: Maquina[];
  plantas: Planta[];
  centrosCosto: CentroCosto[];
};

// ─── Helpers de form ───────────────────────────────────────────────

type LocalPerfil = NonNullable<MaquinaPayload["perfilesOperativos"]>[number] & {
  uiKey: string;
};

function emptyMaquina(plantaId: string): MaquinaPayload {
  return {
    nombre: "",
    plantilla: "impresora_laser",
    plantaId,
    estado: "activa",
    geometriaTrabajo: "pliego",
    unidadProduccionPrincipal: "ppm",
    activo: true,
    perfilesOperativos: [],
    consumibles: [],
    componentesDesgaste: [],
    parametrosTecnicos: {},
  };
}

function maquinaToPayload(maquina: Maquina): MaquinaPayload {
  return {
    codigo: maquina.codigo,
    nombre: maquina.nombre,
    plantilla: maquina.plantilla,
    plantillaVersion: maquina.plantillaVersion,
    fabricante: maquina.fabricante || undefined,
    modelo: maquina.modelo || undefined,
    numeroSerie: maquina.numeroSerie || undefined,
    plantaId: maquina.plantaId,
    centroCostoPrincipalId: maquina.centroCostoPrincipalId || undefined,
    estado: maquina.estado,
    estadoConfiguracion: maquina.estadoConfiguracion,
    geometriaTrabajo: maquina.geometriaTrabajo,
    unidadProduccionPrincipal: maquina.unidadProduccionPrincipal,
    anchoUtil: maquina.anchoUtil ?? undefined,
    largoUtil: maquina.largoUtil ?? undefined,
    altoUtil: maquina.altoUtil ?? undefined,
    espesorMaximo: maquina.espesorMaximo ?? undefined,
    pesoMaximo: maquina.pesoMaximo ?? undefined,
    activo: maquina.activo,
    observaciones: maquina.observaciones || undefined,
    parametrosTecnicos: (maquina.parametrosTecnicos as Record<string, unknown> | null) ?? {},
    perfilesOperativos: maquina.perfilesOperativos.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      tipoPerfil: p.tipoPerfil,
      activo: p.activo,
      productivityValue: p.productivityValue ?? undefined,
      productivityUnit: p.productivityUnit || undefined,
      setupMin: p.setupMin ?? undefined,
      cleanupMin: p.cleanupMin ?? undefined,
      feedReloadMin: p.feedReloadMin ?? undefined,
      detalle: p.detalle ?? undefined,
      reglaSeleccionJson: p.reglaSeleccionJson ?? undefined,
    })),
    consumibles: maquina.consumibles.map((c) => ({
      materiaPrimaVarianteId: c.materiaPrimaVarianteId,
      nombre: c.nombre,
      tipo: c.tipo,
      unidad: c.unidad,
      rendimientoEstimado: c.rendimientoEstimado ?? undefined,
      consumoBase: c.consumoBase ?? undefined,
      activo: c.activo,
    })),
    componentesDesgaste: maquina.componentesDesgaste.map((d) => ({
      materiaPrimaVarianteId: d.materiaPrimaVarianteId,
      nombre: d.nombre,
      tipo: d.tipo,
      vidaUtilEstimada: d.vidaUtilEstimada ?? undefined,
      unidadDesgaste: d.unidadDesgaste,
      activo: d.activo,
    })),
  };
}

// ─── Helpers para campos genéricos ──────────────────────────────────

const MAQUINA_DIRECT_FIELDS = new Set([
  "anchoUtil",
  "largoUtil",
  "altoUtil",
  "espesorMaximo",
  "pesoMaximo",
  "gramajeMaxGr",
]);

function getMaquinaFieldValue(form: MaquinaPayload, key: string): unknown {
  if (MAQUINA_DIRECT_FIELDS.has(key)) {
    return (form as unknown as Record<string, unknown>)[key];
  }
  return (form.parametrosTecnicos ?? {})[key];
}

function setMaquinaFieldValue(form: MaquinaPayload, key: string, value: unknown): MaquinaPayload {
  if (MAQUINA_DIRECT_FIELDS.has(key)) {
    return { ...form, [key]: value } as MaquinaPayload;
  }
  return {
    ...form,
    parametrosTecnicos: { ...(form.parametrosTecnicos ?? {}), [key]: value },
  };
}

const PERFIL_DIRECT_FIELDS = new Set([
  "nombre",
  "tipoPerfil",
  "activo",
  "productivityValue",
  "productivityUnit",
  "setupMin",
  "cleanupMin",
  "feedReloadMin",
]);

function getPerfilFieldValue(perfil: LocalPerfil, key: string): unknown {
  if (PERFIL_DIRECT_FIELDS.has(key)) {
    return (perfil as unknown as Record<string, unknown>)[key];
  }
  return (perfil.detalle ?? {})[key];
}

function setPerfilFieldValue(perfil: LocalPerfil, key: string, value: unknown): LocalPerfil {
  if (PERFIL_DIRECT_FIELDS.has(key)) {
    return { ...perfil, [key]: value } as LocalPerfil;
  }
  return { ...perfil, detalle: { ...(perfil.detalle ?? {}), [key]: value } };
}

// ─── Renderer genérico de un campo del template ────────────────────

interface FieldInputProps {
  field: MaquinariaTemplateField;
  value: unknown;
  onChange: (value: unknown) => void;
}

function FieldInput({ field, value, onChange }: FieldInputProps) {
  const id = `field-${field.scope}-${field.key}`;

  switch (field.kind) {
    case "text":
      return (
        <Input
          id={id}
          value={typeof value === "string" ? value : ""}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "textarea":
      return (
        <Textarea
          id={id}
          rows={3}
          value={
            typeof value === "string"
              ? value
              : value !== undefined && value !== null
                ? JSON.stringify(value, null, 2)
                : ""
          }
          placeholder={field.placeholder}
          onChange={(e) => {
            const raw = e.target.value;
            try {
              onChange(JSON.parse(raw));
            } catch {
              onChange(raw);
            }
          }}
        />
      );

    case "number":
      return (
        <div className="flex items-center gap-2">
          <Input
            id={id}
            type="number"
            inputMode="decimal"
            value={typeof value === "number" ? value : value ? Number(value) : ""}
            placeholder={field.placeholder}
            onChange={(e) => {
              const v = e.target.value;
              onChange(v === "" ? undefined : Number(v));
            }}
          />
          {field.unit && (
            <span className="text-muted-foreground text-xs">{field.unit}</span>
          )}
        </div>
      );

    case "boolean":
      return (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span>Sí</span>
        </label>
      );

    case "select":
      return (
        <Select
          value={typeof value === "string" ? value : ""}
          onValueChange={(v) => onChange(v ?? "")}
        >
          <SelectTrigger id={id}>
            <SelectValue placeholder="Elegí" />
          </SelectTrigger>
          <SelectContent>
            {field.options?.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );

    case "multiselect": {
      const current = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div className="space-y-1.5">
          {field.options?.map((opt) => (
            <label key={opt.value} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={current.includes(opt.value)}
                onChange={(e) => {
                  const next = e.target.checked
                    ? [...current, opt.value]
                    : current.filter((v) => v !== opt.value);
                  onChange(next);
                }}
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
      );
    }
  }
}

// ─── Componente principal ──────────────────────────────────────────

export function MaquinariaPanel({
  initialMaquinas,
  plantas,
  centrosCosto,
}: MaquinariaPanelProps) {
  const router = useRouter();
  const [maquinas, setMaquinas] = React.useState(initialMaquinas);
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<MaquinaPayload>(() =>
    emptyMaquina(plantas[0]?.id ?? ""),
  );
  const [perfiles, setPerfiles] = React.useState<LocalPerfil[]>([]);
  const [filterText, setFilterText] = React.useState("");
  const [filterPlantilla, setFilterPlantilla] = React.useState<PlantillaMaquinaria | "all">("all");
  const [saving, setSaving] = React.useState(false);
  const [openSection, setOpenSection] = React.useState<string | null>("capacidades_fisicas");

  const template: MaquinariaTemplateDefinition | null = React.useMemo(
    () => getMaquinariaTemplate(form.plantilla),
    [form.plantilla],
  );

  // Filtros aplicados
  const filteredMaquinas = React.useMemo(() => {
    let result = maquinas;
    if (filterText) {
      const q = filterText.toLowerCase();
      result = result.filter(
        (m) =>
          m.nombre.toLowerCase().includes(q) ||
          m.codigo.toLowerCase().includes(q),
      );
    }
    if (filterPlantilla !== "all") {
      result = result.filter((m) => m.plantilla === filterPlantilla);
    }
    return result;
  }, [maquinas, filterText, filterPlantilla]);

  const handleNueva = () => {
    setEditingId(null);
    setForm(emptyMaquina(plantas[0]?.id ?? ""));
    setPerfiles([]);
    setOpenSection("capacidades_fisicas");
    setIsSheetOpen(true);
  };

  const handleEditar = (maquina: Maquina) => {
    setEditingId(maquina.id);
    const payload = maquinaToPayload(maquina);
    setForm(payload);
    setPerfiles(
      payload.perfilesOperativos.map((p, i) => ({
        ...p,
        uiKey: `p-${i}-${Date.now()}`,
      })),
    );
    setOpenSection("capacidades_fisicas");
    setIsSheetOpen(true);
  };

  const handlePlantillaChange = (newPlantilla: PlantillaMaquinaria) => {
    const newTemplate = getMaquinariaTemplate(newPlantilla);
    setForm((prev) => ({
      ...prev,
      plantilla: newPlantilla,
      geometriaTrabajo: newTemplate?.geometry ?? prev.geometriaTrabajo,
      unidadProduccionPrincipal:
        newTemplate?.defaultProductionUnit ?? prev.unidadProduccionPrincipal,
      // Reset paramsTecnicos al cambiar plantilla (el shape es distinto).
      parametrosTecnicos: {},
    }));
    setPerfiles([]); // los perfiles también dependen del template
  };

  const handleAgregarPerfil = () => {
    setPerfiles((prev) => [
      ...prev,
      {
        uiKey: `p-${Date.now()}-${Math.random()}`,
        nombre: "Nuevo perfil",
        tipoPerfil: "impresion",
        activo: true,
        detalle: {},
      },
    ]);
  };

  const handleEliminarPerfil = (uiKey: string) => {
    setPerfiles((prev) => prev.filter((p) => p.uiKey !== uiKey));
  };

  const handleGuardar = async () => {
    if (!form.nombre.trim()) {
      toast.error("La máquina necesita un nombre");
      return;
    }
    setSaving(true);
    try {
      const payload: MaquinaPayload = {
        ...form,
        perfilesOperativos: perfiles.map(({ uiKey: _uiKey, ...rest }) => rest),
      };
      if (editingId) {
        const updated = await updateMaquina(editingId, payload);
        setMaquinas((prev) => prev.map((m) => (m.id === editingId ? updated : m)));
        toast.success(`"${updated.nombre}" actualizada`);
      } else {
        const created = await createMaquina(payload);
        setMaquinas((prev) => [...prev, created]);
        toast.success(`"${created.nombre}" creada`);
      }
      setIsSheetOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error guardando");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (maquina: Maquina) => {
    try {
      const updated = await toggleMaquina(maquina.id);
      setMaquinas((prev) => prev.map((m) => (m.id === maquina.id ? updated : m)));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    }
  };

  const handleDesactivar = async (maquina: Maquina) => {
    if (!confirm(`¿Desactivar "${maquina.nombre}"? (no se elimina, queda inactiva)`)) return;
    try {
      const updated = await toggleMaquina(maquina.id);
      setMaquinas((prev) => prev.map((m) => (m.id === maquina.id ? updated : m)));
      toast.success("Máquina desactivada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Maquinaria</h1>
          <p className="text-muted-foreground text-sm">
            Catálogo de máquinas + perfiles operativos. Modelo v3.0 alineado a doc §5–§13.
          </p>
        </div>
        <Button onClick={handleNueva}>
          <PlusIcon className="mr-2 size-4" />
          Nueva máquina
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="grid grid-cols-1 gap-3 pt-4 md:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="filter-text">Buscar</Label>
            <Input
              id="filter-text"
              placeholder="Nombre o código..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Plantilla</Label>
            <Select
              value={filterPlantilla}
              onValueChange={(v) =>
                setFilterPlantilla((v ?? "all") as PlantillaMaquinaria | "all")
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {maquinariaTemplates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Lista */}
      <Card>
        <CardHeader>
          <CardTitle>Máquinas ({filteredMaquinas.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredMaquinas.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm italic">
              Sin máquinas todavía.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Plantilla</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Perfiles</TableHead>
                  <TableHead className="w-32">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMaquinas.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <button onClick={() => handleToggle(m)}>
                        {m.activo ? (
                          <CheckCircle2Icon className="size-4 text-green-500" />
                        ) : (
                          <CircleIcon className="text-muted-foreground size-4" />
                        )}
                      </button>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{m.codigo}</TableCell>
                    <TableCell className="font-medium">{m.nombre}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{getPlantillaMaquinariaLabel(m.plantilla)}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={m.estado === "activa" ? "default" : "secondary"}
                        title={`código: ${m.estado}`}
                      >
                        {getEstadoMaquinaLabel(m.estado)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {m.perfilesOperativos.length}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="outline" size="sm" onClick={() => handleEditar(m)}>
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDesactivar(m)}
                          className="text-destructive size-8"
                          title="Desactivar"
                        >
                          <Trash2Icon className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Sheet editor */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>{editingId ? "Editar máquina" : "Nueva máquina"}</SheetTitle>
            <SheetDescription>
              Completá los campos según la plantilla elegida. Los discriminantes
              específicos se editan en cada perfil operativo.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4 p-4">
            {/* Identidad */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Identidad</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="codigo">Código</Label>
                    <Input
                      id="codigo"
                      value={form.codigo ?? ""}
                      placeholder="auto"
                      onChange={(e) => setForm({ ...form, codigo: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="nombre">Nombre *</Label>
                    <Input
                      id="nombre"
                      value={form.nombre}
                      onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <LabelConTooltip
                      label="Plantilla"
                      required
                      tooltip="Tipo de máquina (define qué campos pide y qué familias puede ejecutar). Ej: impresora láser, plotter eco-solvente, guillotina, plegadora."
                    />
                    <Select
                      value={form.plantilla}
                      onValueChange={(v) => handlePlantillaChange((v ?? "impresora_laser") as PlantillaMaquinaria)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {maquinariaTemplates.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Estado</Label>
                    <Select
                      value={form.estado}
                      onValueChange={(v) =>
                        setForm({
                          ...form,
                          estado: (v ?? "activa") as MaquinaPayload["estado"],
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {estadoMaquinaItems.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Planta</Label>
                    <Select
                      value={form.plantaId}
                      onValueChange={(v) => setForm({ ...form, plantaId: v ?? "" })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Elegí" />
                      </SelectTrigger>
                      <SelectContent>
                        {plantas.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Centro de costo</Label>
                    <Select
                      value={form.centroCostoPrincipalId ?? ""}
                      onValueChange={(v) =>
                        setForm({ ...form, centroCostoPrincipalId: v || undefined })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sin asignar" />
                      </SelectTrigger>
                      <SelectContent>
                        {centrosCosto.map((cc) => (
                          <SelectItem key={cc.id} value={cc.id}>
                            {cc.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <LabelConTooltip
                      label="Geometría de trabajo"
                      tooltip="Forma del sustrato sobre el que opera la máquina. Pliego = hojas precortadas; Rollo = bobina continua; Plano/Cilindrico/Volumen = piezas tridimensionales."
                    />
                    <Select
                      value={form.geometriaTrabajo}
                      onValueChange={(v) =>
                        setForm({
                          ...form,
                          geometriaTrabajo: (v ?? "pliego") as MaquinaPayload["geometriaTrabajo"],
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {geometriaTrabajoMaquinaItems.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Secciones del template */}
            {template?.sections.map((sec) => (
              <Card key={sec.id}>
                <button
                  type="button"
                  onClick={() => setOpenSection(openSection === sec.id ? null : sec.id)}
                  className="w-full text-left"
                >
                  <CardHeader className="cursor-pointer">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2 text-base">
                          {openSection === sec.id ? (
                            <ChevronDownIcon className="size-4" />
                          ) : (
                            <ChevronRightIcon className="size-4" />
                          )}
                          {sec.title}
                        </CardTitle>
                        <CardDescription className="ml-6 text-xs">
                          {sec.description}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                </button>
                {openSection === sec.id && (
                  <CardContent className="space-y-3">
                    {sec.id === "perfiles_operativos" ? (
                      <PerfilesOperativosEditor
                        perfiles={perfiles}
                        setPerfiles={setPerfiles}
                        sectionFields={sec.fields}
                        onAgregar={handleAgregarPerfil}
                        onEliminar={handleEliminarPerfil}
                      />
                    ) : sec.id === "consumibles" || sec.id === "desgaste_repuestos" ? (
                      <p className="text-muted-foreground text-xs italic">
                        Editor de {sec.id === "consumibles" ? "consumibles" : "desgaste"} simplificado:
                        editá vía API por ahora. UI rica pendiente de iteración UX.
                      </p>
                    ) : (
                      sec.fields.map((field) => (
                        <div key={field.key} className="space-y-1">
                          <Label htmlFor={`field-${field.scope}-${field.key}`} className="text-sm">
                            {field.label}
                            {field.required && <span className="text-destructive"> *</span>}
                          </Label>
                          <FieldInput
                            field={field}
                            value={getMaquinaFieldValue(form, field.key)}
                            onChange={(v) => setForm(setMaquinaFieldValue(form, field.key, v))}
                          />
                          {field.description && (
                            <p className="text-muted-foreground text-xs">{field.description}</p>
                          )}
                        </div>
                      ))
                    )}
                  </CardContent>
                )}
              </Card>
            ))}

            {/* Botones */}
            <div className="sticky bottom-0 flex justify-end gap-2 border-t bg-background p-4">
              <Button variant="outline" onClick={() => setIsSheetOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleGuardar} disabled={saving}>
                {saving ? "Guardando..." : editingId ? "Actualizar" : "Crear"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ─── Sub-componente: editor de perfiles ────────────────────────────

interface PerfilesProps {
  perfiles: LocalPerfil[];
  setPerfiles: React.Dispatch<React.SetStateAction<LocalPerfil[]>>;
  sectionFields: MaquinariaTemplateField[];
  onAgregar: () => void;
  onEliminar: (uiKey: string) => void;
}

function PerfilesOperativosEditor({
  perfiles,
  setPerfiles,
  sectionFields,
  onAgregar,
  onEliminar,
}: PerfilesProps) {
  return (
    <div className="space-y-3">
      {perfiles.length === 0 ? (
        <p className="text-muted-foreground text-xs italic">Sin perfiles. Agregá al menos uno.</p>
      ) : (
        perfiles.map((perfil, idx) => (
          <Card key={perfil.uiKey} className="bg-muted/30">
            <CardHeader className="flex flex-row items-center justify-between p-3">
              <div className="flex items-center gap-2">
                <Badge>{idx + 1}</Badge>
                <span className="text-sm font-medium">
                  {perfil.nombre || "(sin nombre)"}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive size-7"
                onClick={() => onEliminar(perfil.uiKey)}
              >
                <Trash2Icon className="size-4" />
              </Button>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <LabelConTooltip
                  label="Tipo de perfil"
                  iconSize="sm"
                  tooltip="Define qué tipo de operación ejecuta este perfil dentro de la máquina (impresión, corte, laminado, mecanizado, etc.). Una misma máquina puede tener múltiples perfiles si soporta más de un tipo."
                />
                <Select
                  value={perfil.tipoPerfil}
                  onValueChange={(v) => {
                    const next = setPerfilFieldValue(perfil, "tipoPerfil", v ?? "impresion");
                    setPerfiles((prev) =>
                      prev.map((p) => (p.uiKey === perfil.uiKey ? next : p)),
                    );
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {tipoPerfilOperativoMaquinaItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {sectionFields.map((field) => (
                <div key={field.key} className="space-y-1">
                  <Label
                    htmlFor={`p-${perfil.uiKey}-${field.key}`}
                    className="text-xs"
                  >
                    {field.label}
                    {field.required && <span className="text-destructive"> *</span>}
                  </Label>
                  <FieldInput
                    field={field}
                    value={getPerfilFieldValue(perfil, field.key)}
                    onChange={(v) => {
                      const next = setPerfilFieldValue(perfil, field.key, v);
                      setPerfiles((prev) =>
                        prev.map((p) => (p.uiKey === perfil.uiKey ? next : p)),
                      );
                    }}
                  />
                  {field.description && (
                    <p className="text-muted-foreground text-xs">{field.description}</p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        ))
      )}
      <Button variant="outline" size="sm" onClick={onAgregar}>
        <PlusIcon className="mr-2 size-4" />
        Agregar perfil
      </Button>
    </div>
  );
}
