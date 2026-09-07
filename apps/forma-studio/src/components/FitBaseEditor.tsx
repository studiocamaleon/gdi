import { Box, Layers, Scan, SlidersHorizontal, RotateCcw } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Button } from "./ui/button";
import { Field, FieldLabel, FieldGroup } from "./ui/field";
import { NumberControl, SwitchControl, Section, Choice } from "./Controls";
import { styleDefaults } from "../core/project";
import {
  componentLabel,
  fitAssembly,
  fitComponents,
  updateFitParameters,
  FIT_BASES,
  type FitComponent,
} from "../core/fit-assembly";
import { fitWallLevels } from "../core/fit-base-geometry";
import type { Parameters, Project } from "../core/types";
import type { ComponentInspectionProps } from "./FitComponentEditor";
import { PerforationEditor } from "./PerforationEditor";

export function FitBaseEditor({
  project: p,
  onChange,
  component,
  isolated,
  onComponentChange,
  onIsolatedChange,
}: ComponentInspectionProps & {
  project: Project;
  onChange: (p: Project) => void;
}) {
  const v = p.params,
    a = fitAssembly(p.style, v),
    type = v.fitBaseType;
  const acrylic = p.style === "acrylic-fit",
    perforated = p.style === "perforated",
    lock = type === "pvc-lock",
    frame = type === "ring-pvc";
  const components = fitComponents(p.style, v);
  const active = components.includes(component) ? component : "body";
  const label = active === "fit" ? "Encastre" : componentLabel(p, active);
  const change = (changes: Partial<Parameters>) =>
    onChange({ ...p, params: updateFitParameters(p.style, v, changes) });
  const n = (
    key: keyof Parameters,
    label: string,
    min = 0.5,
    max = 10,
    step = 0.1,
    unit = "mm",
  ) => (
    <NumberControl
      key={key}
      label={label}
      value={v[key] as number}
      min={min}
      max={Math.max(min, max)}
      step={step}
      unit={unit}
      slider
      onChange={(value) => change({ [key]: value })}
    />
  );
  const icons = {
    body: Box,
    back: Layers,
    face: Scan,
    pvc: Layers,
    fit: SlidersHorizontal,
  };
  return (
    <div className="component-editor">
      <p className="section-caption">
        {FIT_BASES.find((b) => b.value === type)?.description}
      </p>
      <Tabs
        className="flex-col"
        value={active}
        onValueChange={(value) => onComponentChange(value as FitComponent)}
      >
        <TabsList aria-label="Componentes de la letra" className="w-full">
          {components.map((id) => {
            const Icon = icons[id];
            return (
              <TabsTrigger
                key={id}
                value={id}
                className="flex-col gap-1 h-auto py-2 px-1"
              >
                <Icon />
                <span>
                  {
                    {
                      body: perforated ? "Calado" : "Cuerpo",
                      back: frame ? "Marco" : "Base",
                      face: perforated ? "Difusor" : "Acrílico",
                      pvc: "PVC",
                      fit: "Encastre",
                    }[id]
                  }
                </span>
              </TabsTrigger>
            );
          })}
        </TabsList>
        <div className="component-description" aria-live="polite">
          <strong>{label}</strong>
          <p>
            {active === "body"
              ? perforated
                ? "Cuerpo y frente calado impresos en una pieza. El difusor acrílico se coloca detrás del frente."
                : "Pared exterior y frente. La profundidad total incluye el cierre posterior."
              : active === "back"
                ? "Pieza impresa independiente. La altura incluye el fondo y se conserva al editar el cuerpo."
                : active === "face"
                  ? perforated
                    ? "Placa de acrílico sin calar. Cubre todos los huecos desde adentro y se introduce por la abertura posterior."
                    : "Placa de corte con holgura propia. Se introduce por atrás hasta el apoyo frontal."
                  : active === "pvc"
                    ? frame
                      ? "Placa apoyada en el marco. Se coloca desde la cara abierta del marco antes de introducir el conjunto en el cuerpo."
                      : "Placa que entra por la abertura posterior hasta el tope trapezoidal."
                    : "Las holguras de acrílico, PVC y piezas impresas se aplican por lado y se ajustan por separado."}
          </p>
        </div>
        {active !== "fit" && (
          <Button
            variant="outline"
            size="sm"
            aria-pressed={isolated}
            onClick={() => onIsolatedChange(!isolated)}
          >
            <Scan data-icon="inline-start" />
            {isolated ? "Volver al conjunto" : "Aislar pieza en el visor"}
          </Button>
        )}
        <TabsContent value="body">
          {perforated && <PerforationEditor params={v} onChange={change} />}
          <Section title="Cuerpo y frente" defaultOpen={!perforated}>
            <FieldGroup>
              {n(
                "height",
                "Profundidad total",
                lock
                  ? a.front + v.pvc + v.fitLockHeight + v.fitLockOffset + 0.1
                  : a.front + a.baseHeight + a.clearance,
                300,
              )}
              {n("wall", "Espesor mínimo de pared", 0.5, 8)}
              {acrylic ? (
                <>
                  {n(
                    "borderWidth",
                    "Ancho del apoyo frontal",
                    v.cutClearance + 0.1,
                    10,
                  )}
                  {n("borderThickness", "Espesor del apoyo frontal", 0.5, 10)}
                </>
              ) : (
                n(
                  "base",
                  perforated
                    ? "Espesor del frente calado"
                    : "Espesor del frente impreso",
                  0.5,
                  10,
                )
              )}
            </FieldGroup>
          </Section>
          {lock && (
            <Section
              title="Perfil exterior de pared"
              caption="El paso interior se mantiene recto. Hacia adentro reduce el espacio útil para las placas."
            >
              <FieldGroup>
                <Choice
                  label="Perfil de pared"
                  value={v.fitWallProfile}
                  options={[
                    { value: "straight", label: "Recto" },
                    { value: "bevel", label: "Biselado" },
                    { value: "curved", label: "Curvo" },
                    { value: "angular", label: "Angular" },
                  ]}
                  onChange={(value) =>
                    change({
                      fitWallProfile: value as Parameters["fitWallProfile"],
                      fitProfileTop: Math.max(v.fitProfileTop, a.front),
                    })
                  }
                />
                {v.fitWallProfile !== "straight" && (
                  <>
                    <Choice
                      label="Dirección del perfil"
                      value={v.fitProfileDirection}
                      options={[
                        { value: "outward", label: "Hacia afuera" },
                        { value: "inward", label: "Hacia adentro" },
                      ]}
                      onChange={(value) =>
                        change({
                          fitProfileDirection:
                            value as Parameters["fitProfileDirection"],
                        })
                      }
                    />
                    {n("fitProfileAngle", "Ángulo del perfil", 0, 60, 0.1, "°")}
                    {n(
                      "fitProfileTop",
                      "Tramo recto frontal",
                      a.front,
                      v.height - v.fitProfileBottom - 0.1,
                    )}
                    {n(
                      "fitProfileBottom",
                      "Tramo recto posterior",
                      0,
                      v.height - v.fitProfileTop - 0.1,
                    )}
                  </>
                )}
              </FieldGroup>
            </Section>
          )}
        </TabsContent>
        {!lock && (
          <TabsContent value="back">
            <Section title={frame ? "Marco impreso" : "Base impresa"}>
              <FieldGroup>
                <NumberControl
                  label={frame ? "Altura del marco" : "Altura de la base"}
                  value={a.baseHeight}
                  min={a.baseMin}
                  max={a.baseMax}
                  slider
                  onChange={(fitBaseHeight) => change({ fitBaseHeight })}
                />
                {n(
                  "traySheet",
                  frame ? "Espesor del apoyo inferior" : "Espesor del fondo",
                  0.5,
                  Math.min(10, a.baseHeight - 0.1),
                )}
                {n("innerWall", "Espesor de pared interior", 0.5, 8)}
                {type === "rim" && (
                  <>
                    {n("fitRimWall", "Espesor del reborde exterior", 0.5, 8)}
                    {n(
                      "fitRimHeight",
                      "Altura del reborde exterior",
                      0.5,
                      a.baseHeight - v.traySheet,
                    )}
                  </>
                )}
                {frame &&
                  n(
                    "fitRingWidth",
                    "Ancho del apoyo de PVC",
                    v.pvcClearance + 0.1,
                    15,
                  )}
                {type === "double-channel" && (
                  <>
                    {n("fitChannelGap", "Separación entre paredes", 0.5, 30)}
                    {n("secondInnerWall", "Espesor de segunda pared", 0.5, 8)}
                    {n(
                      "fitChannelHeight",
                      "Altura de segunda pared",
                      0.5,
                      a.baseHeight - v.traySheet - v.fitChannelFloor,
                    )}
                    {n(
                      "fitChannelFloor",
                      "Altura del suelo del canal",
                      0.5,
                      a.baseHeight - v.traySheet - v.fitChannelHeight,
                    )}
                  </>
                )}
              </FieldGroup>
            </Section>
          </TabsContent>
        )}
        {(acrylic || perforated) && (
          <TabsContent value="face">
            <Section
              title={perforated ? "Difusor acrílico" : "Acrílico de corte"}
            >
              <FieldGroup>
                {n("acrylic", "Espesor del acrílico", 0.5, 10)}
                {n(
                  "cutClearance",
                  "Holgura de acrílico por lado",
                  0,
                  perforated ? 2 : Math.min(2, v.borderWidth - 0.1),
                  0.05,
                )}
              </FieldGroup>
            </Section>
          </TabsContent>
        )}
        {(frame || lock) && (
          <TabsContent value="pvc">
            <Section title="Fondo de PVC">
              <FieldGroup>
                {n(
                  "pvc",
                  "Espesor del PVC",
                  0.5,
                  frame
                    ? a.baseHeight - v.traySheet - 0.1
                    : v.height -
                        a.front -
                        v.fitLockHeight -
                        v.fitLockOffset -
                        0.1,
                )}
                {n(
                  "pvcClearance",
                  "Holgura de PVC por lado",
                  0,
                  Math.min(
                    2,
                    (frame ? v.fitRingWidth : v.fitLockDepth * 0.6) - 0.1,
                  ),
                  0.05,
                )}
              </FieldGroup>
            </Section>
          </TabsContent>
        )}
        <TabsContent value="fit">
          <Section title={lock ? "Traba trapezoidal" : "Ajuste del encastre"}>
            <FieldGroup>
              {lock ? (
                <>
                  {n(
                    "fitLockDepth",
                    "Profundidad de la traba",
                    Math.max(0.2, (v.pvcClearance + 0.1) / 0.6),
                    8,
                  )}
                  {n(
                    "fitLockHeight",
                    "Altura de la traba",
                    0.5,
                    v.height - a.front - v.pvc - v.fitLockOffset - 0.1,
                  )}
                  {n(
                    "fitLockOffset",
                    "Retranqueo del fondo de PVC",
                    0,
                    v.height - a.front - v.pvc - v.fitLockHeight - 0.1,
                  )}
                </>
              ) : (
                n("clearance", "Holgura del encastre por lado", 0, 2, 0.05)
              )}
            </FieldGroup>
          </Section>
        </TabsContent>
      </Tabs>
      <Section title="Sección de montaje" defaultOpen={false}>
        <figure className="assembly-preview">
          <FitBaseSection project={p} component={active} />
          <figcaption>
            Sección local de pared y apoyos. Frente arriba; cierre abajo.
            {perforated &&
              " Calados esquemáticos: el patrón real se ve en el visor."}
          </figcaption>
        </figure>
      </Section>
      {active !== "fit" && (
        <Section title="Vista de la pieza" defaultOpen={false}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="fit-base-color">
                Color de {label.toLowerCase()}
              </FieldLabel>
              <input
                id="fit-base-color"
                type="color"
                value={p.colors[active]}
                onChange={(e) =>
                  onChange({
                    ...p,
                    colors: { ...p.colors, [active]: e.target.value },
                  })
                }
              />
            </Field>
            <SwitchControl
              label="Visible en el conjunto"
              value={!p.hidden.includes(active)}
              onChange={(visible) =>
                onChange({
                  ...p,
                  hidden: visible
                    ? p.hidden.filter((l) => l !== active)
                    : [...new Set([...p.hidden, active])],
                })
              }
            />
          </FieldGroup>
        </Section>
      )}
      <Section title="Orientación" defaultOpen={false}>
        <SwitchControl
          label="Espejar geometría"
          value={v.mirror}
          onChange={(mirror) => change({ mirror })}
        />
      </Section>
      <Button
        variant="ghost"
        onClick={() => {
          onComponentChange("body");
          onIsolatedChange(false);
          onChange({ ...p, params: styleDefaults(p.style) });
        }}
      >
        <RotateCcw data-icon="inline-start" />
        Restaurar parámetros del modelo
      </Button>
    </div>
  );
}

