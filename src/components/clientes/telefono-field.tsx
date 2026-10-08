"use client";

import * as React from "react";
import { Input, Label, Description } from "@heroui/react";
import { Field, FieldGroup } from "@/components/ui/field";
import { SelectBuscable } from "@/components/ui/select-buscable";
import {
  getCountries,
  getCountryCallingCode,
  normalizarTelefonoCliente,
  type CountryCode,
} from "@/lib/telefono-cliente";
import focus from "@/components/design-system/field-focus.module.css";
import styles from "./clientes.module.css";

import { paisesTelefonicos } from "@/lib/paises-telefonicos";

export function TelefonoField({
  id,
  label,
  codigo,
  numero,
  pais = "AR",
  onChange,
  disabled,
  error,
  required,
}: {
  id: string;
  label: string;
  codigo: string;
  numero: string;
  pais?: string;
  onChange: (codigo: string, numero: string) => void;
  disabled?: boolean;
  error?: string;
  required?: boolean;
}) {
  const normalized = normalizarTelefonoCliente(codigo, numero, pais);
  const region =
    normalized.ok && numero
      ? normalized.pais
      : (getCountries().find(
          (c) =>
            c === pais &&
            getCountryCallingCode(c) === codigo.replace(/\D/g, ""),
        ) ??
        getCountries().find(
          (c) => getCountryCallingCode(c) === codigo.replace(/\D/g, ""),
        ) ??
        getCountries().find((c) => c === pais) ??
        "AR");
  const [country, setCountry] = React.useState<CountryCode>(
    region as CountryCode,
  );
  const [touched, setTouched] = React.useState(false);
  const [pasteError, setPasteError] = React.useState<string>();
  const message =
    error ??
    pasteError ??
    (touched && !normalized.ok ? normalized.error : undefined);
  const input = (raw: string) => {
    setPasteError(undefined);
    // El pegado admite formato habitual; el campo siempre muestra sólo dígitos.
    const parsed = normalizarTelefonoCliente(
      getCountryCallingCode(country),
      raw,
      country,
    );
    if (parsed.ok && parsed.telefonoNumero) {
      setCountry(parsed.pais as CountryCode);
      onChange(parsed.telefonoCodigo, parsed.telefonoNumero);
    } else {
      onChange(getCountryCallingCode(country), raw.replace(/\D/g, ""));
    }
  };
  return (
    <FieldGroup className={styles.phoneGrid}>
      <Field>
        <Label htmlFor={`${id}-pais`}>País del teléfono</Label>
        <SelectBuscable
          id={`${id}-pais`}
          ariaLabel="País del teléfono"
          opciones={paisesTelefonicos}
          placeholderBusqueda="Buscar país o prefijo…"
          value={country}
          disabled={disabled}
          onChange={(value) => {
            const next = value as CountryCode;
            setCountry(next);
            onChange(
              getCountryCallingCode(next),
              normalized.ok ? normalized.telefonoNumero : numero,
            );
            setPasteError(undefined);
            setTouched(true);
          }}
        />
      </Field>
      <Field data-invalid={Boolean(message)}>
        <Label htmlFor={id}>{label}</Label>
        <Input
          id={id}
          type="tel"
          required={required}
          className={focus.singleBorder}
          inputMode="numeric"
          autoComplete="tel-national"
          disabled={disabled}
          value={normalized.ok && numero ? normalized.telefonoNumero : numero}
          aria-invalid={Boolean(message)}
          aria-describedby={`${id}-ayuda`}
          onBlur={() => setTouched(true)}
          onChange={(event) => input(event.target.value)}
          onPaste={(event) => {
            const raw = event.clipboardData.getData("text");
            if (
              raw.trim().startsWith("+") ||
              raw.trim().startsWith("00") ||
              !/^[\d\s().-]+$/.test(raw)
            ) {
              event.preventDefault();
              const parsed = normalizarTelefonoCliente(
                getCountryCallingCode(country),
                raw,
                country,
              );
              if (parsed.ok) input(raw);
              else {
                setPasteError(parsed.error);
                setTouched(true);
              }
            }
          }}
          placeholder="Código de área y número"
        />
        <Description id={`${id}-ayuda`}>
          {message ??
            (normalized.ok && normalized.internacional
              ? `Número completo: ${normalized.internacional}`
              : "Incluí el código de área. Podés pegar el número con espacios o guiones; los limpiamos automáticamente.")}
        </Description>
      </Field>
    </FieldGroup>
  );
}
