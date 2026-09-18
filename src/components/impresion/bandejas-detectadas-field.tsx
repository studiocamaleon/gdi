"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { ActionButton } from "@/components/design-system/action-button";
import { SelectField } from "@/components/design-system/select-field";
import { Field, FieldLabel } from "@/components/ui/field";
import { buscarBandejas } from "@/lib/qz-impresion";
import s from "./perfiles-impresion.module.css";

type Resultado =
  | { estado: "cargando" }
  | { estado: "error"; mensaje: string }
  | { estado: "listo"; bandejas: string[] };

export function BandejasDetectadasField({
  tenantId,
  host,
  impresora,
  existentes,
  value,
  onChange,
  disabled,
  label = "Bandeja detectada",
}: {
  tenantId: string;
  host: string;
  impresora: string;
  existentes: readonly string[];
  value: string;
  onChange: (codigo: string) => void;
  disabled: boolean;
  label?: string;
}) {
  const [resultado, setResultado] = useState<Resultado>({ estado: "cargando" });
  const [intento, setIntento] = useState(0);
  useEffect(() => {
    let vigente = true;
    // Esperar al montaje definitivo evita consultas duplicadas en StrictMode.
    const inicio = setTimeout(() => {
      void buscarBandejas(host, tenantId, impresora).then(
        (bandejas) => {
          if (vigente) setResultado({ estado: "listo", bandejas });
        },
        (error: unknown) => {
          if (vigente)
            setResultado({
              estado: "error",
              mensaje:
                error instanceof Error
                  ? error.message
                  : "No se pudieron consultar las bandejas.",
            });
        },
      );
    }, 0);
    return () => {
      vigente = false;
      clearTimeout(inicio);
    };
  }, [host, tenantId, impresora, intento]);

  const cargando = resultado.estado === "cargando";
  const bandejas = resultado.estado === "listo" ? resultado.bandejas : [];
  const disponibles = bandejas.filter((codigo) => !existentes.includes(codigo));
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <div className={s.selectorBandeja}>
        <SelectField
          aria-label={label}
          disabled={disabled || cargando || !disponibles.length}
          value={value}
          onChange={onChange}
          options={[
            {
              value: "",
              label: cargando
                ? "Consultando bandejas…"
                : "Seleccionar bandeja…",
              disabled: true,
            },
            ...bandejas.map((codigo) => ({
              value: codigo,
              label: existentes.includes(codigo)
                ? `${codigo} · Ya agregada`
                : codigo,
              disabled: existentes.includes(codigo),
            })),
          ]}
        />
        <ActionButton
          variant="outline"
          isIconOnly
          aria-label="Volver a consultar bandejas"
          title="Volver a consultar bandejas"
          isDisabled={disabled || cargando}
          onPress={() => {
            onChange("");
            setResultado({ estado: "cargando" });
            setIntento((actual) => actual + 1);
          }}
        >
          <RefreshCw size={16} aria-hidden="true" />
        </ActionButton>
      </div>
      {resultado.estado === "error" ? (
        <p className={s.error} role="alert">
          {resultado.mensaje}
        </p>
      ) : (
        <p className={s.ayuda} role="status">
          {cargando
            ? `Consultando ${impresora}…`
            : !bandejas.length
              ? "El controlador no informa bandejas. Revisá el controlador instalado en el equipo de impresión y volvé a consultar."
              : !disponibles.length
                ? "Todas las bandejas detectadas ya están agregadas."
                : `${bandejas.length} bandejas detectadas en ${impresora}.`}
        </p>
      )}
    </Field>
  );
}
