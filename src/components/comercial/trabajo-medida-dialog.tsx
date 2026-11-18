"use client";

import * as React from "react";
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, Trash2Icon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
  FieldSet,
  FieldLegend,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectItem,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { useTipoCambioDocumento } from "./tipo-cambio-documento";
import { formatearMoneda } from "@/lib/moneda";
import type { PropuestaItem } from "@/lib/propuestas";
import {
  opcionesTrabajoMedida,
  obtenerTrabajoMedida,
  calcularTrabajoMedida,
  itemDesdeTrabajoMedida,
  trabajoMedidaDe,
  type TrabajoMedidaInput,
  type OpcionesMedida,
  type CalculoMedida,
  type OperacionMedida,
} from "@/lib/trabajos-medida-api";

const inicial = (): TrabajoMedidaInput => ({
  nombre: "",
  descripcion: "",
  cantidad: 1,
  unidad: "unidad",
  precio: Number.NaN,
  basePrecio: "TOTAL",
  tipoPrecio: "FINAL",
  categoriaFiscal: "general",
  costos: {
    modo: "TOTAL",
    totalEstimado: Number.NaN,
    materiales: 0,
    otros: [],
  },
  produccion: true,
  operaciones: [],
});

function Elegir({
  label,
  value,
  opciones,
  onChange,
}: {
  label: string;
  value: string;
  opciones: Array<{ id: string; nombre: string }>;
  onChange: (v: string) => void;
}) {
  const id = React.useId();
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select
        value={value}
        onValueChange={(v) => onChange(v ?? "")}
        items={opciones.map((o) => ({ value: o.id, label: o.nombre }))}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {opciones.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.nombre}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  );
}

