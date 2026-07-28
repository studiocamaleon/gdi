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
  PlantillaMaquinaria,
} from "@/lib/maquinaria";
import { getMaquinariaTemplate } from "@/lib/maquinaria-templates";
import { getMateriasPrimas } from "@/lib/materias-primas-api";
import type { MateriaPrima } from "@/lib/materias-primas";

import {
  cleanGranFormatoGeometryFields,
  cloneRecord,
  emptyMaquina,
  getDefaultOpenSection,
  getDefaultProductivityUnit,
  getDefaultProfileType,
  getPerfilFieldValue,
  maquinaToPayload,
  normalizePerfilTypeForTemplate,
  normalizeProductionUnitForTemplate,
  normalizeRequiredPrinterConsumibles,
  setMaquinaFieldValue,
  setPerfilFieldValue,
  type LocalPerfil,
} from "./helpers";

export function useMaquinaEditor({
  defaultPlantaId,
  activo,
  initialMaquina,
}: {
  defaultPlantaId: string;
  /** Con el editor cerrado no se cargan materias primas (el sheet las pide al abrir). */
  activo: boolean;
  /** La ficha edita una máquina existente desde el primer render (sin initDesdeMaquina). */
  initialMaquina?: Maquina;
}) {
  const [form, setForm] = React.useState<MaquinaPayload>(() =>
    initialMaquina ? maquinaToPayload(initialMaquina) : emptyMaquina(defaultPlantaId),
  );
  const [perfiles, setPerfiles] = React.useState<LocalPerfil[]>(() => {
    if (!initialMaquina) return [];
    const payload = maquinaToPayload(initialMaquina);
    return payload.perfilesOperativos.map((p, i) =>
      normalizePerfilTypeForTemplate({ ...p, uiKey: `p-${i}-init` }, payload),
    );
  });
  const [openSection, setOpenSection] = React.useState<string | null>(() =>
    initialMaquina
      ? getDefaultOpenSection(initialMaquina.plantilla)
      : "capacidades_fisicas",
  );
  const [materiasPrimas, setMateriasPrimas] = React.useState<MateriaPrima[]>([]);
  const [loadingMaterias, setLoadingMaterias] = React.useState(false);

  const template: MaquinariaTemplateDefinition | null = React.useMemo(
    () => getMaquinariaTemplate(form.plantilla),
    [form.plantilla],
  );

  React.useEffect(() => {
    if (!activo || materiasPrimas.length > 0 || loadingMaterias) return;
    setLoadingMaterias(true);
    getMateriasPrimas()
      .then(setMateriasPrimas)
      .catch((err) => {
        toast.error(
          err instanceof Error ? err.message : "No se pudieron cargar materias primas",
        );
      })
      .finally(() => setLoadingMaterias(false));
  }, [activo, loadingMaterias, materiasPrimas.length]);

  const initNueva = React.useCallback(() => {
    const initialForm = emptyMaquina(defaultPlantaId);
    setForm(initialForm);
    setPerfiles([]);
    setOpenSection(getDefaultOpenSection(initialForm.plantilla));
  }, [defaultPlantaId]);

  const initDesdeMaquina = React.useCallback((maquina: Maquina) => {
    const payload = maquinaToPayload(maquina);
    setForm(payload);
    setPerfiles(
      payload.perfilesOperativos.map((p, i) =>
        normalizePerfilTypeForTemplate(
          {
            ...p,
            uiKey: `p-${i}-${Date.now()}`,
          },
          payload,
        ),
      ),
    );
    setOpenSection(getDefaultOpenSection(payload.plantilla));
  }, []);

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
      consumibles: [],
    }));
    setPerfiles([]); // los perfiles también dependen del template
    setOpenSection(getDefaultOpenSection(newPlantilla));
  };

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
    if (field.key === "gramajeMaxGr" && typeof value === "number") {
      setPerfiles((current) =>
        current.map((perfil) => {
          const currentMax = Number(getPerfilFieldValue(perfil, "gramajeMaxGr"));
          if (!Number.isFinite(currentMax) || currentMax <= value) return perfil;
          return setPerfilFieldValue(perfil, "gramajeMaxGr", value);
        }),
      );
    }
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
    openSection,
    setOpenSection,
    materiasPrimas,
    loadingMaterias,
    initNueva,
    initDesdeMaquina,
    handlePlantillaChange,
    handleMaquinaFieldChange,
    handleAgregarPerfil,
    handleEliminarPerfil,
    handleDuplicarPerfil,
    buildPayload,
  };
}

export type MaquinaEditorState = ReturnType<typeof useMaquinaEditor>;
