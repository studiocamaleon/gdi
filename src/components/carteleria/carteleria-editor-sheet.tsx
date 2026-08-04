"use client";

/**
 * Configurador de cartelería — EL sheet de estos productos.
 *
 * Para un producto de cartelería este componente reemplaza el cuerpo genérico
 * del sheet (medidas duplicadas, opcionales, materiales sueltos): acá viven
 * las medidas, la tecnología de impresión, la lona, el caño, las chapas, la
 * iluminación, los anclajes, la cantidad y las notas. El layout es el del
 * prototipo signage/ (params · 3D · listado y costo).
 *
 * Edita EN VIVO el motorConfig del sheet (el debounce re-cotiza) y el listado
 * renderiza EL DESGLOSE DEL MOTOR — acá no se calcula ningún precio
 * (docs/carteleria-configurador-diseno.md §2, §6 y §12).
 */
import * as React from "react";
import {
  RulerIcon,
  FrameIcon,
  LayersIcon,
  LightbulbIcon,
  AnchorIcon,
  ChevronRightIcon,
  PrinterIcon,
  StickyNoteIcon,
} from "lucide-react";

import type { CotizarResponse } from "@/lib/productos-servicios-api";
import { CarteleriaViewport } from "./viewport-3d";
import { derivarMetricas, type CarteleriaVista } from "./geometria";
import s from "./carteleria.module.css";

/* ─────────── Contratos con el sheet ─────────── */

export type CarteleriaValor = {
  anchoCm: number;
  altoCm: number;
  profundidadCm: number;
  sepRefuerzoVcm: number;
  sepRefuerzoHcm: number;
  cenefa: boolean;
  solapaCenefaCm: number;
  pintura: boolean;
  fondo: boolean;
  /** Doble faz de la lona (frente + contra): caras=2 del paso de impresión. */
  dobleFaz: boolean;
  densidad: number;
};

/** Vista mínima de un slot con candidatos (estructural con SlotComercialElige). */
export type CarteleriaSlotView = {
  configPasoId: string;
  slotCodigo: string;
  candidatos: Array<{
    materiaPrimaId: string;
    label: string;
    defaultVarianteId?: string | null;
    variantes: Array<{
      variantId: string;
      /** Etiqueta enriquecida del sheet (incluye ancho/espesor). */
      label?: string | null;
      sku?: string | null;
      nombreVariante?: string | null;
    }>;
  }>;
};

/** Tecnologías del paso de impresión (del selector M-2 del sheet). */
export type CarteleriaTecnologia = {
  value: string;
  label: string;
  /** maquinaId de la primera candidata de esa tecnología. */
  maquinaId: string;
  maquinaIds: string[];
};

const HOVER_POR_FAMILIA: Record<string, string> = {
  estructura_bastidor: "frame",
  iluminacion_led: "led",
  impresion_por_area: "front",
  modificacion_pre: "front",
};

/** Nombre humano del slot en el listado (desambigua cenefa vs chapa trasera). */
const SLOT_LABELS: Record<string, string> = {
  perfil_estructural: "Perfil",
  chapa_cenefa: "Cenefa",
  chapa_fondo: "Chapa trasera",
  pintura: "Pintura",
  anclaje: "Anclajes",
  modulos_led: "Módulos LED",
  fuente: "Fuente",
  cableado: "Cable",
  sustrato_principal: "Lona",
};

const fmtMoneda = (n: number) =>
  "$" + Math.round(n).toLocaleString("es-AR", { minimumFractionDigits: 0 });
const fmtNum = (n: number, dec = 2) =>
  Number(n).toLocaleString("es-AR", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });

/* ─────────── Piezas de UI (port del prototipo) ─────────── */

function Acc({
  open,
  onToggle,
  icon,
  title,
  meta,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  icon: React.ReactNode;
  title: string;
  meta?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`${s.acc} ${open ? s.accOpen : ""}`}>
      <button type="button" className={s.accHead} onClick={onToggle}>
        <span className={s.accIco}>{icon}</span>
        <span className={s.accBody}>
          <span className={s.accNm}>{title}</span>
          {meta ? <span className={s.accMeta}>{meta}</span> : null}
        </span>
        <span className={s.accChev}>
          <ChevronRightIcon size={13} />
        </span>
      </button>
      {open ? <div className={s.accContent}>{children}</div> : null}
    </div>
  );
}

