"use client";

import type {
  TipoImpresionProductoVariante,
  CarasProductoVariante,
  ValorOpcionProductiva,
} from "@/lib/productos-servicios";
import type { CatalogoVariante } from "@/lib/propuestas";
import {
  LABEL_TIPO_IMPRESION,
  LABEL_CARAS,
  LABEL_TIPO_COPIA,
} from "@/lib/propuestas";

// ---------------------------------------------------------------------------
// Config type
// ---------------------------------------------------------------------------

export type TalonarioProposalConfig = {
  tipoImpresion: TipoImpresionProductoVariante;
  caras: CarasProductoVariante;
  tipoCopia: ValorOpcionProductiva;
};

// ---------------------------------------------------------------------------
// Segmented toggle (same pattern as digital-laser-config)
// ---------------------------------------------------------------------------

function SegmentedToggle<T extends string>({
  label,
  options,
  value,
  onChange,
  labels,
}: {
  label: string;
  options: T[];
  value: T;
  onChange: (value: T) => void;
  labels: Record<string, string>;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">{label}</p>
      <div className="flex gap-1 rounded-lg border p-0.5">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              opt === value
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {labels[opt] ?? opt}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function TalonarioProposalConfigPanel({
  variante,
  config,
  onConfigChange,
}: {
  variante: CatalogoVariante;
  config: TalonarioProposalConfig;
  onConfigChange: (config: TalonarioProposalConfig) => void;
}) {
  const opciones = variante.opcionesProductivas;
  if (!opciones || opciones.length === 0) return null;

  const tipoImpresionOpt = opciones.find(
    (o) => o.dimension === "tipo_impresion",
  );
  const carasOpt = opciones.find((o) => o.dimension === "caras");
  const tipoCopiaOpt = opciones.find((o) => o.dimension === "tipo_copia");

  return (
    <div className="flex flex-col gap-4">
      {tipoCopiaOpt && tipoCopiaOpt.valores.length > 0 && (
        <SegmentedToggle
          label="Tipo de copia"
          options={tipoCopiaOpt.valores as ValorOpcionProductiva[]}
          value={config.tipoCopia}
          onChange={(v) => onConfigChange({ ...config, tipoCopia: v })}
          labels={LABEL_TIPO_COPIA}
        />
      )}

      {tipoImpresionOpt && tipoImpresionOpt.valores.length > 1 && (
        <SegmentedToggle
          label="Tipo de impresion"
          options={tipoImpresionOpt.valores as TipoImpresionProductoVariante[]}
          value={config.tipoImpresion}
          onChange={(v) => onConfigChange({ ...config, tipoImpresion: v })}
          labels={LABEL_TIPO_IMPRESION}
        />
      )}

      {carasOpt && carasOpt.valores.length > 1 && (
        <SegmentedToggle
          label="Caras"
          options={carasOpt.valores as CarasProductoVariante[]}
          value={config.caras}
          onChange={(v) => onConfigChange({ ...config, caras: v })}
          labels={LABEL_CARAS}
        />
      )}
    </div>
  );
}
