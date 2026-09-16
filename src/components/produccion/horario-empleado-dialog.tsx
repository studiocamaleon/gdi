"use client";
import { useState } from "react";
import { ActionButton } from "@/components/design-system/action-button";
import { FormDialog } from "@/components/design-system/form-dialog";
import { CalendarioEditor, diasInvalidos } from "./calendario-editor";
import type { CalendarioEstacion, Estacion } from "@/lib/estaciones";
import f from "./estacion-form.module.css";

export function HorarioEmpleadoDialog({
  nombre,
  value,
  fuentes,
  onClose,
  onApply,
}: {
  nombre: string;
  value: CalendarioEstacion | null;
  fuentes: Pick<Estacion, "id" | "nombre" | "calendario">[];
  onClose: () => void;
  onApply: (value: CalendarioEstacion) => void;
}) {
  const [calendario, setCalendario] = useState(value);
  return (
    <FormDialog
      className={f.dialog}
      isOpen
      onOpenChange={(open) => !open && onClose()}
      title={`Horario de ${nombre}`}
      description="Este horario es personal y se aplica en todas sus estaciones. Los cambios se guardan al guardar la estación."
    >
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <CalendarioEditor
          titulo="Horario laboral"
          value={calendario}
          onChange={setCalendario}
          fuentes={fuentes}
        />
      </div>
      <div className="flex shrink-0 justify-end gap-2 border-t border-[var(--border)] p-4">
        <ActionButton variant="outline" onPress={onClose}>
          Cancelar
        </ActionButton>
        <ActionButton
          isDisabled={!calendario || diasInvalidos(calendario).length > 0}
          onPress={() => calendario && onApply(calendario)}
        >
          Aplicar horario
        </ActionButton>
      </div>
    </FormDialog>
  );
}