function Stepper({
  value,
  onChange,
  unit,
  step = 5,
  min = 0,
  max = 9999,
}: {
  value: number;
  onChange: (v: number) => void;
  unit: string;
  step?: number;
  min?: number;
  max?: number;
}) {
  // Borrador local: permite borrar todo y tipear ("2", "", "200") sin que el
  // control reformatee en cada tecla. Se confirma en blur o Enter.
  const [draft, setDraft] = React.useState<string | null>(null);
  const clamp = (v: number) =>
    Math.max(min, Math.min(max, Math.round(v * 100) / 100));
  const commit = () => {
    if (draft === null) return;
    const v = parseFloat(draft.replace(",", "."));
    if (!isNaN(v)) onChange(clamp(v));
    setDraft(null);
  };
  const nudge = (delta: number) => {
    setDraft(null);
    onChange(clamp(value + delta));
  };
  return (
    <div className={s.stepper}>
      <button type="button" onClick={() => nudge(-step)} aria-label="−">
        −
      </button>
      <input
        type="text"
        inputMode="decimal"
        value={draft ?? String(value)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setDraft(null);
        }}
      />
      <span className={s.stepperUnit}>{unit}</span>
      <button type="button" onClick={() => nudge(step)} aria-label="+">
        +
      </button>
    </div>
  );
}

