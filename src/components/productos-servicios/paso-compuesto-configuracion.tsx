"use client";

import { Card, Checkbox, Input } from "@heroui/react";
import { ActionButton as Button } from "@/components/design-system/action-button";
import { SelectField } from "@/components/design-system/select-field";
import {
  useDesignScope,
  useDesignTheme,
} from "@/components/design-system/appearance";
import listPage from "@/components/design-system/list-page.module.css";
import focus from "@/components/design-system/field-focus.module.css";
import * as React from "react";
import {
  ArrowUpRightIcon,
  BoxesIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";
import type {
  DefinicionPasoInternoCompuesto,
  FamiliaListItem,
  PasoTenant,
} from "@/lib/productos-servicios";
import {
  actualizarPasoTenant,
  getCatalogoFamilias,
  getPasosTenant,
} from "@/lib/productos-servicios-api";
import styles from "./paso-compuesto-configuracion.module.css";
import { NodoConfiguracionHeader } from "./nodo-configuracion-header";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

function slug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 80);
}

function siguienteCodigoOperacion(
  operaciones: DefinicionPasoInternoCompuesto[],
) {
  let numero = operaciones.length + 1;
  while (operaciones.some((item) => item.codigo === `operacion_${numero}`)) {
    numero += 1;
  }
  return `operacion_${numero}`;
}

export function PasoCompuestoConfiguracion({ paso }: { paso: PasoTenant }) {
  const scope = useDesignScope();
  const theme = useDesignTheme();
  const [operaciones, setOperaciones] = React.useState<
    DefinicionPasoInternoCompuesto[]
  >(() =>
    (paso.pasosInternos ?? paso.operacionesCompuestas ?? []).map((item) => ({
      ...item,
      familiaCodigo: item.familiaCodigo ?? "",
      requiereCodigos: item.requiereCodigos ?? [],
    })),
  );
  const [familias, setFamilias] = React.useState<FamiliaListItem[]>([]);
  const [guardando, setGuardando] = React.useState(false);

  React.useEffect(() => {
    Promise.all([getCatalogoFamilias(), getPasosTenant()])
      .then(([catalogo, pasos]) => {
        const compuestos = new Set(
          pasos
            .filter((item) => item.tipoPaso === "COMPUESTO")
            .map((item) => item.id),
        );
        setFamilias(
          catalogo.familias.filter(
            (item) =>
              item.visibleEnSelector !== false &&
              item.codigo !== paso.id &&
              !compuestos.has(item.codigo),
          ),
        );
      })
      .catch(() => toast.error("No se pudo cargar el catálogo de pasos."));
  }, [paso.id]);

  const cambiar = (
    index: number,
    patch: Partial<DefinicionPasoInternoCompuesto>,
  ) =>
    setOperaciones((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    );

  const guardar = async () => {
    if (
      operaciones.some((item) => !item.familiaCodigo || !item.nombre.trim())
    ) {
      toast.error(
        "Todos los pasos internos deben elegir un paso real y un nombre.",
      );
      return;
    }
    setGuardando(true);
    try {
      await actualizarPasoTenant(paso.id, {
        tipoPaso: "COMPUESTO",
        pasosInternos: operaciones.map((item, index) => ({
          ...item,
          codigo: item.codigo || slug(item.nombre),
          orden: index,
        })),
      });
      toast.success("Subflujo del nodo actualizado");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo guardar la subruta.",
      );
    } finally {
      setGuardando(false);
    }
  };

  return (
    <main {...scope} className={`${theme} ${listPage.page} ${styles.page}`}>
      <NodoConfiguracionHeader
        nombre={paso.nombre}
        compuesto
        origen="tenant"
        estado={`${operaciones.length} ${operaciones.length === 1 ? "operación interna" : "operaciones internas"}`}
      />

      <Card className={styles.panel}>
        <Card.Header className={styles.panelHead}>
          <div>
            <strong>Operaciones internas</strong>
            <span>
              Calculan el trabajo sin crear estados separados en producción.
            </span>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              setOperaciones((current) => [
                ...current,
                {
                  codigo: siguienteCodigoOperacion(current),
                  nombre: "",
                  familiaCodigo: "",
                  descripcion: null,
                  dimension: "CANTIDAD",
                  requerida: true,
                  requiereCodigos: [],
                  orden: current.length,
                },
              ])
            }
          >
            <PlusIcon />
            <span>Agregar operación</span>
          </Button>
        </Card.Header>
        {!operaciones.length ? (
          <Empty className={styles.empty}>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <BoxesIcon />
              </EmptyMedia>
              <EmptyTitle>Definí las operaciones del nodo</EmptyTitle>
              <EmptyDescription>
                Agregá la primera operación que formará parte de este nodo
                compuesto.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className={styles.rows}>
            <div className={styles.rowHead} aria-hidden="true">
              <span />
              <span>Familia de cálculo</span>
              <span>Nombre de la operación</span>
              <span />
              <span />
            </div>
            {operaciones.map((operacion, index) => (
              <div className={styles.row} key={operacion.codigo}>
                <span className={styles.index}>
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className={styles.field}>
                  <span className={styles.rowLabel}>Familia de cálculo</span>
                  <SelectField
                    aria-label={`Nodo simple ${index + 1}`}
                    value={operacion.familiaCodigo}
                    onChange={(value) => {
                      const familia = familias.find(
                        (item) => item.codigo === value,
                      );
                      cambiar(index, {
                        familiaCodigo: value,
                        nombre: operacion.nombre || familia?.nombre || "",
                      });
                    }}
                    options={[
                      { value: "", label: "Elegir nodo simple…" },
                      ...familias.map((familia) => ({
                        value: familia.codigo,
                        label: familia.nombre,
                      })),
                    ]}
                  />
                </div>
                <div className={styles.field}>
                  <span className={styles.rowLabel}>
                    Nombre de la operación
                  </span>
                  <Input
                    className={focus.singleBorder}
                    aria-label={`Nombre de la operación ${index + 1}`}
                    value={operacion.nombre}
                    placeholder="Ej. Tensado de lona"
                    onChange={(event) =>
                      cambiar(index, { nombre: event.target.value })
                    }
                  />
                </div>
                <Checkbox
                  isSelected={operacion.requerida}
                  onChange={(value) => cambiar(index, { requerida: value })}
                  aria-label={`Operación ${index + 1} obligatoria`}
                  className={styles.required}
                >
                  <Checkbox.Content>
                    <Checkbox.Control>
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                    <span>Obligatoria</span>
                  </Checkbox.Content>
                </Checkbox>
                <Button
                  type="button"
                  variant="danger-soft"
                  isIconOnly
                  className={styles.remove}
                  aria-label={`Quitar ${operacion.nombre || "paso"}`}
                  onClick={() =>
                    setOperaciones((current) =>
                      current.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                >
                  <Trash2Icon />
                </Button>
              </div>
            ))}
          </div>
        )}
        <footer className={styles.footer}>
          <Button
            type="button"
            variant="outline"
            onClick={() => history.back()}
          >
            Volver
          </Button>
          <Button type="button" isDisabled={guardando} onClick={guardar}>
            <ArrowUpRightIcon />
            {guardando ? "Guardando…" : "Guardar operaciones"}
          </Button>
        </footer>
      </Card>
    </main>
  );
}
