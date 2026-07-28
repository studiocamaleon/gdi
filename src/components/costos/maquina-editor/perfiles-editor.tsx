/**
 * Editor de perfiles operativos de una máquina — tabla estilo Holdprint
 * (2026-07-28): una fila por perfil, columnas generadas desde los campos
 * que declara la plantilla (la unidad va en el encabezado), y la tinta se
 * configura desde un botón que abre el modal PerfilTintasModal. Antes era
 * una card con acordeón por perfil.
 */

import * as React from "react";
import { CopyIcon, PlusIcon, XIcon } from "lucide-react";

import {
  tipoPerfilOperativoMaquinaItems,
  type MaquinaPayload,
  type MaquinariaTemplateField,
} from "@/lib/maquinaria";
import type { MateriaPrima } from "@/lib/materias-primas";

import { PerfilTintasModal } from "./consumibles-editor";
import {
  FieldInput,
  PRINTER_TEMPLATES_WITH_CONSUMIBLES,
  canalFromConsumible,
  cleanPerfilDetailsForType,
  getAllowedProfileTypes,
  getDefaultProfileType,
  getPerfilFieldValue,
  getTemplateUnitLabel,
  normalizePerfilTypeForTemplate,
  restringirColoresDelPerfil,
  setPerfilFieldValue,
  setPerfilFieldValueForTemplate,
  shouldShowPerfilField,
  type LocalPerfil,
} from "./helpers";

// ─── Sub-componente: editor de perfiles ────────────────────────────

interface PerfilesProps {
  perfiles: LocalPerfil[];
  setPerfiles: React.Dispatch<React.SetStateAction<LocalPerfil[]>>;
  sectionFields: MaquinariaTemplateField[];
  form: MaquinaPayload;
  setForm: React.Dispatch<React.SetStateAction<MaquinaPayload>>;
  materiasPrimas: MateriaPrima[];
  loadingMaterias: boolean;
  onAgregar: () => void;
  onEliminar: (uiKey: string) => void;
  onDuplicar: (uiKey: string) => void;
}

