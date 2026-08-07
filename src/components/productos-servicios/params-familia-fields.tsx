"use client";

import { Input } from "@/components/ui/input";
import { HumanSelect, type HumanSelectOption } from "@/components/ui/human-select";
import { LabelConTooltip } from "@/components/ui/label-con-tooltip";
import type { FamiliaListItem } from "@/lib/productos-servicios";
import {
  DESCRIPCIONES_VALOR_PARAM,
  familiaConParamsEditables,
  camposEditablesComercial,
  etiquetaValorParam,
  patchParaEnum,
  toggleCampoEditable,
  toggleMultiEnum,
  valorBooleanoParam,
} from "@/lib/params-familia";

/**
 * Editor de los parámetros propios de una familia, generado desde el
 * `paramsPasoSchema` que declara el backend.
 *
 * El schema ya viajaba al front tipado (`FamiliaListItem.paramsPasoSchema`)
 * pero nadie lo renderizaba: sólo se mostraba como documentación en la ficha
 * de capacidades. Esto lo vuelve funcional.
 *
 * La lógica (presets, toggle, defaults) vive en `@/lib/params-familia` para
 * poder testearla; acá queda sólo el render.
 */

type ParamSchema = FamiliaListItem["paramsPasoSchema"][number];

function opcionesDeEnum(valores: string[]): HumanSelectOption[] {
  return valores.map((valor) => ({
    value: valor,
    label: etiquetaValorParam(valor),
    description: DESCRIPCIONES_VALOR_PARAM[valor] ?? null,
  }));
}

export function ParamsFamiliaFields({
  familia,
  params,
  onChange,
}: {
  familia: FamiliaListItem;
  params: Record<string, unknown>;
  /** Patch shallow sobre `paramsPasoJson`. */
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const schema = familia.paramsPasoSchema ?? [];
  if (!familiaConParamsEditables(familia) || schema.length === 0) {
    return null;
  }

  const abiertos = camposEditablesComercial(params);

  /**
   * Deja que el comercial cambie este campo al cotizar. Lo modelado pasa a ser
   * la sugerencia.
   */
  const renderToggleEditable = (param: ParamSchema) => (
    <label className="text-muted-foreground mt-1 flex items-center gap-1.5 text-xs">
      <input
        type="checkbox"
        checked={abiertos.includes(param.campo)}
        onChange={(e) =>
          onChange(toggleCampoEditable(params, param.campo, e.target.checked))
        }
      />
      El comercial puede cambiarlo al cotizar
    </label>
  );

  const renderCampo = (param: ParamSchema) => {
    const valor = params[param.campo];

    if (param.tipo === "enum") {
      return (
        <div key={param.campo} className="field">
          <LabelConTooltip
            label={param.etiqueta}
            tooltip={param.descripcion}
            required={param.requerido}
          />
          <HumanSelect
            value={
              typeof valor === "string" ? valor : String(param.default ?? "")
            }
            onValueChange={(v) => onChange(patchParaEnum(param.campo, v))}
            options={opcionesDeEnum(param.valoresPermitidos ?? [])}
            placeholder="Elegir"
          />
          {renderToggleEditable(param)}
        </div>
      );
    }

    if (param.tipo === "number") {
      return (
        <div key={param.campo} className="field">
          <LabelConTooltip
            label={param.etiqueta}
            tooltip={param.descripcion}
            required={param.requerido}
          />
          <Input
            type="number"
            min={0}
            step={1}
            value={typeof valor === "number" ? valor : ""}
            onChange={(e) =>
              onChange({
                [param.campo]:
                  e.target.value === "" ? null : Number(e.target.value),
              })
            }
            placeholder="mm"
          />
          {renderToggleEditable(param)}
        </div>
      );
    }

    if (param.tipo === "multi-enum") {
      const permitidos = param.valoresPermitidos ?? [];
      const actuales = Array.isArray(valor) ? valor.map(String) : [];
      return (
        <div key={param.campo} className="field md:col-span-full">
          <LabelConTooltip
            label={param.etiqueta}
            tooltip={param.descripcion}
            required={param.requerido}
          />
          <div className="flex flex-wrap gap-2">
            {permitidos.map((opcion) => (
              <label
                key={opcion}
                className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={actuales.includes(opcion)}
                  onChange={(e) =>
                    onChange({
                      [param.campo]: toggleMultiEnum(
                        permitidos,
                        valor,
                        opcion,
                        e.target.checked,
                      ),
                    })
                  }
                />
                <span>{etiquetaValorParam(opcion)}</span>
              </label>
            ))}
          </div>
          {param.requerido && actuales.length === 0 ? (
            <span className="text-destructive text-xs">
              Elegí al menos un lado: sin lados el paso no puede calcular nada y
              la cotización va a cortar.
            </span>
          ) : null}
          {renderToggleEditable(param)}
        </div>
      );
    }

    if (param.tipo === "boolean") {
      return (
        <div key={param.campo} className="field md:col-span-full">
          <label className="flex items-start gap-2 rounded-md border p-2 text-sm">
            <input
              type="checkbox"
              checked={valorBooleanoParam(valor, param.default)}
              onChange={(e) => onChange({ [param.campo]: e.target.checked })}
            />
            <span>
              <span className="font-medium">{param.etiqueta}</span>
              {param.descripcion ? (
                <span className="text-muted-foreground block text-xs">
                  {param.descripcion}
                </span>
              ) : null}
            </span>
          </label>
          {renderToggleEditable(param)}
        </div>
      );
    }

    return null;
  };

  return <>{schema.map(renderCampo)}</>;
}
