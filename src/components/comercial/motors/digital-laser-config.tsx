"use client";

import type {
  TipoImpresionProductoVariante,
  CarasProductoVariante,
} from "@/lib/productos-servicios";
import type { CatalogoVariante } from "@/lib/propuestas";
import { LABEL_TIPO_IMPRESION, LABEL_CARAS } from "@/lib/propuestas";

// ---------------------------------------------------------------------------
// Motor-specific config props contract (shared across motors)
// ---------------------------------------------------------------------------

export type MotorProposalConfigProps = {
  variante: CatalogoVariante;
  config: {
    tipoImpresion: TipoImpresionProductoVariante;
    caras: CarasProductoVariante;
  };
  onConfigChange: (config: {
    tipoImpresion: TipoImpresionProductoVariante;
    caras: CarasProductoVariante;
  }) => void;
};

// ---------------------------------------------------------------------------
// Segmented toggle (reusable within this file)
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
  onChange: (v: T) => void;
  labels: Record<T, string>;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="inline-flex items-center rounded-lg border border-input bg-muted p-0.5">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
              value === opt
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {labels[opt]}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Digital Laser config panel
// ---------------------------------------------------------------------------

export function DigitalLaserConfig({
  variante,
  config,
  onConfigChange,
}: MotorProposalConfigProps) {
  const opciones = variante.opcionesProductivas;
  if (!opciones || opciones.length === 0) return null;

  const tipoImpresionOpt = opciones.find(
    (o) => o.dimension === "tipo_impresion",
  );
  const carasOpt = opciones.find((o) => o.dimension === "caras");

  return (
    <div className="flex flex-col gap-4">
      {tipoImpresionOpt && tipoImpresionOpt.valores.length > 1 && (
        <SegmentedToggle
          label="Tipo de impresion"
          options={
            tipoImpresionOpt.valores as TipoImpresionProductoVariante[]
          }
          value={config.tipoImpresion}
          onChange={(v) =>
            onConfigChange({ ...config, tipoImpresion: v })
          }
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
