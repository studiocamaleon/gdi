import { RotateCcw } from "lucide-react";
import {
  NumberControl as Num,
  SwitchControl as Switch,
  Choice,
  Section,
} from "./Controls";
import { FieldGroup } from "./ui/field";
import { Button } from "./ui/button";
import { styleDefaults } from "../core/project";
import type { Parameters, Project } from "../core/types";
import { organicProfile } from "../core/letter-models";
import {
  FitComponentEditor,
  type ComponentInspectionProps,
} from "./FitComponentEditor";
import { isFitStyle } from "../core/fit-assembly";
export function ModelParameters({
  project: p,
  onChange,
  ...inspection
}: {
  project: Project;
  onChange: (p: Project) => void;
} & ComponentInspectionProps) {
  const v = { ...styleDefaults(p.style), ...p.params },
    id = p.style;
  const change = <K extends keyof Parameters>(k: K, x: Parameters[K]) =>
    onChange({ ...p, params: { ...v, [k]: x } });
  const n = (
    key: keyof Parameters,
    label: string,
    min: number,
    max: number,
    unit = "mm",
    step = 0.1,
  ) => (
    <Num
      key={key}
      label={label}
      value={v[key] as number}
      min={min}
      max={max}
      unit={unit}
      step={step}
      slider
      onChange={(x) => change(key, x as never)}
    />
  );
  const b = (key: keyof Parameters, label: string, description?: string) => (
    <Switch
      key={key}
      label={label}
      value={v[key] as boolean}
      description={description}
      onChange={(x) => change(key, x as never)}
    />
  );
  const choice = (
    key: keyof Parameters,
    label: string,
    options: [string, string][],
  ) => (
    <Choice
      key={key}
      label={label}
      value={String(v[key])}
      options={options.map(([value, label]) => ({ value, label }))}
      onChange={(x) => change(key, x as never)}
    />
  );
  const supports = (
    <>
      {n("ledge", "Ancho del apoyo", 0.5, 5)}
      {n("supportAngle", "Ángulo del apoyo", 25, 60, "°", 1)}
      {b("flatSupport", "Apoyo plano")}
    </>
  );
  const standard = ["solid-back", "open-back", "double-led"].includes(id);
  if (isFitStyle(id))
    return (
      <FitComponentEditor project={p} onChange={onChange} {...inspection} />
    );
  return (
    <>
      {standard && (
        <Section title="Cuerpo y frente">
          <FieldGroup>
            {id !== "open-back" &&
              n("base", "Espesor del fondo impreso", 0.5, 20)}
            {n("wall", "Pared exterior", 1, 5)}
            {n(
              "innerWall",
              "Pared interior de apoyo",
              id === "open-back" ? 0 : 0.5,
              5,
            )}
            {n("height", "Altura de la pared", 0, 150)}
            {n(
              "acrylic",
              "Espesor del acrílico",
              id === "double-led" ? 1 : 0,
              id === "double-led" ? 10 : 150,
            )}
            {id === "double-led" && (
              <>
                {n("gap", "Distancia entre paredes", 1, 30)}
                {n("secondInnerWall", "Segunda pared interior", 0.5, 5)}
              </>
            )}
            {id === "open-back" && n("pvc", "Espesor del fondo de PVC", 0, 20)}
          </FieldGroup>
        </Section>
      )}
      {["double-support", "single-support"].includes(id) && (
        <>
          <Section title="Cuerpo y materiales">
            <FieldGroup>
              {n("acrylic", "Espesor del acrílico", 1, 10)}
              {id === "double-support"
                ? n("pvc", "Espesor del PVC", 0, 20)
                : n("base", "Espesor del fondo impreso", 0.5, 20)}
              {n("wall", "Pared exterior", 1, 5)}
              {n("height", "Altura de la pared exterior", 10, 150)}
            </FieldGroup>
          </Section>
          <Section
            title={
              id === "double-support"
                ? "Apoyos de frente y fondo"
                : "Apoyo del frente"
            }
          >
            <FieldGroup>{supports}</FieldGroup>
          </Section>
        </>
      )}
      {id === "back-fit" && (
        <Section title="Borde y encastre posterior">
          <FieldGroup>
            {n("borderWidth", "Ancho del borde frontal", 0, 10)}
            {n("borderThickness", "Espesor del borde frontal", 0.5, 20)}
            {n("wall", "Pared exterior", 1, 5)}
            {n("innerWall", "Pared interior de apoyo", 0, 5)}
            {n("height", "Altura de la pared", 0, 150)}
            {n("pvc", "Espesor del PVC", 0, 50)}
          </FieldGroup>
        </Section>
      )}
      {id === "halo" && (
        <>
          <Section title="Iluminación posterior">
            <FieldGroup>
              <Switch
                label="Doble pared"
                value={v.doubleHalo}
                onChange={(x) =>
                  onChange({
                    ...p,
                    params: {
                      ...v,
                      doubleHalo: x,
                      wall: x ? 3 : 4,
                      innerWall: 3,
                    },
                  })
                }
              />
              {n("base", "Espesor de la cara impresa", 0.5, 10)}
              {n("wall", "Espesor de la pared exterior", 1, 12)}
              {v.doubleHalo ? (
                <>
                  {n("outerHeight", "Altura de la pared exterior", 5, 80)}
                  {n("gap", "Espacio entre paredes", 0.5, 20)}
                  {n("innerWall", "Espesor de la pared interior", 1, 12)}
                  {n("height", "Altura de la pared interior", 5, 80)}
                </>
              ) : (
                n("height", "Altura de la pared", 5, 80)
              )}
            </FieldGroup>
          </Section>
          {v.doubleHalo && (
            <>
              <Section title="Aristas y fondo">
                <FieldGroup>
                  {choice("corner", "Terminación de aristas", [
                    ["Round", "Redondeada"],
                    ["Miter", "Recta"],
                    ["Bevel", "Chaflán"],
                  ])}
                  {v.corner !== "Miter" &&
                    n("cornerRadius", "Radio de la arista", 0, 3)}
                  {b("backTray", "Bandeja trasera a presión")}
                </FieldGroup>
              </Section>
              {v.backTray && (
                <Section title="Encastre de bandeja">
                  <FieldGroup>
                    {n("trayDepth", "Espesor del encastre", 1, 5)}
                    {n("clearance", "Holgura por lado", 0, 0.5, "mm", 0.05)}
                    {n("retention", "Retención del encastre", 0.2, 1.5)}
                    {n("trayWall", "Ancho del borde de bandeja", 1.5, 15)}
                    {n("traySheet", "Espesor de chapa de bandeja", 0.6, 3)}
                  </FieldGroup>
                </Section>
              )}
            </>
          )}
        </>
      )}
      {id === "curved" && (
        <>
          <Section title="Barrido angular">
            <FieldGroup>
              {n("curveAngle", "Extrusión angular", 10, 360, "°", 1)}
              {n("curveRadius", "Radio", 10, 400)}
              {n("curveCenter", "Centro de rotación", -500, 500)}
              {n("curveSegments", "Segmentos", 20, 128, "", 1)}
              {b("curveBase", "Base de apoyo")}
            </FieldGroup>
          </Section>
          {v.curveBase && (
            <>
              <Section title="Dimensiones de la base">
                <FieldGroup>
                  {n("curveBaseThickness", "Espesor de la base", 1, 100)}
                  {n("curveSide", "Margen lateral", 0, 300)}
                  {n("curveDepth", "Margen de profundidad", 0, 200)}
                  {n("curveAdvance", "Avance frontal", 0, 300)}
                  {n("curveBaseRadius", "Radio de las esquinas", 0, 100)}
                  {b("curveSeparate", "Base desmontable")}
                </FieldGroup>
              </Section>
              {v.curveSeparate && (
                <Section title="Montaje de la letra">
                  <FieldGroup>
                    {n("curveFitDepth", "Profundidad del encastre", 1, 80)}
                    {n(
                      "curveFitClearance",
                      "Holgura del encastre",
                      0,
                      3,
                      "mm",
                      0.05,
                    )}
                  </FieldGroup>
                </Section>
              )}
            </>
          )}
        </>
      )}
      {id === "neon" && (
        <>
          <Section title="Canal para neón">
            <FieldGroup>
              {n("height", "Altura de la pared", 1, 60)}
              {n("base", "Espesor del fondo", 0.5, 20)}
              {n("wall", "Espesor de la pared", 0.5, 10)}
              {b("neonOutline", "Modo contorno")}
              {v.neonOutline && n("neonWidth", "Ancho del canal", 0.5, 100)}
            </FieldGroup>
          </Section>
          <Section title="Trabas de retención">
            <FieldGroup>
              {n("neonPosition", "Posición de la traba", 0, 40)}
              {n("neonRetention", "Profundidad de la traba", 0, 8)}
              {n("neonRetentionHeight", "Altura de la traba", 0.4, 20)}
            </FieldGroup>
          </Section>
        </>
      )}
      {id === "organic" && (
        <>
          <Section title="Perfil de la pared">
            <FieldGroup>
              {choice("organicProfile", "Forma del perfil", [
                ["zigzag", "Zigzag"],
                ["belly", "Barriga cóncava / convexa"],
                ["pedestal", "Pedestal · curva S"],
                ["waves", "Ondas"],
                ["bumper", "Bumper"],
                ["bubble", "Bubble"],
                ["stack", "Frisos · Stack"],
              ])}
              {v.organicProfile === "zigzag" && (
                <>
                  {n("organicAmplitude", "Amplitud", 0.5, 15)}
                  {n("organicPeriod", "Período", 2, 40)}
                </>
              )}
              {v.organicProfile === "belly" &&
                n("organicBelly", "Profundidad de la barriga", -15, 15)}
              {v.organicProfile === "pedestal" && (
                <>
                  {n("organicExpansion", "Apertura de la base", 0.5, 20)}
                  {n("organicCurvature", "Curvatura", 0, 100, "%", 1)}
                </>
              )}
              {v.organicProfile === "waves" && (
                <>
                  {n("organicWaveAmplitude", "Amplitud de onda", 0.5, 12)}
                  {n("organicWavePeriod", "Período de onda", 2, 40)}
                  {n("organicWaveShape", "Forma de onda", 0, 100, "%", 1)}
                </>
              )}
              {v.organicProfile === "bumper" && (
                <>
                  {n("organicBumper", "Avance del pie", 0.5, 20)}
                  {n("organicFoot", "Altura recta del pie", 0, 60)}
                  {b("organicCloseBase", "Cerrar el pie en la base")}
                </>
              )}
              {v.organicProfile === "bubble" && (
                <>
                  {n("organicBubble", "Redondeo", 0, 100, "%", 1)}
                  {n("organicRadius", "Radio del hombro", 1, 40)}
                </>
              )}
              {v.organicProfile === "stack" && (
                <>
                  {n("organicCount", "Cantidad de frisos", 1, 6, "", 1)}
                  {n("organicStackAdvance", "Avance del friso", 0.3, 6)}
                  {n("organicStackGap", "Espacio entre frisos", 0, 30)}
                  {b("organicCloseBase", "Cerrar la base a 45°")}
                </>
              )}
              {n("organicSlant", "Inclinación", 0, 20)}
              {n("organicAngle", "Ángulo máximo", 30, 60, "°", 1)}
              {n("height", "Altura del cuerpo", 5, 120)}
              {!v.organicSolid && n("wall", "Espesor de la pared", 0.8, 10)}
              <Switch
                label="Letra maciza"
                value={v.organicSolid}
                onChange={(x) =>
                  onChange({
                    ...p,
                    params: { ...v, organicSolid: x, mirror: x },
                  })
                }
              />
            </FieldGroup>
            <OrganicDiagram params={v} />
          </Section>
          {!v.organicSolid && (
            <>
              <Section title="Frente">
                <FieldGroup>
                  {v.organicFit !== "back" &&
                    choice("organicFace", "Material del frente", [
                      ["acrylic", "Acrílico"],
                      ["printed", "Impreso independiente"],
                    ])}
                  <Choice
                    label="Fijación del frente"
                    value={v.organicFit}
                    options={[
                      { value: "front", label: "Desde el frente" },
                      { value: "back", label: "Desde atrás" },
                    ]}
                    onChange={(x) =>
                      onChange({
                        ...p,
                        params: {
                          ...v,
                          organicFit: x as Parameters["organicFit"],
                          mirror: x === "back",
                          organicFace: x === "back" ? "acrylic" : v.organicFace,
                        },
                      })
                    }
                  />
                  {n("acrylic", "Espesor del frente", 1, 10)}
                  {n("clearance", "Holgura del frente", 0, 2, "mm", 0.05)}
                  {v.organicFace === "printed" && v.organicFit !== "back" && (
                    <>
                      {n("organicFaceAdvance", "Avance del frente", 0, 10)}
                      {choice("organicFaceCorner", "Arista del frente", [
                        ["straight", "Recta"],
                        ["chamfer", "Chaflán"],
                        ["round", "Redondeada"],
                      ])}
                      {v.organicFaceCorner !== "straight" &&
                        n("organicFaceRadius", "Tamaño de la arista", 0.2, 5)}
                      {b("organicShell", "Frente en cascarón")}
                      {v.organicShell &&
                        n(
                          "organicShellThickness",
                          "Espesor del cascarón",
                          0.8,
                          5,
                        )}
                    </>
                  )}
                </FieldGroup>
              </Section>
              <Section
                title={v.organicFit === "back" ? "Borde frontal" : "Apoyos"}
              >
                <FieldGroup>
                  {v.organicFit === "back" ? (
                    <>
                      {n("borderWidth", "Ancho del borde frontal", 0.5, 10)}
                      {n(
                        "borderThickness",
                        "Espesor del borde frontal",
                        0.5,
                        10,
                      )}
                    </>
                  ) : (
                    supports
                  )}
                </FieldGroup>
              </Section>
              <Section title="Fondo">
                <FieldGroup>
                  {choice("organicBack", "Material del fondo", [
                    ["printed", "Impreso"],
                    ["pvc", "PVC"],
                  ])}
                  {v.organicBack === "printed" ? (
                    v.organicFit === "back" ? (
                      <>
                        {n("organicCapSheet", "Chapa de la tapa", 0.6, 5)}
                        {n(
                          "organicCapHeight",
                          "Altura de paredes de la tapa",
                          2,
                          30,
                        )}
                        {n(
                          "organicCapWall",
                          "Espesor de paredes de la tapa",
                          0.8,
                          5,
                        )}
                        {n(
                          "organicCapClearance",
                          "Holgura de la tapa",
                          0,
                          1,
                          "mm",
                          0.05,
                        )}
                      </>
                    ) : (
                      n("base", "Espesor del fondo", 0.6, 10)
                    )
                  ) : (
                    <>
                      {n("pvc", "Espesor del PVC", 1, 20)}
                      {n("pvcClearance", "Holgura del PVC", 0, 2, "mm", 0.05)}
                      {v.organicFit === "back" && (
                        <>
                          {b("organicPvcSupport", "Apoyo para el PVC")}
                          {v.organicPvcSupport && (
                            <>
                              {n("ledge", "Ancho del apoyo", 0.5, 5)}
                              {n(
                                "supportAngle",
                                "Ángulo del apoyo",
                                25,
                                60,
                                "°",
                                1,
                              )}
                            </>
                          )}
                        </>
                      )}
                    </>
                  )}
                </FieldGroup>
              </Section>
            </>
          )}
        </>
      )}
      <Section title="Orientación y fabricación">
        <FieldGroup>
          {b("mirror", "Espejar geometría")}
          {[
            "solid-back",
            "open-back",
            "double-support",
            "single-support",
          ].includes(id) && (
            <>
              {b("lipEnabled", "Pestaña de fijación exterior")}
              {v.lipEnabled && (
                <>
                  {n("lipHeight", "Altura de pestaña", 0.8, 5)}
                  {n("lip", "Ancho de pestaña", 0.8, 20)}
                </>
              )}
            </>
          )}
          {!["curved", "neon", "halo", "organic", "printed-fit"].includes(id) &&
            n(
              "cutClearance",
              "Reducción para archivos de corte",
              0,
              2,
              "mm",
              0.05,
            )}
        </FieldGroup>
      </Section>
      <Button
        variant="ghost"
        onClick={() => onChange({ ...p, params: styleDefaults(id) })}
      >
        <RotateCcw data-icon="inline-start" />
        Restaurar parámetros del modelo
      </Button>
    </>
  );
}
function OrganicDiagram({ params }: { params: Parameters }) {
  const { levels } = organicProfile(params),
    H = levels.at(-1)!.z,
    scale = 140 / Math.max(H, 1);
  const outer = levels.map(
    (l) => `${90 + l.offset * scale},${155 - l.z * scale}`,
  );
  const inner = [...levels]
    .reverse()
    .map(
      (l) => `${90 + (l.offset - params.wall) * scale},${155 - l.z * scale}`,
    );
  return (
    <svg
      viewBox="0 0 190 175"
      className="w-full h-44 mt-5"
      aria-label="Sección del perfil de pared"
      role="img"
    >
      <text x="10" y="14" fill="currentColor" fontSize="10">
        Frente
      </text>
      <polygon
        points={[...outer, ...inner].join(" ")}
        fill="var(--primary)"
        fillOpacity=".15"
        stroke="currentColor"
        strokeWidth="1"
      />
      <text x="10" y="164" fill="currentColor" fontSize="10">
        Fondo
      </text>
    </svg>
  );
}