export function PerfilesOperativosEditor({
  perfiles,
  setPerfiles,
  sectionFields,
  form,
  setForm,
  materiasPrimas,
  loadingMaterias,
  onAgregar,
  onEliminar,
  onDuplicar,
}: PerfilesProps) {
  const [tintasDeUiKey, setTintasDeUiKey] = React.useState<string | null>(null);

  const allowedProfileTypeItems = tipoPerfilOperativoMaquinaItems.filter((item) =>
    getAllowedProfileTypes(form).includes(item.value),
  );
  // La columna Tipo sólo aparece si hay algo que elegir.
  const conColumnaTipo = allowedProfileTypeItems.length > 1;
  // Tintas por perfil: impresoras de la familia, menos láser (tóner por máquina).
  const conColumnaTinta =
    PRINTER_TEMPLATES_WITH_CONSUMIBLES.has(form.plantilla) &&
    form.plantilla !== "impresora_laser";

  const updatePerfil = (uiKey: string, next: LocalPerfil) => {
    setPerfiles((prev) => prev.map((p) => (p.uiKey === uiKey ? next : p)));
  };

  const tintasConfiguradas = (perfil: LocalPerfil) =>
    form.consumibles.filter(
      (item) =>
        item.perfilOperativoId === perfil.id &&
        item.materiaPrimaVarianteId &&
        canalFromConsumible(item),
    ).length;

  const perfilTintas = perfiles.find((p) => p.uiKey === tintasDeUiKey) ?? null;

  // Una columna existe sólo si al menos un perfil la usa: los campos de
  // corte no ocupan lugar cuando todos los perfiles son de impresión.
  const visibleFields = sectionFields.filter(
    (field) =>
      perfiles.length === 0 ||
      perfiles.some((perfil) => shouldShowPerfilField(field, form, perfil)),
  );

  return (
    <div className="maq-perfiles">
      {perfiles.length === 0 ? (
        <p className="maq-perfiles-vacio">Sin perfiles. Agregá al menos uno.</p>
      ) : (
        <div className="maq-perfiles-scroll">
          <table className="maq-perfiles-tabla">
            <thead>
              <tr>
                {conColumnaTipo ? <th className="tipo">Tipo</th> : null}
                {visibleFields.map((field) => (
                  <th
                    key={field.key}
                    title={field.description}
                    className={field.kind === "number" ? "num" : undefined}
                  >
                    {field.label}
                    {field.unit ? (
                      <span className="unidad"> ({getTemplateUnitLabel(field.unit)})</span>
                    ) : null}
                    {field.required ? <span className="req"> *</span> : null}
                  </th>
                ))}
                {conColumnaTinta ? <th className="tinta">Tinta</th> : null}
                <th className="acciones" aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {perfiles.map((perfil, idx) => {
                const cantidadTintas = tintasConfiguradas(perfil);
                return (
                  <tr key={perfil.uiKey}>
                    {conColumnaTipo ? (
                      <td className="tipo">
                        <select
                          value={perfil.tipoPerfil}
                          aria-label={`Tipo del perfil ${perfil.nombre || idx + 1}`}
                          onChange={(e) => {
                            const next = normalizePerfilTypeForTemplate(
                              cleanPerfilDetailsForType(
                                setPerfilFieldValue(
                                  perfil,
                                  "tipoPerfil",
                                  e.target.value || getDefaultProfileType(form),
                                ),
                              ),
                              form,
                            );
                            updatePerfil(perfil.uiKey, next);
                          }}
                        >
                          {allowedProfileTypeItems.map((item) => (
                            <option key={item.value} value={item.value}>
                              {item.label}
                            </option>
                          ))}
                        </select>
                      </td>
                    ) : null}
                    {visibleFields.map((field) => {
                      const esNum = field.kind === "number";
                      if (!shouldShowPerfilField(field, form, perfil)) {
                        return (
                          <td key={field.key} className={esNum ? "na num" : "na"}>
                            —
                          </td>
                        );
                      }
                      const valor = getPerfilFieldValue(perfil, field.key);
                      // La unidad vive en el encabezado; la celda va limpia.
                      const sinUnidad: MaquinariaTemplateField = field.unit
                        ? { ...field, unit: undefined }
                        : field;
                      // Los colores del perfil no pueden exceder los de la máquina.
                      const cellField = restringirColoresDelPerfil(
                        sinUnidad,
                        form,
                        valor,
                      );
                      return (
                        <td key={field.key} className={esNum ? "num" : undefined}>
                          <FieldInput
                            field={cellField}
                            value={valor}
                            onChange={(v) => {
                              const next = setPerfilFieldValueForTemplate(
                                perfil,
                                form,
                                field.key,
                                v,
                              );
                              updatePerfil(perfil.uiKey, next);
                            }}
                          />
                        </td>
                      );
                    })}
                    {conColumnaTinta ? (
                      <td className="tinta">
                        {perfil.tipoPerfil === "corte" ? (
                          <span className="na">—</span>
                        ) : (
                          <button
                            type="button"
                            className={`maq-perfiles-tinta-btn ${cantidadTintas > 0 ? "ok" : ""}`}
                            onClick={() => setTintasDeUiKey(perfil.uiKey)}
                          >
                            {cantidadTintas > 0
                              ? `${cantidadTintas} tinta${cantidadTintas === 1 ? "" : "s"}`
                              : "Para configurar"}
                          </button>
                        )}
                      </td>
                    ) : null}
                    <td className="acciones">
                      <span className="maq-perfiles-acciones">
                        <button
                          type="button"
                          className="dup"
                          title="Duplicar perfil"
                          aria-label={`Duplicar perfil ${perfil.nombre || idx + 1}`}
                          onClick={() => onDuplicar(perfil.uiKey)}
                        >
                          <CopyIcon />
                        </button>
                        <button
                          type="button"
                          className="del"
                          title="Eliminar perfil"
                          aria-label={`Eliminar perfil ${perfil.nombre || idx + 1}`}
                          onClick={() => onEliminar(perfil.uiKey)}
                        >
                          <XIcon />
                        </button>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <button type="button" className="maq-btn maq-perfiles-agregar" onClick={onAgregar}>
        <PlusIcon />
        Agregar perfil
      </button>

      {perfilTintas ? (
        <PerfilTintasModal
          perfil={perfilTintas}
          form={form}
          setForm={setForm}
          materiasPrimas={materiasPrimas}
          loadingMaterias={loadingMaterias}
          onClose={() => setTintasDeUiKey(null)}
        />
      ) : null}
    </div>
  );
}
