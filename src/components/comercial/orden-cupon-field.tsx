"use client";

import { useRef, useState } from "react";
import { Input } from "@heroui/react";
import { ActionButton } from "@/components/design-system/action-button";
import focus from "@/components/design-system/field-focus.module.css";
import s from "./orden-financial-forms.module.css";

/** El controlador valida el cupón y aplica el plan del backend. */
export function OrdenCuponField({
  id,
  isDisabled = false,
  onValidar,
}: {
  id: string;
  isDisabled?: boolean;
  onValidar: (codigo: string) => Promise<boolean>;
}) {
  const [codigo, setCodigo] = useState("");
  const [validando, setValidando] = useState(false);
  const [error, setError] = useState("");
  const pendiente = useRef(false);
  const validar = async () => {
    if (pendiente.current || isDisabled || !codigo.trim()) return;
    pendiente.current = true;
    setValidando(true);
    setError("");
    try {
      if (await onValidar(codigo.trim())) setCodigo("");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "No se pudo validar el cupón.",
      );
    } finally {
      pendiente.current = false;
      setValidando(false);
    }
  };
  return (
    <div id={id} className={s.coupon}>
      <label className={s.label} htmlFor={`${id}-codigo`}>
        Código del cupón
      </label>
      <div className={s.couponRow}>
        <Input
          id={`${id}-codigo`}
          autoFocus
          autoComplete="off"
          placeholder="Ingresá el código"
          value={codigo}
          disabled={validando || isDisabled}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`${s.input} ${focus.singleBorder}`}
          onChange={(event) => {
            setCodigo(event.target.value.toUpperCase());
            setError("");
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              event.stopPropagation();
              void validar();
            }
          }}
        />
        <ActionButton
          onPress={() => void validar()}
          isDisabled={validando || isDisabled || !codigo.trim()}
        >
          {validando ? "Validando…" : "Validar"}
        </ActionButton>
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className={s.couponError}>
          {error}
        </p>
      )}
    </div>
  );
}
