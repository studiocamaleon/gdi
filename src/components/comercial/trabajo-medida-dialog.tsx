"use client";

import * as React from "react";
import { Card, Input, Spinner, TextArea } from "@heroui/react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CalculatorIcon,
  LayersIcon,
  PaperclipIcon,
  PlusIcon,
  RouteIcon,
  Trash2Icon,
  WalletIcon,
  XIcon,
} from "lucide-react";
import { FormDialog } from "@/components/design-system/form-dialog";
import { ActionButton } from "@/components/design-system/action-button";
import { SegmentedControl } from "@/components/design-system/choice-controls";
import { SelectField } from "@/components/design-system/select-field";
import focus from "@/components/design-system/field-focus.module.css";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
} from "@/components/ui/field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import s from "./trabajo-medida-dialog.module.css";
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
      <SelectField
        id={id}
        aria-label={label}
        className={s.select}
        value={value}
        onChange={onChange}
        options={opciones.map((o) => ({ value: o.id, label: o.nombre }))}
      />
    </Field>
  );
}

function Seccion({
  titulo,
  icono,
  children,
}: {
  titulo: string;
  icono: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className={s.section}>
      <Card.Header className={s.sectionHeader}>
        <span className={s.sectionIcon} aria-hidden="true">
          {icono}
        </span>
        <Card.Title>{titulo}</Card.Title>
      </Card.Header>
      <Card.Content className={s.sectionBody}>{children}</Card.Content>
    </Card>
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
  const selectorArchivos = React.useRef<HTMLInputElement>(null);
  const resumenRef = React.useRef<HTMLElement>(null);
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
    setOpciones(null);
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
                periodo: o.periodo,
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
  React.useEffect(() => {
    if (calculo && window.matchMedia("(max-width: 799px)").matches) {
      resumenRef.current?.scrollIntoView({ block: "nearest" });
    }
  }, [calculo]);

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
    setCalculo(null);
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
    <FormDialog
      isOpen={open}
      onOpenChange={onOpenChange}
      title={item ? "Editar trabajo a medida" : "Nuevo trabajo a medida"}
      description="Estimá el costo y definí el precio y la producción de este trabajo."
      className={s.dialog}
    >
      {cargando ? (
        <div className={s.loading} role="status">
          <Spinner size="sm" />
          Cargando opciones…
        </div>
      ) : (
        opciones && (
          <div className={s.workspace}>
            <div className={s.form}>
              <Seccion titulo="Datos del trabajo" icono={<LayersIcon />}>
                <FieldGroup className={s.jobFields}>
                  <Field className={s.fullRow}>
                    <FieldLabel htmlFor="medida-nombre">Nombre</FieldLabel>
                    <Input
                      className={focus.singleBorder}
                      id="medida-nombre"
                      placeholder="Ej.: Exhibidor para mostrador"
                      value={input.nombre}
                      maxLength={200}
                      onChange={(e) => cambiar({ nombre: e.target.value })}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="medida-cantidad">Cantidad</FieldLabel>
                    <Input
                      className={focus.singleBorder}
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
                      { id: "unidad", nombre: "Unidades" },
                      { id: "m2", nombre: "m²" },
                      { id: "metro_lineal", nombre: "Metros lineales" },
                      { id: "libros", nombre: "Libros" },
                      { id: "hojas", nombre: "Hojas" },
                    ]}
                    onChange={(v) =>
                      cambiar({ unidad: v as TrabajoMedidaInput["unidad"] })
                    }
                  />
                  <Field className={s.deliveryField}>
                    <FieldLabel htmlFor="medida-entrega">
                      Entrega comprometida
                    </FieldLabel>
                    <Input
                      className={focus.singleBorder}
                      id="medida-entrega"
                      type="date"
                      value={entrega}
                      onChange={(e) => setEntrega(e.target.value)}
                    />
                  </Field>
                  <Field className={s.fullRow}>
                    <FieldLabel htmlFor="medida-descripcion">
                      Descripción e instrucciones de producción
                    </FieldLabel>
                    <TextArea
                      className={`${s.textarea} ${focus.singleBorder}`}
                      id="medida-descripcion"
                      value={input.descripcion}
                      maxLength={4000}
                      onChange={(e) => cambiar({ descripcion: e.target.value })}
                    />
                  </Field>
                  <Field className={s.fullRow}>
                    <FieldLabel htmlFor="medida-archivos">
                      Archivos y referencias
                    </FieldLabel>
                    <input
                      ref={selectorArchivos}
                      id="medida-archivos"
                      type="file"
                      multiple
                      hidden
                      onChange={(e) => {
                        const nuevos = Array.from(e.currentTarget.files ?? []);
                        setArchivos((previos) => [...previos, ...nuevos]);
                        e.currentTarget.value = "";
                      }}
                    />
                    <ActionButton
                      className={s.inlineAction}
                      variant="outline"
                      onPress={() => selectorArchivos.current?.click()}
                    >
                      <PaperclipIcon aria-hidden />
                      Adjuntar archivos
                    </ActionButton>
                    {archivos.length > 0 && (
                      <ul
                        className={s.attachments}
                        aria-label="Archivos por adjuntar"
                      >
                        {archivos.map((archivo, i) => (
                          <li key={i}>
                            <span>{archivo.name}</span>
                            <ActionButton
                              isIconOnly
                              variant="ghost"
                              aria-label={`Quitar ${archivo.name}`}
                              onPress={() =>
                                setArchivos((previos) =>
                                  previos.filter((_, j) => j !== i),
                                )
                              }
                            >
                              <XIcon aria-hidden />
                            </ActionButton>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Field>
                </FieldGroup>
              </Seccion>
              <Seccion titulo="Costos estimados" icono={<CalculatorIcon />}>
                <FieldGroup className={s.fields}>
                  <SegmentedControl
                    aria-label="Detalle de costos"
                    value={input.costos.modo ?? "DESGLOSADO"}
                    options={[
                      { value: "TOTAL", label: "Costo total", icon: null },
                      {
                        value: "DESGLOSADO",
                        label: "Desglosar costos",
                        icon: null,
                      },
                    ]}
                    onChange={(modo) =>
                      cambiar({
                        costos: {
                          ...input.costos,
                          modo: modo as "TOTAL" | "DESGLOSADO",
                          totalEstimado: Number.isFinite(
                            input.costos.totalEstimado,
                          )
                            ? input.costos.totalEstimado
                            : undefined,
                        },
                      })
                    }
                  />
                  {input.costos.modo === "TOTAL" ? (
                    <Field>
                      <FieldLabel htmlFor="medida-costo-total">
                        Costo total aproximado · {opciones.moneda.codigo}
                      </FieldLabel>
                      <Input
                        className={focus.singleBorder}
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
                        Incluí materiales, mano de obra y máquina. Las horas que
                        cargues sirven para desglosar el importe y no se suman
                        al total.
                      </FieldDescription>
                    </Field>
                  ) : (
                    <>
                      <Field>
                        <FieldLabel htmlFor="medida-materiales">
                          Costo de materiales · {opciones.moneda.codigo}
                        </FieldLabel>
                        <Input
                          className={focus.singleBorder}
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
                          Importe para todo el trabajo. La estimación no
                          descuenta stock.
                        </FieldDescription>
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="medida-materiales-detalle">
                          Detalle de materiales (opcional)
                        </FieldLabel>
                        <TextArea
                          className={`${s.textarea} ${focus.singleBorder}`}
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
                        <FieldGroup key={i} className={s.costRow}>
                          <Field>
                            <FieldLabel htmlFor={`gasto-${i}`}>
                              Otro costo directo
                            </FieldLabel>
                            <Input
                              className={focus.singleBorder}
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
                              className={focus.singleBorder}
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
                          <ActionButton
                            variant="ghost"
                            isIconOnly
                            aria-label={`Quitar costo ${i + 1}`}
                            onPress={() =>
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
                          </ActionButton>
                        </FieldGroup>
                      ))}
                      <ActionButton
                        className={s.inlineAction}
                        variant="outline"
                        onPress={() =>
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
                        <PlusIcon aria-hidden />
                        Agregar otro costo
                      </ActionButton>
                    </>
                  )}
                </FieldGroup>
              </Seccion>
              <Seccion titulo="Producción y horas" icono={<RouteIcon />}>
                <FieldGroup className={s.fields}>
                  <SegmentedControl
                    aria-label="Seguimiento de producción"
                    value={input.produccion ? "SI" : "NO"}
                    options={[
                      { value: "SI", label: "Con ruta", icon: null },
                      { value: "NO", label: "Sin seguimiento", icon: null },
                    ]}
                    onChange={(v) => cambiar({ produccion: v === "SI" })}
                  />
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
                    Horas para el trabajo completo. Tarifas publicadas de{" "}
                    {opciones.periodo}.
                  </FieldDescription>
                  {input.operaciones.map((o, i) => (
                    <fieldset key={o.clave} className={s.operation}>
                      <legend>
                        {input.produccion ? `Paso ${i + 1}` : `Centro ${i + 1}`}
                      </legend>
                      <FieldGroup className={s.twoFields}>
                        <Field>
                          <FieldLabel htmlFor={`operacion-${o.clave}`}>
                            Operación
                          </FieldLabel>
                          <Input
                            className={focus.singleBorder}
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
                            Horas estimadas
                          </FieldLabel>
                          <Input
                            className={focus.singleBorder}
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
                      <div className={s.operationActions}>
                        <ActionButton
                          isIconOnly
                          variant="ghost"
                          isDisabled={i === 0}
                          aria-label={`Subir paso ${i + 1}`}
                          onPress={() => mover(i, -1)}
                        >
                          <ArrowUpIcon />
                        </ActionButton>
                        <ActionButton
                          isIconOnly
                          variant="ghost"
                          isDisabled={i === input.operaciones.length - 1}
                          aria-label={`Bajar paso ${i + 1}`}
                          onPress={() => mover(i, 1)}
                        >
                          <ArrowDownIcon />
                        </ActionButton>
                        <ActionButton
                          isIconOnly
                          variant="ghost"
                          aria-label={`Quitar paso ${i + 1}`}
                          onPress={() =>
                            cambiar({
                              operaciones: input.operaciones.filter(
                                (v) => v.clave !== o.clave,
                              ),
                            })
                          }
                        >
                          <Trash2Icon />
                        </ActionButton>
                      </div>
                    </fieldset>
                  ))}
                  <ActionButton
                    className={s.inlineAction}
                    variant="outline"
                    onPress={() =>
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
                    <PlusIcon aria-hidden />
                    Agregar {input.produccion ? "paso" : "horas de un centro"}
                  </ActionButton>
                </FieldGroup>
              </Seccion>
            </div>
            <div className={s.aside}>
              <Seccion titulo="Precio de venta" icono={<WalletIcon />}>
                <FieldGroup className={s.fields}>
                  <Field>
                    <FieldLabel htmlFor="medida-precio">
                      Precio acordado · {opciones.moneda.codigo}
                    </FieldLabel>
                    <Input
                      className={focus.singleBorder}
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
                  <FieldGroup className={s.fields}>
                    <Field>
                      <FieldLabel id="medida-base-precio">
                        Precio por
                      </FieldLabel>
                      <SegmentedControl
                        aria-labelledby="medida-base-precio"
                        value={input.basePrecio}
                        options={[
                          {
                            value: "TOTAL",
                            label: "Trabajo completo",
                            icon: null,
                          },
                          { value: "UNITARIO", label: "Unidad", icon: null },
                        ]}
                        onChange={(basePrecio) =>
                          cambiar({
                            basePrecio:
                              basePrecio as TrabajoMedidaInput["basePrecio"],
                          })
                        }
                      />
                    </Field>
                    <Field>
                      <FieldLabel id="medida-tipo-precio">Impuestos</FieldLabel>
                      <SegmentedControl
                        aria-labelledby="medida-tipo-precio"
                        value={input.tipoPrecio}
                        options={[
                          { value: "FINAL", label: "Incluidos", icon: null },
                          {
                            value: "NETO",
                            label: "Agregar al neto",
                            icon: null,
                          },
                        ]}
                        onChange={(tipoPrecio) =>
                          cambiar({
                            tipoPrecio:
                              tipoPrecio as TrabajoMedidaInput["tipoPrecio"],
                          })
                        }
                      />
                    </Field>
                  </FieldGroup>
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
                </FieldGroup>
              </Seccion>
              <aside
                ref={resumenRef}
                aria-label="Resumen del trabajo"
                className={s.summaryRegion}
              >
                <Card className={s.summary}>
                  <Card.Header className={s.summaryHeader}>
                    <Card.Title>Resumen del trabajo</Card.Title>
                    <span className={s.currency}>{opciones.moneda.codigo}</span>
                  </Card.Header>
                  <Card.Content className={s.summaryBody} aria-live="polite">
                    {calculo ? (
                      <dl className={s.amounts}>
                        <div>
                          <dt>Venta neta</dt>
                          <dd>{money(calculo.resumen.neto)}</dd>
                        </div>
                        <div>
                          <dt>Impuestos al cliente</dt>
                          <dd>{money(calculo.resumen.impuestos)}</dd>
                        </div>
                        <div className={s.total}>
                          <dt>Total al cliente</dt>
                          <dd>{money(calculo.resumen.total)}</dd>
                        </div>
                        <div className={s.costTotal}>
                          <dt>Costo estimado</dt>
                          <dd>{money(calculo.resumen.costoTotal)}</dd>
                        </div>
                        <div>
                          <dt>Margen estimado</dt>
                          <dd>{money(calculo.resumen.margen)}</dd>
                        </div>
                        <div>
                          <dt>Contribución estimada</dt>
                          <dd>{money(calculo.resumen.contribucion)}</dd>
                        </div>
                      </dl>
                    ) : (
                      <p>
                        {calculando
                          ? "Calculando importes…"
                          : "Revisá el cálculo para ver los importes."}
                      </p>
                    )}
                  </Card.Content>
                </Card>
                {calculo && input.operaciones.some((o) => o.horas == null) && (
                  <Alert className={s.notice}>
                    <AlertDescription>
                      {input.costos.modo === "TOTAL"
                        ? "Hay horas sin desglosar. El total se conserva y el costo sin asignar a centros se considera variable."
                        : "Hay pasos sin horas estimadas. El margen todavía es parcial."}
                    </AlertDescription>
                  </Alert>
                )}
                {calculo && calculo.resumen.margen < 0 && (
                  <Alert className={s.notice}>
                    <AlertDescription>
                      El precio no cubre los costos estimados de este trabajo.
                    </AlertDescription>
                  </Alert>
                )}
                {calculo && (
                  <p className={s.summaryHelp}>
                    La contribución resta los costos variables. El margen
                    también resta las horas de los centros.
                  </p>
                )}
              </aside>
            </div>
          </div>
        )
      )}
      {error && (
        <Alert variant="destructive" className={s.error}>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <footer className={s.footer}>
        <ActionButton variant="ghost" onPress={() => onOpenChange(false)}>
          Cancelar
        </ActionButton>
        <div className={s.footerActions}>
          <ActionButton
            className={s.reviewButton}
            variant="outline"
            isDisabled={cargando || calculando || !opciones}
            onPress={() => void revisar()}
          >
            {calculando ? (
              <Spinner size="sm" />
            ) : (
              <CalculatorIcon aria-hidden />
            )}
            {calculando ? "Calculando…" : "Revisar cálculo"}
          </ActionButton>
          <ActionButton
            isDisabled={!calculo || calculando || cargando}
            onPress={() => {
              if (calculo)
                onGuardar({
                  ...itemDesdeTrabajoMedida(calculo, item),
                  fechaEntrega: entrega || undefined,
                  archivosPendientes: archivos,
                });
            }}
          >
            {item ? "Guardar trabajo" : "Agregar trabajo"}
          </ActionButton>
        </div>
      </footer>
    </FormDialog>
  );
}
