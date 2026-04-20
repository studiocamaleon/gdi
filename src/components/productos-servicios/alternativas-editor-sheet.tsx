"use client";

/**
 * P1.3.c — Editor de alternativas máquina+perfil para un paso de ruta.
 *
 * El dueño del sistema puede declarar N alternativas por paso; el cliente
 * elige al cotizar cuál aplicar. Si no elige, se usa la marcada esDefault.
 */
import * as React from "react";
import { toast } from "sonner";

import { GdiSpinner } from "@/components/brand/gdi-spinner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getMaquinas } from "@/lib/maquinaria-api";
import type { Maquina } from "@/lib/maquinaria";
import {
  createProcesoOperacionAlternativa,
  deleteProcesoOperacionAlternativa,
  listProcesoOperacionAlternativas,
  type ProcesoOperacionAlternativa,
  updateProcesoOperacionAlternativa,
} from "@/lib/procesos-api";

const NONE = "__none__";

type DraftForm = {
  id: string | null; // null => creando
  maquinaId: string;
  perfilOperativoId: string; // NONE significa null
  label: string;
  esDefault: boolean;
  orden: number;
  // P4.1 — overrides opcionales. "" significa "usar valor base del paso".
  setupMin: string;
  cleanupMin: string;
  tiempoFijoMin: string;
  productividadBase: string;
  // P4-debt #3 — configNestingV2 override como JSON stringified.
  // "" significa "usar configNestingV2 base del paso".
  configNestingV2Json: string;
};

const emptyDraft: DraftForm = {
  id: null,
  maquinaId: "",
  perfilOperativoId: NONE,
  label: "",
  esDefault: false,
  orden: 0,
  setupMin: "",
  cleanupMin: "",
  tiempoFijoMin: "",
  productividadBase: "",
  configNestingV2Json: "",
};

