"use client";

import type { FamiliaListItem } from "@/lib/productos-servicios";
import {
  DESCRIPCIONES_VALOR_PARAM,
  familiaConParamsEditables,
  esEditableComercial,
  etiquetaValorParam,
  patchParaEnum,
  toggleEditableComercial,
  toggleMultiEnum,
  valorBooleanoParam,
} from "@/lib/params-familia";
import s from "./el-trabajo.module.css";

/**
 * Editor de los parámetros propios de una familia (paso "El trabajo", caso
 * "parámetros"): la tabla del diseño pasos/El trabajo.html —una fila por
 * parámetro con su valor por defecto y el lock Fijo/Editable ("Al cotizar")—.
 * Es genérica: sirve para sembrado, bastidor, cortes, imposición… cualquier
 * familia que declare `paramsPasoSchema`.
 *
 * La lógica (presets, toggle, defaults) vive en `@/lib/params-familia` para
 * poder testearla; acá queda sólo el render.
 */

type ParamSchema = FamiliaListItem["paramsPasoSchema"][number];

const LOCK = (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="4" y="10" width="16" height="10" rx="2" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </svg>
);
const OPEN = (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="4" y="10" width="16" height="10" rx="2" />
    <path d="M8 10V7a4 4 0 0 1 7.4-2" />
  </svg>
);

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
  // `modoTalonarioIncompleto` se declara en el schema pero NO se edita acá: es
  // un modo del control "Imposición del pliego" (Acomodado). Si lo dejáramos,
  // aparecería dos veces.
  const schema = (familia.paramsPasoSchema ?? []).filter(
    (p) => p.campo !== "modoTalonarioIncompleto",
  );
  if (!familiaConParamsEditables(familia) || schema.length === 0) {
    return null;
  }

  const renderControl = (param: ParamSchema) => {
    const valor = params[param.campo];

    if (param.tipo === "enum") {
      return (
        <span className={`${s.ctl} ${s.sel}`}>
          <select
            value={typeof valor === "string" ? valor : String(param.default ?? "")}
            onChange={(e) => onChange(patchParaEnum(param.campo, e.target.value))}
          >
            {(param.valoresPermitidos ?? []).map((opcion) => (
              <option key={opcion} value={opcion}>
                {etiquetaValorParam(opcion)}
              </option>
            ))}
          </select>
        </span>
      );
    }

    if (param.tipo === "number") {
      return (
        <span className={s.ctl}>
          <input
            className={s.num}
            inputMode="decimal"
            value={typeof valor === "number" ? String(valor) : ""}
            onChange={(e) =>
              onChange({
                [param.campo]:
                  e.target.value === "" ? null : Number(e.target.value),
              })
            }
            placeholder="—"
          />
        </span>
      );
    }

    if (param.tipo === "multi-enum") {
      const permitidos = param.valoresPermitidos ?? [];
      const actuales = Array.isArray(valor) ? valor.map(String) : [];
      return (
        <span className={s.chips}>
          {permitidos.map((opcion) => {
            const on = actuales.includes(opcion);
            return (
              <button
                key={opcion}
                type="button"
                className={s.chip}
                aria-pressed={on}
                onClick={() =>
                  onChange({
                    [param.campo]: toggleMultiEnum(permitidos, valor, opcion, !on),
                  })
                }
              >
                {etiquetaValorParam(opcion)}
              </button>
            );
          })}
        </span>
      );
    }

    if (param.tipo === "boolean") {
      const on = valorBooleanoParam(valor, param.default);
      return (
        <button
          type="button"
          className={s.tog}
          aria-pressed={on}
          onClick={() => onChange({ [param.campo]: !on })}
        >
          <span className={s.tr} />
          <span className={s.togt}>{on ? "Sí" : "No"}</span>
        </button>
      );
    }

    return null;
  };

  const renderRow = (param: ParamSchema) => {
    const expuesto = param.expuestoAlComercial === true;
    const editable = esEditableComercial(params, param.campo, expuesto);
    const descripcion = [
      param.descripcion,
      DESCRIPCIONES_VALOR_PARAM[param.campo],
    ]
      .filter(Boolean)
      .join(" ");
    const faltaObligatorio =
      param.tipo === "multi-enum" &&
      param.requerido &&
      (!Array.isArray(params[param.campo]) ||
        (params[param.campo] as unknown[]).length === 0);
    return (
      <div key={param.campo} className={s.prow}>
        <span className={s.lb}>
          <span className={s.a}>
            {param.etiqueta}
            {param.requerido ? <span className={s.req}>obligatorio</span> : null}
          </span>
          {descripcion ? <span className={s.b}>{descripcion}</span> : null}
        </span>
        {renderControl(param)}
        <button
          type="button"
          className={s.lock}
          aria-pressed={editable}
          title={
            expuesto
              ? "La familia sugiere abrirlo; podés fijarlo igual."
              : undefined
          }
          onClick={() =>
            onChange(
              toggleEditableComercial(params, param.campo, !editable, expuesto),
            )
          }
        >
          {editable ? OPEN : LOCK}
          {editable ? "Editable" : "Fijo"}
        </button>
        {faltaObligatorio ? (
          <span className={s.reqmsg}>
            Elegí al menos un lado: sin lados el paso no puede calcular nada y la
            cotización va a cortar.
          </span>
        ) : null}
      </div>
    );
  };

  return (
    <div className={s.root}>
      <div className={s.phead}>
        <span className={s.k}>Parámetro</span>
        <span className={s.k}>Valor por defecto</span>
        <span className={`${s.k} ${s.kr}`}>Al cotizar</span>
      </div>
      {schema.map(renderRow)}
      <div className={s.foot}>
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5M12 8h.01" />
        </svg>
        <span>
          <b>Fijo</b> usa siempre el valor por defecto. <b>Editable</b> lo
          muestra en el presupuesto con ese valor precargado, y el comercial
          puede cambiarlo.
        </span>
      </div>
    </div>
  );
}
