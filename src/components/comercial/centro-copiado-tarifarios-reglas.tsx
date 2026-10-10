"use client";
import { useState } from "react";
import { FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import {
  Elegir,
  TextoTarifa,
  ErrorTarifa,
  mensajeErrorTarifa,
} from "./centro-copiado-tarifarios-controles";
import { cambiarCobertura } from "@/lib/centro-copiado-tarifarios-editor";
import type { ContenidoTarifario } from "@/lib/centro-copiado-tarifarios-api";

const acumulacion = [
  { value: "COMBINACION", label: "Por combinación en el pedido" },
  { value: "ARCHIVO", label: "Por archivo" },
] as const;
export function ReglasTarifario({
  contenido: c,
  onChange,
  disabled,
}: {
  contenido: ContenidoTarifario;
  onChange: (c: ContenidoTarifario) => void;
  disabled: boolean;
}) {
  const [confirmacion, setConfirmacion] = useState<{
    texto: string;
    aplicar: () => ContenidoTarifario;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  function cambiar(mutacion: (c: ContenidoTarifario) => void) {
    if (disabled) return;
    const nuevo = structuredClone(c);
    mutacion(nuevo);
    onChange(nuevo);
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Reglas del tarifario</CardTitle>
        <CardDescription>
          Papel e impresión incluidos. Preparación y mínimo se aplican una vez
          por pedido; las terminaciones se cobran aparte.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        <FieldGroup className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Elegir
            etiqueta="Cobertura"
            disabled={disabled}
            valor={c.hojas?.reglas.cobertura ?? c.cad!.reglas.cobertura}
            opciones={[
              {
                value: "UNICA",
                label: "Precio único para todas las coberturas",
              },
              { value: "DIFERENCIADA", label: "Precios por cobertura" },
            ]}
            onChange={(v) => {
              setError(null);
              setConfirmacion({
                texto:
                  "Cambiar la cobertura reorganiza ambas matrices. Sus precios quedarán pendientes y sus rangos volverán a los generales. Cargá cada cobertura de forma independiente.",
                aplicar: () => cambiarCobertura(c, v),
              });
            }}
            ayuda="Con precios por cobertura, el volumen se acumula por separado."
          />
          <Elegir
            etiqueta="IVA de los precios"
            disabled={disabled}
            valor={c.composicion.iva}
            opciones={[
              { value: "INCLUIDO", label: "IVA incluido" },
              { value: "MAS_IVA", label: "Más IVA" },
            ]}
            onChange={(v) => {
              setError(null);
              setConfirmacion({
                texto:
                  "Los importes cargados conservarán su valor numérico. Cambiar la condición de IVA modifica su interpretación y el total a cobrar; revisá los precios antes de publicar.",
                aplicar: () => ({
                  ...c,
                  composicion: { ...c.composicion, iva: v },
                }),
              });
            }}
          />
          <Elegir
            etiqueta="Preparación"
            disabled={disabled}
            valor={c.composicion.preparacion.modalidad}
            opciones={[
              { value: "INCLUIDA", label: "Incluida" },
              { value: "FIJA_PEDIDO", label: "Cargo fijo por pedido" },
            ]}
            onChange={(v) =>
              cambiar((x) => {
                x.composicion.preparacion =
                  v === "INCLUIDA"
                    ? { modalidad: v }
                    : { modalidad: v, importe: "" };
              })
            }
          />
          {c.composicion.preparacion.modalidad === "FIJA_PEDIDO" && (
            <TextoTarifa
              etiqueta="Importe de preparación"
              inputMode="decimal"
              disabled={disabled}
              valor={c.composicion.preparacion.importe}
              onChange={(v) =>
                cambiar((x) => {
                  x.composicion.preparacion = {
                    modalidad: "FIJA_PEDIDO",
                    importe: v,
                  };
                })
              }
            />
          )}
          <Elegir
            etiqueta="Mínimo del pedido"
            disabled={disabled}
            valor={c.composicion.minimo.modalidad}
            opciones={[
              { value: "SIN_MINIMO", label: "Sin mínimo" },
              { value: "IMPORTE_PEDIDO", label: "Mínimo de importe" },
            ]}
            onChange={(v) =>
              cambiar((x) => {
                x.composicion.minimo =
                  v === "SIN_MINIMO"
                    ? { modalidad: v }
                    : { modalidad: v, importe: "" };
              })
            }
            ayuda="Sobre impresión más preparación, después de los ajustes. Terminaciones aparte."
          />
          {c.composicion.minimo.modalidad === "IMPORTE_PEDIDO" && (
            <TextoTarifa
              etiqueta="Importe mínimo"
              inputMode="decimal"
              disabled={disabled}
              valor={c.composicion.minimo.importe}
              onChange={(v) =>
                cambiar((x) => {
                  x.composicion.minimo = {
                    modalidad: "IMPORTE_PEDIDO",
                    importe: v,
                  };
                })
              }
            />
          )}
        </FieldGroup>
        {c.hojas && (
          <FieldGroup className="grid gap-4 md:grid-cols-3">
            <Elegir
              etiqueta="Unidad del precio de hojas"
              disabled={disabled}
              valor={c.hojas.reglas.unidad}
              opciones={[
                { value: "HOJA", label: "Por hoja física" },
                { value: "CARILLA", label: "Por carilla impresa" },
              ]}
              onChange={(v) => {
                setError(null);
                setConfirmacion({
                  texto:
                    "Cambiar la unidad deja pendientes todos los precios de hojas para evitar reutilizar un importe con otra unidad. Los mismos inicios de tramo pasarán a expresarse en la nueva unidad.",
                  aplicar: () => {
                    const nuevo = structuredClone(c);
                    nuevo.hojas!.reglas.unidad = v;
                    for (const f of nuevo.hojas!.filas)
                      for (const p of f.precios) p.precioUnitario = null;
                    return nuevo;
                  },
                });
              }}
              ayuda="El tramo y el precio usan la misma unidad: hojas físicas o carillas impresas."
            />
            <Elegir
              etiqueta="Acumulación de hojas"
              disabled={disabled}
              valor={c.hojas.reglas.acumulacion}
              opciones={acumulacion}
              onChange={(v) =>
                cambiar((x) => {
                  x.hojas!.reglas.acumulacion = v;
                })
              }
            />
            <Elegir
              etiqueta="Última hoja impar"
              disabled={disabled}
              valor={c.hojas.reglas.ultimaHojaImpar}
              opciones={[
                { value: "MANTENER_DOBLE", label: "Mantener precio doble faz" },
                {
                  value: "COBRAR_SIMPLE",
                  label: "Cobrar esa hoja como simple faz",
                },
              ]}
              onChange={(v) =>
                cambiar((x) => {
                  x.hojas!.reglas.ultimaHojaImpar = v;
                })
              }
            />
          </FieldGroup>
        )}
        {c.cad && (
          <FieldGroup className="grid gap-4 md:grid-cols-3">
            <Elegir
              etiqueta="Acumulación CAD"
              disabled={disabled}
              valor={c.cad.reglas.acumulacion}
              opciones={acumulacion}
              onChange={(v) =>
                cambiar((x) => {
                  x.cad!.reglas.acumulacion = v;
                })
              }
            />
            <Elegir
              etiqueta="Redondeo comercial CAD"
              disabled={disabled}
              valor={c.cad.reglas.redondeo.modalidad}
              opciones={[
                { value: "SIN_REDONDEO", label: "Sin redondeo" },
                { value: "HACIA_ARRIBA", label: "Hacia arriba por incremento" },
              ]}
              onChange={(v) =>
                cambiar((x) => {
                  x.cad!.reglas.redondeo =
                    v === "SIN_REDONDEO"
                      ? { modalidad: v }
                      : { modalidad: v, incrementoMl: "0.1" };
                })
              }
              ayuda="El tramo usa el consumo sin redondear. El cobro se redondea una vez por grupo."
            />
            {c.cad.reglas.redondeo.modalidad === "HACIA_ARRIBA" && (
              <TextoTarifa
                etiqueta="Incremento de redondeo (ML)"
                inputMode="decimal"
                disabled={disabled}
                valor={c.cad.reglas.redondeo.incrementoMl}
                onChange={(v) =>
                  cambiar((x) => {
                    x.cad!.reglas.redondeo = {
                      modalidad: "HACIA_ARRIBA",
                      incrementoMl: v,
                    };
                  })
                }
              />
            )}
          </FieldGroup>
        )}
      </CardContent>
      <Dialog
        open={!!confirmacion}
        onOpenChange={(v) => {
          if (!v) setConfirmacion(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revisar cambio de regla</DialogTitle>
            <DialogDescription>{confirmacion?.texto}</DialogDescription>
          </DialogHeader>
          <ErrorTarifa error={error} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmacion(null)}>
              Cancelar
            </Button>
            <Button
              disabled={disabled}
              onClick={() => {
                try {
                  if (!disabled && confirmacion)
                    onChange(confirmacion.aplicar());
                  setConfirmacion(null);
                } catch (e) {
                  setError(mensajeErrorTarifa(e));
                }
              }}
            >
              Confirmar cambio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
