import { Box, Layers, Scan, SlidersHorizontal, RotateCcw } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Button } from "./ui/button";
import { Field, FieldLabel, FieldGroup } from "./ui/field";
import { NumberControl, SwitchControl, Section, Choice } from "./Controls";
import { FitBaseEditor } from "./FitBaseEditor";
import { styleDefaults } from "../core/project";
import {
  componentLabel,
  fitAssembly,
  updateFitParameters,
  type FitComponent,
  FIT_BASES,
} from "../core/fit-assembly";
import type { Parameters, Project } from "../core/types";

export interface ComponentInspectionProps {
  component: FitComponent;
  isolated: boolean;
  onComponentChange: (component: FitComponent) => void;
  onIsolatedChange: (isolated: boolean) => void;
}

export function FitComponentEditor(
  props: ComponentInspectionProps & {
    project: Project;
    onChange: (project: Project) => void;
  },
) {
  const p = props.project;
  const v = { ...styleDefaults(p.style), ...p.params };
  return (
    <div className="flex flex-col gap-4">
      <Choice
        label="Construcción de la base"
        value={v.fitBaseType}
        options={
          p.style === "perforated"
            ? FIT_BASES.filter((b) => b.value !== "legacy")
            : FIT_BASES
        }
        onChange={(type) => {
          const params = updateFitParameters(p.style, v, {
            fitBaseType: type as Parameters["fitBaseType"],
          });
          const a = fitAssembly(p.style, params);
          params.fitBaseHeight = Math.max(
            a.baseMin,
            Math.min(a.baseMax, a.baseHeight),
          );
          props.onComponentChange("body");
          props.onIsolatedChange(false);
          props.onChange({ ...p, params });
        }}
      />
      {v.fitBaseType === "legacy" ? (
        <LegacyFitComponentEditor {...props} />
      ) : (
        <FitBaseEditor {...props} />
      )}
    </div>
  );
}

