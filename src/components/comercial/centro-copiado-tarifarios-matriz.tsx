"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Elegir,
  TextoTarifa,
  ErrorTarifa,
  mensajeErrorTarifa,
} from "./centro-copiado-tarifarios-controles";
import {
  ajustarPrecio,
  claveCombinacion,
  claveRango,
  decimalEditor,
  leerRangos,
  pegarPrecios,
  preciosConRangos,
  type CambioPrecio,
  type FilaMatriz,
  type MatrizCad,
  type MatrizHojas,
} from "@/lib/centro-copiado-tarifarios-editor";

type Matriz = MatrizHojas | MatrizCad;
export function EditorMatriz({
  matriz,
  nombres,
  disabled,
  generando,
  permiteGenerar = true,
  onChange,
  onGenerar,
}: {
  matriz: Matriz;
  nombres: Record<string, string>;
  disabled: boolean;
  generando?: boolean;
  permiteGenerar?: boolean;
  onChange: (m: Matriz) => void;
  onGenerar: () => void;
}) {
  const cad = matriz.reglas.unidad === "ML";
  const unidad = cad
    ? "ML"
    : matriz.reglas.unidad === "HOJA"
      ? "hoja"
      : "carilla";
  const [busqueda, setBusqueda] = useState("");
  const [pagina, setPagina] = useState(0);
  const [rangos, setRangos] = useState<{
    fila: number | null;
    texto: string;
    heredar: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState<{
    titulo: string;
    detalle: string;
    aplicar: () => void;
  } | null>(null);
  const [ajuste, setAjuste] = useState<{
    modo: "PORCENTAJE" | "IMPORTE";
    valor: string;
    redondeo: string;
  } | null>(null);
  const [paginaRevision, setPaginaRevision] = useState(0);
  const [cambios, setCambios] = useState<CambioPrecio[] | null>(null);
  const descripcion = (fila: FilaMatriz) => {
    const c = fila.combinacion;
    return `${nombres[c.papelMateriaPrimaId] ?? "Papel no disponible"}${c.gramaje === null ? "" : ` · ${c.gramaje} g`} · ${"tamano" in c ? c.tamano : `${c.anchoRolloMm} mm`} · ${c.color === "BN" ? "K" : "CMYK"}${"faz" in c ? ` · ${c.faz === 1 ? "Simple faz" : "Doble faz"}` : ""}${c.cobertura ? ` · ${c.cobertura}` : ""}`;
  };
  const indices = matriz.filas.flatMap((f, i) =>
    descripcion(f).toLocaleLowerCase().includes(busqueda.toLocaleLowerCase())
      ? [i]
      : [],
  );
  const ultima = Math.max(0, Math.ceil(indices.length / 20) - 1);
  const actual = Math.min(pagina, ultima);
  const visibles = indices.slice(actual * 20, actual * 20 + 20);
  function cambiar(mutacion: (m: Matriz) => void) {
    if (disabled) return;
    const copia = structuredClone(matriz);
    mutacion(copia);
    onChange(copia);
  }
  function aplicarCambios(c: CambioPrecio[]) {
    cambiar((m) => {
      for (const cambio of c) {
        const fila = m.filas[cambio.fila];
        const precios = preciosConRangos(
          fila,
          fila.rangosPropios ?? m.rangosGenerales,
        );
        precios[cambio.tramo].precioUnitario = cambio.despues;
        fila.precios = precios as typeof fila.precios;
      }
    });
  }
  function aplicarRangos() {
    if (!rangos || disabled) return;
    try {
      const nuevos = rangos.heredar
        ? matriz.rangosGenerales
        : leerRangos(rangos.texto, cad);
      const afectados =
        rangos.fila === null
          ? matriz.filas.filter((f) => !f.rangosPropios)
          : [matriz.filas[rangos.fila]];
      const eliminados = afectados.reduce(
        (n, f) =>
          n +
          f.precios.filter(
            (p) =>
              p.precioUnitario !== null &&
              p.precioUnitario !== "" &&
              !nuevos.some(
                (r) => claveRango(r) === claveRango(p.desdeCantidad),
              ),
          ).length,
        0,
      );
      const aplicar = () => {
        cambiar((m) => {
          if (rangos.fila === null)
            m.rangosGenerales = nuevos as typeof m.rangosGenerales;
          const filas =
            rangos.fila === null
              ? m.filas.filter((f) => !f.rangosPropios)
              : [m.filas[rangos.fila]];
          for (const f of filas) {
            if (rangos.fila !== null)
              f.rangosPropios = rangos.heredar
                ? null
                : (nuevos as typeof f.rangosPropios);
            f.precios = preciosConRangos(f, nuevos) as typeof f.precios;
          }
        });
        setRangos(null);
      };
      if (eliminados) {
        setRangos(null);
        setConfirmar({
          titulo: "Reemplazar rangos",
          detalle: `Se eliminarán ${eliminados} precios de tramos retirados. Los tramos nuevos quedarán pendientes. Los precios de tramos conservados no cambian.`,
          aplicar,
        });
      } else aplicar();
    } catch (e) {
      setError(mensajeErrorTarifa(e));
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {cad ? "Planos CAD · metro lineal" : "Impresión en hojas"}
        </CardTitle>
        <CardDescription>
          {cad
            ? "Se cobra el largo de papel consumido, incluidos los márgenes de avance. Cada ancho de rollo tiene su precio."
            : "El tramo alcanzado se aplica a todas las unidades del grupo. Simple y doble faz tienen precios independientes."}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{matriz.filas.length} combinaciones</Badge>
          <span className="text-sm text-muted-foreground">
            Tramos generales desde {matriz.rangosGenerales.join(" · ")}{" "}
            {cad
              ? "ML"
              : matriz.reglas.unidad === "HOJA"
                ? "hojas físicas"
                : "carillas impresas"}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => {
              setError(null);
              setRangos({
                fila: null,
                texto: matriz.rangosGenerales.join("; "),
                heredar: false,
              });
            }}
          >
            Editar rangos generales
          </Button>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-48 flex-1">
            <TextoTarifa
              etiqueta="Buscar combinaciones"
              valor={busqueda}
              onChange={(v) => {
                setBusqueda(v);
                setPagina(0);
              }}
              placeholder="Papel, gramaje, tamaño, faz o cobertura"
            />
          </div>
          <Button
            variant="outline"
            disabled={disabled || generando || !permiteGenerar}
            loading={generando}
            onClick={onGenerar}
          >
            <Plus data-icon="inline-start" />
            Agregar combinaciones de {cad ? "CAD" : "la oferta"}
          </Button>
          <Button
            variant="outline"
            disabled={disabled || !indices.length}
            onClick={() => {
              setError(null);
              setAjuste({ modo: "PORCENTAJE", valor: "", redondeo: "" });
            }}
          >
            <SlidersHorizontal data-icon="inline-start" />
            Ajustar precios
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Precio por {unidad}, en la moneda del tarifario. Vacío = pendiente; 0
          = gratuito. Podés pegar un bloque de Excel sobre una celda: filas y
          tramos deben coincidir con esta página, sin encabezados ni separadores
          de miles.
        </p>
        {!visibles.length ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>
                {matriz.filas.length
                  ? "Sin coincidencias"
                  : "Todavía no hay combinaciones"}
              </EmptyTitle>
              <EmptyDescription>
                {matriz.filas.length
                  ? "Probá otra búsqueda."
                  : "Agregá las combinaciones disponibles y completá sus precios por tramo."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Combinación</TableHead>
                <TableHead>Precios por tramo</TableHead>
                <TableHead>
                  <span className="sr-only">Acciones de la combinación</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibles.map((indice, j) => {
                const fila = matriz.filas[indice];
                const rangosFila = fila.rangosPropios ?? matriz.rangosGenerales;
                const label = descripcion(fila);
                return (
                  <TableRow key={claveCombinacion(fila.combinacion)}>
                    <TableCell className="w-56 whitespace-normal align-top">
                      <div className="max-w-56 whitespace-normal font-medium">
                        {label}
                      </div>
                      {fila.rangosPropios && (
                        <Badge variant="outline" className="mt-2">
                          Rangos propios
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <FieldGroup className="flex flex-row flex-wrap gap-3 min-w-64">
                        {rangosFila.map((rango, columna) => {
                          const precio =
                            fila.precios.find(
                              (p) =>
                                claveRango(p.desdeCantidad) ===
                                claveRango(rango),
                            )?.precioUnitario ?? "";
                          let invalido = false;
                          try {
                            decimalEditor(precio);
                          } catch {
                            invalido = true;
                          }
                          const id = `tarifa-${cad ? "cad" : "hoja"}-${indice}-${columna}`;
                          return (
                            <Field
                              key={String(rango)}
                              className="w-28"
                              data-invalid={invalido}
                            >
                              <FieldLabel htmlFor={id}>
                                Desde {rango}
                                {cad
                                  ? " ML"
                                  : ` ${unidad}${Number(rango) === 1 ? "" : "s"}`}
                              </FieldLabel>
                              <Input
                                id={id}
                                aria-label={`${label}, desde ${rango}, precio por ${unidad}`}
                                aria-invalid={invalido}
                                title={
                                  invalido
                                    ? "Revisá el importe; no uses separadores de miles."
                                    : undefined
                                }
                                className="tabular-nums"
                                inputMode="decimal"
                                placeholder="Pendiente"
                                disabled={disabled}
                                value={precio}
                                onChange={(e) =>
                                  aplicarCambios([
                                    {
                                      fila: indice,
                                      tramo: columna,
                                      antes: precio,
                                      despues: e.target.value || null,
                                    },
                                  ])
                                }
                                onPaste={(e) => {
                                  const texto =
                                    e.clipboardData.getData("text/plain");
                                  if (!/[\t\n\r]/.test(texto) || disabled)
                                    return;
                                  e.preventDefault();
                                  try {
                                    const c = pegarPrecios(
                                      texto,
                                      matriz.filas,
                                      visibles,
                                      j,
                                      columna,
                                      matriz.rangosGenerales,
                                    );
                                    setPaginaRevision(0);
                                    setCambios(c);
                                    setError(null);
                                  } catch (err) {
                                    toast.error(mensajeErrorTarifa(err));
                                  }
                                }}
                              />
                            </Field>
                          );
                        })}
                      </FieldGroup>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="flex flex-col gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={disabled}
                          onClick={() => {
                            setError(null);
                            setRangos({
                              fila: indice,
                              texto: rangosFila.join("; "),
                              heredar: !fila.rangosPropios,
                            });
                          }}
                        >
                          Rangos
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={disabled}
                          aria-label={`Quitar ${label}`}
                          onClick={() =>
                            setConfirmar({
                              titulo: "Quitar combinación del borrador",
                              detalle: `${label}. Se quitarán sus precios de este borrador. Las versiones publicadas se conservan.`,
                              aplicar: () =>
                                cambiar((m) => {
                                  m.filas.splice(indice, 1);
                                }),
                            })
                          }
                        >
                          Quitar
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm text-muted-foreground">
            {indices.length} resultados · Página {actual + 1} de {ultima + 1}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={actual === 0}
              onClick={() => setPagina(actual - 1)}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={actual === ultima}
              onClick={() => setPagina(actual + 1)}
            >
              Siguiente
            </Button>
          </div>
        </div>
      </CardContent>
      <Dialog
        open={!!rangos}
        onOpenChange={(v) => {
          if (!v) setRangos(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {rangos?.fila === null
                ? "Rangos generales"
                : "Rangos de la combinación"}
            </DialogTitle>
            <DialogDescription>
              Escribí los inicios separados por punto y coma. El primero es{" "}
              {cad ? "0 ML" : `1 ${unidad}`}; el último queda abierto. Cada
              tramo rige hasta el siguiente.
            </DialogDescription>
          </DialogHeader>
          {rangos && (
            <FieldGroup>
              {rangos.fila !== null && (
                <Elegir
                  etiqueta="Origen de los rangos"
                  valor={rangos.heredar ? "GENERAL" : "PROPIO"}
                  opciones={[
                    { value: "GENERAL", label: "Heredar rangos generales" },
                    { value: "PROPIO", label: "Usar rangos propios" },
                  ]}
                  onChange={(v) =>
                    setRangos({ ...rangos, heredar: v === "GENERAL" })
                  }
                />
              )}
              <TextoTarifa
                etiqueta="Inicios de los tramos"
                valor={
                  rangos.heredar
                    ? matriz.rangosGenerales.join("; ")
                    : rangos.texto
                }
                disabled={rangos.heredar}
                onChange={(v) => setRangos({ ...rangos, texto: v })}
                ayuda={cad ? "Ejemplo: 0; 10,5; 50" : "Ejemplo: 1; 100; 500"}
              />
            </FieldGroup>
          )}
          <ErrorTarifa error={error} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRangos(null)}>
              Cancelar
            </Button>
            <Button disabled={disabled} onClick={aplicarRangos}>
              Aplicar rangos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!confirmar}
        onOpenChange={(v) => {
          if (!v) setConfirmar(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmar?.titulo}</DialogTitle>
            <DialogDescription>{confirmar?.detalle}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmar(null)}>
              Cancelar
            </Button>
            <Button
              disabled={disabled}
              onClick={() => {
                if (!disabled) confirmar?.aplicar();
                setConfirmar(null);
              }}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!ajuste}
        onOpenChange={(v) => {
          if (!v) setAjuste(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajustar precios en borrador</DialogTitle>
            <DialogDescription>
              Afecta todos los tramos de las {indices.length} combinaciones que
              coinciden con la búsqueda, en todas las páginas. Las celdas
              pendientes se conservan.
            </DialogDescription>
          </DialogHeader>
          {ajuste && (
            <FieldGroup>
              <Elegir
                etiqueta="Tipo de ajuste"
                valor={ajuste.modo}
                opciones={[
                  { value: "PORCENTAJE", label: "Porcentaje" },
                  { value: "IMPORTE", label: "Importe por unidad" },
                ]}
                onChange={(v) => setAjuste({ ...ajuste, modo: v })}
              />
              <TextoTarifa
                etiqueta={
                  ajuste.modo === "PORCENTAJE"
                    ? "Porcentaje de ajuste"
                    : "Importe a sumar por unidad"
                }
                valor={ajuste.valor}
                onChange={(v) => setAjuste({ ...ajuste, valor: v })}
                ayuda="Un valor negativo reduce el precio. Se revisa antes de aplicar."
              />
              <TextoTarifa
                etiqueta="Redondear hacia arriba a múltiplos de"
                valor={ajuste.redondeo}
                onChange={(v) => setAjuste({ ...ajuste, redondeo: v })}
                ayuda="Opcional. Vacío conserva hasta ocho decimales."
              />
            </FieldGroup>
          )}
          <ErrorTarifa error={error} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAjuste(null)}>
              Cancelar
            </Button>
            <Button
              disabled={disabled}
              onClick={() => {
                if (!ajuste) return;
                try {
                  const c = indices.flatMap((i) =>
                    preciosConRangos(
                      matriz.filas[i],
                      matriz.filas[i].rangosPropios ?? matriz.rangosGenerales,
                    ).flatMap((p, tramo) =>
                      p.precioUnitario == null || p.precioUnitario.trim() === ""
                        ? []
                        : [
                            {
                              fila: i,
                              tramo,
                              antes: p.precioUnitario,
                              despues: ajustarPrecio(
                                p.precioUnitario,
                                ajuste.modo,
                                ajuste.valor,
                                ajuste.redondeo,
                              ),
                            },
                          ],
                    ),
                  );
                  if (!c.length)
                    throw new Error("No hay precios cargados para ajustar.");
                  setPaginaRevision(0);
                  setCambios(c);
                  setAjuste(null);
                  setError(null);
                } catch (e) {
                  setError(mensajeErrorTarifa(e));
                }
              }}
            >
              Revisar ajuste
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!cambios}
        onOpenChange={(v) => {
          if (!v) setCambios(null);
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Revisar {cambios?.length} celdas</DialogTitle>
            <DialogDescription>
              Estos valores se aplican sólo al borrador. Revisá el cambio antes
              de guardar y publicar.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-80 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Combinación y tramo</TableHead>
                  <TableHead>Antes</TableHead>
                  <TableHead>Después</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cambios
                  ?.slice(paginaRevision * 50, (paginaRevision + 1) * 50)
                  .map((c) => (
                    <TableRow key={`${c.fila}-${c.tramo}`}>
                      <TableCell className="whitespace-normal">
                        {descripcion(matriz.filas[c.fila])} · desde{" "}
                        {
                          (matriz.filas[c.fila].rangosPropios ??
                            matriz.rangosGenerales)[c.tramo]
                        }
                      </TableCell>
                      <TableCell>{c.antes ?? "Pendiente"}</TableCell>
                      <TableCell>{c.despues ?? "Pendiente"}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
          {cambios && cambios.length > 50 && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">
                Celdas {paginaRevision * 50 + 1}–
                {Math.min(cambios.length, (paginaRevision + 1) * 50)} de{" "}
                {cambios.length}
              </span>
              <Button
                variant="outline"
                disabled={!paginaRevision}
                onClick={() => setPaginaRevision((p) => p - 1)}
              >
                Anteriores
              </Button>
              <Button
                variant="outline"
                disabled={(paginaRevision + 1) * 50 >= cambios.length}
                onClick={() => setPaginaRevision((p) => p + 1)}
              >
                Siguientes
              </Button>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCambios(null)}>
              Cancelar
            </Button>
            <Button
              disabled={disabled}
              onClick={() => {
                if (cambios) aplicarCambios(cambios);
                setCambios(null);
              }}
            >
              Aplicar al borrador
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
