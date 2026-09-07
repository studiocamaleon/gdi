import { useRef, useState } from "react";
import {
  Plus,
  Trash2,
  Eye,
  EyeOff,
  BookmarkPlus,
  RotateCcw,
  Download,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { FieldGroup, Field, FieldLabel } from "./ui/field";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Alert, AlertDescription } from "./ui/alert";
import {
  NumberControl as Num,
  SwitchControl as Switch,
  Choice,
  Section,
} from "./Controls";
import { styleDefaults, DEFAULT_JOINT } from "../core/project";
import { ModelParameters } from "./ModelParameters";
import type { ComponentInspectionProps } from "./FitComponentEditor";
import { componentLabel } from "../core/fit-assembly";
import { download } from "../core/output";
import { parseJoint } from "../core/storage";
import type {
  Project,
  Parameters,
  Layer,
  Feature,
  Model,
  JointParameters,
} from "../core/types";
export type ToolPanel =
  "parameters" | "layers" | "holes" | "pins" | "cuts" | "presets" | "joint";
interface Props extends ComponentInspectionProps {
  project: Project;
  model: Model | null;
  panel: ToolPanel;
  selected: string | null;
  onChange: (p: Project) => void;
  onSelect: (id: string) => void;
  onPlaceCenter: () => void;
}
export function Inspector({
  project: p,
  model,
  panel,
  selected,
  onChange,
  onSelect,
  onPlaceCenter,
  ...inspection
}: Props) {
  const change = <K extends keyof Parameters>(k: K, v: Parameters[K]) =>
    onChange({ ...p, params: { ...p.params, [k]: v } });
  const [presetName, setPresetName] = useState("Mi configuración");
  const [presets, setPresets] = useState<
    { name: string; params: Parameters; style: Project["style"] }[]
  >(() => {
    try {
      return JSON.parse(localStorage.getItem("forma.presets") || "[]");
    } catch {
      return [];
    }
  });
  const [axis, setAxis] = useState<"x" | "y">("x"),
    [cutAt, setCutAt] = useState(100),
    [gap, setGap] = useState(0.2);
  const feature = p.features.find((f) => f.id === selected);
  const update = (data: Partial<Feature>) =>
    onChange({
      ...p,
      features: p.features.map((f) =>
        f.id === selected ? { ...f, ...data } : f,
      ),
    });
  if (panel === "joint")
    return <JointInspector project={p} onChange={onChange} />;
  if (panel === "layers")
    return (
      <>
        <Section
          title="Componentes del modelo"
          caption="Colores de vista previa y visibilidad."
        >
          <div className="layer-list">
            {(
              [...new Set(model?.parts.map((m) => m.layer) || [])] as Layer[]
            ).map((layer) => (
              <div className="layer-row" key={layer}>
                <input
                  aria-label={`Color de ${componentLabel(p, layer)}`}
                  type="color"
                  value={p.colors[layer]}
                  onChange={(e) =>
                    onChange({
                      ...p,
                      colors: { ...p.colors, [layer]: e.target.value },
                    })
                  }
                />
                <div>
                  <strong>{componentLabel(p, layer)}</strong>
                  <small>
                    {model?.parts.filter((m) => m.layer === layer).length}{" "}
                    piezas
                  </small>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`${p.hidden.includes(layer) ? "Mostrar" : "Ocultar"} ${componentLabel(p, layer)}`}
                  onClick={() =>
                    onChange({
                      ...p,
                      hidden: p.hidden.includes(layer)
                        ? p.hidden.filter((x) => x !== layer)
                        : [...p.hidden, layer],
                    })
                  }
                >
                  {p.hidden.includes(layer) ? <EyeOff /> : <Eye />}
                </Button>
              </div>
            ))}
          </div>
        </Section>
        <Section title="Terminación">
          <Switch
            label="Revestimiento interior"
            value={p.params.liner}
            onChange={(v) => change("liner", v)}
            description="Agrega una lámina interior de 0,6 mm para imprimir en blanco."
          />
        </Section>
      </>
    );
  if (panel === "holes" || panel === "pins")
    return (
      <>
        <Section
          title={panel === "holes" ? "Perforaciones" : "Pines de fijación"}
          caption="Hacé clic sobre el modelo para agregar. Arrastrá un marcador o ajustá sus coordenadas."
        >
          <Button variant="outline" onClick={onPlaceCenter}>
            <Plus data-icon="inline-start" />
            Agregar en el centro
          </Button>
          {panel === "pins" && (
            <FieldGroup>
              <Num
                label="Diámetro del pin"
                value={p.params.pinDiameter}
                onChange={(v) => change("pinDiameter", v)}
                min={2}
                max={50}
              />
              <Num
                label="Altura (0 = automática)"
                value={p.params.pinHeight}
                onChange={(v) => change("pinHeight", v)}
                max={200}
              />
              <Num
                label="Agujero central (0 = macizo)"
                value={p.params.pinHole}
                onChange={(v) => change("pinHole", v)}
                max={p.params.pinDiameter - 1}
              />
            </FieldGroup>
          )}
          <div className="feature-list">
            {p.features
              .filter((f) => f.type === (panel === "holes" ? "hole" : "pin"))
              .map((f, i) => (
                <div className="feature-row" key={f.id}>
                  <Button
                    variant={selected === f.id ? "secondary" : "ghost"}
                    onClick={() => onSelect(f.id)}
                  >
                    {panel === "holes" ? "Perforación" : "Pin"} {i + 1}
                    <small>
                      {f.x.toFixed(1)}, {f.y.toFixed(1)}
                    </small>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Eliminar fijación"
                    onClick={() =>
                      onChange({
                        ...p,
                        features: p.features.filter((x) => x.id !== f.id),
                      })
                    }
                  >
                    <Trash2 />
                  </Button>
                </div>
              ))}
          </div>
          {feature && (
            <FieldGroup>
              <Num
                label="Posición X"
                value={feature.x}
                min={-3000}
                max={3000}
                onChange={(v) => update({ x: v })}
              />
              <Num
                label="Posición Y"
                value={feature.y}
                min={-3000}
                max={3000}
                onChange={(v) => update({ y: v })}
              />
              {feature.type === "hole" && (
                <>
                  <Choice
                    label="Forma del agujero"
                    value={feature.shape}
                    options={[
                      { value: "circle", label: "Circular" },
                      { value: "slot", label: "Rectángulo / oblongo" },
                    ]}
                    onChange={(v) => update({ shape: v as Feature["shape"] })}
                  />
                  {feature.shape === "circle" ? (
                    <Num
                      label="Diámetro"
                      value={feature.diameter}
                      min={0.5}
                      max={100}
                      onChange={(v) => update({ diameter: v })}
                    />
                  ) : (
                    <>
                      <Num
                        label="Ancho"
                        value={feature.width}
                        min={1}
                        max={100}
                        onChange={(v) => update({ width: v })}
                      />
                      <Num
                        label="Alto"
                        value={feature.height}
                        min={1}
                        max={100}
                        onChange={(v) => update({ height: v })}
                      />
                      <Num
                        label="Radio"
                        value={feature.radius}
                        max={Math.min(feature.width, feature.height) / 2}
                        onChange={(v) => update({ radius: v })}
                      />
                    </>
                  )}
                </>
              )}
            </FieldGroup>
          )}
        </Section>
        <p className="fine-note">
          Esc vuelve a la órbita. Supr elimina la fijación seleccionada.
        </p>
      </>
    );
  if (panel === "cuts")
    return (
      <>
        <Section
          title="Dividir para imprimir"
          caption="Cortes planos cerrados. Las secciones se exportan como sólidos independientes."
        >
          <FieldGroup>
            <Choice
              label="Dirección"
              value={axis}
              options={[
                { value: "x", label: "Vertical · eje X" },
                { value: "y", label: "Horizontal · eje Y" },
              ]}
              onChange={(v) => setAxis(v as "x" | "y")}
            />
            <Num
              label="Posición del corte"
              value={cutAt}
              max={3000}
              onChange={setCutAt}
            />
            <Num label="Separación" value={gap} max={5} onChange={setGap} />
            <Button
              variant="outline"
              onClick={() =>
                onChange({
                  ...p,
                  cuts: [
                    ...p.cuts,
                    { id: crypto.randomUUID(), axis, at: cutAt, gap },
                  ],
                })
              }
            >
              <Plus data-icon="inline-start" />
              Agregar corte
            </Button>
          </FieldGroup>
          <div className="feature-list">
            {p.cuts.map((c, i) => (
              <div className="feature-row" key={c.id}>
                <span>
                  Corte {i + 1} · {c.axis.toUpperCase()} {c.at} mm
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Eliminar corte ${i + 1}`}
                  onClick={() =>
                    onChange({
                      ...p,
                      cuts: p.cuts.filter((x) => x.id !== c.id),
                    })
                  }
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
          </div>
        </Section>
      </>
    );
  if (panel === "presets")
    return (
      <>
        <Section
          title="Mis predefiniciones"
          caption="Guardadas en este navegador. El proyecto conserva la configuración aplicada."
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="preset-name">Nombre</FieldLabel>
              <Input
                id="preset-name"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
              />
            </Field>
            <Button
              variant="outline"
              onClick={() => {
                const next = [
                  {
                    name: presetName.trim() || "Configuración",
                    params: p.params,
                    style: p.style,
                  },
                  ...presets,
                ].slice(0, 30);
                localStorage.setItem("forma.presets", JSON.stringify(next));
                setPresets(next);
                toast.success("Predefinición guardada");
              }}
            >
              <BookmarkPlus data-icon="inline-start" />
              Guardar configuración
            </Button>
          </FieldGroup>
          {presets.map((v, i) => (
            <div className="preset-row" key={i}>
              <Button
                variant="ghost"
                onClick={() =>
                  onChange({
                    ...p,
                    style: v.style,
                    params: { ...styleDefaults(v.style), ...v.params },
                  })
                }
              >
                {v.name}
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Eliminar predefinición"
                onClick={() => {
                  const n = presets.filter((_, idx) => idx !== i);
                  localStorage.setItem("forma.presets", JSON.stringify(n));
                  setPresets(n);
                }}
              >
                <Trash2 />
              </Button>
            </div>
          ))}
        </Section>
      </>
    );
  return <ModelParameters project={p} onChange={onChange} {...inspection} />;
}

const jointGroups: {
  title: string;
  keys: [keyof JointParameters, string, number, number][];
}[] = [
  {
    title: "Esfera y ajuste",
    keys: [
      ["ball", "Diámetro de esfera", 6, 40],
      ["clearance", "Holgura diametral", 0, 2],
      ["retention", "Retención", 0, 2],
      ["chamfer", "Entrada biselada", 0.2, 5],
    ],
  },
  {
    title: "Base del perno",
    keys: [
      ["flangeLength", "Largo", 20, 100],
      ["flangeWidth", "Ancho", 15, 80],
      ["flangeHeight", "Espesor", 2, 10],
      ["flangeRadius", "Radio de esquina", 0, 15],
      ["screw", "Fijaciones Ø", 2, 8],
      ["screwSpacing", "Separación de tornillos", 10, 75],
      ["recess", "Rebaje Ø", 4, 15],
      ["recessDepth", "Profundidad de rebaje", 0, 5],
      ["centralHole", "Agujero central Ø", 0, 10],
      ["notch", "Muesca lateral Ø", 0, 12],
    ],
  },
  {
    title: "Cuerpo y punta",
    keys: [
      ["baseDiameter", "Base cilíndrica Ø", 8, 35],
      ["baseHeight", "Altura de base", 2, 20],
      ["neck", "Cuello Ø", 3, 25],
      ["neckHeight", "Altura del cuello", 1, 20],
      ["fillet", "Refuerzo del cuello", 0, 5],
      ["flatTop", "Plano superior Ø", 0, 30],
      ["tipDiameter", "Base de la punta Ø", 2, 15],
      ["tipAngle", "Ángulo de punta", 30, 120],
    ],
  },
  {
    title: "Alojamiento",
    keys: [
      ["socketHeight", "Altura", 10, 60],
      ["socketTop", "Diámetro superior", 12, 50],
      ["socketBottom", "Diámetro inferior", 10, 45],
      ["socketScrew", "Agujero de tornillo", 2, 10],
      ["countersink", "Avellanado Ø", 4, 15],
      ["socketFlange", "Pestaña de apoyo Ø", 15, 60],
      ["socketFlangeHeight", "Altura de pestaña", 1, 10],
    ],
  },
  {
    title: "Ranuras y flexibilidad",
    keys: [
      ["slots", "Cantidad de ranuras", 0, 12],
      ["slotWidth", "Ancho de ranura", 0.5, 5],
      ["slotLength", "Largo de ranura", 5, 40],
      ["fingerThin", "Espesor flexible", 1, 5],
      ["tilt", "Inclinación de impresión", 0, 60],
    ],
  },
];
function JointInspector({
  project: p,
  onChange,
}: {
  project: Project;
  onChange: (p: Project) => void;
}) {
  const file = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={file}
        hidden
        type="file"
        accept=".json"
        onChange={async (event) => {
          const input = event.target,
            selected = input.files?.[0];
          if (!selected) return;
          try {
            if (selected.size > 100000)
              throw new Error("El archivo supera el tamaño permitido.");
            onChange({
              ...p,
              joint: parseJoint(JSON.parse(await selected.text())),
            });
            toast.success("Encastre cargado");
          } catch (error) {
            toast.error(
              error instanceof Error
                ? error.message
                : "No se pudo abrir el encastre.",
            );
          }
          input.value = "";
        }}
      />
      <Button variant="outline" onClick={() => file.current?.click()}>
        <Upload data-icon="inline-start" />
        Abrir configuración JSON
      </Button>
      {jointGroups.map((g, i) => (
        <Section key={g.title} title={g.title} defaultOpen={i === 0}>
          <FieldGroup>
            {g.keys.map(([key, label, min, max]) => (
              <Num
                key={key}
                label={label}
                min={min}
                max={max}
                step={key === "slots" ? 1 : 0.1}
                unit={
                  key === "slots"
                    ? "u."
                    : key === "tilt" || key === "tipAngle"
                      ? "°"
                      : "mm"
                }
                value={p.joint[key] as number}
                onChange={(v) =>
                  onChange({ ...p, joint: { ...p.joint, [key]: v } })
                }
              />
            ))}
          </FieldGroup>
        </Section>
      ))}
      <Section title="Opciones">
        <Switch
          label="Muescas de fijación"
          value={p.joint.notches}
          onChange={(v) =>
            onChange({ ...p, joint: { ...p.joint, notches: v } })
          }
        />
        <Switch
          label="Alivio de raíz"
          value={p.joint.rootRelief}
          onChange={(v) =>
            onChange({ ...p, joint: { ...p.joint, rootRelief: v } })
          }
        />
      </Section>
      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={() =>
            download(
              JSON.stringify(p.joint, null, 2),
              "encastre.json",
              "application/json",
            )
          }
        >
          <Download data-icon="inline-start" />
          JSON
        </Button>
        <Button
          variant="ghost"
          onClick={() => onChange({ ...p, joint: { ...DEFAULT_JOINT } })}
        >
          <RotateCcw data-icon="inline-start" />
          Restaurar
        </Button>
      </div>
      <Alert>
        <AlertDescription>
          El ajuste se valida con una muestra impresa. La flexión calculada es
          orientativa y no sustituye una prueba mecánica.
        </AlertDescription>
      </Alert>
    </>
  );
}
