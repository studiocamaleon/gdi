"use client";

import * as React from "react";
import { useConfigRegional } from "@/components/navigation/config-regional-provider";
import { PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { getProveedores } from "@/lib/proveedores-api";
import type {
  TercerizadoEje,
  TercerizadoEntradaPayload,
  UpsertConfigPasoPayload,
} from "@/lib/productos-servicios-api";
import s from "./el-proveedor.module.css";

/**
 * Panel de configuración de un paso TERCERIZADO (proveedor + fuente de costo).
 * UI portada del diseño canónico (claude.ai/design · "El proveedor.html").
 *
 * El "quién lo hace" ya lo maneja el eje Identidad (pills): cuando esta pantalla
 * se monta es porque el paso es tercerizado, así que NO lleva toggle propio. El
 * `onToggle` sigue siendo opcional para el editor detallado viejo, que sí
 * necesita prender/apagar la tercerización desde acá.
 */

type Patch = Partial<UpsertConfigPasoPayload>;

const CLAVE_CANTIDAD = "cantidad";

const FUENTES = [
  { value: "matriz", label: "Matriz de cantidades" },
  { value: "tarifa_magnitud", label: "Tarifa por magnitud" },
  { value: "fijo", label: "Precio fijo" },
] as const;

const FUENTE_HINT: Record<string, string> = {
  matriz:
    "Precio por combinación de atributos y corte de cantidad. Es lo que manda el proveedor en su lista.",
  tarifa_magnitud:
    "Un precio por unidad de magnitud — el costo escala con el tamaño del trabajo.",
  fijo: "Un único precio por orden, sin importar cantidad ni medida.",
};

const MAGNITUDES = [
  { value: "area_m2", label: "Área (m²)" },
  { value: "perimetro_ml", label: "Perímetro (ml)" },
  { value: "ml", label: "Metros lineales (ml)" },
  { value: "cantidad", label: "Cantidad (unidades)" },
] as const;

const SIN_TECNOLOGIA = "__none__";
const TECNOLOGIAS_TERCERIZADO = [
  { value: "offset", label: "Offset" },
  { value: "serigrafia", label: "Serigrafía" },
  { value: "tampografia", label: "Tampografía" },
  { value: "sublimacion", label: "Sublimación" },
  { value: "bordado", label: "Bordado" },
  { value: "laser", label: "Corte/grabado láser" },
  { value: "flexografia", label: "Flexografía" },
  { value: "termoformado", label: "Termoformado" },
  { value: "otra", label: "Otra" },
] as const;

const slug = (str: string) =>
  str
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase() || "eje";

function cfgDe(value: UpsertConfigPasoPayload): Record<string, unknown> {
  const c = value.tercerizadoConfigJson;
  return c && typeof c === "object" ? { ...(c as Record<string, unknown>) } : {};
}

/** Producto cartesiano de los valores de cada eje (sin el de cantidad). */
function combinaciones(ejes: TercerizadoEje[]): Array<Record<string, string>> {
  return ejes.reduce<Array<Record<string, string>>>(
    (acc, eje) =>
      acc.flatMap((combo) =>
        eje.valores.map((v) => ({ ...combo, [eje.clave]: v.clave })),
      ),
    [{}],
  );
}

const claveDe = (valores: Record<string, unknown>) =>
  Object.keys(valores)
    .sort()
    .map((k) => `${k}=${valores[k]}`)
    .join("&");

export function PasoTercerizadoPanel({
  value,
  onChange,
  onToggle,
}: {
  value: UpsertConfigPasoPayload;
  onChange: (patch: Patch) => void;
  /** Sólo el editor detallado viejo: prende/apaga la tercerización desde acá.
   *  En el editor guiado lo maneja el eje Identidad y no se pasa. */
  onToggle?: (tercerizado: boolean) => void;
}) {
  const [proveedores, setProveedores] = React.useState<
    Array<{ id: string; nombre: string }>
  >([]);

  React.useEffect(() => {
    let vivo = true;
    getProveedores()
      .then((res) => {
        if (vivo)
          setProveedores(res.map((p) => ({ id: p.id, nombre: p.nombre })));
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  const gated = typeof onToggle === "function";
  const on = gated ? !!value.tercerizado : true;

  React.useEffect(() => {
    if (on && !value.fuenteCostoTercerizado) {
      onChange({ fuenteCostoTercerizado: "matriz" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, value.fuenteCostoTercerizado]);

  const fuente = value.fuenteCostoTercerizado ?? "matriz";
  const cfg = cfgDe(value);
  const patchCfg = (extra: Record<string, unknown>) =>
    onChange({ tercerizadoConfigJson: { ...cfg, ...extra } });

  return (
    <div className={s.root}>
      {gated ? (
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            cursor: "pointer",
            marginBottom: on ? 12 : 0,
          }}
        >
          <input
            type="checkbox"
            checked={on}
            onChange={(e) => onToggle?.(e.target.checked)}
          />
          <span style={{ fontSize: 12.5, fontWeight: 500 }}>
            Lo terceriza un proveedor
          </span>
        </label>
      ) : null}

      {on ? (
        <>
          <div className={s.sec}>
            <div className={s.fields}>
              <div className={s.f}>
                <span className={s.k}>Proveedor</span>
                <span
                  className={`${s.ctl} ${s.sel} ${
                    value.proveedorId ? "" : s.warnb
                  }`}
                >
                  <select
                    value={value.proveedorId ?? ""}
                    onChange={(e) =>
                      onChange({ proveedorId: e.target.value || null })
                    }
                  >
                    <option value="">— elegí un proveedor —</option>
                    {proveedores.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}
                      </option>
                    ))}
                  </select>
                </span>
              </div>
              <div className={s.f}>
                <span className={s.k}>
                  Plazo de entrega <span className={s.o}>· opcional</span>
                </span>
                <span className={s.ctl}>
                  <input
                    className={s.num}
                    inputMode="numeric"
                    placeholder="—"
                    value={value.plazoProveedorDias ?? ""}
                    onChange={(e) =>
                      onChange({
                        plazoProveedorDias:
                          e.target.value === ""
                            ? null
                            : Number(e.target.value),
                      })
                    }
                  />
                  <span className={s.u}>días hábiles</span>
                </span>
              </div>
              <div className={`${s.f} ${s.full}`}>
                <span className={s.k}>
                  Tecnología{" "}
                  <span className={s.o}>
                    · solo para reportes, no afecta el costo
                  </span>
                </span>
                <span
                  className={`${s.ctl} ${s.sel}`}
                  style={{ maxWidth: 300 }}
                >
                  <select
                    value={
                      typeof cfg.tecnologia === "string" && cfg.tecnologia
                        ? cfg.tecnologia
                        : SIN_TECNOLOGIA
                    }
                    onChange={(e) =>
                      patchCfg({
                        tecnologia:
                          e.target.value === SIN_TECNOLOGIA
                            ? null
                            : e.target.value,
                      })
                    }
                  >
                    <option value={SIN_TECNOLOGIA}>Sin tecnología</option>
                    {TECNOLOGIAS_TERCERIZADO.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </span>
              </div>
            </div>
          </div>

          <div className={s.sec}>
            <h4 className={s.h4}>Cómo cotiza</h4>
            <p className={s.hint}>{FUENTE_HINT[fuente]}</p>
            <div className={s.seg}>
              {FUENTES.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  aria-pressed={fuente === f.value}
                  onClick={() =>
                    onChange({
                      fuenteCostoTercerizado: f.value,
                      // cambiar de fuente resetea la config específica pero
                      // conserva la tecnología del proceso.
                      tercerizadoConfigJson: cfg.tecnologia
                        ? { tecnologia: cfg.tecnologia }
                        : {},
                    })
                  }
                >
                  {f.label}
                </button>
              ))}
            </div>
            {fuente === "tarifa_magnitud" ? (
              <TarifaEditor cfg={cfg} patchCfg={patchCfg} />
            ) : fuente === "fijo" ? (
              <FijoEditor cfg={cfg} patchCfg={patchCfg} />
            ) : null}
          </div>

          {fuente === "matriz" ? (
            <MatrizEditor value={value} onChange={onChange} />
          ) : null}

          <div className={s.foot}>
            <p>
              Cada celda es el costo del proveedor para esa combinación y tanda.
              Dejá vacías las combinaciones que no ofrece.
            </p>
            <p>
              Los costos se cargan en <b>neto (sin IVA)</b>. El precio de venta
              sale del margen configurado en el tab <b>Pricing</b>.
            </p>
          </div>
        </>
      ) : null}
    </div>
  );
}

/* ─────────── Fuente: tarifa por magnitud ─────────── */
function TarifaEditor({
  cfg,
  patchCfg,
}: {
  cfg: Record<string, unknown>;
  patchCfg: (extra: Record<string, unknown>) => void;
}) {
  const { moneda } = useConfigRegional();
  const numOrNull = (v: string) => (v === "" ? null : Number(v));
  return (
    <div
      className={s.fields}
      style={{ marginTop: 12, maxWidth: 520 }}
    >
      <div className={s.f}>
        <span className={s.k}>Tarifa</span>
        <span className={s.ctl}>
          <span className={s.pre}>{moneda.simbolo}</span>
          <input
            className={s.num}
            inputMode="decimal"
            placeholder="0"
            value={(cfg.tarifa as number) ?? ""}
            onChange={(e) => patchCfg({ tarifa: numOrNull(e.target.value) })}
          />
        </span>
      </div>
      <div className={s.f}>
        <span className={s.k}>Por unidad de</span>
        <span className={`${s.ctl} ${s.sel}`}>
          <select
            value={String(cfg.magnitud ?? "area_m2")}
            onChange={(e) => patchCfg({ magnitud: e.target.value })}
          >
            {MAGNITUDES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </span>
      </div>
      <div className={s.f}>
        <span className={s.k}>
          Mínimo de magnitud <span className={s.o}>· opcional</span>
        </span>
        <span className={s.ctl}>
          <input
            className={s.num}
            inputMode="decimal"
            placeholder="—"
            value={(cfg.minimoMagnitud as number) ?? ""}
            onChange={(e) =>
              patchCfg({ minimoMagnitud: numOrNull(e.target.value) })
            }
          />
        </span>
      </div>
      <div className={s.f}>
        <span className={s.k}>
          Mínimo de costo <span className={s.o}>· opcional</span>
        </span>
        <span className={s.ctl}>
          <span className={s.pre}>{moneda.simbolo}</span>
          <input
            className={s.num}
            inputMode="decimal"
            placeholder="—"
            value={(cfg.minimoCosto as number) ?? ""}
            onChange={(e) =>
              patchCfg({ minimoCosto: numOrNull(e.target.value) })
            }
          />
        </span>
      </div>
    </div>
  );
}

/* ─────────── Fuente: costo fijo ─────────── */
function FijoEditor({
  cfg,
  patchCfg,
}: {
  cfg: Record<string, unknown>;
  patchCfg: (extra: Record<string, unknown>) => void;
}) {
  const { moneda } = useConfigRegional();
  return (
    <div
      className={s.fields}
      style={{ marginTop: 12, maxWidth: 520 }}
    >
      <div className={s.f}>
        <span className={s.k}>Precio por orden</span>
        <span className={s.ctl}>
          <span className={s.pre}>{moneda.simbolo}</span>
          <input
            className={s.num}
            inputMode="decimal"
            placeholder="0"
            value={(cfg.costo as number) ?? ""}
            onChange={(e) =>
              patchCfg({
                costo: e.target.value === "" ? null : Number(e.target.value),
              })
            }
          />
        </span>
      </div>
      <div className={s.f}>
        <span className={s.k}>Se cobra por</span>
        <span className={`${s.ctl} ${s.sel}`}>
          <select
            value={String(cfg.por ?? "trabajo")}
            onChange={(e) => patchCfg({ por: e.target.value })}
          >
            <option value="trabajo">Trabajo (una vez)</option>
            <option value="unidad">Unidad (× cantidad)</option>
          </select>
        </span>
      </div>
    </div>
  );
}

/* ─────────── Fuente: matriz (atributos × cantidades + grilla) ─────────── */
function MatrizEditor({
  value,
  onChange,
}: {
  value: UpsertConfigPasoPayload;
  onChange: (patch: Patch) => void;
}) {
  const { moneda } = useConfigRegional();
  const cfg = cfgDe(value);
  const ejes: TercerizadoEje[] = Array.isArray(cfg.ejes)
    ? (cfg.ejes as TercerizadoEje[])
    : [];
  const atributos = ejes.filter((e) => e.clave !== CLAVE_CANTIDAD);
  const cantidadEje = ejes.find((e) => e.clave === CLAVE_CANTIDAD);
  const cantidades = cantidadEje?.valores ?? [];
  const entradas = value.tercerizadoEntradas ?? [];

  const setEjes = (next: TercerizadoEje[]) =>
    onChange({
      tercerizadoConfigJson: {
        ...cfg,
        ejes: next,
        columnaEjeClave: CLAVE_CANTIDAD,
      },
    });

  const setEntradas = (next: TercerizadoEntradaPayload[]) =>
    onChange({ tercerizadoEntradas: next });

  const costoPorClave = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const e of entradas) m.set(claveDe(e.valores), e.costo);
    return m;
  }, [entradas]);

  const combos = React.useMemo(() => combinaciones(atributos), [atributos]);

  const setCosto = (
    rowValores: Record<string, string>,
    cantClave: string,
    costo: number | null,
  ) => {
    const valores = { ...rowValores, [CLAVE_CANTIDAD]: cantClave };
    const clave = claveDe(valores);
    const resto = entradas.filter((e) => claveDe(e.valores) !== clave);
    if (costo == null || Number.isNaN(costo)) {
      setEntradas(resto);
    } else {
      setEntradas([
        ...resto,
        { valores, cantidad: Number(cantClave) || 1, costo },
      ]);
    }
  };

  const addEje = () => {
    const n = atributos.length + 1;
    const clave = slug(`atributo ${n}`) + "_" + n;
    setEjes([
      ...atributos,
      { clave, label: `Atributo ${n}`, orden: n, valores: [] },
      ...(cantidadEje ? [cantidadEje] : []),
    ]);
  };

  const patchEje = (clave: string, patch: Partial<TercerizadoEje>) => {
    const next = ejes.map((e) => (e.clave === clave ? { ...e, ...patch } : e));
    setEjes(
      next
        .filter((e) => e.clave !== CLAVE_CANTIDAD)
        .concat(cantidadEje ? [cantidadEje] : []),
    );
  };

  const removeEje = (clave: string) =>
    setEjes(
      atributos
        .filter((e) => e.clave !== clave)
        .concat(cantidadEje ? [cantidadEje] : []),
    );

  const addValor = (ejeClave: string, texto: string) => {
    const t = texto.trim();
    if (!t) return;
    const eje = atributos.find((e) => e.clave === ejeClave);
    if (!eje) return;
    const clave = slug(t);
    if (eje.valores.some((v) => v.clave === clave)) return;
    patchEje(ejeClave, { valores: [...eje.valores, { clave, label: t }] });
  };

  const removeValor = (ejeClave: string, valClave: string) => {
    const eje = atributos.find((e) => e.clave === ejeClave);
    if (!eje) return;
    patchEje(ejeClave, {
      valores: eje.valores.filter((v) => v.clave !== valClave),
    });
  };

  const setCantidades = (vals: Array<{ clave: string; label: string }>) => {
    setEjes([
      ...atributos,
      { clave: CLAVE_CANTIDAD, label: "Cantidad", orden: 99, valores: vals },
    ]);
  };

  const addCantidad = (texto: string) => {
    const n = parseInt((texto || "").replace(/\D/g, ""), 10);
    if (!n) return;
    if (cantidades.some((c) => c.clave === String(n))) return;
    const next = [...cantidades, { clave: String(n), label: String(n) }].sort(
      (a, b) => Number(a.clave) - Number(b.clave),
    );
    setCantidades(next);
  };

  const gridLista =
    atributos.length > 0 &&
    atributos.every((e) => e.valores.length > 0) &&
    cantidades.length > 0;

  const totalCeldas = combos.length * cantidades.length;
  const cargadas = combos.reduce(
    (acc, combo) =>
      acc +
      cantidades.filter(
        (c) =>
          (costoPorClave.get(
            claveDe({ ...combo, [CLAVE_CANTIDAD]: c.clave }),
          ) ?? 0) > 0,
      ).length,
    0,
  );

  return (
    <>
      {/* atributos */}
      <div className={s.sec}>
        <div className={s.sechd}>
          <div>
            <h4 className={s.h4}>
              Atributos{" "}
              {combos.length ? (
                <span className={s.n}>{combos.length} combinaciones</span>
              ) : null}
            </h4>
            <p className={s.hint}>
              Cada combinación de valores es una fila de la grilla. Ej: gramaje,
              color, terminación.
            </p>
          </div>
          <div className={s.sp} />
          <button type="button" className={`${s.btn} ${s.btnGh}`} onClick={addEje}>
            <PlusIcon className="size-3.5" />
            Agregar atributo
          </button>
        </div>
        {atributos.length === 0 ? (
          <p style={{ fontSize: 12.5, color: "var(--muted-text-2, #92929b)", margin: 0 }}>
            Agregá los atributos que mueven el precio (medida, faz, papel…).
          </p>
        ) : (
          <div className={s.attrs}>
            {atributos.map((eje) => (
              <div className={s.attr} key={eje.clave}>
                <div className={s.ah}>
                  <input
                    className={s.nm}
                    value={eje.label}
                    placeholder="Nombre del atributo"
                    onChange={(e) => patchEje(eje.clave, { label: e.target.value })}
                  />
                  <span className={s.rc}>
                    {eje.valores.length
                      ? `${eje.valores.length} ${eje.valores.length > 1 ? "valores" : "valor"}`
                      : "sin valores"}
                  </span>
                  <button
                    type="button"
                    className={s.icb}
                    onClick={() => removeEje(eje.clave)}
                    title="Quitar atributo"
                  >
                    <Trash2Icon className="size-3.5" />
                  </button>
                </div>
                <div className={s.av}>
                  {eje.valores.map((v) => (
                    <span className={s.vchip} key={v.clave}>
                      {v.label}
                      <button
                        type="button"
                        onClick={() => removeValor(eje.clave, v.clave)}
                        aria-label={`Quitar ${v.label}`}
                      >
                        <XIcon className="size-3" />
                      </button>
                    </span>
                  ))}
                  <input
                    className={s.vadd}
                    placeholder="Agregar valor…"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addValor(eje.clave, e.currentTarget.value);
                        e.currentTarget.value = "";
                      }
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* cantidades */}
      <div className={s.sec}>
        <div className={s.sechd}>
          <div>
            <h4 className={s.h4}>
              Cantidades{" "}
              {cantidades.length ? (
                <span className={s.n}>{cantidades.length} columnas</span>
              ) : null}
            </h4>
            <p className={s.hint}>
              Los cortes de tirada que cotiza el proveedor. Cada uno es una
              columna.
            </p>
          </div>
        </div>
        <div className={s.qty}>
          {cantidades.map((c) => (
            <span className={s.vchip} key={c.clave}>
              {Number(c.clave).toLocaleString("es-AR")}
              <button
                type="button"
                onClick={() =>
                  setCantidades(cantidades.filter((x) => x.clave !== c.clave))
                }
                aria-label={`Quitar ${c.label}`}
              >
                <XIcon className="size-3" />
              </button>
            </span>
          ))}
          <input
            className={`${s.vadd} ${s.qadd}`}
            inputMode="numeric"
            placeholder="Ej: 5000"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCantidad(e.currentTarget.value);
                e.currentTarget.value = "";
              }
            }}
          />
        </div>
      </div>

      {/* grilla */}
      <div className={`${s.sec} ${s.secLast}`}>
        <div className={s.sechd}>
          <div>
            <h4 className={s.h4}>Grilla de costos</h4>
            <p className={s.hint}>
              Precio neto por combinación y cantidad, sin impuestos ni margen.
            </p>
          </div>
          <div className={s.sp} />
          {gridLista ? (
            <span
              className={`${s.pill} ${cargadas < totalCeldas ? s.pillW : ""}`}
            >
              {cargadas} de {totalCeldas} precios
            </span>
          ) : null}
        </div>
        <div className={s.gwrap}>
          {gridLista ? (
            <table className={s.table}>
              <thead>
                <tr>
                  {atributos.map((e) => (
                    <th key={e.clave}>{e.label || "—"}</th>
                  ))}
                  {cantidades.map((c) => (
                    <th key={c.clave} className={s.q}>
                      {Number(c.clave).toLocaleString("es-AR")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {combos.map((combo, i) => (
                  <tr key={i}>
                    {atributos.map((e) => (
                      <td key={e.clave}>
                        {e.valores.find((v) => v.clave === combo[e.clave])
                          ?.label ?? combo[e.clave]}
                      </td>
                    ))}
                    {cantidades.map((c) => {
                      const val =
                        costoPorClave.get(
                          claveDe({ ...combo, [CLAVE_CANTIDAD]: c.clave }),
                        ) ?? "";
                      return (
                        <td key={c.clave} className={s.pr}>
                          <span className={`${s.ctl} ${val === "" ? s.zero : ""}`}>
                            <span className={s.pre}>{moneda.simbolo}</span>
                            <input
                              className={s.num}
                              inputMode="decimal"
                              placeholder="0"
                              value={val}
                              onChange={(ev) =>
                                setCosto(
                                  combo,
                                  c.clave,
                                  ev.target.value === ""
                                    ? null
                                    : Number(ev.target.value),
                                )
                              }
                            />
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className={s.gempty}>
              <b>La grilla se arma sola</b>
              Cargá al menos un valor de atributo y un corte de cantidad.
            </div>
          )}
        </div>
        <div className={s.gfoot}>
          <span>Entre cortes de cantidad, el sistema interpola.</span>
        </div>
      </div>
    </>
  );
}
