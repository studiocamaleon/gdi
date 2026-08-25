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
import { ConfirmacionDestructiva } from "@/components/ui/confirmacion-destructiva";
import {
  SelectBuscable,
  type OpcionSelect,
} from "@/components/ui/select-buscable";

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
  isPerfilFieldRequired,
  normalizePerfilTypeForTemplate,
  productividadPlanchaEnVivo,
  restringirColoresDelPerfil,
  setPerfilFieldValue,
  setPerfilFieldValueForTemplate,
  shouldShowPerfilField,
  type LocalPerfil,
} from "./helpers";

// ─── Sub-componente: editor de perfiles ────────────────────────────

const FAMILIAS_MATERIAL: Record<string, string> = {
  sustrato: "Sustratos",
  transferencia_laminacion: "Transferencia y laminación",
  quimico_auxiliar: "Químicos y auxiliares",
  aditiva_3d: "Materiales 3D",
  metal_estructura: "Estructuras",
  terminacion_editorial: "Terminación editorial",
  magnetico_fijacion: "Magnéticos y fijación",
  pop_exhibidor: "POP y exhibidores",
  adhesivo_tecnico: "Adhesivos técnicos",
  sellos: "Sellos",
};

function MaterialesPerfilPicker({
  value,
  onChange,
  materiasPrimas,
  loading,
  opcionesLegadas,
}: {
  value: unknown;
  onChange: (value: string[]) => void;
  materiasPrimas: MateriaPrima[];
  loading: boolean;
  opcionesLegadas?: MaquinariaTemplateField["options"];
}) {
  const seleccionados = Array.isArray(value)
    ? value.map(String)
    : typeof value === "string" && value
      ? [value]
      : [];
  const porId = new Map(
    materiasPrimas.map((material) => [material.id, material]),
  );
  const opciones: OpcionSelect[] = materiasPrimas
    .filter(
      (material) =>
        material.activo &&
        material.subfamilia === "sustrato_rigido" &&
        !material.esConsumible &&
        !material.esRepuesto &&
        !material.esProductoBase &&
        material.variantes.some((variante) => variante.activo) &&
        !seleccionados.includes(material.id),
    )
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
    .map((material) => {
      const variantesActivas = material.variantes.filter(
        (variante) => variante.activo,
      ).length;
      return {
        value: material.id,
        label: material.nombre,
        grupo: FAMILIAS_MATERIAL[material.familia] ?? "Otros materiales",
        detalle: `${material.codigo} · ${variantesActivas} ${variantesActivas === 1 ? "variante" : "variantes"}`,
      };
    });

  const quitar = (id: string) =>
    onChange(seleccionados.filter((seleccionado) => seleccionado !== id));

  return (
    <div className="maq-material-field">
      <SelectBuscable
        value=""
        opciones={opciones}
        onChange={(id) => id && onChange([...seleccionados, id])}
        placeholder={loading ? "Cargando materiales…" : "Buscar material…"}
        placeholderBusqueda="Escribí un material y presioná Enter…"
        vacio="No hay sustratos rígidos activos que coincidan."
        disabled={loading || opciones.length === 0}
        ariaLabel="Agregar material de inventario al perfil"
        minimoParaBuscar={0}
      />
      {seleccionados.length > 0 ? (
        <div className="maq-material-chips">
          {seleccionados.map((id) => {
            const material = porId.get(id);
            const legado = opcionesLegadas?.find(
              (opcion) => opcion.value === id,
            );
            const label = material?.nombre ?? legado?.label ?? id;
            return (
              <button
                key={id}
                type="button"
                className="maq-material-chip"
                title={`Quitar ${label}${material && !material.activo ? " (inactivo)" : ""}`}
                onClick={() => quitar(id)}
              >
                <span>{label}</span>
                <XIcon aria-hidden />
                <span className="sr-only">Quitar</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

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
  const [perfilAEliminar, setPerfilAEliminar] =
    React.useState<LocalPerfil | null>(null);

  const allowedProfileTypeItems = tipoPerfilOperativoMaquinaItems.filter(
    (item) => getAllowedProfileTypes(form).includes(item.value),
  );
  // La columna Tipo sólo aparece si hay algo que elegir.
  const conColumnaTipo = allowedProfileTypeItems.length > 1;
  const etiquetaColumnaTipo =
    form.plantilla === "corte_laser" ? "Operación" : "Tipo";
  // Tintas por perfil en todas las impresoras de la familia, láser incluida:
  // el consumo de tóner cambia con el papel, igual que la productividad.
  const conColumnaTinta = PRINTER_TEMPLATES_WITH_CONSUMIBLES.has(
    form.plantilla,
  );
  // Plancha térmica: la productividad se DERIVA del ciclo, se muestra en vivo.
  const conColumnaProductividad = form.plantilla === "plancha_termica";

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
                {conColumnaTipo ? (
                  <th className="tipo">{etiquetaColumnaTipo}</th>
                ) : null}
                {visibleFields.map((field) => (
                  <th
                    key={field.key}
                    title={field.description}
                    className={field.kind === "number" ? "num" : undefined}
                  >
                    {field.label}
                    {field.unit ? (
                      <span className="unidad">
                        {" "}
                        ({getTemplateUnitLabel(field.unit)})
                      </span>
                    ) : null}
                    {perfiles.some((perfil) =>
                      isPerfilFieldRequired(field, form, perfil),
                    ) ? (
                      <span className="req"> *</span>
                    ) : null}
                  </th>
                ))}
                {conColumnaProductividad ? (
                  <th
                    className="num"
                    title="Se calcula desde los segundos del ciclo (pre + planchado + post)."
                  >
                    Productividad<span className="unidad"> (piezas/h)</span>
                  </th>
                ) : null}
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
                          <td
                            key={field.key}
                            className={esNum ? "na num" : "na"}
                          >
                            —
                          </td>
                        );
                      }
                      const valor = getPerfilFieldValue(perfil, field.key);
                      // La unidad vive en el encabezado; la celda va limpia.
                      const requerido = isPerfilFieldRequired(
                        field,
                        form,
                        perfil,
                      );
                      const sinUnidad: MaquinariaTemplateField = {
                        ...field,
                        unit: undefined,
                        required: requerido,
                      };
                      // Los colores del perfil no pueden exceder los de la máquina.
                      const cellField = restringirColoresDelPerfil(
                        sinUnidad,
                        form,
                        valor,
                      );
                      return (
                        <td
                          key={field.key}
                          className={esNum ? "num" : undefined}
                        >
                          {form.plantilla === "corte_laser" &&
                          field.key === "material" ? (
                            <MaterialesPerfilPicker
                              value={valor}
                              materiasPrimas={materiasPrimas}
                              loading={loadingMaterias}
                              opcionesLegadas={field.options}
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
                          ) : (
                            <FieldInput
                              field={cellField}
                              value={valor}
                              // Los modos de color van como pills, no como una
                              // pila de checkboxes dentro de la celda.
                              renderColorModeCards={field.key === "colores"}
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
                          )}
                        </td>
                      );
                    })}
                    {conColumnaProductividad
                      ? (() => {
                          const prod = productividadPlanchaEnVivo(perfil);
                          return (
                            <td className="num">
                              {prod === null ? (
                                <span className="na">—</span>
                              ) : (
                                <strong>{Math.round(prod)}</strong>
                              )}
                            </td>
                          );
                        })()
                      : null}
                    {conColumnaTinta ? (
                      <td className="tinta">
                        {perfil.tipoPerfil === "corte" ? (
                          <span className="na">—</span>
                        ) : (
                          <button
                            type="button"
                            className={`maq-perfiles-tinta-btn ${cantidadTintas > 0 ? "ok" : ""}`}
                            title={
                              cantidadTintas > 0
                                ? `${cantidadTintas} tinta${cantidadTintas === 1 ? "" : "s"} vinculada${cantidadTintas === 1 ? "" : "s"}`
                                : "Todavía sin tintas vinculadas"
                            }
                            onClick={() => setTintasDeUiKey(perfil.uiKey)}
                          >
                            {/* El punto dice si ya tiene tintas; el texto dice
                                qué hace el botón. El número vive en el title. */}
                            <span className="punto" />
                            Configurar
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
                          onClick={() => setPerfilAEliminar(perfil)}
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

      <button
        type="button"
        className="maq-btn maq-perfiles-agregar"
        onClick={onAgregar}
      >
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

      <ConfirmacionDestructiva
        open={perfilAEliminar !== null}
        onOpenChange={(open) => {
          if (!open) setPerfilAEliminar(null);
        }}
        titulo="Eliminar perfil operativo"
        descripcion={`¿Eliminar "${perfilAEliminar?.nombre || "este perfil"}"? También se quitarán sus consumibles vinculados al guardar.`}
        nombreItem={perfilAEliminar?.nombre}
        requiereTipear={false}
        accionLabel="Eliminar perfil"
        onConfirmar={() => {
          if (!perfilAEliminar) return;
          onEliminar(perfilAEliminar.uiKey);
          setPerfilAEliminar(null);
        }}
      />
    </div>
  );
}