function LegacyFitComponentEditor({
  project: p,
  onChange,
  component,
  isolated,
  onComponentChange,
  onIsolatedChange,
}: ComponentInspectionProps & {
  project: Project;
  onChange: (project: Project) => void;
}) {
  const v = { ...styleDefaults(p.style), ...p.params };
  const assembly = fitAssembly(p.style, v);
  const acrylic = p.style === "acrylic-fit";
  const active = component === "face" && !acrylic ? "body" : component;
  const tabs = [
    { id: "body", label: "Cuerpo", icon: Box },
    { id: "back", label: "Base", icon: Layers },
    ...(acrylic ? [{ id: "face", label: "Acrílico", icon: Scan }] : []),
    { id: "fit", label: "Encastre", icon: SlidersHorizontal },
  ] as const;
  const change = (changes: Partial<Parameters>) =>
    onChange({ ...p, params: updateFitParameters(p.style, v, changes) });
  const n = (
    key: keyof Parameters,
    label: string,
    min: number,
    max: number,
    step = 0.1,
  ) => (
    <NumberControl
      label={label}
      value={v[key] as number}
      min={min}
      max={Math.max(min, max)}
      step={step}
      slider
      onChange={(value) => change({ [key]: value })}
    />
  );
  const label =
    active === "fit" ? "Encastre entre piezas" : componentLabel(p, active);

  return (
    <div className="component-editor">
      <p className="section-caption">
        Elegí una pieza para configurar sus medidas y verla en el montaje.
      </p>
      <Tabs
        className="flex-col"
        value={active}
        onValueChange={(value) => onComponentChange(value as FitComponent)}
      >
        <TabsList aria-label="Componentes de la letra" className="w-full">
          {tabs.map(({ id, label, icon: Icon }) => (
            <TabsTrigger
              key={id}
              value={id}
              className="flex-col gap-1 h-auto py-2 px-1"
            >
              <Icon />
              <span>{label}</span>
            </TabsTrigger>
          ))}
        </TabsList>
        <div className="component-description" aria-live="polite">
          <strong>{label}</strong>
          <p>
            {active === "body"
              ? acrylic
                ? "Pared exterior y apoyo del acrílico."
                : "Pared exterior y frente impreso en una sola pieza."
              : active === "back"
                ? "Base impresa desmontable: fondo y pared interior que encastran por atrás del cuerpo."
                : active === "face"
                  ? "Placa frontal de acrílico para corte. Se introduce por la abertura posterior y descansa sobre el apoyo frontal."
                  : "Ajuste entre cuerpo y base. La holgura se aplica por lado."}
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
          <Section title="Medidas del cuerpo">
            <FieldGroup>
              <NumberControl
                label="Altura del cuerpo"
                value={assembly.bodyHeight}
                min={Math.max(
                  assembly.front + 0.1,
                  assembly.front +
                    assembly.baseHeight +
                    assembly.clearance -
                    v.outerRecess,
                )}
                max={300 - v.outerRecess}
                slider
                onChange={(height) =>
                  change({ height: height + v.outerRecess })
                }
              />
              {n("wall", "Espesor de pared", 1, 5)}
              {acrylic ? (
                <>
                  {n("borderWidth", "Ancho del apoyo frontal", 0, 10)}
                  {n(
                    "borderThickness",
                    "Espesor del apoyo frontal",
                    0.5,
                    Math.min(
                      20,
                      v.height -
                        v.acrylic -
                        assembly.baseHeight -
                        assembly.clearance,
                    ),
                  )}
                </>
              ) : (
                n(
                  "base",
                  "Espesor del frente impreso",
                  0.5,
                  Math.min(
                    20,
                    v.height - assembly.baseHeight - assembly.clearance,
                  ),
                )
              )}
              {n(
                "outerRecess",
                "Retroceso del cuerpo",
                0,
                Math.min(
                  50,
                  v.height - assembly.front - 0.1,
                  assembly.baseHeight + v.clearance,
                ),
              )}
            </FieldGroup>
          </Section>
        </TabsContent>
        <TabsContent value="back">
          <Section
            title="Medidas de la base"
            caption="La altura incluye el fondo. Se conserva al cambiar la altura del cuerpo."
          >
            <FieldGroup>
              <NumberControl
                label="Altura de la base"
                value={assembly.baseHeight}
                min={assembly.baseMin}
                max={Math.max(assembly.baseMin, assembly.baseMax)}
                slider
                onChange={(fitBaseHeight) => change({ fitBaseHeight })}
              />
              {n(
                "traySheet",
                "Espesor del fondo",
                0.5,
                Math.min(10, assembly.baseHeight - 0.1),
              )}
              {n("innerWall", "Espesor de pared de la base", 0.5, 5)}
            </FieldGroup>
          </Section>
        </TabsContent>
        {acrylic && (
          <TabsContent value="face">
            <Section
              title="Placa de acrílico"
              caption="La holgura modifica el tamaño de la placa y su archivo de corte."
            >
              <FieldGroup>
                {n(
                  "acrylic",
                  "Espesor del acrílico",
                  1,
                  Math.min(
                    10,
                    v.height -
                      v.borderThickness -
                      assembly.baseHeight -
                      assembly.clearance,
                  ),
                )}
                {n("cutClearance", "Holgura de acrílico por lado", 0, 2, 0.05)}
              </FieldGroup>
            </Section>
          </TabsContent>
        )}
        <TabsContent value="fit">
          <Section title="Ajuste del montaje">
            <FieldGroup>
              {n(
                "clearance",
                "Holgura del encastre por lado",
                0,
                Math.min(
                  2,
                  (v.height - assembly.front - assembly.baseHeight) /
                    (acrylic ? 1 : 2),
                ),
                0.05,
              )}
            </FieldGroup>
            <p className="section-caption">
              Profundidad del conjunto: {Number(v.height.toFixed(2))} mm. Base
              desmontable: {Number(assembly.baseHeight.toFixed(2))} mm.
            </p>
          </Section>
        </TabsContent>
      </Tabs>
      <Section title="Sección de montaje" defaultOpen={false}>
        <figure className="assembly-preview">
          <FitAssemblyDiagram project={p} component={active} />
          <figcaption>Esquema del cuerpo, la base y el frente.</figcaption>
        </figure>
      </Section>
      {active !== "fit" && (
        <Section title="Vista de la pieza" defaultOpen={false}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="component-color">
                Color de {label.toLowerCase()}
              </FieldLabel>
              <input
                id="component-color"
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
                    ? p.hidden.filter((layer) => layer !== active)
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
        onClick={() => onChange({ ...p, params: styleDefaults(p.style) })}
      >
        <RotateCcw data-icon="inline-start" />
        Restaurar parámetros del modelo
      </Button>
    </div>
  );
}

function FitAssemblyDiagram({
  project: p,
  component,
}: {
  project: Project;
  component: FitComponent;
}) {
  const v = p.params;
  const a = fitAssembly(p.style, v);
  const scale = 105 / Math.max(v.height, 1);
  const y = (z: number) => 16 + z * scale;
  const h = (height: number) => Math.max(1.5, height * scale);
  const appearance = (layer: "body" | "back" | "face") => ({
    fill: p.colors[layer],
    stroke:
      component === layer || (component === "fit" && layer !== "face")
        ? "var(--primary)"
        : "var(--muted-foreground)",
    strokeWidth: component === layer ? 2 : 0.75,
    opacity: component === "fit" || component === layer ? 1 : 0.4,
  });
  return (
    <svg
      viewBox="0 0 250 150"
      role="img"
      aria-label="Sección esquemática del cuerpo, la base y el frente ensamblados"
    >
      <g {...appearance("body")}>
        <rect x="38" y={y(0)} width="18" height={h(a.bodyHeight)} />
        <rect
          x="56"
          y={y(0)}
          width={p.style === "printed-fit" ? 139 : 25}
          height={h(p.style === "printed-fit" ? v.base : v.borderThickness)}
        />
      </g>
      {p.style === "acrylic-fit" && (
        <rect
          {...appearance("face")}
          x="57"
          y={y(v.borderThickness)}
          width="138"
          height={h(v.acrylic)}
        />
      )}
      <g {...appearance("back")}>
        <rect
          x="64"
          y={y(v.height - a.baseHeight)}
          width="14"
          height={h(a.baseHeight)}
        />
        <rect
          x="78"
          y={y(v.height - v.traySheet)}
          width="117"
          height={h(v.traySheet)}
        />
        {v.outerRecess > v.clearance && (
          <rect
            x="38"
            y={y(v.height - v.outerRecess + v.clearance)}
            width="26"
            height={h(v.outerRecess - v.clearance)}
          />
        )}
      </g>
      <g fill="var(--muted-foreground)" fontSize="9">
        <text x="205" y="26">
          Frente
        </text>
        <text x="205" y="123">
          Base
        </text>
      </g>
    </svg>
  );
}
