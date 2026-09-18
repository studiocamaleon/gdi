"use client";
import { useId, useState } from "react";
import { Printer, Search } from "lucide-react";
import { ActionButton } from "@/components/design-system/action-button";
import { SelectField } from "@/components/design-system/select-field";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel, FieldGroup } from "@/components/ui/field";
import { buscarImpresoras } from "@/lib/qz-impresion";
import {
  guardarImpresora,
  hostQzValido,
  type ImpresoraPuesto,
  type UsoImpresora,
} from "@/lib/impresora-puesto";
import s from "./impresion.module.css";

export function ImpresoraPuestoForm({
  tenantId,
  inicial,
  onGuardar,
  disabled = false,
  uso = "etiquetas",
}: {
  tenantId: string;
  inicial: ImpresoraPuesto;
  onGuardar: (config: ImpresoraPuesto) => void;
  disabled?: boolean;
  uso?: UsoImpresora;
}) {
  const id = useId();
  const [host, setHost] = useState(inicial.host);
  const [impresora, setImpresora] = useState(inicial.impresora);
  const [lista, setLista] = useState<string[]>(
    inicial.impresora ? [inicial.impresora] : [],
  );
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const bloqueado = disabled || buscando;
  async function buscar() {
    setError("");
    setMensaje("");
    setBuscando(true);
    try {
      const nombres = await buscarImpresoras(host.trim(), tenantId);
      setLista(nombres);
      setImpresora(
        nombres.includes(impresora)
          ? impresora
          : nombres.length === 1
            ? nombres[0]
            : "",
      );
      setMensaje(
        nombres.length
          ? `Conectado · ${nombres.length} impresora${nombres.length === 1 ? "" : "s"} disponible${nombres.length === 1 ? "" : "s"}`
          : "QZ está conectado, pero no hay impresoras instaladas.",
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "No se pudieron buscar las impresoras.",
      );
    } finally {
      setBuscando(false);
    }
  }
  function guardar() {
    setError("");
    try {
      const config = { host: host.trim(), impresora };
      guardarImpresora(tenantId, config, uso);
      onGuardar(config);
      setMensaje("Impresora guardada en este navegador.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    }
  }
  return (
    <div className={s.setup}>
      <div className={s.sectionTitle}>
        <Printer aria-hidden="true" />
        <div>
          <strong>
            {uso === "etiquetas"
              ? "Impresora de etiquetas"
              : "Impresora de documentos"}
          </strong>
          <p>
            {uso === "etiquetas"
              ? "Etiquetas de 100 × 150 mm · TSPL · 203 dpi"
              : "Documentos A4 · Blanco y negro"}
          </p>
        </div>
      </div>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={`${id}-host`}>Equipo con QZ Tray</FieldLabel>
          <div className={s.hostRow}>
            <Input
              id={`${id}-host`}
              value={host}
              disabled={bloqueado}
              placeholder="localhost o IP del equipo"
              onChange={(e) => {
                setHost(e.target.value);
                setError("");
                setLista([]);
                setImpresora("");
                setMensaje("");
              }}
            />
            <ActionButton
              variant="outline"
              isDisabled={bloqueado || !hostQzValido(host.trim())}
              onPress={buscar}
            >
              <Search aria-hidden="true" />
              {buscando ? "Conectando…" : "Buscar"}
            </ActionButton>
          </div>
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-printer`}>Impresora</FieldLabel>
          <SelectField
            id={`${id}-printer`}
            aria-label="Impresora"
            value={impresora}
            disabled={bloqueado || !lista.length}
            onChange={setImpresora}
            options={[
              { value: "", label: "Seleccioná una impresora" },
              ...lista.map((name) => ({ value: name, label: name })),
            ]}
          />
        </Field>
      </FieldGroup>
      <p className={s.help}>
        Esta selección se guarda para esta empresa en este navegador. QZ Tray
        debe estar abierto en el equipo conectado a la impresora.
      </p>
      {error && (
        <p role="alert" className={s.error}>
          {error}
        </p>
      )}
      {mensaje && (
        <p role="status" className={s.help}>
          {mensaje}
        </p>
      )}
      <ActionButton
        isDisabled={bloqueado || !impresora || !hostQzValido(host.trim())}
        onPress={guardar}
      >
        Guardar impresora
      </ActionButton>
    </div>
  );
}
