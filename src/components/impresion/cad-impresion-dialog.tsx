"use client";

import { useId, useRef, useState } from "react";
import { Printer, Ruler, File, RotateCw, Palette, Circle } from "lucide-react";
import { ActionButton } from "@/components/design-system/action-button";
import { FormDialog } from "@/components/design-system/form-dialog";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@heroui/react";
import { Checkbox } from "@/components/ui/checkbox";
import { SegmentedControl } from "@/components/design-system/choice-controls";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  guardarConfiguracionCad,
  type DestinoImpresion,
} from "@/lib/impresion-api";
import { imprimirPruebaCad } from "@/lib/qz-impresion";
import {
  esConfiguracionCad,
  planPruebaCad,
  type ConfiguracionCad,
  type FormatoPruebaCad,
} from "../../../apps/api/src/impresion/cad.domain";
import { BandejasDetectadasField } from "./bandejas-detectadas-field";
import s from "./perfiles-impresion.module.css";

export function CadImpresionDialog({
  destino,
  tenantId,
  onClose,
  onSaved,
}: {
  destino: DestinoImpresion;
  tenantId: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const id = useId();
  const lock = useRef(false);
  const [guardado, setGuardado] = useState(destino.cad ?? null);
  const [version, setVersion] = useState(destino.version);
  const [ancho, setAncho] = useState(String(destino.cad?.anchoRolloMm ?? 914));
  const [origen, setOrigen] = useState(
    destino.cad?.origenPapel ??
      (destino.bandejas.length === 1 ? destino.bandejas[0].codigo : ""),
  );
  const [predeterminado, setPredeterminado] = useState(
    destino.cad?.usarOrigenPredeterminado ?? false,
  );
  const [formato, setFormato] = useState<FormatoPruebaCad>("A1");
  const [color, setColor] = useState<"BN" | "COLOR">("COLOR");
  const [ocupado, setOcupado] = useState<"guardar" | "imprimir" | null>(null);
  const [error, setError] = useState("");
  const [enviada, setEnviada] = useState("");
  const configuracion: ConfiguracionCad = {
    anchoRolloMm: Number(ancho.replace(",", ".")),
    margenMm: 5,
    origenPapel: predeterminado ? "" : origen,
    usarOrigenPredeterminado: predeterminado,
  };
  const valida = esConfiguracionCad(configuracion);
  const cambios =
    !guardado ||
    configuracion.anchoRolloMm !== guardado.anchoRolloMm ||
    configuracion.origenPapel !== guardado.origenPapel ||
    predeterminado !== guardado.usarOrigenPredeterminado;
  let plan: ReturnType<typeof planPruebaCad> | null = null;
  let motivo = "";
  if (valida) {
    try {
      plan = planPruebaCad(configuracion, formato);
    } catch (e) {
      motivo = e instanceof Error ? e.message : "Revisá el formato.";
    }
  }

  async function guardar(habilitado = true) {
    if (lock.current || (habilitado && !valida)) return;
    lock.current = true;
    setOcupado("guardar");
    setError("");
    setEnviada("");
    try {
      const actualizado = await guardarConfiguracionCad(destino.id, {
        ...(habilitado ? configuracion : (guardado ?? configuracion)),
        version,
        habilitado,
      });
      setGuardado(actualizado.cad ?? null);
      setVersion(actualizado.version);
      await onSaved();
      if (!habilitado) onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar el rollo.");
    } finally {
      lock.current = false;
      setOcupado(null);
    }
  }
  async function imprimir() {
    if (lock.current || cambios || !plan) return;
    lock.current = true;
    setOcupado("imprimir");
    setError("");
    setEnviada("");
    try {
      const resultado = await imprimirPruebaCad(
        tenantId,
        destino.host,
        destino.id,
        version,
        formato,
        color,
      );
      setEnviada(
        `Prueba ${resultado.original.nombre} en ${color === "BN" ? "B/N (escala de grises)" : "Color"} enviada a ${destino.nombre}. Comprobá el modo de color y la calidad configurada en Windows. Medí el cuadrado: debe tener 200 mm en ambos lados. La regla debe medir 500 mm.`,
      );
    } catch (e) {
      setError(
        `${e instanceof Error ? e.message : "No se pudo confirmar el envío."} Revisá la cola antes de repetir la prueba.`,
      );
    } finally {
      lock.current = false;
      setOcupado(null);
    }
  }
  const bloqueado = Boolean(ocupado);
  return (
    <FormDialog
      isOpen
      onOpenChange={(open) => {
        if (!open && !bloqueado) onClose();
      }}
      isDismissable={!bloqueado}
      title={
        <span className={s.modalTitulo}>
          <Ruler />
          Rollo y prueba CAD
        </span>
      }
      description={destino.nombre}
      className={s.dialog}
    >
      <div className={s.cadContenido}>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <FieldGroup className={s.campos}>
          <Field
            data-invalid={
              !Number.isFinite(configuracion.anchoRolloMm) ||
              configuracion.anchoRolloMm < 300 ||
              configuracion.anchoRolloMm > 914.4
            }
          >
            <FieldLabel htmlFor={`${id}-ancho`}>
              Ancho del rollo (mm)
            </FieldLabel>
            <Input
              id={`${id}-ancho`}
              value={ancho}
              inputMode="decimal"
              disabled={bloqueado}
              aria-invalid={
                !Number.isFinite(configuracion.anchoRolloMm) ||
                configuracion.anchoRolloMm < 300 ||
                configuracion.anchoRolloMm > 914.4
              }
              onChange={(e) => {
                setAncho(e.target.value);
                setEnviada("");
              }}
            />
            <FieldDescription>
              Rollo cargado. Margen reservado: 5 mm por lado.
            </FieldDescription>
          </Field>
          {!predeterminado && (
            <BandejasDetectadasField
              tenantId={tenantId}
              host={destino.host}
              impresora={destino.impresora}
              existentes={[]}
              value={origen}
              onChange={(v) => {
                setOrigen(v);
                setEnviada("");
              }}
              disabled={bloqueado}
              label="Origen de papel (rollo)"
            />
          )}
          <Field orientation="horizontal" className={s.cadAnchoCompleto}>
            <Checkbox
              id={`${id}-default`}
              aria-label="Usar el origen predeterminado: confirmé Rollo en las preferencias de Windows"
              checked={predeterminado}
              disabled={bloqueado}
              onCheckedChange={(v) => {
                setPredeterminado(Boolean(v));
                setEnviada("");
              }}
            />
            <FieldLabel htmlFor={`${id}-default`}>
              Usar el origen predeterminado: confirmé Rollo en las preferencias
              de Windows
            </FieldLabel>
          </Field>
        </FieldGroup>
        <div className={s.cadConfiguracion}>
          <p className={s.ayuda}>
            Escala fija al 100% · Simple faz · Una copia
          </p>
          <ActionButton
            variant="outline"
            isDisabled={bloqueado || !valida || !cambios}
            onPress={() => void guardar()}
          >
            {ocupado === "guardar"
              ? "Guardando…"
              : guardado
                ? "Guardar rollo"
                : "Guardar configuración CAD"}
          </ActionButton>
        </div>
        <Field>
          <FieldLabel>Lámina de prueba</FieldLabel>
          <SegmentedControl
            tone="graphite"
            aria-label="Lámina de prueba"
            value={formato}
            isDisabled={bloqueado}
            options={[
              {
                value: "A1",
                label: "A1 · Giro automático",
                icon: <RotateCw />,
              },
              { value: "PERSONALIZADO", label: "900 × 350 mm", icon: <File /> },
            ]}
            onChange={(v) => {
              if (v === "A1" || v === "PERSONALIZADO") {
                setFormato(v);
                setEnviada("");
              }
            }}
          />
        </Field>
        <Field>
          <FieldLabel>Modo de color</FieldLabel>
          <SegmentedControl
            tone="graphite"
            aria-label="Modo de color"
            value={color}
            isDisabled={bloqueado}
            options={[
              {
                value: "BN",
                label: "B/N · Escala de grises",
                icon: <Circle />,
              },
              { value: "COLOR", label: "Color", icon: <Palette /> },
            ]}
            onChange={(v) => {
              if (v === "BN" || v === "COLOR") {
                setColor(v);
                setEnviada("");
              }
            }}
          />
          <FieldDescription>
            Calidad: la configurada en Windows. Para esta prueba, elegí Rápida
            en las preferencias de impresión del HP.
          </FieldDescription>
        </Field>
        {plan && (
          <dl className={s.cadResumen}>
            <div>
              <dt>Original</dt>
              <dd>
                {plan.original.anchoMm} × {plan.original.altoMm} mm
              </dd>
            </div>
            <div>
              <dt>Giro</dt>
              <dd>{plan.giro}° · 100%</dd>
            </div>
            <div>
              <dt>Salida con márgenes</dt>
              <dd>
                {plan.anchoSalidaMm} × {plan.largoSalidaMm} mm
              </dd>
            </div>
          </dl>
        )}
        {motivo && (
          <Alert variant="destructive">
            <AlertDescription>{motivo}</AlertDescription>
          </Alert>
        )}
        {enviada ? (
          <Alert role="status">
            <Ruler />
            <AlertTitle>Revisá la copia impresa</AlertTitle>
            <AlertDescription>{enviada}</AlertDescription>
          </Alert>
        ) : (
          <p className={s.ayuda}>
            La lámina incluye reglas y un cuadrado de control. En Windows, usá
            tamaño real y desactivá ajustar al papel. Esta prueba valida el
            plotter; el envío de planos de las OT es el siguiente paso.
          </p>
        )}
      </div>
      <footer className={s.footer}>
        <ActionButton
          variant="tertiary"
          isDisabled={bloqueado}
          onPress={onClose}
        >
          Cerrar
        </ActionButton>
        <ActionButton
          isDisabled={bloqueado || cambios || !plan || !destino.activo}
          onPress={() => void imprimir()}
        >
          <Printer data-icon="inline-start" />
          {ocupado === "imprimir" ? "Enviando…" : "Imprimir prueba CAD"}
        </ActionButton>
      </footer>
    </FormDialog>
  );
}
