"use client";

import { useId, useRef, useState } from "react";
import { PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@heroui/react";
import { ActionButton } from "@/components/design-system/action-button";
import { SelectField } from "@/components/design-system/select-field";
import focus from "@/components/design-system/field-focus.module.css";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { usePuede } from "@/components/navigation/permisos-provider";
import { useCapacidad } from "@/components/navigation/capacidades-provider";
import { createPlanta } from "@/lib/costos-api";
import type { Planta } from "@/lib/costos";

export function PlantaSelector({
  plantas,
  value,
  onChange,
  onAltaAbiertaChange,
}: {
  plantas: Planta[];
  value: string;
  onChange: (id: string) => void;
  onAltaAbiertaChange?: (abierta: boolean) => void;
}) {
  const id = useId();
  const puedeGestionar = usePuede("costos.gestionar");
  const maquinaria = useCapacidad("maquinaria");
  const centros = useCapacidad("centros_costo");
  const puedeCrear = puedeGestionar && (maquinaria || centros);
  const [creadas, setCreadas] = useState<Planta[]>([]);
  const [abierta, setAbierta] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const enviando = useRef(false);
  const opciones = [
    ...plantas,
    ...creadas.filter((p) => !plantas.some((o) => o.id === p.id)),
  ];
  const activas = opciones.filter((p) => p.activa || p.id === value);
  const cambiarAbierta = (siguiente: boolean) => {
    setAbierta(siguiente);
    onAltaAbiertaChange?.(siguiente);
  };
  const abrir = () => {
    let numero = 1;
    while (
      opciones.some(
        (p) =>
          p.codigo.toUpperCase() === `PLT-${String(numero).padStart(3, "0")}`,
      )
    )
      numero++;
    setCodigo(`PLT-${String(numero).padStart(3, "0")}`);
    setNombre("");
    setError("");
    cambiarAbierta(true);
  };
  const guardar = async () => {
    if (enviando.current || !puedeCrear || !codigo.trim() || !nombre.trim())
      return;
    enviando.current = true;
    setGuardando(true);
    setError("");
    try {
      const planta = await createPlanta({
        codigo: codigo.trim(),
        nombre: nombre.trim(),
      });
      setCreadas((actuales) => [...actuales, planta]);
      onChange(planta.id);
      cambiarAbierta(false);
      toast.success("Planta creada y seleccionada.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear la planta.");
    } finally {
      enviando.current = false;
      setGuardando(false);
    }
  };

  return (
    <FieldGroup>
      <Field>
        <FieldLabel>Planta</FieldLabel>
        <SelectField
          value={value}
          onChange={onChange}
          disabled={activas.length === 0 || guardando}
          aria-label="Planta"
          className="w-full min-w-0"
          options={activas.map((p) => ({
            value: p.id,
            label: p.nombre,
            disabled: !p.activa,
          }))}
        />
        <FieldDescription>
          {activas.length === 0
            ? "Creá la planta o taller donde vas a usar esta máquina."
            : "La planta identifica el taller o sede donde trabaja la máquina."}
        </FieldDescription>
        {puedeCrear && !abierta && (
          <div>
            <ActionButton type="button" variant="outline" onPress={abrir}>
              <PlusIcon data-icon="inline-start" /> Nueva planta
            </ActionButton>
          </div>
        )}
      </Field>
      {puedeCrear && abierta && (
        <FieldSet
          disabled={guardando}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              (event.target as HTMLElement).tagName === "INPUT"
            ) {
              event.preventDefault();
              event.stopPropagation();
              void guardar();
            }
          }}
        >
          <FieldLegend>Nueva planta</FieldLegend>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={`${id}-nombre`}>
                Nombre de la planta
              </FieldLabel>
              <Input
                id={`${id}-nombre`}
                className={focus.singleBorder}
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej: Taller principal"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`${id}-codigo`}>
                Código de la planta
              </FieldLabel>
              <Input
                id={`${id}-codigo`}
                className={focus.singleBorder}
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
              />
              <FieldDescription>
                Un código corto y único dentro de tu empresa.
              </FieldDescription>
            </Field>
          </FieldGroup>
          {error && (
            <Alert variant="destructive">
              <AlertTitle>No se pudo crear la planta</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="flex flex-wrap gap-2">
            <ActionButton
              type="button"
              isDisabled={guardando || !codigo.trim() || !nombre.trim()}
              onPress={() => void guardar()}
            >
              {guardando ? "Guardando…" : "Guardar planta"}
            </ActionButton>
            <ActionButton
              type="button"
              variant="outline"
              isDisabled={guardando}
              onPress={() => cambiarAbierta(false)}
            >
              Cancelar nueva planta
            </ActionButton>
          </div>
        </FieldSet>
      )}
    </FieldGroup>
  );
}