export function TrabajoMedidaDialog({
  open,
  onOpenChange,
  item,
  clienteId,
  fechaEntrega,
  onGuardar,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  item: PropuestaItem | null;
  clienteId: string | null;
  fechaEntrega: string;
  onGuardar: (item: PropuestaItem) => void;
}) {
  const [input, setInput] = React.useState<TrabajoMedidaInput>(inicial);
  const [opciones, setOpciones] = React.useState<OpcionesMedida | null>(null);
  const [calculo, setCalculo] = React.useState<CalculoMedida | null>(null);
  const [error, setError] = React.useState("");
  const [cargando, setCargando] = React.useState(false);
  const [calculando, setCalculando] = React.useState(false);
  const [archivos, setArchivos] = React.useState<File[]>([]);
  const [entrega, setEntrega] = React.useState(fechaEntrega);
  const cambio = useTipoCambioDocumento();
  const revision = React.useRef(0);
  React.useEffect(() => {
    if (!open) return;
    let vigente = true;
    const cancelarRevision = () => {
      revision.current++;
    };
    cancelarRevision();
    setCargando(true);
    setError("");
    setCalculo(null);
    setArchivos(item?.archivosPendientes ?? []);
    setEntrega(item?.fechaEntrega ?? fechaEntrega);
    Promise.all([
      opcionesTrabajoMedida(),
      item?.cotizacionItemId
        ? obtenerTrabajoMedida(item.cotizacionItemId)
        : Promise.resolve(item ? trabajoMedidaDe(item) : null),
    ])
      .then(([o, previo]) => {
        if (!vigente) return;
        setOpciones(o);
        setInput(
          previo
            ? {
                ...previo,
                anteriorItemId: item?.cotizacionItemId ?? previo.anteriorItemId,
                descuento: item?.descuentoInput ?? previo.descuento,
              }
            : inicial(),
        );
      })
      .catch((e) => {
        if (vigente)
          setError(
            e instanceof Error ? e.message : "No se pudo abrir el trabajo.",
          );
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });
    return () => {
      vigente = false;
      cancelarRevision();
    };
  }, [open, item, fechaEntrega]);
  const cambiar = (c: Partial<TrabajoMedidaInput>) => {
    revision.current++;
    setInput((p) => ({ ...p, ...c }));
    setCalculo(null);
    setError("");
  };
  const operacion = (id: string, c: Partial<OperacionMedida>) =>
    cambiar({
      operaciones: input.operaciones.map((o) =>
        o.clave === id ? { ...o, ...c } : o,
      ),
    });
  const mover = (i: number, delta: number) => {
    const lista = [...input.operaciones];
    [lista[i], lista[i + delta]] = [lista[i + delta], lista[i]];
    cambiar({ operaciones: lista });
  };
  const money = (n: number) =>
    opciones ? formatearMoneda(n, opciones.moneda) : String(n);
  const revisar = async () => {
    setError("");
    setCalculando(true);
    const actual = revision.current;
    try {
      const tipoCambioId = cambio
        ? (await cambio.resolver()).id
        : input.tipoCambioId;
      const resultado = await calcularTrabajoMedida({
        ...input,
        clienteId,
        tipoCambioId,
      });
      if (revision.current === actual) setCalculo(resultado);
    } catch (e) {
      if (revision.current === actual)
        setError(e instanceof Error ? e.message : "No se pudo calcular.");
    } finally {
      setCalculando(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            {item ? "Editar trabajo a medida" : "Nuevo trabajo a medida"}
          </DialogTitle>
          <DialogDescription>
            Cargá el costo estimado y fijá el precio de este proyecto. Los
            costos y las horas corresponden al trabajo completo.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {cargando ? (
          <Spinner aria-label="Cargando opciones" />
        ) : (
          opciones && (
            <FieldGroup>
              <FieldSet>
                <FieldLegend>El trabajo</FieldLegend>
                <FieldGroup className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="medida-nombre">Nombre</FieldLabel>
                    <Input
                      id="medida-nombre"
                      value={input.nombre}
                      maxLength={200}
                      onChange={(e) => cambiar({ nombre: e.target.value })}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="medida-cantidad">Cantidad</FieldLabel>
                    <Input
                      id="medida-cantidad"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={input.cantidad}
                      onChange={(e) =>
                        cambiar({ cantidad: Number(e.target.value) })
                      }
                    />
                  </Field>
                  <Elegir
                    label="Unidad"
                    value={input.unidad}
                    opciones={[
                      { id: "unidad", nombre: "Unidades / proyectos" },
                      { id: "m2", nombre: "m²" },
                      { id: "metro_lineal", nombre: "Metros lineales" },
                      { id: "libros", nombre: "Libros" },
                      { id: "hojas", nombre: "Hojas" },
                    ]}
                    onChange={(v) =>
                      cambiar({ unidad: v as TrabajoMedidaInput["unidad"] })
                    }
                  />
                  <Field>
                    <FieldLabel htmlFor="medida-entrega">
                      Entrega comprometida
                    </FieldLabel>
                    <Input
                      id="medida-entrega"
                      type="date"
                      value={entrega}
                      onChange={(e) => setEntrega(e.target.value)}
                    />
                    <FieldDescription>
                      Fecha elegida manualmente; los tiempos permiten
                      contrastarla con la capacidad del taller.
                    </FieldDescription>
                  </Field>
                  <Field className="sm:col-span-2">
                    <FieldLabel htmlFor="medida-descripcion">
                      Descripción e instrucciones de producción
                    </FieldLabel>
                    <Textarea
                      id="medida-descripcion"
                      value={input.descripcion}
                      maxLength={4000}
                      onChange={(e) => cambiar({ descripcion: e.target.value })}
                    />
                  </Field>
                  <Field className="sm:col-span-2">
                    <FieldLabel htmlFor="medida-archivos">
                      Archivos y referencias
                    </FieldLabel>
                    <Input
                      id="medida-archivos"
                      type="file"
                      multiple
                      onChange={(e) =>
                        setArchivos([
                          ...archivos,
                          ...Array.from(e.target.files ?? []),
                        ])
                      }
                    />
                    <FieldDescription>
                      {archivos.length
                        ? archivos.map((f) => f.name).join(" · ")
                        : "Se adjuntan al guardar la orden, igual que en los otros productos."}
                    </FieldDescription>
                  </Field>
                </FieldGroup>
              </FieldSet>
              <FieldSet>
                <FieldLegend>
                  Costos estimados · {opciones.moneda.codigo}
                </FieldLegend>
                <FieldGroup>
                  <ToggleGroup
                    value={[input.costos.modo ?? "DESGLOSADO"]}
                    variant="outline"
                    aria-label="Detalle de costos"
                    onValueChange={(v) => {
                      if (v.length)
                        cambiar({
                          costos: {
                            ...input.costos,
                            modo: v[0] as "TOTAL" | "DESGLOSADO",
                            totalEstimado: Number.isFinite(
                              input.costos.totalEstimado,
                            )
                              ? input.costos.totalEstimado
                              : undefined,
                          },
                        });
                    }}
                  >
                    <ToggleGroupItem value="TOTAL">
                      Costo total aproximado
                    </ToggleGroupItem>
                    <ToggleGroupItem value="DESGLOSADO">
                      Desglosar costos
                    </ToggleGroupItem>
                  </ToggleGroup>
                  {input.costos.modo === "TOTAL" ? (
                    <Field>
                      <FieldLabel htmlFor="medida-costo-total">
                        Costo total aproximado
                      </FieldLabel>
                      <Input
                        id="medida-costo-total"
                        type="number"
                        min="0"
                        step="any"
                        value={
                          Number.isFinite(input.costos.totalEstimado)
                            ? input.costos.totalEstimado
                            : ""
                        }
                        onChange={(e) =>
                          cambiar({
                            costos: {
                              ...input.costos,
                              totalEstimado:
                                e.target.value === ""
                                  ? undefined
                                  : Number(e.target.value),
                            },
                          })
                        }
                      />
                      <FieldDescription>
                        Incluí materiales, mano de obra y máquina. Las horas
                        cargadas abajo ya están dentro de este importe: no se
                        suman otra vez. Lo que no se desglosa en horas se
                        considera costo variable estimado para la contribución.
                      </FieldDescription>
                    </Field>
                  ) : (
                    <>
                      <Field>
                        <FieldLabel htmlFor="medida-materiales">
                          Costo de materiales estimado
                        </FieldLabel>
                        <Input
                          id="medida-materiales"
                          type="number"
                          min="0"
                          step="any"
                          value={
                            Number.isFinite(input.costos.materiales)
                              ? input.costos.materiales
                              : ""
                          }
                          onChange={(e) =>
                            cambiar({
                              costos: {
                                ...input.costos,
                                materiales:
                                  e.target.value === ""
                                    ? Number.NaN
                                    : Number(e.target.value),
                              },
                            })
                          }
                        />
                        <FieldDescription>
                          Un importe total. Esta estimación no descuenta stock
                          ni registra pagos.
                        </FieldDescription>
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="medida-materiales-detalle">
                          Detalle de materiales (opcional)
                        </FieldLabel>
                        <Textarea
                          id="medida-materiales-detalle"
                          value={input.costos.detalleMateriales ?? ""}
                          onChange={(e) =>
                            cambiar({
                              costos: {
                                ...input.costos,
                                detalleMateriales: e.target.value,
                              },
                            })
                          }
                        />
                      </Field>
                      {input.costos.otros.map((g, i) => (
                        <FieldGroup
                          key={i}
                          className="grid grid-cols-[1fr_140px_auto] items-end gap-3"
                        >
                          <Field>
                            <FieldLabel htmlFor={`gasto-${i}`}>
                              Otro costo directo
                            </FieldLabel>
                            <Input
                              id={`gasto-${i}`}
                              value={g.nombre}
                              placeholder="Ej.: flete o tercerizado"
                              onChange={(e) =>
                                cambiar({
                                  costos: {
                                    ...input.costos,
                                    otros: input.costos.otros.map((v, j) =>
                                      j === i
                                        ? { ...v, nombre: e.target.value }
                                        : v,
                                    ),
                                  },
                                })
                              }
                            />
                          </Field>
                          <Field>
                            <FieldLabel htmlFor={`importe-${i}`}>
                              Importe
                            </FieldLabel>
                            <Input
                              id={`importe-${i}`}
                              type="number"
                              min="0"
                              step="any"
                              value={g.costo}
                              onChange={(e) =>
                                cambiar({
                                  costos: {
                                    ...input.costos,
                                    otros: input.costos.otros.map((v, j) =>
                                      j === i
                                        ? {
                                            ...v,
                                            costo: Number(e.target.value),
                                          }
                                        : v,
                                    ),
                                  },
                                })
                              }
                            />
                          </Field>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Quitar costo ${i + 1}`}
                            onClick={() =>
                              cambiar({
                                costos: {
                                  ...input.costos,
                                  otros: input.costos.otros.filter(
                                    (_, j) => j !== i,
                                  ),
                                },
                              })
                            }
                          >
                            <Trash2Icon />
                          </Button>
                        </FieldGroup>
                      ))}
                      <Button
                        variant="outline"
                        onClick={() =>
                          cambiar({
                            costos: {
                              ...input.costos,
                              otros: [
                                ...input.costos.otros,
                                { nombre: "", costo: 0 },
                              ],
                            },
                          })
                        }
                      >
                        <PlusIcon data-icon="inline-start" />
                        Agregar otro costo
                      </Button>
                    </>
                  )}
                </FieldGroup>
              </FieldSet>
              <FieldSet>
                <FieldLegend>Horas del taller y producción</FieldLegend>
                <FieldGroup>
                  <ToggleGroup
                    value={[input.produccion ? "SI" : "NO"]}
                    onValueChange={(v) => {
                      if (v.length) cambiar({ produccion: v[0] === "SI" });
                    }}
                    variant="outline"
                    aria-label="Seguimiento de producción"
                  >
                    <ToggleGroupItem value="SI">
                      Con ruta de producción
                    </ToggleGroupItem>
                    <ToggleGroupItem value="NO">
                      Sin seguimiento
                    </ToggleGroupItem>
                  </ToggleGroup>
                  {input.produccion && (
                    <Elegir
                      label="Usar una ruta como base"
                      value={input.rutaOrigenId ?? ""}
                      opciones={[
                        { id: "", nombre: "Armar los pasos de este trabajo" },
                        ...opciones.rutas,
                      ]}
                      onChange={(id) => {
                        const ruta = opciones.rutas.find((r) => r.id === id);
                        cambiar({
                          rutaOrigenId: id || null,
                          operaciones: ruta
                            ? ruta.pasos.map((p) => ({
                                ...p,
                                clave: crypto.randomUUID(),
                                horas: null,
                                centroCostoId: null,
                              }))
                            : input.operaciones,
                        });
                      }}
                    />
                  )}
                  <FieldDescription>
                    Las horas se costean una sola vez. Cada fila puede ser un
                    paso de producción. Si un paso no tiene tiempo estimado, la
                    entrega requiere revisión manual.
                  </FieldDescription>
                  {input.operaciones.map((o, i) => (
                    <FieldSet key={o.clave}>
                      <FieldLegend variant="label">
                        {input.produccion ? `Paso ${i + 1}` : `Centro ${i + 1}`}
                      </FieldLegend>
                      <FieldGroup className="grid gap-3 sm:grid-cols-2">
                        <Field>
                          <FieldLabel htmlFor={`operacion-${o.clave}`}>
                            Operación
                          </FieldLabel>
                          <Input
                            id={`operacion-${o.clave}`}
                            value={o.nombre}
                            onChange={(e) =>
                              operacion(o.clave, { nombre: e.target.value })
                            }
                          />
                        </Field>
                        <Elegir
                          label="Centro de costo"
                          value={o.centroCostoId ?? ""}
                          opciones={[
                            { id: "", nombre: "Sin centro asignado" },
                            ...opciones.centros.map((c) => ({
                              id: c.id,
                              nombre: `${c.nombre} · ${c.tarifaHora == null ? "Sin tarifa vigente" : money(c.tarifaHora) + "/h"}`,
                            })),
                          ]}
                          onChange={(id) =>
                            operacion(o.clave, {
                              centroCostoId: id || null,
                              maquinaId: null,
                            })
                          }
                        />
                        <Field>
                          <FieldLabel htmlFor={`horas-${o.clave}`}>
                            Horas estimadas del trabajo completo
                          </FieldLabel>
                          <Input
                            id={`horas-${o.clave}`}
                            type="number"
                            min="0"
                            step="any"
                            value={o.horas ?? ""}
                            placeholder="Sin estimar"
                            onChange={(e) =>
                              operacion(o.clave, {
                                horas:
                                  e.target.value === ""
                                    ? null
                                    : Number(e.target.value),
                              })
                            }
                          />
                        </Field>
                        <Elegir
                          label="Máquina (opcional)"
                          value={o.maquinaId ?? ""}
                          opciones={[
                            { id: "", nombre: "Sin máquina" },
                            ...opciones.maquinas.filter(
                              (m) =>
                                m.centroCostoPrincipalId === o.centroCostoId,
                            ),
                          ]}
                          onChange={(id) =>
                            operacion(o.clave, { maquinaId: id || null })
                          }
                        />
                      </FieldGroup>
                      <div className="flex justify-end gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={i === 0}
                          aria-label={`Subir paso ${i + 1}`}
                          onClick={() => mover(i, -1)}
                        >
                          <ArrowUpIcon />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={i === input.operaciones.length - 1}
                          aria-label={`Bajar paso ${i + 1}`}
                          onClick={() => mover(i, 1)}
                        >
                          <ArrowDownIcon />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Quitar paso ${i + 1}`}
                          onClick={() =>
                            cambiar({
                              operaciones: input.operaciones.filter(
                                (v) => v.clave !== o.clave,
                              ),
                            })
                          }
                        >
                          <Trash2Icon />
                        </Button>
                      </div>
                    </FieldSet>
                  ))}
                  <Button
                    variant="outline"
                    onClick={() =>
                      cambiar({
                        operaciones: [
                          ...input.operaciones,
                          {
                            clave: crypto.randomUUID(),
                            nombre: "",
                            familiaCodigo: "trabajo_manual",
                            horas: null,
                            centroCostoId: null,
                          },
                        ],
                      })
                    }
                  >
                    <PlusIcon data-icon="inline-start" />
                    Agregar {input.produccion ? "paso" : "horas de un centro"}
                  </Button>
                </FieldGroup>
              </FieldSet>
              <FieldSet>
                <FieldLegend>
                  Precio de venta · {opciones.moneda.codigo}
                </FieldLegend>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="medida-precio">
                      Precio acordado
                    </FieldLabel>
                    <Input
                      id="medida-precio"
                      type="number"
                      min="0"
                      step="any"
                      value={Number.isFinite(input.precio) ? input.precio : ""}
                      onChange={(e) =>
                        cambiar({
                          precio:
                            e.target.value === ""
                              ? Number.NaN
                              : Number(e.target.value),
                        })
                      }
                    />
                  </Field>
                  <ToggleGroup
                    value={[input.basePrecio]}
                    onValueChange={(v) => {
                      if (v.length)
                        cambiar({ basePrecio: v[0] as "TOTAL" | "UNITARIO" });
                    }}
                    variant="outline"
                    aria-label="Base del precio"
                  >
                    <ToggleGroupItem value="TOTAL">
                      Por el trabajo completo
                    </ToggleGroupItem>
                    <ToggleGroupItem value="UNITARIO">
                      Por unidad
                    </ToggleGroupItem>
                  </ToggleGroup>
                  <ToggleGroup
                    value={[input.tipoPrecio]}
                    onValueChange={(v) => {
                      if (v.length)
                        cambiar({ tipoPrecio: v[0] as "FINAL" | "NETO" });
                    }}
                    variant="outline"
                    aria-label="Impuestos del precio"
                  >
                    <ToggleGroupItem value="FINAL">
                      Final, impuestos incluidos
                    </ToggleGroupItem>
                    <ToggleGroupItem value="NETO">
                      Neto, agregar impuestos
                    </ToggleGroupItem>
                  </ToggleGroup>
                  <Elegir
                    label="Categoría fiscal"
                    value={input.categoriaFiscal}
                    opciones={[
                      { id: "general", nombre: "General" },
                      { id: "reducida", nombre: "Reducida" },
                      { id: "exento", nombre: "Exento" },
                    ]}
                    onChange={(v) =>
                      cambiar({
                        categoriaFiscal:
                          v as TrabajoMedidaInput["categoriaFiscal"],
                      })
                    }
                  />
                  <FieldDescription>
                    Se aplica la configuración fiscal de la empresa. Los
                    impuestos internos y comisiones reducen el margen; no
                    aumentan el precio final que fijaste.
                  </FieldDescription>
                </FieldGroup>
              </FieldSet>
              {calculo && (
                <FieldSet>
                  <FieldLegend>
                    Revisión del trabajo{" "}
                    <Badge variant="secondary">Costos estimados</Badge>
                  </FieldLegend>
                  <dl className="grid grid-cols-2 gap-3">
                    <dt>Venta neta</dt>
                    <dd>{money(calculo.resumen.neto)}</dd>
                    <dt>Impuestos al cliente</dt>
                    <dd>{money(calculo.resumen.impuestos)}</dd>
                    <dt>Total al cliente</dt>
                    <dd>{money(calculo.resumen.total)}</dd>
                    <dt>Costo total estimado</dt>
                    <dd>{money(calculo.resumen.costoTotal)}</dd>
                    <dt>Margen estimado</dt>
                    <dd>{money(calculo.resumen.margen)}</dd>
                    <dt>Contribución estimada</dt>
                    <dd>{money(calculo.resumen.contribucion)}</dd>
                  </dl>
                  {calculo.resumen.estimacionParcial && (
                    <Alert>
                      <AlertDescription>
                        Faltan horas por estimar: esos pasos todavía no están
                        incluidos en el costo. El margen es parcial y la entrega
                        necesita revisión manual.
                      </AlertDescription>
                    </Alert>
                  )}
                  <FieldDescription>
                    La contribución descuenta materiales, otros costos directos,
                    impuestos internos y comisiones. El margen también descuenta
                    las horas de los centros.
                  </FieldDescription>
                  {calculo.resumen.margen < 0 && (
                    <Alert>
                      <AlertDescription>
                        El precio no cubre todos los costos estimados de este
                        trabajo.
                      </AlertDescription>
                    </Alert>
                  )}
                </FieldSet>
              )}
            </FieldGroup>
          )
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            variant="outline"
            disabled={cargando || calculando || !opciones}
            onClick={() => void revisar()}
          >
            {calculando && <Spinner data-icon="inline-start" />}Revisar cálculo
          </Button>
          <Button
            disabled={!calculo || calculando || cargando}
            onClick={() => {
              if (calculo)
                onGuardar({
                  ...itemDesdeTrabajoMedida(calculo, item),
                  fechaEntrega: entrega || undefined,
                  archivosPendientes: archivos,
                });
            }}
          >
            {item ? "Guardar trabajo" : "Agregar trabajo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
