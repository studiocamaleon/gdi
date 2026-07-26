"use client";

import * as React from "react";
import {
  StampIcon,
  XIcon,
  CheckIcon,
  AlignLeftIcon,
  AlignCenterIcon,
  AlignRightIcon,
  DownloadIcon,
  WrenchIcon,
  FileTextIcon,
  InfoIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  layoutSello,
  svgSello,
  epsSello,
  type Alineacion,
  type FontResolver,
  type SelloModel,
} from "@/lib/sello-arte/engine";
import {
  cargarTipografiasSello,
  TIPOGRAFIAS_SELLO,
} from "@/lib/sello-arte/fonts";
import { nombreArteSello } from "@/lib/sello-arte/diseno";
import type {
  DisenoSello,
  SelloLineaDiseno,
  SelloModeloDiseno,
} from "@/lib/sello-arte/diseno";
import styles from "./sello-editor.module.css";

/**
 * Modelo del cuerpo del sello elegido (viene de la variante de materia prima).
 * Es el mismo que se guarda dentro del diseño: al guardar la orden el arte se
 * vuelve a dibujar sin el editor abierto, y ahí las medidas tienen que estar.
 */
export type SelloEditorModel = SelloModeloDiseno;

export type { DisenoSello, SelloLineaDiseno };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  model: SelloEditorModel | null;
  /** Etiqueta del tipo (ej. "Sellos automáticos"). */
  tipoLabel?: string;
  /** Diseño previo para re-editar. */
  initial?: DisenoSello | null;
  onSave: (diseno: DisenoSello) => void;
};

const PX_PER_MM = 8; // escala de la vista grande a "tamaño real"

function nuevasLineas(cant: number, previas: SelloLineaDiseno[]): SelloLineaDiseno[] {
  return Array.from({ length: Math.max(1, cant) }, (_, i) => ({
    text: previas[i]?.text ?? "",
    bold: previas[i]?.bold ?? i === 0,
    italic: previas[i]?.italic ?? false,
  }));
}