function FitBaseSection({
  project: p,
  component,
}: {
  project: Project;
  component: FitComponent;
}) {
  const v = p.params,
    a = fitAssembly(p.style, v),
    lock = v.fitBaseType === "pvc-lock";
  let levels;
  try {
    levels = lock
      ? fitWallLevels(v)
      : [
          { z: 0, offset: 0 },
          { z: a.bodyHeight, offset: 0 },
        ];
  } catch {
    return (
      <p className="section-caption">
        Ajustá los parámetros para ver la sección.
      </p>
    );
  }
  const inner = v.wall - Math.min(...levels.map((l) => l.offset));
  const front = inner + (lock ? v.fitLockDepth : 0),
    base = inner + v.clearance;
  const z = v.height - v.traySheet,
    start = v.height - a.baseHeight,
    end = Math.max(32, inner + 25);
  const scale = 125 / Math.max(v.height, end + 15),
    x0 = 45,
    y0 = 10;
  const frontSegments = [];
  if (p.style === "perforated") {
    const holeSize = Math.max(0.4, v.patternSize);
    let start = 0;
    for (
      let hole = Math.max(
        v.patternBorder + v.patternMargin,
        front + v.cutClearance + 0.6,
      );
      hole + holeSize < end;
      hole += holeSize + Math.max(0.4, v.patternSpacing)
    ) {
      frontSegments.push({ x: start, width: hole - start });
      start = hole + holeSize;
    }
    frontSegments.push({ x: start, width: end - start });
  }
  const appearance = (layer: "body" | "back" | "face" | "pvc") => ({
    fill: p.colors[layer],
    stroke: component === layer ? "var(--primary)" : "var(--foreground)",
    strokeWidth: 0.3,
    opacity: component === layer || component === "fit" ? 1 : 0.45,
  });
  const rect = (
    layer: "body" | "back" | "face" | "pvc",
    x: number,
    y: number,
    width: number,
    height: number,
  ) => (
    <rect {...appearance(layer)} x={x} y={y} width={width} height={height} />
  );
  return (
    <svg
      viewBox="0 0 250 150"
      role="img"
      aria-label="Sección de la variante de base seleccionada"
    >
      <g transform={`translate(${x0} ${y0}) scale(${scale})`}>
        <polygon
          {...appearance("body")}
          points={[
            ...levels.map((l) => `${-l.offset},${l.z}`),
            `${inner},${a.bodyHeight}`,
            `${inner},0`,
          ].join(" ")}
        />
        {p.style === "perforated"
          ? frontSegments.map(({ x, width }) => (
              <rect
                key={x}
                {...appearance("body")}
                x={x}
                y={0}
                width={width}
                height={v.base}
              />
            ))
          : rect(
              "body",
              0,
              0,
              p.style !== "acrylic-fit" ? end : front + v.borderWidth,
              p.style !== "acrylic-fit" ? v.base : v.borderThickness,
            )}
        {p.style !== "printed-fit" &&
          rect(
            "face",
            front + v.cutClearance,
            p.style === "perforated" ? v.base : v.borderThickness,
            end - front - v.cutClearance,
            v.acrylic,
          )}
        {lock ? (
          <>
            <polygon
              {...appearance("body")}
              points={[
                [inner, v.height - v.pvc - v.fitLockOffset - v.fitLockHeight],
                [
                  inner + v.fitLockDepth,
                  v.height - v.pvc - v.fitLockOffset - v.fitLockHeight * 0.75,
                ],
                [
                  inner + v.fitLockDepth,
                  v.height - v.pvc - v.fitLockOffset - v.fitLockHeight * 0.25,
                ],
                [
                  inner + v.fitLockDepth * 0.6,
                  v.height - v.pvc - v.fitLockOffset,
                ],
                [inner, v.height - v.pvc - v.fitLockOffset],
              ]
                .map((pt) => pt.join(","))
                .join(" ")}
            />
            {rect(
              "pvc",
              inner + v.pvcClearance,
              v.height - v.pvc - v.fitLockOffset,
              end - inner - v.pvcClearance,
              v.pvc,
            )}
          </>
        ) : (
          <>
            {rect("back", base, start, v.innerWall, a.baseHeight)}
            {rect(
              "back",
              v.fitBaseType === "inset"
                ? base
                : v.fitBaseType === "rim"
                  ? -v.clearance - v.fitRimWall
                  : 0,
              z,
              v.fitBaseType === "ring-pvc"
                ? base + v.innerWall + v.fitRingWidth
                : end -
                    (v.fitBaseType === "inset"
                      ? base
                      : v.fitBaseType === "rim"
                        ? -v.clearance - v.fitRimWall
                        : 0),
              v.traySheet,
            )}
            {v.fitBaseType === "rim" &&
              rect(
                "back",
                -v.clearance - v.fitRimWall,
                z - v.fitRimHeight,
                v.fitRimWall,
                v.fitRimHeight,
              )}
            {v.fitBaseType === "ring-pvc" &&
              rect(
                "pvc",
                base + v.innerWall + v.pvcClearance,
                z - v.pvc,
                end - base - v.innerWall - v.pvcClearance,
                v.pvc,
              )}
            {v.fitBaseType === "double-channel" && (
              <>
                {rect(
                  "back",
                  base + v.innerWall,
                  z - v.fitChannelFloor,
                  end - base - v.innerWall,
                  v.fitChannelFloor,
                )}
                {rect(
                  "back",
                  base + v.innerWall + v.fitChannelGap,
                  z - v.fitChannelFloor - v.fitChannelHeight,
                  v.secondInnerWall,
                  v.fitChannelHeight,
                )}
              </>
            )}
          </>
        )}
      </g>
      <g fill="var(--muted-foreground)" fontSize="9">
        <text x="199" y="20">
          Frente
        </text>
        <text x="199" y="138">
          Cierre
        </text>
      </g>
    </svg>
  );
}
