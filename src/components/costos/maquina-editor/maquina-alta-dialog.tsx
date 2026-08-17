"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import type { Planta } from "@/lib/costos";
import type { MaquinaPayload, PlantillaMaquinaria } from "@/lib/maquinaria";
import { createMaquina } from "@/lib/maquinaria-api";
import {
  getMaquinariaTemplate,
  maquinariaTemplates,
} from "@/lib/maquinaria-templates";
import { emptyMaquina, SelectDisplay } from "./helpers";

type MaquinaAltaDialogProps = {
  open: boolean;
  onClose: () => void;
  plantas: Planta[];
};

export function MaquinaAltaDialog({
  open,
  onClose,
  plantas,
}: MaquinaAltaDialogProps) {
  const router = useRouter();
  const [nombre, setNombre] = React.useState("");
  const [plantilla, setPlantilla] = React.useState<PlantillaMaquinaria | null>(
    null,
  );
  const [plantaId, setPlantaId] = React.useState(plantas[0]?.id ?? "");
  const [creando, setCreando] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setNombre("");
    setPlantilla(null);
    setPlantaId(plantas[0]?.id ?? "");
    setCreando(false);
  }, [open, plantas]);

  const puedeGuardar =
    nombre.trim().length > 0 &&
    plantilla !== null &&
    Boolean(plantaId) &&
    !creando;

  const handleCrear = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!puedeGuardar || !plantilla) return;
    setCreando(true);
    try {
      const template = getMaquinariaTemplate(plantilla);
      const base = emptyMaquina(plantaId);
      const payload: MaquinaPayload = {
        ...base,
        nombre: nombre.trim(),
        plantilla,
        plantaId,
        geometriaTrabajo: template?.geometry ?? base.geometriaTrabajo,
        unidadProduccionPrincipal:
          template?.defaultProductionUnit ?? base.unidadProduccionPrincipal,
        estado: "inactiva",
        activo: false,
        estadoConfiguracion: "borrador",
      };
      const created = await createMaquina(payload);
      toast.success(
        `"${created.nombre}" creada. Completá su ficha para activarla.`,
      );
      router.push(`/costos/maquinaria/${created.id}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Error creando la máquina",
      );
      setCreando(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !creando) onClose();
      }}
    >
      <DialogContent>
        <form onSubmit={handleCrear} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Nueva máquina</DialogTitle>
            <DialogDescription>
              Crearemos un borrador. Después podrás completar perfiles,
              consumibles y costos antes de activarla.
            </DialogDescription>
          </DialogHeader>

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="maquina-alta-nombre">
                Nombre de la máquina
              </FieldLabel>
              <Input
                id="maquina-alta-nombre"
                value={nombre}
                autoFocus
                maxLength={120}
                required
                onChange={(event) => setNombre(event.target.value)}
                placeholder="Ej: Impresora láser color"
              />
            </Field>

            <Field>
              <FieldLabel>Tipo de máquina</FieldLabel>
              <Select
                value={plantilla ?? undefined}
                onValueChange={(value) =>
                  setPlantilla((value ?? null) as PlantillaMaquinaria | null)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectDisplay
                    label={
                      plantilla
                        ? maquinariaTemplates.find(
                            (template) => template.id === plantilla,
                          )?.label
                        : undefined
                    }
                    placeholder="Seleccionar tipo"
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {maquinariaTemplates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>

            <Field data-disabled={plantas.length === 0}>
              <FieldLabel>Planta</FieldLabel>
              <Select
                value={plantaId || undefined}
                disabled={plantas.length === 0}
                onValueChange={(value) => setPlantaId(value ?? "")}
              >
                <SelectTrigger className="w-full">
                  <SelectDisplay
                    label={
                      plantas.find((planta) => planta.id === plantaId)?.nombre
                    }
                    placeholder="Seleccionar planta"
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {plantas.map((planta) => (
                      <SelectItem key={planta.id} value={planta.id}>
                        {planta.nombre}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {plantas.length === 0 ? (
                <FieldDescription>
                  Primero debes crear una planta.
                </FieldDescription>
              ) : null}
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={creando}
              onClick={onClose}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={!puedeGuardar}>
              {creando ? "Creando…" : "Crear borrador"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
