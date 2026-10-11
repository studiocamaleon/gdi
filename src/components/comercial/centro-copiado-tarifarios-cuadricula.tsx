"use client";
import { MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  claveRango,
  decimalEditor,
  type CambioPrecio,
  type FilaMatriz,
} from "@/lib/centro-copiado-tarifarios-editor";
import {
  etiquetaTramo,
  type GrupoCuadricula,
  type Matriz,
  type PapelCuadricula,
} from "@/lib/centro-copiado-tarifarios-cuadricula";
import styles from "./centro-copiado-tarifarios.module.css";

export function CuadriculaPrecios({
  matriz,
  grupos,
  nombres,
  formatos,
  disabled,
  descripcion,
  onPrecio,
  onPegar,
  onOpciones,
}: {
  matriz: Matriz;
  grupos: GrupoCuadricula[];
  nombres: Record<string, string>;
  formatos: { nombre: string; anchoMm: number; altoMm: number }[];
  disabled: boolean;
  descripcion: (fila: FilaMatriz) => string;
  onPrecio: (c: CambioPrecio) => void;
  onPegar: (
    texto: string,
    papeles: PapelCuadricula[],
    fila: number,
    columna: number,
  ) => void;
  onOpciones: (indices: number[]) => void;
}) {
  const cad = matriz.reglas.unidad === "ML";
  const unidad = cad
    ? "ML"
    : matriz.reglas.unidad === "HOJA"
      ? "hoja"
      : "carilla";
  return grupos.map((grupo) => {
    const formato = formatos.find((f) => f.nombre === grupo.formato);
    return (
      <section
        key={grupo.clave}
        className={styles.matrixSection}
        aria-label={`${grupo.formato} · ${grupo.propios ? "Rangos propios" : "Rangos generales"}`}
      >
        <div className={styles.matrixHeading}>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h3 className="font-semibold text-base">{grupo.formato}</h3>
            {formato && (
              <span className="text-xs text-muted-foreground">
                {formato.anchoMm} × {formato.altoMm} mm
              </span>
            )}
          </div>
          {grupo.propios ? (
            <Badge variant="outline">Rangos propios</Badge>
          ) : (
            <span className="text-xs text-muted-foreground">
              Precio por {unidad}
            </span>
          )}
        </div>
        {grupo.propios && (
          <p className="px-4 pt-3 text-xs text-muted-foreground">
            Estas combinaciones tienen una excepción de rangos. Las demás caras
            se muestran en su tabla correspondiente.
          </p>
        )}
        <Table
          className={styles.priceGrid}
          aria-label={`Precios ${grupo.formato} · ${grupo.propios ? "rangos propios" : "rangos generales"}`}
        >
          <TableHeader>
            <TableRow>
              <TableHead
                scope="col"
                rowSpan={cad ? 1 : 2}
                className={styles.paperColumn}
              >
                Papel
              </TableHead>
              {grupo.rangos.map((r, t) => (
                <TableHead
                  key={String(r)}
                  scope={cad ? "col" : "colgroup"}
                  colSpan={cad ? 1 : 2}
                  className={styles.tierHeading}
                >
                  {etiquetaTramo(grupo.rangos, t, matriz.reglas.unidad)}
                </TableHead>
              ))}
            </TableRow>
            {!cad && (
              <TableRow>
                {grupo.rangos.flatMap((r) =>
                  [1, 2].map((faz) => (
                    <TableHead
                      key={`${r}-${faz}`}
                      scope="col"
                      className={styles.faceHeading}
                      data-tier-start={faz === 1}
                    >
                      {faz === 1 ? "Simple faz" : "Doble faz"}
                    </TableHead>
                  )),
                )}
              </TableRow>
            )}
          </TableHeader>
          <TableBody>
            {grupo.papeles.map((papel, j) => (
              <TableRow key={papel.clave}>
                <TableHead scope="row" className={styles.paperColumn}>
                  <div className={styles.paperName}>
                    <div>
                      <span>
                        {nombres[papel.papelId] ?? "Papel no disponible"}
                      </span>
                      {papel.gramaje !== null && (
                        <span className="block text-xs text-muted-foreground font-normal mt-1">
                          {papel.gramaje} g/m²
                        </span>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled={disabled}
                      aria-label={`Opciones de ${nombres[papel.papelId] ?? "papel"} ${papel.gramaje ?? ""} · ${grupo.formato}`}
                      onClick={() => onOpciones(papel.indices)}
                    >
                      <MoreHorizontal />
                    </Button>
                  </div>
                </TableHead>
                {papel.celdas.map((celda, columna) => {
                  if (!celda)
                    return (
                      <TableCell
                        key={columna}
                        className={styles.priceCell}
                        data-tier-start={cad || columna % 2 === 0}
                      >
                        <span
                          className="text-xs text-muted-foreground"
                          title="Esta combinación no pertenece a esta tabla. Puede tener rangos propios o no estar agregada."
                        >
                          No disponible
                        </span>
                      </TableCell>
                    );
                  const fila = matriz.filas[celda.fila];
                  const rango = grupo.rangos[celda.tramo];
                  const precio =
                    fila.precios.find(
                      (p) => claveRango(p.desdeCantidad) === claveRango(rango),
                    )?.precioUnitario ?? "";
                  let invalido = false;
                  try {
                    decimalEditor(precio);
                  } catch {
                    invalido = true;
                  }
                  return (
                    <TableCell
                      key={columna}
                      className={styles.priceCell}
                      data-tier-start={cad || columna % 2 === 0}
                    >
                      <Field data-invalid={invalido}>
                        <Input
                          aria-label={`${descripcion(fila)}, desde ${rango}, precio por ${unidad}`}
                          aria-invalid={invalido}
                          title={
                            invalido
                              ? "Revisá el importe; no uses separadores de miles."
                              : undefined
                          }
                          className={styles.priceInput}
                          inputMode="decimal"
                          placeholder="Pendiente"
                          disabled={disabled}
                          value={precio}
                          onChange={(e) =>
                            onPrecio({
                              ...celda,
                              antes: precio,
                              despues: e.target.value || null,
                            })
                          }
                          onPaste={(e) => {
                            const texto = e.clipboardData.getData("text/plain");
                            if (!/[\t\n\r]/.test(texto) || disabled) return;
                            e.preventDefault();
                            onPegar(texto, grupo.papeles, j, columna);
                          }}
                        />
                      </Field>
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
    );
  });
}