export function SelloEditorSheet({
  open,
  onOpenChange,
  model,
  tipoLabel = "Sello",
  initial = null,
  onSave,
}: Props) {
  const [resolver, setResolver] = React.useState<FontResolver | null>(null);
  const [cargando, setCargando] = React.useState(false);
  const [lineas, setLineas] = React.useState<SelloLineaDiseno[]>([]);
  const [align, setAlign] = React.useState<Alineacion>("center");
  const [fontKey, setFontKey] = React.useState<string>(TIPOGRAFIAS_SELLO[0].key);

  // Carga de fuentes al abrir (una vez; la cache las reusa).
  React.useEffect(() => {
    if (!open) return;
    let cancel = false;
    if (!resolver) {
      setCargando(true);
      cargarTipografiasSello()
        .then((r) => {
          if (!cancel) setResolver(() => r);
        })
        .catch((e) => {
          if (!cancel) toast.error(e instanceof Error ? e.message : "No pude cargar las tipografías.");
        })
        .finally(() => {
          if (!cancel) setCargando(false);
        });
    }
    return () => {
      cancel = true;
    };
  }, [open, resolver]);

  // Inicializa/ajusta las líneas al abrir o cambiar de modelo.
  React.useEffect(() => {
    if (!open || !model) return;
    if (initial) {
      setLineas(nuevasLineas(model.lineasMax, initial.lineas));
      setAlign(initial.align);
      setFontKey(initial.fontKey);
    } else {
      setLineas((prev) => nuevasLineas(model.lineasMax, prev));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, model?.nombre, model?.lineasMax]);

  // Escape cierra sólo el editor; se captura antes de que burbujee al listener
  // de Escape del sheet padre (que si no, cerraría también la cotización).
  React.useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      onOpenChange(false);
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open, onOpenChange]);

  const engineModel: SelloModel | null = model
    ? { widthMm: model.widthMm, heightMm: model.heightMm, lineasMax: model.lineasMax }
    : null;

  const setLinea = (i: number, patch: Partial<SelloLineaDiseno>) => {
    setLineas((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  };

  const layoutPara = React.useCallback(
    (fk: string) => {
      if (!engineModel || !resolver) return null;
      return layoutSello(
        engineModel,
        lineas.map((l) => ({ ...l, fontKey: fk })),
        resolver,
        { align },
      );
    },
    [engineModel, resolver, lineas, align],
  );

  const svgCard = React.useCallback(
    (fk: string) => {
      const lay = layoutPara(fk);
      return lay ? svgSello(lay) : "";
    },
    [layoutPara],
  );

  const svgGrande = React.useMemo(() => {
    const lay = layoutPara(fontKey);
    return lay ? svgSello(lay) : "";
  }, [layoutPara, fontKey]);

  const hayTexto = lineas.some((l) => l.text.trim() !== "");
  const fontActual = TIPOGRAFIAS_SELLO.find((t) => t.key === fontKey);

  const descargarEps = (negative: boolean) => {
    const lay = layoutPara(fontKey);
    if (!lay || !model) return;
    const eps = epsSello(lay, {
      negative,
      meta: { modeloNombre: model.nombre },
    });
    const blob = new Blob([eps], { type: "application/postscript" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    // Mismo nombre que el arte que se sube a la orden: el archivo que alguien
    // baja a mano y el que queda en Archivos son el mismo, y se ve.
    a.href = url;
    a.download = nombreArteSello(
      { lineas, align, fontKey, modelo: model },
      negative,
    );
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Archivo generado · ${a.download}`);
  };

  const guardar = () => {
    if (!hayTexto) {
      toast.error("Cargá al menos una línea de texto.");
      return;
    }
    if (!model) return;
    // El modelo viaja DENTRO del diseño: al guardar la orden el arte se
    // regenera desde este dato solo, sin volver a mirar la variante del cuerpo.
    onSave({ lineas, align, fontKey, modelo: model });
    onOpenChange(false);
  };

  if (!open) return null;

  return (
    <>
      <div
        className={styles.overlay}
        onMouseDown={() => onOpenChange(false)}
      />
      <div
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-label="Configurar sello"
      >
        <div className={styles.root}>
          <div className={styles.sheet}>
            {/* barra superior mínima: sólo cerrar (el modelo se ve abajo) */}
            <div className={styles.shTop}>
              <div className={styles.shEyebrow}>
                <StampIcon />
                Diseño del sello
              </div>
              <button
                className={styles.xClose}
                onClick={() => onOpenChange(false)}
                aria-label="Cerrar"
              >
                <XIcon />
              </button>
            </div>

            {/* modelo elegido (read-only) */}
            <div className={styles.prodCard}>
              <div className={styles.prodTags}>
                <span className={styles.prodTag}>
                  <span className={styles.d} />
                  {tipoLabel}
                </span>
              </div>
              <div className={styles.prodRight}>
                <div className={styles.prodModel}>{model?.nombre ?? "—"}</div>
                <div className={styles.prodSpec}>
                  {model
                    ? `${model.widthMm} × ${model.heightMm} mm · ${model.lineasMax} líneas máx`
                    : ""}
                </div>
              </div>
            </div>

            {cargando && !resolver ? (
              <div className={styles.loading}>Cargando tipografías…</div>
            ) : (
              <div className={styles.shBody}>
                {/* líneas */}
                <div className={styles.sec}>
                  <div className={styles.secHead}>
                    <h2>
                      Texto del sello{" "}
                      <span className={styles.cnt}>
                        {model?.lineasMax ?? 0} líneas máx
                      </span>
                    </h2>
                    <p>Una línea por renglón. El máximo lo define el modelo elegido.</p>
                  </div>
                  <div className={styles.lines}>
                    {lineas.map((l, i) => (
                      <div className={styles.linerow} key={i}>
                        <span className={styles.lineno}>{i + 1}</span>
                        <input
                          className={styles.lineInput}
                          value={l.text}
                          placeholder={`Línea ${i + 1}${i === 0 ? " — ej. nombre / razón social" : ""}`}
                          onChange={(e) => setLinea(i, { text: e.target.value })}
                        />
                        <div className={styles.lineTools}>
                          <button
                            className={l.bold ? styles.on : ""}
                            onClick={() => setLinea(i, { bold: !l.bold })}
                            aria-label="Negrita"
                          >
                            <b>B</b>
                          </button>
                          <button
                            className={l.italic ? styles.on : ""}
                            onClick={() => setLinea(i, { italic: !l.italic })}
                            aria-label="Itálica"
                          >
                            <i>I</i>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className={styles.alignRow}>
                    <span className={styles.lbl}>Alineación</span>
                    <div className={styles.seg}>
                      {(
                        [
                          ["left", AlignLeftIcon],
                          ["center", AlignCenterIcon],
                          ["right", AlignRightIcon],
                        ] as const
                      ).map(([a, Icon]) => (
                        <button
                          key={a}
                          className={align === a ? styles.on : ""}
                          onClick={() => setAlign(a)}
                          aria-label={a}
                        >
                          <Icon />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* tipografías */}
                <div className={styles.sec}>
                  <div className={styles.secHead}>
                    <h2>Tipografías sugeridas</h2>
                    <p>
                      Generadas con tu texto, a escala de la matriz. Elegí la que le
                      mostrás al cliente.
                    </p>
                  </div>
                  <div className={styles.fontsGrid}>
                    {TIPOGRAFIAS_SELLO.map((t) => (
                      <button
                        key={t.key}
                        className={`${styles.fcard} ${fontKey === t.key ? styles.on : ""}`}
                        onClick={() => setFontKey(t.key)}
                      >
                        <div
                          className={styles.preview}
                          style={{
                            aspectRatio: model
                              ? `${model.widthMm} / ${model.heightMm}`
                              : "38 / 14",
                          }}
                          dangerouslySetInnerHTML={{ __html: svgCard(t.key) }}
                        />
                        <div className={styles.flabel}>
                          <span className={styles.fname}>{t.nombre}</span>
                          <span className={styles.fcheck}>
                            <CheckIcon />
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* vista grande + archivos */}
                <div className={styles.sec}>
                  <div className={styles.secHead}>
                    <h2>Diseño final y archivos de producción</h2>
                    <p>
                      Vista a tamaño real de la matriz. Los .eps salen a la medida
                      exacta, con el texto en vectores.
                    </p>
                  </div>
                  <div className={styles.final}>
                    <div className={styles.bigprevWrap}>
                      <div className={styles.bigprevHead}>
                        <span className={styles.t}>
                          Vista previa · {fontActual?.nombre ?? "—"}
                        </span>
                        <span className={styles.dims}>
                          {model ? `${model.widthMm} × ${model.heightMm} mm` : ""}
                        </span>
                      </div>
                      <div className={styles.stampStage}>
                        <div
                          className={styles.stampPlate}
                          style={{
                            width: model ? model.widthMm * PX_PER_MM : 0,
                            height: model ? model.heightMm * PX_PER_MM : 0,
                          }}
                          dangerouslySetInnerHTML={{ __html: svgGrande }}
                        />
                      </div>
                      <div className={styles.stampRuler}>
                        {model
                          ? `Matriz de polímero · ${model.widthMm} × ${model.heightMm} mm (tamaño real)`
                          : ""}
                      </div>
                    </div>
                    <div className={styles.exportCol}>
                      <div className={styles.exportHead}>Archivos de producción</div>
                      <button
                        className={`${styles.expBtn} ${styles.pos}`}
                        disabled={!hayTexto}
                        onClick={() => descargarEps(false)}
                      >
                        <span className={styles.ic}>
                          <WrenchIcon />
                        </span>
                        <span className={styles.body}>
                          <span className={styles.t}>.eps · grabado láser</span>
                          <span className={styles.s}>
                            Vector positivo, {model?.widthMm}×{model?.heightMm} mm
                          </span>
                        </span>
                        <span className={styles.dl}>
                          <DownloadIcon />
                        </span>
                      </button>
                      <button
                        className={`${styles.expBtn} ${styles.neg}`}
                        disabled={!hayTexto}
                        onClick={() => descargarEps(true)}
                      >
                        <span className={styles.ic}>
                          <FileTextIcon />
                        </span>
                        <span className={styles.body}>
                          <span className={styles.t}>.eps · negativo</span>
                          <span className={styles.s}>
                            Fondo negro, texto blanco · polímero líquido
                          </span>
                        </span>
                        <span className={styles.dl}>
                          <DownloadIcon />
                        </span>
                      </button>
                      <div className={styles.expNote}>
                        <InfoIcon />
                        <span>
                          Vectores a medida exacta de la matriz. El taller los manda
                          directo al láser o al fotolito.
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* footer */}
            <div className={styles.shFoot}>
              <button className={styles.btn} onClick={() => onOpenChange(false)}>
                Cancelar
              </button>
              <button
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={guardar}
                disabled={!hayTexto}
              >
                <CheckIcon />
                Guardar diseño
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
