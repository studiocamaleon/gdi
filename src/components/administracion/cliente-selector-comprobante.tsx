"use client";

import { useEffect, useState } from "react";
import { Input } from "@heroui/react";
import { listClientes } from "@/lib/clientes-api";
import { CONDICION_FISCAL_LABELS, type CondicionFiscal } from "@/lib/clientes";
import { SelectField } from "@/components/design-system/select-field";
import { ActionButton } from "@/components/design-system/action-button";
import { Field, FieldLabel, FieldGroup } from "@/components/ui/field";

export type ClienteOpcionFiscal = {
  id: string;
  nombre: string;
  razonSocial?: string;
  cuit: string;
  condicionFiscal: CondicionFiscal;
};

/** Búsqueda sobre todo el padrón, con páginas y selección conservada. */
export function ClienteSelectorComprobante({
  value,
  onChange,
  iniciales,
  disabled,
}: {
  value: ClienteOpcionFiscal | null;
  onChange: (cliente: ClienteOpcionFiscal | null) => void;
  iniciales: ClienteOpcionFiscal[];
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [resultado, setResultado] = useState({
    data: iniciales,
    total: iniciales.length,
    pages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reintento, setReintento] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(
      () => {
        listClientes({ q: query, page, limit: 30 }, true)
          .then((res) => {
            if (!cancelled) setResultado(res);
          })
          .catch(() => {
            if (!cancelled)
              setError("No se pudieron cargar los clientes. Volvé a intentar.");
          })
          .finally(() => {
            if (!cancelled) setLoading(false);
          });
      },
      query ? 220 : 0,
    );
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, page, reintento]);
  const options =
    value && !resultado.data.some((c) => c.id === value.id)
      ? [value, ...resultado.data]
      : resultado.data;
  const cambiarPagina = (n: number) => {
    setLoading(true);
    setError("");
    setPage(n);
  };
  return (
    <FieldGroup>
      <Field>
        <FieldLabel htmlFor="cmp-buscar-cliente">Buscar cliente</FieldLabel>
        <Input
          id="cmp-buscar-cliente"
          placeholder="Nombre, razón social o CUIT"
          value={query}
          disabled={disabled}
          onChange={(e) => {
            setLoading(true);
            setError("");
            setQuery(e.target.value);
            setPage(1);
          }}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="cmp-cliente">Cliente</FieldLabel>
        <SelectField
          id="cmp-cliente"
          aria-label="Cliente del comprobante"
          value={value?.id ?? ""}
          disabled={disabled || loading || !!error}
          onChange={(id) => onChange(options.find((c) => c.id === id) ?? null)}
          options={[
            { value: "", label: "Consumidor Final" },
            ...options.map((c) => ({
              value: c.id,
              label: `${c.nombre} · ${c.razonSocial || CONDICION_FISCAL_LABELS[c.condicionFiscal]}`,
            })),
          ]}
        />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <span role="status" className="text-sm text-muted-foreground">
          {error ||
            (loading
              ? "Buscando clientes…"
              : `${resultado.total} ${resultado.total === 1 ? "cliente" : "clientes"} · Página ${page} de ${Math.max(1, resultado.pages)}`)}
        </span>
        {error ? (
          <ActionButton
            variant="outline"
            onPress={() => {
              setError("");
              setLoading(true);
              setReintento((n) => n + 1);
            }}
          >
            Reintentar
          </ActionButton>
        ) : (
          <>
            <ActionButton
              variant="outline"
              isDisabled={disabled || loading || page <= 1}
              onPress={() => cambiarPagina(page - 1)}
            >
              Anterior
            </ActionButton>
            <ActionButton
              variant="outline"
              isDisabled={disabled || loading || page >= resultado.pages}
              onPress={() => cambiarPagina(page + 1)}
            >
              Siguiente
            </ActionButton>
          </>
        )}
      </div>
    </FieldGroup>
  );
}
