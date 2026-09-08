"use client";

import {
  CopyIcon,
  PlusIcon,
  RectangleHorizontalIcon,
  Trash2Icon,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import type { PiezaRectangularComponente } from "@/lib/productos-servicios-api";
import {
  nuevaPiezaRectangular,
  piezasComponenteValidas,
} from "@/lib/piezas-componente";
import styles from "./piezas-rectangulares.module.css";

const numero = (n: number) =>
  n.toLocaleString("es-AR", { maximumFractionDigits: 2 });

export function PiezasRectangulares({
  piezas,
  onChange,
  cantidadProductos,
  idPrefix = "piezas-rectangulares",
}: {
  piezas: PiezaRectangularComponente[];
  onChange?: (piezas: PiezaRectangularComponente[]) => void;
  cantidadProductos?: number;
  idPrefix?: string;
}) {
  const validas = piezasComponenteValidas(piezas);
  const porProducto = piezas.reduce(
    (n, p) =>
      n +
      (Number.isSafeInteger(p.cantidadPorUnidad) && p.cantidadPorUnidad > 0
        ? p.cantidadPorUnidad
        : 0),
    0,
  );
  const actualizar = (id: string, patch: Partial<PiezaRectangularComponente>) =>
    onChange?.(piezas.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  return (
    <section
      className={styles.section}
      aria-label="Piezas rectangulares del componente"
    >
      <header className={styles.header}>
        <span className={styles.icon}>
          <RectangleHorizontalIcon aria-hidden="true" />
        </span>
        <div className={styles.heading}>
          <h3>Piezas del componente</h3>
          <p>
            Distintas medidas y cantidades, con el mismo material y procesos.
          </p>
        </div>
        {onChange && (
          <Button
            type="button"
            variant="outline"
            className={styles.add}
            disabled={piezas.length >= 30}
            onClick={() =>
              onChange([...piezas, nuevaPiezaRectangular(piezas.length + 1)])
            }
          >
            <PlusIcon aria-hidden="true" /> Agregar pieza
          </Button>
        )}
      </header>
      <div className={styles.list}>
        {piezas.map((pieza, index) => (
          <FieldGroup className={styles.row} key={pieza.id}>
            <Field className={styles.name}>
              <FieldLabel htmlFor={`${idPrefix}-${pieza.id}-nombre`}>
                Nombre de la pieza
              </FieldLabel>
              {onChange ? (
                <Input
                  id={`${idPrefix}-${pieza.id}-nombre`}
                  value={pieza.nombre}
                  maxLength={120}
                  onChange={(e) =>
                    actualizar(pieza.id, { nombre: e.target.value })
                  }
                  aria-invalid={!pieza.nombre.trim()}
                />
              ) : (
                <strong>{pieza.nombre}</strong>
              )}
            </Field>
            {(["anchoMm", "altoMm"] as const).map((eje) => (
              <Field key={eje}>
                <FieldLabel htmlFor={`${idPrefix}-${pieza.id}-${eje}`}>
                  {eje === "anchoMm" ? "Ancho" : "Alto"}
                </FieldLabel>
                {onChange ? (
                  <InputGroup className={styles.measure}>
                    <InputGroupInput
                      id={`${idPrefix}-${pieza.id}-${eje}`}
                      type="number"
                      min={0.001}
                      max={100000}
                      step="any"
                      value={
                        Number.isFinite(pieza.medidas[eje])
                          ? Number((pieza.medidas[eje] / 10).toFixed(6))
                          : ""
                      }
                      aria-invalid={
                        !(
                          pieza.medidas[eje] > 0 &&
                          pieza.medidas[eje] <= 1000000
                        )
                      }
                      onChange={(e) =>
                        actualizar(pieza.id, {
                          medidas: {
                            ...pieza.medidas,
                            [eje]:
                              e.target.value === ""
                                ? Number.NaN
                                : Number(e.target.value) * 10,
                          },
                        })
                      }
                    />
                    <InputGroupAddon align="inline-end">cm</InputGroupAddon>
                  </InputGroup>
                ) : (
                  <span>{numero(pieza.medidas[eje] / 10)} cm</span>
                )}
              </Field>
            ))}
            <Field>
              <FieldLabel htmlFor={`${idPrefix}-${pieza.id}-cantidad`}>
                Por producto
              </FieldLabel>
              {onChange ? (
                <Input
                  id={`${idPrefix}-${pieza.id}-cantidad`}
                  type="number"
                  min={1}
                  max={10000}
                  step={1}
                  value={
                    Number.isFinite(pieza.cantidadPorUnidad)
                      ? pieza.cantidadPorUnidad
                      : ""
                  }
                  aria-invalid={
                    !Number.isSafeInteger(pieza.cantidadPorUnidad) ||
                    pieza.cantidadPorUnidad < 1 ||
                    pieza.cantidadPorUnidad > 10000
                  }
                  onChange={(e) =>
                    actualizar(pieza.id, {
                      cantidadPorUnidad:
                        e.target.value === ""
                          ? Number.NaN
                          : Number(e.target.value),
                    })
                  }
                />
              ) : (
                <span>× {numero(pieza.cantidadPorUnidad)}</span>
              )}
            </Field>
            {onChange && (
              <div className={styles.actions}>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={piezas.length >= 30}
                  aria-label={`Duplicar ${pieza.nombre || `pieza ${index + 1}`}`}
                  title="Duplicar pieza"
                  onClick={() =>
                    onChange([
                      ...piezas.slice(0, index + 1),
                      {
                        ...pieza,
                        id: crypto.randomUUID(),
                        nombre: `${pieza.nombre} (copia)`.slice(0, 120),
                        medidas: { ...pieza.medidas },
                      },
                      ...piezas.slice(index + 1),
                    ])
                  }
                >
                  <CopyIcon />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={piezas.length <= 1}
                  aria-label={`Quitar ${pieza.nombre || `pieza ${index + 1}`}`}
                  title="Quitar pieza"
                  onClick={() =>
                    onChange(piezas.filter((p) => p.id !== pieza.id))
                  }
                >
                  <Trash2Icon />
                </Button>
              </div>
            )}
          </FieldGroup>
        ))}
      </div>
      {!validas && onChange && (
        <Alert variant="destructive" className={styles.error}>
          <AlertDescription>
            Completá cada nombre, medidas mayores que cero y una cantidad entera
            entre 1 y 10.000.
          </AlertDescription>
        </Alert>
      )}
      <footer className={styles.footer}>
        <span>
          {piezas.length}{" "}
          {piezas.length === 1 ? "tipo de pieza" : "tipos de pieza"} ·{" "}
          <strong>
            {numero(porProducto)} {porProducto === 1 ? "pieza" : "piezas"} por
            producto
          </strong>
        </span>
        {cantidadProductos != null && validas && (
          <span>
            {numero(cantidadProductos)} productos × {numero(porProducto)} ={" "}
            <strong>{numero(cantidadProductos * porProducto)} piezas</strong>
          </span>
        )}
        {cantidadProductos == null && (
          <span>La cantidad se multiplica por las unidades vendidas.</span>
        )}
      </footer>
    </section>
  );
}
