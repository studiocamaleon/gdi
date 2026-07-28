"use client";

/**
 * Estado y handlers del editor de una máquina, sin UI.
 *
 * Extraído de maquinaria-panel.tsx en la Fase B de la migración de UI
 * (2026-07-28): el mismo estado sirve al sheet de hoy y a la ficha por
 * máquina de la Fase C. Sin cambios de comportamiento. Guardar queda
 * afuera a propósito: crear vs. actualizar (y qué hacer después) es del
 * caller; acá sólo se normaliza el payload con `buildPayload()`.
 */

import * as React from "react";
import { toast } from "sonner";

import type {
  Maquina,
  MaquinaPayload,
  MaquinariaTemplateDefinition,
  MaquinariaTemplateField,
} from "@/lib/maquinaria";
import { getMaquinariaTemplate } from "@/lib/maquinaria-templates";
import { getMateriasPrimas } from "@/lib/materias-primas-api";
import type { MateriaPrima } from "@/lib/materias-primas";

import {
  cleanGranFormatoGeometryFields,
  cloneRecord,
  getDefaultProductivityUnit,
  getDefaultProfileType,
  maquinaToPayload,
  normalizePerfilTypeForTemplate,
  normalizeProductionUnitForTemplate,
  normalizeRequiredPrinterConsumibles,
  setMaquinaFieldValue,
  type LocalPerfil,
} from "./helpers";

export function useMaquinaEditor({
  maquina,
}: {
  /** La ficha edita una máquina existente desde el primer render. */
  maquina: Maquina;
}) {
  const [form, setForm] = React.useState<MaquinaPayload>(() =>
    maquinaToPayload(maquina),
  );
  const [perfiles, setPerfiles] = React.useState<LocalPerfil[]>(() => {
    const payload = maquinaToPayload(maquina);
    return payload.perfilesOperativos.map((p, i) =>
      normalizePerfilTypeForTemplate({ ...p, uiKey: `p-${i}-init` }, payload),
    );
  });
  const [materiasPrimas, setMateriasPrimas] = React.useState<MateriaPrima[]>([]);
  const [loadingMaterias, setLoadingMaterias] = React.useState(false);

  const template: MaquinariaTemplateDefinition | null = React.useMemo(
    () => getMaquinariaTemplate(form.plantilla),
    [form.plantilla],
  );

  React.useEffect(() => {
    if (materiasPrimas.length > 0 || loadingMaterias) return;
    setLoadingMaterias(true);
    getMateriasPrimas()
      .then(setMateriasPrimas)
      .catch((err) => {
        toast.error(
          err instanceof Error ? err.message : "No se pudieron cargar materias primas",
        );
      })
      .finally(() => setLoadingMaterias(false));
  }, [loadingMaterias, materiasPrimas.length]);

  const handleMaquinaFieldChange = (
    field: MaquinariaTemplateField,
    value: unknown,
  ) => {
    setForm((current) => {
      const next = setMaquinaFieldValue(current, field.key, value);
      return field.key === "geometria"
        ? cleanGranFormatoGeometryFields(next, value)
        : next;
    });
    if (field.key === "soportaCorteIntegrado" && value !== true) {
      const nextForm = setMaquinaFieldValue(form, field.key, value);
      setPerfiles((current) =>
        current.map((perfil) => normalizePerfilTypeForTemplate(perfil, nextForm)),
      );
    }
    if (field.key === "geometria" && value !== "MESA_EXTENSORA") {
      setPerfiles((current) =>
        current.map((perfil) => {
          const detalle = { ...(perfil.detalle ?? {}) };
          delete detalle.modoOperacion;
          return { ...perfil, detalle };
        }),
      );
    }
  };

  const handleAgregarPerfil = () => {
    setPerfiles((prev) => {
      const nuevoPerfil = normalizePerfilTypeForTemplate(
        {
          uiKey: `p-${Date.now()}-${Math.random()}`,
          id: crypto.randomUUID(),
          nombre: "Nuevo perfil",
          tipoPerfil: getDefaultProfileType(form),
          productivityUnit: getDefaultProductivityUnit(form),
          activo: true,
          detalle: {},
        },
        form,
      );
      return [
        ...prev,
        nuevoPerfil,
      ];
    });
  };

  const handleEliminarPerfil = (uiKey: string) => {
    setPerfiles((prev) => {
      const perfil = prev.find((p) => p.uiKey === uiKey);
      if (perfil?.id) {
        setForm((current) => ({
          ...current,
          consumibles: current.consumibles.filter(
            (consumible) => consumible.perfilOperativoId !== perfil.id,
          ),
        }));
      }
      return prev.filter((p) => p.uiKey !== uiKey);
    });
  };

  const handleDuplicarPerfil = (uiKey: string) => {
    const source = perfiles.find((perfil) => perfil.uiKey === uiKey);
    if (!source) return;

    const newProfileId = crypto.randomUUID();
    const duplicateName = `${source.nombre || "Perfil"} copia`;
    const duplicatedPerfil: LocalPerfil = {
      ...source,
      uiKey: `p-${Date.now()}-${Math.random()}`,
      id: newProfileId,
      nombre: duplicateName,
      detalle: cloneRecord(source.detalle) ?? {},
      reglaSeleccionJson: cloneRecord(source.reglaSeleccionJson),
    };

    setPerfiles((prev) => {
      const sourceIndex = prev.findIndex((perfil) => perfil.uiKey === uiKey);
      const next = [...prev];
      next.splice(sourceIndex + 1, 0, duplicatedPerfil);
      return next;
    });

    if (source.id) {
      setForm((current) => ({
        ...current,
        consumibles: [
          ...current.consumibles,
          ...current.consumibles
            .filter((consumible) => consumible.perfilOperativoId === source.id)
            .map((consumible) => ({
              ...consumible,
              id: crypto.randomUUID(),
              perfilOperativoId: newProfileId,
              perfilOperativoNombre: duplicateName,
              nombre: consumible.nombre
                ? `${consumible.nombre} copia`
                : consumible.nombre,
              detalle: cloneRecord(consumible.detalle),
            })),
        ],
      }));
    }
  };

  /** Normaliza form + perfiles al payload que espera el API. */
  const buildPayload = (): MaquinaPayload => {
    const normalizedForm: MaquinaPayload = {
      ...form,
      unidadProduccionPrincipal: normalizeProductionUnitForTemplate(form),
    };
    const normalizedPerfiles = perfiles.map((perfil) =>
      normalizePerfilTypeForTemplate(perfil, normalizedForm),
    );
    const perfilesOperativos = normalizedPerfiles.map((perfil) => {
      const payloadPerfil: Partial<LocalPerfil> = { ...perfil };
      delete payloadPerfil.uiKey;
      return payloadPerfil as NonNullable<
        MaquinaPayload["perfilesOperativos"]
      >[number];
    });
    return {
      ...normalizedForm,
      perfilesOperativos,
      consumibles: normalizeRequiredPrinterConsumibles(
        normalizedForm,
        normalizedPerfiles,
      ),
    };
  };

  return {
    form,
    setForm,
    perfiles,
    setPerfiles,
    template,
    materiasPrimas,
    loadingMaterias,
    handleMaquinaFieldChange,
    handleAgregarPerfil,
    handleEliminarPerfil,
    handleDuplicarPerfil,
    buildPayload,
  };
}

export type MaquinaEditorState = ReturnType<typeof useMaquinaEditor>;
