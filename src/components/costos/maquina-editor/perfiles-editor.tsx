"use client";
import styles from "../maquinaria.module.css";
import { SelectField } from "@/components/design-system/select-field";
import { useMaquinariaPuedeEditar } from "./maquinaria-edicion";
import { PerfilesCorteEditor } from "./perfiles-corte-editor";
import corteStyles from "./procesamiento-corte.module.css";
/**
 * Editor de perfiles operativos de una máquina — tabla estilo Holdprint
 * (2026-07-28): una fila por perfil, columnas generadas desde los campos
 * que declara la plantilla (la unidad va en el encabezado), y la tinta se
 * configura desde un botón que abre el modal PerfilTintasModal. Antes era
 * una card con acordeón por perfil.
 */

import * as React from "react";
import { CopyIcon, PlusIcon, Settings2Icon, XIcon } from "lucide-react";

import {
  tipoPerfilOperativoMaquinaItems,
  type MaquinaPayload,
  type MaquinariaTemplateField,
} from "@/lib/maquinaria";
import type { MateriaPrima } from "@/lib/materias-primas";
import { Modal } from "@heroui/react";
import { FormDialog } from "@/components/design-system/form-dialog";
import { Chip, ComboBox, Input, ListBox } from "@heroui/react";
import { useDesignScope } from "@/components/design-system/appearance";
import theme from "@/components/design-system/theme.module.css";
import focus from "@/components/design-system/field-focus.module.css";
import { ActionButton as Button } from "@/components/design-system/action-button";

import { type OpcionSelect } from "@/components/ui/select-buscable";

import { PerfilTintasModal } from "./consumibles-editor";
import materialStyles from "./materiales-perfil-picker.module.css";
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

