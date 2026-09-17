"use client";
import styles from "../maquinaria.module.css";
import focus from "@/components/design-system/field-focus.module.css";
import { SelectField } from "@/components/design-system/select-field";

import * as React from "react";
import { ArrowUpRightIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ActionButton as Button } from "@/components/design-system/action-button";
import { Modal } from "@heroui/react";
import { MaquinariaDialog } from "./maquinaria-dialog";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@heroui/react";
import type { Planta } from "@/lib/costos";
import type { MaquinaPayload, PlantillaMaquinaria } from "@/lib/maquinaria";
import { createMaquina } from "@/lib/maquinaria-api";
import {
  getMaquinariaTemplate,
  maquinariaTemplates,
} from "@/lib/maquinaria-templates";
import { emptyMaquina } from "./helpers";

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
    <MaquinariaDialog
      isOpen={open}
      onOpenChange={(next) => {
        if (!next && !creando) onClose();
      }}
      isDismissable={!creando}
      title="Nueva máquina"
      description="Crearemos un borrador. Después podrás completar perfiles, consumibles y costos antes de activarla."
    >
      <form onSubmit={handleCrear} className={styles.modalForm}>
        <Modal.Body className={styles.modalBody}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="maquina-alta-nombre">
                Nombre de la máquina
              </FieldLabel>
              <Input
                className={focus.singleBorder}
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
              <SelectField
                value={plantilla ?? ""}
                onChange={(value) =>
                  setPlantilla((value ?? null) as PlantillaMaquinaria | null)
                }
                aria-label="Tipo de máquina"
                className="w-full"
                options={[
                  ...(maquinariaTemplates.map((template) => ({
                    value: template.id,
                    label: template.label,
                  })) ?? []),
                ]}
              />
            </Field>

            <Field data-disabled={plantas.length === 0}>
              <FieldLabel>Planta</FieldLabel>
              <SelectField
                value={plantaId}
                disabled={plantas.length === 0}
                onChange={(value) => setPlantaId(value ?? "")}
                aria-label="Planta"
                className="w-full"
                options={[
                  ...(plantas.map((planta) => ({
                    value: planta.id,
                    label: planta.nombre,
                  })) ?? []),
                ]}
              />
              {plantas.length === 0 ? (
                <FieldDescription>
                  Primero debes crear una planta.
                </FieldDescription>
              ) : null}
            </Field>
          </FieldGroup>
        </Modal.Body>
        <Modal.Footer className={styles.modalFooter}>
          <Button
            type="button"
            variant="outline"
            isDisabled={creando}
            onClick={onClose}
          >
            Cancelar
          </Button>
          <Button type="submit" isDisabled={!puedeGuardar}>
            <ArrowUpRightIcon />
            {creando ? "Creando…" : "Crear borrador"}
          </Button>
        </Modal.Footer>
      </form>
    </MaquinariaDialog>
  );
}