export function AlternativasEditorSheet({
  open,
  onOpenChange,
  operacionId,
  operacionNombre,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  operacionId: string;
  operacionNombre: string;
  onChanged?: () => void;
}) {
  const [alternativas, setAlternativas] = React.useState<ProcesoOperacionAlternativa[]>([]);
  const [maquinas, setMaquinas] = React.useState<Maquina[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [draft, setDraft] = React.useState<DraftForm>(emptyDraft);
  const [showForm, setShowForm] = React.useState(false);

  const reload = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [alts, maqs] = await Promise.all([
        listProcesoOperacionAlternativas(operacionId),
        getMaquinas(),
      ]);
      setAlternativas(alts);
      setMaquinas(maqs.filter((m) => m.activo));
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "No se pudieron cargar las opciones.");
    } finally {
      setIsLoading(false);
    }
  }, [operacionId]);

  React.useEffect(() => {
    if (open) {
      setShowForm(false);
      setDraft(emptyDraft);
      void reload();
    }
  }, [open, reload]);

  const maquinaElegida = React.useMemo(
    () => maquinas.find((m) => m.id === draft.maquinaId) ?? null,
    [maquinas, draft.maquinaId],
  );
  const perfilesDisponibles = maquinaElegida?.perfilesOperativos ?? [];

  function startCreate() {
    const nextOrden = alternativas.length > 0
      ? Math.max(...alternativas.map((a) => a.orden)) + 1
      : 0;
    setDraft({ ...emptyDraft, orden: nextOrden, esDefault: alternativas.length === 0 });
    setShowForm(true);
  }

  function startEdit(alt: ProcesoOperacionAlternativa) {
    setDraft({
      id: alt.id,
      maquinaId: alt.maquinaId,
      perfilOperativoId: alt.perfilOperativoId ?? NONE,
      label: alt.label,
      esDefault: alt.esDefault,
      orden: alt.orden,
      setupMin: alt.setupMin != null ? String(alt.setupMin) : "",
      cleanupMin: alt.cleanupMin != null ? String(alt.cleanupMin) : "",
      tiempoFijoMin: alt.tiempoFijoMin != null ? String(alt.tiempoFijoMin) : "",
      productividadBase:
        alt.productividadBase != null ? String(alt.productividadBase) : "",
      configNestingV2Json:
        alt.configNestingV2 != null
          ? JSON.stringify(alt.configNestingV2, null, 2)
          : "",
    });
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setDraft(emptyDraft);
  }

  async function save() {
    if (!draft.maquinaId) {
      toast.error("Seleccioná una máquina.");
      return;
    }
    if (draft.label.trim().length === 0) {
      toast.error("El label es obligatorio.");
      return;
    }
    const parseOverride = (s: string): number | null | undefined => {
      const t = s.trim();
      if (t === "") return null; // empty → null → usa valor base
      const n = Number(t);
      if (!Number.isFinite(n) || n < 0) return undefined; // inválido → mantener sin tocar
      return n;
    };
    const setupMinVal = parseOverride(draft.setupMin);
    const cleanupMinVal = parseOverride(draft.cleanupMin);
    const tiempoFijoMinVal = parseOverride(draft.tiempoFijoMin);
    const productividadBaseVal = parseOverride(draft.productividadBase);
    if (
      setupMinVal === undefined ||
      cleanupMinVal === undefined ||
      tiempoFijoMinVal === undefined ||
      productividadBaseVal === undefined
    ) {
      toast.error("Los overrides deben ser números >= 0 o quedar vacíos.");
      return;
    }

    // P4-debt #3 — parse configNestingV2 override. Empty → null; JSON inválido → abort.
    let configNestingV2Val: Record<string, unknown> | null;
    const configRaw = draft.configNestingV2Json.trim();
    if (configRaw === "") {
      configNestingV2Val = null;
    } else {
      try {
        const parsed = JSON.parse(configRaw);
        if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
          toast.error("configNestingV2 debe ser un objeto JSON.");
          return;
        }
        configNestingV2Val = parsed as Record<string, unknown>;
      } catch {
        toast.error("configNestingV2 no es JSON válido.");
        return;
      }
    }

    const payload = {
      maquinaId: draft.maquinaId,
      perfilOperativoId: draft.perfilOperativoId === NONE ? null : draft.perfilOperativoId,
      label: draft.label.trim(),
      esDefault: draft.esDefault,
      orden: draft.orden,
      setupMin: setupMinVal,
      cleanupMin: cleanupMinVal,
      tiempoFijoMin: tiempoFijoMinVal,
      productividadBase: productividadBaseVal,
      configNestingV2: configNestingV2Val,
    };
    setIsSaving(true);
    try {
      if (draft.id) {
        await updateProcesoOperacionAlternativa(operacionId, draft.id, payload);
        toast.success("Opción actualizada.");
      } else {
        await createProcesoOperacionAlternativa(operacionId, payload);
        toast.success("Opción creada.");
      }
      cancelForm();
      await reload();
      onChanged?.();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "No se pudo guardar la opción.");
    } finally {
      setIsSaving(false);
    }
  }

  async function remove(alt: ProcesoOperacionAlternativa) {
    if (!confirm(`¿Eliminar la opción "${alt.label}"?`)) return;
    try {
      await deleteProcesoOperacionAlternativa(operacionId, alt.id);
      toast.success("Opción eliminada.");
      await reload();
      onChanged?.();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "No se pudo eliminar.");
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-screen max-w-none overflow-y-auto data-[side=right]:w-[94vw] data-[side=right]:sm:max-w-[94vw] xl:data-[side=right]:w-[1120px] xl:data-[side=right]:sm:max-w-[1120px]"
      >
        <SheetHeader className="px-6 pt-6">
          <SheetTitle>Opciones del paso "{operacionNombre}"</SheetTitle>
          <SheetDescription>
            Cada opción declara una combinación máquina + perfil (y opcionalmente
            override de tiempos/productividad) que el cliente puede elegir al cotizar.
            Si no elige, se usa la marcada <strong>default</strong>.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6 px-6 pb-6">
          {isLoading ? (
            <div className="flex justify-center p-6"><GdiSpinner className="size-6" /></div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  {alternativas.length} {alternativas.length === 1 ? "opción" : "opciones"}
                </div>
                {!showForm && (
                  <Button size="sm" onClick={startCreate}>
                    + Nueva opción
                  </Button>
                )}
              </div>

              {alternativas.length === 0 && !showForm ? (
                <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Este paso todavía no tiene opciones. Si no agregás ninguna, el super motor usa
                  la máquina + perfil por defecto declarados en el paso.
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Label</TableHead>
                      <TableHead>Máquina</TableHead>
                      <TableHead>Perfil</TableHead>
                      <TableHead>Default</TableHead>
                      <TableHead className="w-32" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {alternativas.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-mono text-xs">{a.orden}</TableCell>
                        <TableCell className="font-medium">{a.label}</TableCell>
                        <TableCell className="text-sm">{a.maquina?.nombre ?? "—"}</TableCell>
                        <TableCell className="text-sm">{a.perfilOperativo?.nombre ?? "—"}</TableCell>
                        <TableCell>
                          {a.esDefault ? (
                            <Badge variant="default">default</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" onClick={() => startEdit(a)}>
                            Editar
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => remove(a)}>
                            Borrar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              {showForm && (
                <div className="rounded-md border p-4 space-y-4">
                  <div className="text-sm font-medium">
                    {draft.id ? "Editar opción" : "Nueva opción"}
                  </div>

                  <div className="grid gap-2">
                    <Label>Label visible al cliente</Label>
                    <Input
                      value={draft.label}
                      onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
                      placeholder="Ej: Ricoh · Papel Grueso Simple"
                      maxLength={120}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label>Máquina</Label>
                    <Select
                      value={draft.maquinaId || undefined}
                      onValueChange={(v) =>
                        setDraft((d) => ({
                          ...d,
                          maquinaId: v ?? "",
                          perfilOperativoId: NONE,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccioná una máquina">
                          {maquinaElegida?.nombre ?? "Seleccioná una máquina"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {maquinas.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label>Perfil operativo (opcional)</Label>
                    <Select
                      value={draft.perfilOperativoId}
                      onValueChange={(v) =>
                        setDraft((d) => ({ ...d, perfilOperativoId: v ?? NONE }))
                      }
                      disabled={!draft.maquinaId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sin perfil">
                          {draft.perfilOperativoId === NONE
                            ? "Sin perfil"
                            : perfilesDisponibles.find((p) => p.id === draft.perfilOperativoId)
                                ?.nombre ?? "Perfil"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Sin perfil</SelectItem>
                        {perfilesDisponibles.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!draft.maquinaId && (
                      <p className="text-xs text-muted-foreground">
                        Seleccioná primero una máquina.
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Orden</Label>
                      <Input
                        type="number"
                        min={0}
                        value={draft.orden}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            orden: Math.max(0, parseInt(e.target.value, 10) || 0),
                          }))
                        }
                      />
                    </div>
                    <div className="flex items-end gap-3 pb-2">
                      <Switch
                        id="esDefault"
                        checked={draft.esDefault}
                        onCheckedChange={(v) => setDraft((d) => ({ ...d, esDefault: v }))}
                      />
                      <Label htmlFor="esDefault" className="cursor-pointer">
                        Marcar como default
                      </Label>
                    </div>
                  </div>

                  {/* P4.1 — Overrides respecto al paso base. Si se dejan
                      vacíos, la opción usa los valores base del paso. */}
                  <div className="rounded-md border p-3 space-y-3">
                    <div className="text-sm font-medium">
                      Overrides respecto al paso base
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Dejá vacío para usar el valor base del paso. Completá solo los
                      que querés que esta opción cambie (ej: misma máquina pero
                      distinto tiempo de setup y productividad).
                    </p>
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                      <div className="grid gap-1">
                        <Label>Setup (min)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          min={0}
                          value={draft.setupMin}
                          onChange={(e) =>
                            setDraft((d) => ({ ...d, setupMin: e.target.value }))
                          }
                          placeholder="— base —"
                        />
                      </div>
                      <div className="grid gap-1">
                        <Label>Cleanup (min)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          min={0}
                          value={draft.cleanupMin}
                          onChange={(e) =>
                            setDraft((d) => ({ ...d, cleanupMin: e.target.value }))
                          }
                          placeholder="— base —"
                        />
                      </div>
                      <div className="grid gap-1">
                        <Label>Tiempo fijo (min)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          min={0}
                          value={draft.tiempoFijoMin}
                          onChange={(e) =>
                            setDraft((d) => ({ ...d, tiempoFijoMin: e.target.value }))
                          }
                          placeholder="— base —"
                        />
                      </div>
                      <div className="grid gap-1">
                        <Label>Productividad</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          value={draft.productividadBase}
                          onChange={(e) =>
                            setDraft((d) => ({ ...d, productividadBase: e.target.value }))
                          }
                          placeholder="— base —"
                        />
                      </div>
                    </div>

                    {/* P4-debt #3 — Override de configNestingV2. Si se deja
                        vacío, la opción usa el configNestingV2 base del paso. */}
                    <div className="grid gap-2 pt-3">
                      <Label>Override de configuración de nesting (JSON)</Label>
                      <textarea
                        value={draft.configNestingV2Json}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, configNestingV2Json: e.target.value }))
                        }
                        placeholder={'— base —\n\nEjemplo:\n{\n  "pliegos": [{ "anchoMm": 320, "altoMm": 450, "codigo": "SRA3" }]\n}'}
                        className="min-h-[140px] w-full rounded-md border bg-background px-3 py-2 font-mono text-xs"
                        spellCheck={false}
                      />
                      <p className="text-xs text-muted-foreground">
                        Objeto JSON con la forma que la familia de paso espera
                        (ej. <code className="font-mono">pliegos</code> en nesting-hoja,
                        <code className="font-mono"> placas</code> en nesting-placa-rigida).
                        Dejá vacío para usar el configNestingV2 base del paso.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={cancelForm} disabled={isSaving}>
                      Cancelar
                    </Button>
                    <Button size="sm" onClick={save} disabled={isSaving}>
                      {isSaving ? <GdiSpinner className="size-4" /> : "Guardar"}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
