"use client";

import * as React from "react";
import {
  ArrowRightIcon,
  BoxesIcon,
  CheckIcon,
  SearchIcon,
  WorkflowIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Chip,
  Input,
  Modal,
  SearchField,
  ToggleButton,
  ToggleButtonGroup,
} from "@heroui/react";
import { FormDialog } from "@/components/design-system/form-dialog";
import focus from "@/components/design-system/field-focus.module.css";
import { ActionButton as Button } from "@/components/design-system/action-button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { categoriaFamiliaLabels, getLabel } from "@/lib/labels-humanos";
import type { PasoTenant, PlantillaPaso } from "@/lib/productos-servicios";
import { crearPasoTenant } from "@/lib/productos-servicios-api";
import { descripcionPasoParaUsuario } from "@/lib/pasos-presentacion";
import styles from "./paso-alta-dialog.module.css";

type Props = {
  open: boolean;
  plantillas: PlantillaPaso[];
  onClose: () => void;
  onCreado: (paso: PasoTenant) => void;
};

export function PasoAltaDialog({ open, plantillas, onClose, onCreado }: Props) {
  const [nombre, setNombre] = React.useState("");
  const [plantilla, setPlantilla] = React.useState<string | null>(null);
  const [tipoPaso, setTipoPaso] = React.useState<"SIMPLE" | "COMPUESTO">(
    "SIMPLE",
  );
  const [busqueda, setBusqueda] = React.useState("");
  const [creando, setCreando] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setNombre("");
    setPlantilla(null);
    setTipoPaso("SIMPLE");
    setBusqueda("");
    setCreando(false);
  }, [open]);

  const filtradas = React.useMemo(() => {
    const q = busqueda.trim().toLocaleLowerCase("es");
    if (!q) return plantillas;
    return plantillas.filter((item) => {
      const categoria = getLabel(categoriaFamiliaLabels, item.categoria).label;
      return [
        item.nombre,
        descripcionPasoParaUsuario(item.descripcion),
        categoria,
      ].some((texto) => texto.toLocaleLowerCase("es").includes(q));
    });
  }, [busqueda, plantillas]);

  const plantillaEfectiva =
    tipoPaso === "COMPUESTO" ? "trabajo_manual" : plantilla;
  const puedeGuardar = Boolean(nombre.trim() && plantillaEfectiva && !creando);
  const crear = async () => {
    if (!puedeGuardar || !plantillaEfectiva) return;
    setCreando(true);
    try {
      const creado = await crearPasoTenant({
        nombre: nombre.trim(),
        plantillaCodigo: plantillaEfectiva,
        tipoPaso,
        operacionesCompuestas: [],
      });
      toast.success(`"${creado.nombre}" creado`);
      onCreado(creado);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo crear el nodo.",
      );
      setCreando(false);
    }
  };

  return (
    <FormDialog
      isOpen={open}
      onOpenChange={(next) => !next && onClose()}
      title="Nuevo nodo propio"
      description="Creá un nodo para tu empresa y definí cómo se usa en tus flujos de producción."
    >
      <Modal.Body className={styles.body}>
        <FieldGroup className={styles.fields}>
          <Field>
            <FieldLabel htmlFor="paso-alta-nombre">Nombre del nodo</FieldLabel>
            <Input
              className={focus.singleBorder}
              id="paso-alta-nombre"
              value={nombre}
              autoFocus
              maxLength={80}
              aria-describedby="paso-alta-nombre-ayuda"
              onChange={(event) => setNombre(event.target.value)}
              placeholder="Ej.: Bordado"
            />
            <FieldDescription id="paso-alta-nombre-ayuda">
              El nombre operativo que verá tu equipo.
            </FieldDescription>
          </Field>

          <FieldSet className={styles.typeField}>
            <FieldLegend variant="label" id="paso-alta-tipo">
              Tipo de nodo
            </FieldLegend>
            <ToggleButtonGroup
              selectionMode="single"
              disallowEmptySelection
              selectedKeys={new Set([tipoPaso])}
              onSelectionChange={(values) => {
                const next = [...values][0];
                if (next === "SIMPLE" || next === "COMPUESTO")
                  setTipoPaso(next);
              }}
              isDetached
              aria-labelledby="paso-alta-tipo"
              className={styles.typeOptions}
            >
              <ToggleButton id="SIMPLE" className={styles.typeOption}>
                <span className={styles.typeIcon} aria-hidden="true">
                  <WorkflowIcon />
                </span>
                <span className={styles.typeCopy}>
                  <strong>Nodo simple</strong>
                  <span>Una operación productiva.</span>
                </span>
                <span className={styles.typeCheck} aria-hidden="true">
                  <CheckIcon />
                </span>
              </ToggleButton>
              <ToggleButton id="COMPUESTO" className={styles.typeOption}>
                <span className={styles.typeIcon} aria-hidden="true">
                  <BoxesIcon />
                </span>
                <span className={styles.typeCopy}>
                  <strong>Nodo compuesto</strong>
                  <span>Agrupa operaciones configurables por producto.</span>
                </span>
                <span className={styles.typeCheck} aria-hidden="true">
                  <CheckIcon />
                </span>
              </ToggleButton>
            </ToggleButtonGroup>
          </FieldSet>

          {tipoPaso === "SIMPLE" ? (
            <Field className={styles.templatesField}>
              <div className={styles.catalogHeading}>
                <FieldLabel htmlFor="paso-alta-busqueda">
                  Plantilla del sistema
                </FieldLabel>
                <span className={styles.count} role="status">
                  {filtradas.length}{" "}
                  {filtradas.length === 1 ? "plantilla" : "plantillas"}
                </span>
              </div>
              <FieldDescription id="paso-alta-plantilla-ayuda">
                Elegí la base del nodo. Después podrás adaptarla a tu taller.
              </FieldDescription>
              <SearchField
                aria-label="Buscar plantilla"
                value={busqueda}
                onChange={setBusqueda}
              >
                <SearchField.Group className={focus.singleBorder}>
                  <SearchField.SearchIcon>
                    <SearchIcon />
                  </SearchField.SearchIcon>
                  <SearchField.Input
                    id="paso-alta-busqueda"
                    placeholder="Buscar por nombre, categoría o descripción"
                    aria-describedby="paso-alta-plantilla-ayuda"
                  />
                  <SearchField.ClearButton aria-label="Limpiar búsqueda" />
                </SearchField.Group>
              </SearchField>
              <div
                className={styles.templateList}
                role="group"
                aria-label="Plantillas disponibles"
              >
                {filtradas.length === 0 ? (
                  <Empty className={styles.empty}>
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <SearchIcon aria-hidden="true" />
                      </EmptyMedia>
                      <EmptyTitle>Sin plantillas para esta búsqueda</EmptyTitle>
                      <EmptyDescription>
                        Probá con otro nombre o categoría.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : null}
                {filtradas.map((item) => {
                  const seleccionada = plantilla === item.codigo;
                  return (
                    <Button
                      key={item.codigo}
                      type="button"
                      variant="ghost"
                      aria-pressed={seleccionada}
                      className={styles.template}
                      onClick={() => setPlantilla(item.codigo)}
                    >
                      <span className={styles.selectionMark} aria-hidden="true">
                        {seleccionada ? <CheckIcon /> : null}
                      </span>
                      <span className={styles.templateCopy}>
                        <span className={styles.templateHeading}>
                          <span className={styles.templateName}>
                            {item.nombre}
                          </span>
                          <Chip
                            size="sm"
                            variant="soft"
                            className={styles.category}
                          >
                            {
                              getLabel(categoriaFamiliaLabels, item.categoria)
                                .label
                            }
                          </Chip>
                        </span>
                        {item.descripcion ? (
                          <span className={styles.templateDescription}>
                            {descripcionPasoParaUsuario(item.descripcion)}
                          </span>
                        ) : null}
                      </span>
                    </Button>
                  );
                })}
              </div>
            </Field>
          ) : (
            <Alert className={styles.compoundInfo}>
              <BoxesIcon aria-hidden="true" />
              <AlertTitle>Un nodo, varias operaciones</AlertTitle>
              <AlertDescription>
                En el siguiente paso definirás sus operaciones. Al usarlo en un
                producto, podrás configurar las cantidades y reglas de cada una.
              </AlertDescription>
            </Alert>
          )}
        </FieldGroup>
      </Modal.Body>
      <Modal.Footer className={styles.footer}>
        <Button variant="outline" onClick={onClose} isDisabled={creando}>
          Cancelar
        </Button>
        <Button onClick={crear} isDisabled={!puedeGuardar}>
          {creando ? <Spinner aria-label="Creando nodo" /> : null}
          {creando ? "Creando…" : "Crear y configurar"}
          {!creando ? (
            <ArrowRightIcon data-icon="inline-end" aria-hidden="true" />
          ) : null}
        </Button>
      </Modal.Footer>
    </FormDialog>
  );
}