function Seg({
  options,
  value,
  onChange,
}: {
  options: Array<{ v: number; label: string }>;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className={s.seg}>
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          className={Math.abs(value - o.v) < 0.05 ? s.on : ""}
          onClick={() => onChange(o.v)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function SegText({
  options,
  value,
  onChange,
}: {
  options: Array<{ v: string; label: string }>;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className={s.seg}>
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          className={value === o.v ? s.on : ""}
          onClick={() => onChange(o.v)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({
  on,
  onChange,
  title,
  sub,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  title: string;
  sub?: string;
}) {
  return (
    <button
      type="button"
      className={`${s.toggleRow} ${on ? s.on : ""}`}
      onClick={() => onChange(!on)}
    >
      <span className={s.toggleSwitch} />
      <span className={s.toggleBody}>
        <span className={s.toggleNm}>{title}</span>
        {sub ? <span className={s.toggleSub}>{sub}</span> : null}
      </span>
    </button>
  );
}

/** Picker de material: variantes de los candidatos del slot (biblioteca real). */
function MaterialPicker({
  slot,
  value,
  onChange,
}: {
  slot: CarteleriaSlotView | undefined;
  value: string;
  onChange: (variantId: string) => void;
}) {
  if (!slot) {
    // Pasa cuando el detalle del producto quedó viejo en memoria (los slots
    // se reconfiguraron después de cargarlo): reabrir el producto lo trae.
    return (
      <span className={s.hint}>
        Materiales no disponibles — cerrá y reabrí el producto para
        recargarlos.
      </span>
    );
  }
  const opciones = slot.candidatos.flatMap((c) =>
    c.variantes.map((v) => ({
      variantId: v.variantId,
      nombre: v.label || v.nombreVariante || v.sku || c.label,
      materia: c.label,
    })),
  );
  return (
    <div className={s.mats}>
      {opciones.map((o) => (
        <button
          key={o.variantId}
          type="button"
          className={`${s.mat} ${value === o.variantId ? s.on : ""}`}
          onClick={() => onChange(o.variantId)}
        >
          <span className={s.matPip} />
          <span className={s.matBody}>
            <span className={s.matNm}>{o.nombre}</span>
            <span className={s.matMeta}>{o.materia}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

/* ─────────── Configurador (cuerpo del sheet) ─────────── */

type Props = {
  tipoCartel: "backlight" | "frontlight";
  valor: CarteleriaValor;
  onChange: (valor: CarteleriaValor) => void;
  /** Slots con candidatos, ya filtrados a los pasos de cartelería. */
  slots: CarteleriaSlotView[];
  getMaterial: (configPasoId: string, slotCodigo: string) => string;
  setMaterial: (configPasoId: string, slotCodigo: string, variantId: string) => void;
  estructuraConfigPasoId: string;
  ledConfigPasoId: string | null;
  impresionConfigPasoId: string | null;
  /** Pasos opcionales de la ruta real (§15): sus slots viven ahí. */
  pinturaConfigPasoId: string | null;
  fondoConfigPasoId: string | null;
  cenefaConfigPasoId: string | null;
  /** Tecnologías de impresión (M-2) + selección actual. */
  tecnologias: CarteleriaTecnologia[];
  maquinaSeleccionadaId: string;
  onSelectTecnologia: (tec: CarteleriaTecnologia) => void;
  coberturaLedM2: number;
  cotizacion: CotizarResponse | null;
  cotizando: boolean;
  qty: number;
  setQty: (qty: number) => void;
  notaProduccion: string;
  setNotaProduccion: (value: string) => void;
};

export function CarteleriaConfigurador({
  tipoCartel,
  valor,
  onChange,
  slots,
  getMaterial,
  setMaterial,
  estructuraConfigPasoId,
  ledConfigPasoId,
  impresionConfigPasoId,
  pinturaConfigPasoId,
  fondoConfigPasoId,
  cenefaConfigPasoId,
  tecnologias,
  maquinaSeleccionadaId,
  onSelectTecnologia,
  coberturaLedM2,
  cotizacion,
  cotizando,
  qty,
  setQty,
  notaProduccion,
  setNotaProduccion,
}: Props) {
  const [hoverGroup, setHoverGroup] = React.useState<string | null>(null);
  const [openAcc, setOpenAcc] = React.useState<Record<string, boolean>>({
    medidas: true,
    estructura: true,
  });
  const toggleAcc = (k: string) => setOpenAcc((o) => ({ ...o, [k]: !o[k] }));

  const esBacklight = tipoCartel === "backlight";
  const vista: CarteleriaVista = {
    tipoCartel,
    width: Math.max(0.2, valor.anchoCm / 100),
    height: Math.max(0.2, valor.altoCm / 100),
    depth: Math.max(0.04, valor.profundidadCm / 100),
    sepRefuerzoVcm: valor.sepRefuerzoVcm,
    sepRefuerzoHcm: valor.sepRefuerzoHcm,
    cenefa: valor.cenefa,
    solapaCenefaCm: valor.solapaCenefaCm,
    pintura: valor.pintura,
    fondo: valor.fondo,
    perfilLadoM: 0.04,
    densidadLed: valor.densidad,
    coberturaLedM2,
  };
  const metricas = derivarMetricas(vista);
  const areaM2 = (valor.anchoCm / 100) * (valor.altoCm / 100);

  const set = (patch: Partial<CarteleriaValor>) => onChange({ ...valor, ...patch });
  const slotDe = (configPasoId: string | null, slotCodigo: string) =>
    configPasoId
      ? slots.find(
          (sl) => sl.configPasoId === configPasoId && sl.slotCodigo === slotCodigo,
        )
      : undefined;
  const materialDe = (configPasoId: string | null, slotCodigo: string) => {
    if (!configPasoId) return "";
    const elegido = getMaterial(configPasoId, slotCodigo);
    if (elegido) return elegido;
    const slot = slotDe(configPasoId, slotCodigo);
    return slot?.candidatos.find((c) => c.defaultVarianteId)?.defaultVarianteId ?? "";
  };

  const tecnologiaActual =
    tecnologias.find((t) => t.maquinaIds.includes(maquinaSeleccionadaId))?.value ??
    tecnologias[0]?.value ??
    "";

  const pasos = (cotizacion?.cotizacion?.pasos ?? []).filter((p) => p.activado);
  const precio = cotizacion?.cotizacion?.precio ?? null;
  const costos = cotizacion?.cotizacion?.costos ?? null;
  const errorMotor = cotizacion && !cotizacion.exitoso ? cotizacion.errores[0] : null;
  const ocDe = (familia: string, key: string): number | null => {
    const paso = pasos.find((p) => p.familiaCodigo === familia) as
      | { outputsCanonicos?: Record<string, unknown> }
      | undefined;
    const v = Number(paso?.outputsCanonicos?.[key]);
    return Number.isFinite(v) && v > 0 ? v : null;
  };
  const modulosMotor = ocDe("iluminacion_led", "modulos_led");
  const wattsMotor = ocDe("iluminacion_led", "watts_led");

  return (
    <div className={s.configurador}>
      {/* ── Parámetros ── */}
      <aside className={s.paramsCol}>
        <Acc
          open={!!openAcc.medidas}
          onToggle={() => toggleAcc("medidas")}
          icon={<RulerIcon size={14} />}
          title="Medidas y cantidad"
          meta={`${fmtNum(valor.anchoCm / 100)} × ${fmtNum(valor.altoCm / 100)}${
            esBacklight ? ` × ${fmtNum(valor.profundidadCm / 100)}` : ""
          } m · ${qty} u.`}
        >
          <div className={s.field}>
            <label>
              Ancho <span className={s.fieldUnit}>cm</span>
            </label>
            <Stepper value={valor.anchoCm} onChange={(v) => set({ anchoCm: v })} unit="cm" step={5} min={30} max={1200} />
          </div>
          <div className={s.field}>
            <label>
              Alto <span className={s.fieldUnit}>cm</span>
            </label>
            <Stepper value={valor.altoCm} onChange={(v) => set({ altoCm: v })} unit="cm" step={5} min={30} max={600} />
          </div>
          {esBacklight ? (
            <div className={s.field}>
              <label>
                Profundidad <span className={s.fieldUnit}>cm</span>
              </label>
              <Stepper value={valor.profundidadCm} onChange={(v) => set({ profundidadCm: v })} unit="cm" step={2} min={8} max={50} />
              <span className={s.hint}>Mín. 12 cm recomendado para iluminación uniforme.</span>
            </div>
          ) : null}
          <div className={s.field}>
            <label>Cantidad</label>
            <Stepper value={qty} onChange={(v) => setQty(Math.max(1, Math.round(v)))} unit="u." step={1} min={1} max={999} />
          </div>
        </Acc>

        <Acc
          open={!!openAcc.estructura}
          onToggle={() => toggleAcc("estructura")}
          icon={<FrameIcon size={14} />}
          title="Estructura metálica"
          meta={`${fmtNum(metricas.mlTotal, 1)} ml · ${metricas.puntosSoldadura} soldaduras`}
        >
          <div className={s.infoBox}>
            <strong>{fmtNum(metricas.mlTotal, 1)} m</strong> de perfil ·{" "}
            <strong>{metricas.puntosSoldadura}</strong> puntos de soldadura
          </div>
          <div className={s.field}>
            <label>Perfil</label>
            <MaterialPicker
              slot={slotDe(estructuraConfigPasoId, "perfil_estructural")}
              value={materialDe(estructuraConfigPasoId, "perfil_estructural")}
              onChange={(v) => setMaterial(estructuraConfigPasoId, "perfil_estructural", v)}
            />
          </div>
          <div className={s.field}>
            <label>
              Refuerzos verticales <span className={s.fieldUnit}>cada N cm</span>
            </label>
            <Seg
              options={[
                { v: 0, label: "Sin" },
                { v: 80, label: "80 cm" },
                { v: 100, label: "100 cm" },
                { v: 120, label: "120 cm" },
              ]}
              value={valor.sepRefuerzoVcm}
              onChange={(v) => set({ sepRefuerzoVcm: v })}
            />
            {metricas.refuerzosV > 0 ? (
              <span className={s.hint}>
                {metricas.refuerzosV} refuerzo(s) → +
                {fmtNum(metricas.refuerzosV * (valor.altoCm / 100) * (esBacklight ? 2 : 1), 1)} ml
              </span>
            ) : null}
          </div>
          <div className={s.field}>
            <label>
              Refuerzos horizontales <span className={s.fieldUnit}>cada N cm</span>
            </label>
            <Seg
              options={[
                { v: 0, label: "Sin" },
                { v: 80, label: "80 cm" },
                { v: 100, label: "100 cm" },
              ]}
              value={valor.sepRefuerzoHcm}
              onChange={(v) => set({ sepRefuerzoHcm: v })}
            />
          </div>
          <Toggle
            on={valor.pintura}
            onChange={(v) => set({ pintura: v })}
            title="Antióxido + esmalte"
            sub="Recomendado en exterior · se ve en el 3D"
          />
          {valor.pintura && pinturaConfigPasoId ? (
            <div className={s.field}>
              <label>Pintura</label>
              <MaterialPicker
                slot={slotDe(pinturaConfigPasoId, "pintura")}
                value={materialDe(pinturaConfigPasoId, "pintura")}
                onChange={(v) => setMaterial(pinturaConfigPasoId, "pintura", v)}
              />
            </div>
          ) : null}
          {esBacklight ? (
            <>
              <div className={s.divider} />
              <Toggle
                on={valor.cenefa}
                onChange={(v) => set({ cenefa: v })}
                title="Cenefa · chapa plegada lateral"
                sub="Cierra los laterales envolviendo el perímetro"
              />
              {valor.cenefa ? (
                <>
                  <div className={s.field}>
                    <label>Chapa de la cenefa</label>
                    <MaterialPicker
                      slot={slotDe(cenefaConfigPasoId, "chapa")}
                      value={materialDe(cenefaConfigPasoId, "chapa")}
                      onChange={(v) =>
                        cenefaConfigPasoId && setMaterial(cenefaConfigPasoId, "chapa", v)
                      }
                    />
                  </div>
                  <div className={s.field}>
                    <label>
                      Solapa de plegado <span className={s.fieldUnit}>cm por lado</span>
                    </label>
                    <Seg
                      options={[
                        { v: 1.5, label: "1,5 cm" },
                        { v: 2, label: "2 cm" },
                        { v: 3, label: "3 cm" },
                      ]}
                      value={valor.solapaCenefaCm}
                      onChange={(v) => set({ solapaCenefaCm: v })}
                    />
                    <span className={s.hint}>
                      Desarrollo: {fmtNum(valor.profundidadCm, 0)} + {fmtNum(valor.solapaCenefaCm, 1)}
                      ×2 = <strong>{fmtNum(valor.profundidadCm + valor.solapaCenefaCm * 2, 0)} cm</strong> ·{" "}
                      {fmtNum(metricas.cenefaM2)} m²
                    </span>
                  </div>
                </>
              ) : null}
              <Toggle
                on={valor.fondo}
                onChange={(v) => set({ fondo: v })}
                title="Chapa trasera"
                sub="Panel posterior opaco (simple faz) · se ve en el 3D"
              />
              {valor.fondo ? (
                <div className={s.field}>
                  <label>Chapa del fondo</label>
                  <MaterialPicker
                    slot={slotDe(fondoConfigPasoId, "chapa")}
                    value={materialDe(fondoConfigPasoId, "chapa")}
                    onChange={(v) =>
                      fondoConfigPasoId && setMaterial(fondoConfigPasoId, "chapa", v)
                    }
                  />
                </div>
              ) : null}
            </>
          ) : null}
        </Acc>

        {impresionConfigPasoId ? (
          <Acc
            open={!!openAcc.cara}
            onToggle={() => toggleAcc("cara")}
            icon={<LayersIcon size={14} />}
            title="Cara frontal · lona"
            meta={tecnologias.find((t) => t.value === tecnologiaActual)?.label ?? ""}
          >
            {tecnologias.length > 1 ? (
              <div className={s.field}>
                <label>
                  <PrinterIcon size={11} /> Tecnología de impresión
                </label>
                <SegText
                  options={tecnologias.map((t) => ({ v: t.value, label: t.label }))}
                  value={tecnologiaActual}
                  onChange={(v) => {
                    const tec = tecnologias.find((t) => t.value === v);
                    if (tec) onSelectTecnologia(tec);
                  }}
                />
              </div>
            ) : null}
            <div className={s.field}>
              <label>Lona</label>
              <MaterialPicker
                slot={slotDe(impresionConfigPasoId, "sustrato_principal")}
                value={materialDe(impresionConfigPasoId, "sustrato_principal")}
                onChange={(v) => setMaterial(impresionConfigPasoId, "sustrato_principal", v)}
              />
            </div>
            <span className={s.hint}>
              La demasía de tensado y el acomodo en el rollo los calcula el
              motor; si el rollo no entra en la boca de la máquina, corta con
              aviso.
            </span>
          </Acc>
        ) : null}

        {esBacklight && ledConfigPasoId ? (
          <Acc
            open={!!openAcc.ilum}
            onToggle={() => toggleAcc("ilum")}
            icon={<LightbulbIcon size={14} />}
            title="Iluminación interior"
            meta={
              modulosMotor
                ? `${modulosMotor} módulos · ${fmtNum(wattsMotor ?? 0, 0)}W`
                : `${metricas.ledCount} módulos (estimado)`
            }
          >
            <div className={s.field}>
              <label>Módulo / tubo</label>
              <MaterialPicker
                slot={slotDe(ledConfigPasoId, "modulos_led")}
                value={materialDe(ledConfigPasoId, "modulos_led")}
                onChange={(v) => setMaterial(ledConfigPasoId, "modulos_led", v)}
              />
            </div>
            <div className={s.field}>
              <label>
                Densidad <span className={s.fieldUnit}>× recomendada</span>
              </label>
              <Seg
                options={[
                  { v: 0.7, label: "Económica" },
                  { v: 1.0, label: "Estándar" },
                  { v: 1.4, label: "Brillante" },
                ]}
                value={valor.densidad}
                onChange={(v) => set({ densidad: v })}
              />
            </div>
            <div className={s.infoBox}>
              {modulosMotor ? (
                <>
                  Motor: <strong>{modulosMotor} módulos</strong> ·{" "}
                  {fmtNum(wattsMotor ?? 0, 0)}W · fuente elegida por capacidad
                </>
              ) : (
                <>Grilla estimada {metricas.ledCols}×{metricas.ledRows}</>
              )}
            </div>
          </Acc>
        ) : null}

        <Acc
          open={!!openAcc.anc}
          onToggle={() => toggleAcc("anc")}
          icon={<AnchorIcon size={14} />}
          title="Anclajes y montaje"
          meta={`${Math.max(2, Math.ceil(valor.anchoCm / 80)) * 2} soportes`}
        >
          <div className={s.field}>
            <label>Tipo de anclaje</label>
            <MaterialPicker
              slot={slotDe(estructuraConfigPasoId, "anclaje")}
              value={materialDe(estructuraConfigPasoId, "anclaje")}
              onChange={(v) => setMaterial(estructuraConfigPasoId, "anclaje", v)}
            />
          </div>
          <span className={s.hint}>
            Flete e instalación se agregan como cargos de la orden.
          </span>
        </Acc>

        <Acc
          open={!!openAcc.notas}
          onToggle={() => toggleAcc("notas")}
          icon={<StickyNoteIcon size={14} />}
          title="Notas para producción"
          meta={notaProduccion ? notaProduccion.slice(0, 40) : "sin notas"}
        >
          <textarea
            className={s.notasArea}
            rows={3}
            placeholder="Ej: entregar enrollado en tubo, coordinar instalación…"
            value={notaProduccion}
            onChange={(e) => setNotaProduccion(e.target.value)}
          />
        </Acc>
      </aside>

      {/* ── 3D ── */}
      <div className={s.viewportCol}>
        <CarteleriaViewport vista={vista} hoverComponent={hoverGroup} />
      </div>

      {/* ── Listado y costo ── */}
      <aside className={s.precioCol}>
        <div className={s.precioHead}>
          <span>Listado y costo</span>
          <span className={`${s.liveDot} ${cotizando ? s.liveDotBusy : ""}`} />
          <span className={s.liveLabel}>{cotizando ? "recalculando…" : "motor"}</span>
        </div>

        {errorMotor ? <div className={s.motorError}>{errorMotor.mensaje}</div> : null}

        <div className={s.pasosList}>
          {pasos.map((p, si) => {
            const materiales = (p.materiales ?? []) as Array<{
              slotCodigo: string;
              materialDisplayName?: string;
              materialNombre?: string;
              cantidad: number;
              unidad: string;
              precioUnitario: number;
              costoTotal: number;
            }>;
            const tiempo = p.tiempo as { totalMin?: number; costo?: number } | undefined;
            return (
              <div
                key={p.configPasoId ?? `${p.rutaPasoOrden}`}
                className={s.bomSect}
                onMouseEnter={() => setHoverGroup(HOVER_POR_FAMILIA[p.familiaCodigo] ?? null)}
                onMouseLeave={() => setHoverGroup(null)}
              >
                <div className={s.bomSectHead}>
                  <span>{p.nombreVisible || p.familiaCodigo}</span>
                  <span className={s.bomSectSum}>{fmtMoneda(p.costoTotal)}</span>
                </div>
                {materiales.map((m, mi) => (
                  <div key={`${m.slotCodigo}-${mi}`} className={s.bomItem}>
                    <span className={s.bomIx}>
                      {String(si + 1).padStart(2, "0")}.{String(mi + 1).padStart(2, "0")}
                    </span>
                    <span className={s.bomBody}>
                      <span className={s.bomNm}>
                        {SLOT_LABELS[m.slotCodigo] ? `${SLOT_LABELS[m.slotCodigo]} · ` : ""}
                        {m.materialDisplayName || m.materialNombre || m.slotCodigo}
                      </span>
                      <span className={s.bomQty}>
                        {fmtNum(m.cantidad, m.unidad === "unidad" ? 0 : 2)} {m.unidad} ·{" "}
                        {fmtMoneda(m.precioUnitario)}/{m.unidad}
                      </span>
                    </span>
                    <span className={s.bomPrice}>{fmtMoneda(m.costoTotal)}</span>
                  </div>
                ))}
                {tiempo && (tiempo.costo ?? 0) > 0 ? (
                  <div className={s.bomItem}>
                    <span className={s.bomIx}>{String(si + 1).padStart(2, "0")}.MO</span>
                    <span className={s.bomBody}>
                      <span className={s.bomNm}>Tiempo del paso</span>
                      <span className={s.bomQty}>{fmtNum(tiempo.totalMin ?? 0, 0)} min</span>
                    </span>
                    <span className={s.bomPrice}>{fmtMoneda(tiempo.costo ?? 0)}</span>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className={s.precioFoot}>
          <div className={s.precioRow}>
            <span>Costo materiales + tiempo</span>
            <span>{fmtMoneda(costos?.total ?? 0)}</span>
          </div>
          <div className={`${s.precioRow} ${s.precioTotal}`}>
            <span>
              Precio {qty > 1 ? `(${qty} u.)` : ""}
              {precio?.margenAplicadoPct != null ? ` · margen ${precio.margenAplicadoPct}%` : ""}
            </span>
            <span className={cotizando ? s.atenuado : ""}>
              {precio ? fmtMoneda(precio.precioTotal) : "—"}
            </span>
          </div>
          {precio && areaM2 > 0 ? (
            <div className={s.precioRow}>
              <span>Precio por m²</span>
              <span>{fmtMoneda(precio.precioTotal / qty / areaM2)}</span>
            </div>
          ) : null}
          <p className={s.hint}>
            Los precios salen del motor: biblioteca, tarifas del centro y
            margen reales. El 3D sólo deriva la geometría.
          </p>
        </div>
      </aside>
    </div>
  );
}
