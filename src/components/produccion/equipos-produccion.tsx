"use client";

import { useState } from "react";
import { PlusIcon, UsersIcon, PencilIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CalendarioEditor, diasInvalidos } from "./calendario-editor";
import {
  calendarioDefault,
  etiquetaCalendario,
  type EquipoProduccion,
  type Estacion,
} from "@/lib/estaciones";
import { guardarEquipoProduccion } from "@/lib/estaciones-api";
import s from "./equipos-produccion.module.css";

export function EquiposProduccion({
  equipos,
  estaciones,
  error,
  onSaved,
}: {
  equipos: EquipoProduccion[];
  estaciones: Estacion[];
  error: string | null;
  onSaved: () => Promise<void>;
}) {
  const [editor, setEditor] = useState<EquipoProduccion | "nuevo" | null>(null);
  return (
    <Card className={s.card}>
      <CardHeader className={s.header}>
        <div>
          <CardTitle className={s.title}>
            <UsersIcon size={18} />
            Equipos compartidos
          </CardTitle>
          <CardDescription>
            Las personas disponibles se comparten entre todas sus estaciones.
          </CardDescription>
        </div>
        <Button variant="outline" onClick={() => setEditor("nuevo")}>
          <PlusIcon data-icon="inline-start" />
          Crear equipo
        </Button>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {!equipos.length && !error ? (
          <p className={s.help}>
            Creá, por ejemplo, Diseño, Impresión y Taller. Cada persona debe
            contarse en un solo equipo; vinculá ese mismo equipo a todas las
            estaciones que atiende.
          </p>
        ) : null}
        <div className={s.list}>
          {equipos.map((e) => (
            <div key={e.id} className={s.team}>
              <div>
                <strong>{e.nombre}</strong>
                <span>
                  {e.personas} {e.personas === 1 ? "persona" : "personas"} ·{" "}
                  {e.activo
                    ? `${estaciones.filter((x) => x.equipoProduccionId === e.id).length} estaciones`
                    : "Inactivo"}
                </span>
                <span>{etiquetaCalendario(e.calendario) ?? "Sin horario"}</span>
              </div>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={`Editar equipo ${e.nombre}`}
                onClick={() => setEditor(e)}
              >
                <PencilIcon />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
      {editor && (
        <EditorEquipo
          key={typeof editor === "string" ? editor : editor.id}
          initial={editor === "nuevo" ? undefined : editor}
          estaciones={estaciones}
          onClose={() => setEditor(null)}
          onSaved={onSaved}
        />
      )}
    </Card>
  );
}

function EditorEquipo({
  initial,
  estaciones,
  onClose,
  onSaved,
}: {
  initial?: EquipoProduccion;
  estaciones: Estacion[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [draft, setDraft] = useState<Omit<EquipoProduccion, "id">>(
    () =>
      initial ?? {
        nombre: "",
        personas: 1,
        activo: true,
        calendario: calendarioDefault(),
      },
  );
  const [saving, setSaving] = useState(false),
    [error, setError] = useState<string | null>(null);
  const [guardadoId, setGuardadoId] = useState(initial?.id);
  const valido =
    !!draft.nombre.trim() &&
    Number.isInteger(draft.personas) &&
    draft.personas >= 1 &&
    draft.personas <= 99 &&
    draft.calendario &&
    !diasInvalidos(draft.calendario).length &&
    Object.values(draft.calendario.dias).some((d) => d?.length);
  async function guardar() {
    if (!valido || saving) return;
    setSaving(true);
    setError(null);
    try {
      const guardado = await guardarEquipoProduccion(draft, guardadoId);
      setGuardadoId(guardado.id);
      await onSaved();
      onClose();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo guardar el equipo.",
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !saving) onClose();
      }}
    >
      <DialogContent className={s.dialog}>
        <DialogHeader>
          <DialogTitle>
            {initial ? "Editar equipo" : "Nuevo equipo"}
          </DialogTitle>
          <DialogDescription>
            Personas con el mismo horario y las mismas tareas habilitadas. No
            cuentes a una persona en dos equipos.
          </DialogDescription>
        </DialogHeader>
        <div className={s.body}>
          <FieldGroup>
            <div className={s.fields}>
              <Field>
                <FieldLabel htmlFor="equipo-nombre">Nombre</FieldLabel>
                <Input
                  id="equipo-nombre"
                  maxLength={120}
                  value={draft.nombre}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, nombre: e.target.value }))
                  }
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="equipo-personas">
                  Personas disponibles
                </FieldLabel>
                <Input
                  id="equipo-personas"
                  type="number"
                  min={1}
                  max={99}
                  step={1}
                  value={Number.isFinite(draft.personas) ? draft.personas : ""}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      personas:
                        e.target.value === "" ? NaN : Number(e.target.value),
                    }))
                  }
                />
              </Field>
            </div>
            <FieldDescription>
              Si una colocación necesita dos personas, reservará dos cupos de
              Taller durante el tiempo cotizado. Los empleados habilitados en la
              estación siguen controlando quién puede registrar el trabajo.
            </FieldDescription>
            <CalendarioEditor
              fuentes={estaciones}
              value={draft.calendario}
              onChange={(calendario) => setDraft((d) => ({ ...d, calendario }))}
            />
            <Field orientation="horizontal">
              <Switch
                id="equipo-activo"
                aria-label="Equipo disponible para producir"
                checked={draft.activo}
                onCheckedChange={(activo) =>
                  setDraft((d) => ({ ...d, activo }))
                }
              />
              <FieldLabel htmlFor="equipo-activo">
                Equipo disponible para producir
              </FieldLabel>
            </Field>
            {!draft.activo && (
              <p className={s.help}>
                Sus estaciones quedarán sin capacidad humana hasta reactivarlo o
                asignarles otro equipo.
              </p>
            )}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </FieldGroup>
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={saving} onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={!valido || saving} onClick={() => void guardar()}>
            {saving ? "Guardando…" : "Guardar equipo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