export function MaterialesPerfilPicker({
  value,
  onChange,
  materiasPrimas,
  loading,
  opcionesLegadas,
  soloRigidos = true,
}: {
  value: unknown;
  onChange: (value: string[]) => void;
  materiasPrimas: MateriaPrima[];
  loading: boolean;
  opcionesLegadas?: MaquinariaTemplateField["options"];
  soloRigidos?: boolean;
}) {
  const scope = useDesignScope();
  const puedeEditar = useMaquinariaPuedeEditar();
  const [busquedaMaterial, setBusquedaMaterial] = React.useState("");
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
        (!soloRigidos || material.subfamilia === "sustrato_rigido") &&
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
    <div className={materialStyles.field}>
      <ComboBox
        aria-label="Agregar material de inventario al perfil"
        selectedKey={null}
        inputValue={busquedaMaterial}
        onInputChange={setBusquedaMaterial}
        isDisabled={!puedeEditar || loading || opciones.length === 0}
        menuTrigger="focus"
        fullWidth
        onSelectionChange={(id) => {
          if (id) {
            onChange([...seleccionados, String(id)]);
            setBusquedaMaterial("");
          }
        }}
      >
        <ComboBox.InputGroup>
          <Input
            className={focus.singleBorder}
            placeholder={loading ? "Cargando materiales…" : "Buscar material…"}
          />
          <ComboBox.Trigger />
        </ComboBox.InputGroup>
        <ComboBox.Popover
          {...scope}
          className={`${theme.theme} ${styles.materialPopover}`}
        >
          <ListBox
            renderEmptyState={() => "No hay materiales activos que coincidan."}
          >
            {opciones.map((opcion) => (
              <ListBox.Item
                key={opcion.value}
                id={opcion.value}
                textValue={opcion.label}
              >
                <div className="min-w-0">
                  <div>{opcion.label}</div>
                  <p className="text-xs text-muted-foreground">
                    {opcion.grupo} · {opcion.detalle}
                  </p>
                </div>
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </ComboBox.Popover>
      </ComboBox>
      {seleccionados.length > 0 ? (
        <ul
          className={materialStyles.selection}
          aria-label="Materiales seleccionados"
        >
          {seleccionados.map((id) => {
            const material = porId.get(id);
            const legado = opcionesLegadas?.find(
              (opcion) => opcion.value === id,
            );
            const label = material?.nombre ?? legado?.label ?? id;
            return (
              <li key={id} className={materialStyles.item}>
                <Chip size="sm" variant="soft" className={materialStyles.chip}>
                  <span className={materialStyles.name}>{label}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    isIconOnly
                    className={materialStyles.remove}
                    aria-label={`Quitar ${label}`}
                    title={`Quitar ${label}${material && !material.activo ? " (inactivo)" : ""}`}
                    onClick={() => quitar(id)}
                  >
                    <XIcon aria-hidden />
                  </Button>
                </Chip>
              </li>
            );
          })}
        </ul>
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

  if (form.parametrosTecnicos?.procesamientoCorte) {
    const tradicionales = perfiles.filter(
      (p) => p.detalle?.procesamientoCorteVersion !== 1,
    );
    return (
      <>
        <PerfilesCorteEditor
          perfiles={perfiles.filter(
            (p) => p.detalle?.procesamientoCorteVersion === 1,
          )}
          setPerfiles={setPerfiles}
          form={form}
          materiasPrimas={materiasPrimas}
          loadingMaterias={loadingMaterias}
          onEliminar={onEliminar}
        />
        {tradicionales.length > 0 && (
          <details className={corteStyles.advanced}>
            <summary>
              Perfiles por productividad · {tradicionales.length}
            </summary>
            <p className={corteStyles.help}>
              Los productos que no cotizan por operaciones siguen usando estos
              perfiles.
            </p>
            <PerfilesOperativosEditor
              perfiles={tradicionales}
              setPerfiles={(next) =>
                setPerfiles((prev) => [
                  ...prev.filter(
                    (p) => p.detalle?.procesamientoCorteVersion === 1,
                  ),
                  ...(typeof next === "function"
                    ? next(
                        prev.filter(
                          (p) => p.detalle?.procesamientoCorteVersion !== 1,
                        ),
                      )
                    : next),
                ])
              }
              sectionFields={sectionFields}
              form={{
                ...form,
                parametrosTecnicos: {
                  ...form.parametrosTecnicos,
                  procesamientoCorte: undefined,
                },
              }}
              setForm={setForm}
              materiasPrimas={materiasPrimas}
              loadingMaterias={loadingMaterias}
              onAgregar={onAgregar}
              onEliminar={onEliminar}
              onDuplicar={onDuplicar}
            />
          </details>
        )}
      </>
    );
  }
  return (
    <div className={`${styles["maq-perfiles"]}`}>
      {perfiles.length === 0 ? (
        <p className={`${styles["maq-perfiles-vacio"]}`}>
          Sin perfiles. Agregá al menos uno.
        </p>
      ) : (
        <div className={`${styles["maq-perfiles-scroll"]}`}>
          <table
            className={`${styles["maq-perfiles-tabla"]} ${form.plantilla === "impresora_laser" ? "laser" : ""}`}
          >
            <thead>
              <tr>
                {conColumnaTipo ? (
                  <th className="tipo">{etiquetaColumnaTipo}</th>
                ) : null}
                {visibleFields.map((field) => (
                  <th
                    key={field.key}
                    title={field.description}
                    className={`${field.kind === "number" ? "num " : ""}campo-${field.key}`}
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
                        <SelectField
                          value={perfil.tipoPerfil}
                          aria-label={`Tipo del perfil ${perfil.nombre || idx + 1}`}
                          onChange={(value) => {
                            const next = normalizePerfilTypeForTemplate(
                              cleanPerfilDetailsForType(
                                setPerfilFieldValue(
                                  perfil,
                                  "tipoPerfil",
                                  value || getDefaultProfileType(form),
                                ),
                              ),
                              form,
                            );
                            updatePerfil(perfil.uiKey, next);
                          }}
                          options={[
                            ...(allowedProfileTypeItems.map((item) => ({
                              value: item.value,
                              label: item.label,
                            })) ?? []),
                          ]}
                        />
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
                          className={`${esNum ? "num " : ""}campo-${field.key}`}
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
                              compactColorModeLabels={
                                form.plantilla === "impresora_laser" &&
                                field.key === "colores"
                              }
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
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            isIconOnly
                            className={`${styles["maq-perfiles-tinta-btn"]} ${cantidadTintas > 0 ? "ok" : ""}`}
                            aria-label={`Configurar tintas de ${perfil.nombre || `perfil ${idx + 1}`}`}
                            title={
                              cantidadTintas > 0
                                ? `Configurar tintas · ${cantidadTintas} vinculada${cantidadTintas === 1 ? "" : "s"}`
                                : "Configurar tintas"
                            }
                            onPress={() => setTintasDeUiKey(perfil.uiKey)}
                          >
                            <Settings2Icon aria-hidden />
                            <span className="punto" aria-hidden />
                          </Button>
                        )}
                      </td>
                    ) : null}
                    <td className="acciones">
                      <span className={`${styles["maq-perfiles-acciones"]}`}>
                        <Button
                          variant="ghost"
                          isIconOnly
                          type="button"
                          className="dup"
                          title="Duplicar perfil"
                          aria-label={`Duplicar perfil ${perfil.nombre || idx + 1}`}
                          onClick={() => onDuplicar(perfil.uiKey)}
                        >
                          <CopyIcon />
                        </Button>
                        <Button
                          variant="ghost"
                          isIconOnly
                          type="button"
                          className="del"
                          title="Eliminar perfil"
                          aria-label={`Eliminar perfil ${perfil.nombre || idx + 1}`}
                          onClick={() => setPerfilAEliminar(perfil)}
                        >
                          <XIcon />
                        </Button>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Button
        variant="outline"
        type="button"
        className={`${styles["maq-btn"]} ${styles["maq-perfiles-agregar"]}`}
        onClick={onAgregar}
      >
        <PlusIcon />
        Agregar perfil
      </Button>

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

      <FormDialog
        isOpen={perfilAEliminar !== null}
        onOpenChange={(open) => {
          if (!open) setPerfilAEliminar(null);
        }}
        title="Eliminar perfil operativo"
        description={`¿Eliminar "${perfilAEliminar?.nombre || "este perfil"}"? También se quitarán sus consumibles vinculados al guardar.`}
      >
        <Modal.Footer className={styles.modalFooter}>
          <Button variant="outline" onPress={() => setPerfilAEliminar(null)}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            onPress={() => {
              if (!perfilAEliminar) return;
              onEliminar(perfilAEliminar.uiKey);
              setPerfilAEliminar(null);
            }}
          >
            Eliminar perfil
          </Button>
        </Modal.Footer>
      </FormDialog>
    </div>
  );
}
