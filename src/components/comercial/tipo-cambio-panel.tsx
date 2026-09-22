"use client";
import * as React from "react";
import { ArrowUpRightIcon, RefreshCwIcon } from "lucide-react";
import { toast } from "sonner";
import { DesignSystemProvider } from "@/components/design-system/appearance";
import designTheme from "@/components/design-system/brand-workspace-theme.module.css";
import { ActionButton } from "@/components/design-system/action-button";
import { SelectField } from "@/components/design-system/select-field";
import { useCapacidad } from "@/components/navigation/capacidades-provider";
import { usePuede } from "@/components/navigation/permisos-provider";
import { useConfigRegional } from "@/components/navigation/config-regional-provider";
import { Input } from "@heroui/react";
import {
  crearTipoCambio,
  getTipoCambioConfig,
  guardarTipoCambioConfig,
  type TipoCambioSnapshot,
} from "@/lib/tipo-cambio-api";
import { useTipoCambioDocumento } from "./tipo-cambio-documento";
import s from "./tipo-cambio-panel.module.css";

function EditorCambio({
  destino,
  initialModo = "automatico",
  initialTasa,
  aplicar,
  texto,
}: {
  destino: string;
  initialModo?: "automatico" | "manual";
  initialTasa?: number | null;
  aplicar: (input: {
    modo: "automatico" | "manual";
    tasa?: number;
  }) => Promise<void>;
  texto: string;
}) {
  const [modo, setModo] = React.useState(initialModo);
  const [tasa, setTasa] = React.useState(
    initialTasa == null ? "" : String(initialTasa),
  );
  const [busy, setBusy] = React.useState(false);
  return (
    <div className={s.editor}>
      <SelectField
        aria-label="Origen del tipo de cambio"
        value={modo}
        onChange={(v) => setModo(v as typeof modo)}
        options={[
          { value: "automatico", label: "Automático" },
          { value: "manual", label: "Manual" },
        ]}
      />
      {modo === "manual" && (
        <label className={s.field}>
          1 USD equivale a ({destino})
          <Input
            type="number"
            min="0.00000001"
            max="1000000000"
            step="any"
            inputMode="decimal"
            aria-label={`Tipo de cambio USD a ${destino}`}
            value={tasa}
            onChange={(e) => setTasa(e.target.value)}
          />
        </label>
      )}
      <ActionButton
        variant="primary"
        isDisabled={busy || (modo === "manual" && !(Number(tasa) > 0))}
        onPress={async () => {
          setBusy(true);
          try {
            await aplicar({
              modo,
              ...(modo === "manual" ? { tasa: Number(tasa) } : {}),
            });
          } catch (error) {
            toast.error(
              error instanceof Error
                ? error.message
                : "No se pudo actualizar el tipo de cambio.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Actualizando…" : texto}
        <ArrowUpRightIcon size={14} />
      </ActionButton>
    </div>
  );
}

export function TipoCambioPanel({
  editable,
  onAplicar,
}: {
  editable: boolean;
  onAplicar: (cambio: TipoCambioSnapshot) => Promise<void>;
}) {
  const contexto = useTipoCambioDocumento();
  const { moneda } = useConfigRegional();
  const cambio = contexto?.cambio;
  const [abierto, setAbierto] = React.useState(false);
  if (moneda.codigo === "USD" && !cambio) return null;
  return (
    <section className={s.panel} aria-label="Tipo de cambio del trabajo">
      <div className={s.header}>
        <span>Tipo de cambio</span>
        <RefreshCwIcon size={14} />
      </div>
      <strong className={s.value}>
        {cambio?.tasa
          ? `1 USD = ${cambio.tasa.toLocaleString(moneda.locale, { maximumFractionDigits: 8 })} ${cambio.monedaDestino}`
          : cambio
            ? "Sin tasa disponible"
            : "Se define al cotizar"}
      </strong>
      <p className={s.detail}>
        {cambio
          ? `${cambio.referencia || cambio.fuente} · ${new Date(cambio.capturadoEn).toLocaleString(moneda.locale)}`
          : "Usa la configuración de la empresa."}
      </p>
      {cambio?.observacion && <p className={s.notice}>{cambio.observacion}</p>}
      {editable && (
        <>
          <button
            type="button"
            className={s.link}
            aria-expanded={abierto}
            onClick={() => setAbierto((v) => !v)}
          >
            {abierto ? "Cerrar" : "Cambiar tipo de cambio"}
            <ArrowUpRightIcon size={13} />
          </button>
          {abierto && (
            <>
              <p className={s.detail}>
                Se recalcularán todos los productos de este trabajo. Los cambios
                se aplican al guardar.
              </p>
              <EditorCambio
                destino={moneda.codigo}
                initialModo={
                  cambio?.modo === "manual" ? "manual" : "automatico"
                }
                initialTasa={cambio?.tasa}
                texto="Aplicar a todo el trabajo"
                aplicar={async (input) => {
                  const nuevo = await crearTipoCambio(input);
                  if (nuevo.tasa == null)
                    throw new Error(
                      nuevo.observacion ||
                        "No hay una tasa automática disponible. Ingresá una tasa manual.",
                    );
                  await onAplicar(nuevo);
                  contexto?.establecer(nuevo);
                  setAbierto(false);
                  toast.success("Tipo de cambio aplicado a todo el trabajo.");
                }}
              />
            </>
          )}
        </>
      )}
    </section>
  );
}

export function TipoCambioEmpresa() {
  const conPrecios = useCapacidad("reglas_precio");
  const puedeGestionar = usePuede("costos.gestionar") && conPrecios;
  const { moneda } = useConfigRegional();
  const [config, setConfig] = React.useState<Awaited<
    ReturnType<typeof getTipoCambioConfig>
  > | null>(null);
  const [error, setError] = React.useState("");
  React.useEffect(() => {
    let activo = true;
    getTipoCambioConfig().then(
      (c) => {
        if (activo) setConfig(c);
      },
      (e) => {
        if (activo) setError(e.message);
      },
    );
    return () => {
      activo = false;
    };
  }, [moneda.codigo]);
  return (
    <DesignSystemProvider appearance="light" theme="brand">
      <section
        data-ui="heroui"
        data-appearance="light"
        className={`${designTheme.theme} ${s.empresa}`}
      >
        <div className={s.header}>
          Precios del inventario en USD
          <RefreshCwIcon size={16} />
        </div>
        <p className={s.detail}>
          El motor convierte los costos a {moneda.codigo} al cotizar. Esta
          configuración se usa para trabajos nuevos; los guardados conservan su
          tipo de cambio.
        </p>
        {error && <p role="alert">{error}</p>}
        {config && !puedeGestionar && (
          <p className={s.detail}>
            Tipo de cambio{" "}
            {config.modo === "automatico"
              ? "automático"
              : `manual: ${config.tasaManual}`}
            . Sólo consulta.
          </p>
        )}
        {config && puedeGestionar && (
          <EditorCambio
            key={`${config.modo}-${config.tasaManual}-${config.monedaDestino}`}
            destino={moneda.codigo}
            initialModo={config.modo}
            initialTasa={config.tasaManual}
            texto="Guardar tipo de cambio"
            aplicar={async (input) => {
              setConfig(await guardarTipoCambioConfig(input));
              toast.success("Configuración de tipo de cambio guardada.");
            }}
          />
        )}
      </section>
    </DesignSystemProvider>
  );
}
