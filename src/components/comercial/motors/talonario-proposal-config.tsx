"use client";

import * as React from "react";
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

export type TalonarioOverrides = {
  anchoMm?: number;
  altoMm?: number;
  encuadernacion?: {
    tipo: "abrochado" | "emblocado";
    cantidadGrapas?: number | null;
    posicionGrapas?: string | null;
    bordeEncolar?: string | null;
  };
  puntillado?: {
    habilitado: boolean;
    borde?: string | null;
    distanciaBordeMm?: number | null;
  };
};

export type TalonarioProposalConfig = {
  tipoImpresion: TipoImpresionProductoVariante;
  caras: CarasProductoVariante;
  tipoCopia: ValorOpcionProductiva;
  overrides?: TalonarioOverrides;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BORDES = [
  { value: "superior", label: "Superior" },
  { value: "inferior", label: "Inferior" },
  { value: "izquierdo", label: "Izquierdo" },
  { value: "derecho", label: "Derecho" },
];

const POSICIONES_BROCHES = [
  { value: "superior", label: "Superior" },
  { value: "lateral", label: "Lateral" },
];

// ---------------------------------------------------------------------------
// Segmented toggle
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
  const [showOverrides, setShowOverrides] = React.useState(Boolean(config.overrides));

  const tipoImpresionOpt = opciones?.find((o) => o.dimension === "tipo_impresion");
  const carasOpt = opciones?.find((o) => o.dimension === "caras");
  const tipoCopiaOpt = opciones?.find((o) => o.dimension === "tipo_copia");

  const updateOverride = (patch: Partial<TalonarioOverrides>) => {
    onConfigChange({
      ...config,
      overrides: { ...(config.overrides ?? {}), ...patch },
    });
  };

  const updateEncuadernacion = (patch: Partial<NonNullable<TalonarioOverrides["encuadernacion"]>>) => {
    const current = config.overrides?.encuadernacion ?? { tipo: "abrochado" as const, cantidadGrapas: 2, posicionGrapas: "superior", bordeEncolar: null };
    updateOverride({ encuadernacion: { ...current, ...patch } });
  };

  const updatePuntillado = (patch: Partial<NonNullable<TalonarioOverrides["puntillado"]>>) => {
    const current = config.overrides?.puntillado ?? { habilitado: true, borde: "superior", distanciaBordeMm: 30 };
    updateOverride({ puntillado: { ...current, ...patch } });
  };

  const handleToggleOverrides = (enabled: boolean) => {
    setShowOverrides(enabled);
    if (!enabled) {
      onConfigChange({ ...config, overrides: undefined });
    } else {
      onConfigChange({
        ...config,
        overrides: {
          anchoMm: Number(variante.anchoMm),
          altoMm: Number(variante.altoMm),
        },
      });
    }
  };

  const ov = config.overrides;

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

      {/* Per-order overrides */}
      <div className="mt-1 rounded-lg border border-dashed p-3 space-y-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showOverrides}
            onChange={(e) => handleToggleOverrides(e.target.checked)}
            className="rounded border-input"
          />
          <span className="text-sm font-medium">Personalizar para este pedido</span>
        </label>

        {showOverrides && ov && (
          <div className="space-y-3 pl-1">
            {/* Medidas */}
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Medidas del talonario</p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  className="h-7 w-20 rounded-md border px-2 text-xs"
                  value={ov.anchoMm ?? ""}
                  placeholder="Ancho"
                  onChange={(e) => updateOverride({ anchoMm: parseFloat(e.target.value) || undefined })}
                />
                <span className="text-xs text-muted-foreground">×</span>
                <input
                  type="number"
                  className="h-7 w-20 rounded-md border px-2 text-xs"
                  value={ov.altoMm ?? ""}
                  placeholder="Alto"
                  onChange={(e) => updateOverride({ altoMm: parseFloat(e.target.value) || undefined })}
                />
                <span className="text-xs text-muted-foreground">mm</span>
              </div>
            </div>

            {/* Encuadernación */}
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Encuadernación</p>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="h-7 rounded-md border px-2 text-xs"
                  value={ov.encuadernacion?.tipo ?? ""}
                  onChange={(e) => {
                    if (!e.target.value) {
                      const next = { ...ov };
                      delete next.encuadernacion;
                      onConfigChange({ ...config, overrides: next });
                    } else {
                      updateEncuadernacion({ tipo: e.target.value as "abrochado" | "emblocado" });
                    }
                  }}
                >
                  <option value="">Heredar del producto</option>
                  <option value="abrochado">Abrochado (grapas)</option>
                  <option value="emblocado">Emblocado (cola)</option>
                </select>
                {ov.encuadernacion?.tipo === "abrochado" && (
                  <>
                    <input
                      type="number"
                      className="h-7 w-14 rounded-md border px-2 text-xs"
                      value={ov.encuadernacion.cantidadGrapas ?? 2}
                      onChange={(e) => updateEncuadernacion({ cantidadGrapas: parseInt(e.target.value) || 2 })}
                    />
                    <span className="text-xs text-muted-foreground">grapas</span>
                    <select
                      className="h-7 rounded-md border px-2 text-xs"
                      value={ov.encuadernacion.posicionGrapas ?? "superior"}
                      onChange={(e) => updateEncuadernacion({ posicionGrapas: e.target.value })}
                    >
                      {POSICIONES_BROCHES.map((p) => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                  </>
                )}
                {ov.encuadernacion?.tipo === "emblocado" && (
                  <>
                    <span className="text-xs text-muted-foreground">Borde:</span>
                    <select
                      className="h-7 rounded-md border px-2 text-xs"
                      value={ov.encuadernacion.bordeEncolar ?? "superior"}
                      onChange={(e) => updateEncuadernacion({ bordeEncolar: e.target.value })}
                    >
                      {BORDES.map((b) => (
                        <option key={b.value} value={b.value}>{b.label}</option>
                      ))}
                    </select>
                  </>
                )}
              </div>
            </div>

            {/* Puntillado */}
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Puntillado</p>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={ov.puntillado !== undefined}
                    onChange={(e) => {
                      if (!e.target.checked) {
                        const next = { ...ov };
                        delete next.puntillado;
                        onConfigChange({ ...config, overrides: next });
                      } else {
                        updatePuntillado({ habilitado: true });
                      }
                    }}
                    className="rounded border-input"
                  />
                  Personalizar
                </label>
                {ov.puntillado && (
                  <>
                    <label className="flex items-center gap-1 text-xs">
                      <input
                        type="checkbox"
                        checked={ov.puntillado.habilitado}
                        onChange={(e) => updatePuntillado({ habilitado: e.target.checked })}
                        className="rounded border-input"
                      />
                      Habilitado
                    </label>
                    {ov.puntillado.habilitado && (
                      <>
                        <select
                          className="h-7 rounded-md border px-2 text-xs"
                          value={ov.puntillado.borde ?? "superior"}
                          onChange={(e) => updatePuntillado({ borde: e.target.value })}
                        >
                          {BORDES.map((b) => (
                            <option key={b.value} value={b.value}>{b.label}</option>
                          ))}
                        </select>
                        <input
                          type="number"
                          className="h-7 w-16 rounded-md border px-2 text-xs"
                          value={ov.puntillado.distanciaBordeMm ?? 30}
                          onChange={(e) => updatePuntillado({ distanciaBordeMm: parseFloat(e.target.value) || 30 })}
                        />
                        <span className="text-xs text-muted-foreground">mm</span>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
