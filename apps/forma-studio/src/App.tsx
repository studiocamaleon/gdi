import { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Type,
  Upload,
  Download,
  Layers,
  SlidersHorizontal,
  Bookmark,
  Scissors,
  CircleDot,
  Move3D,
  Maximize,
  Grid2X2,
  RotateCcw,
  Undo2,
  Redo2,
  Save,
  FolderOpen,
  Plus,
  ArrowRight,
  Check,
  ChevronRight,
  HelpCircle,
  Sun,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  FileText,
  Package,
  Clock,
  MousePointer2,
  Link2,
  LoaderCircle,
  X,
  Settings2,
} from "lucide-react";
import { toast, Toaster } from "sonner";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Badge } from "./components/ui/badge";
import { Field, FieldLabel, FieldGroup } from "./components/ui/field";
import { ToggleGroup, ToggleGroupItem } from "./components/ui/toggle-group";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./components/ui/dialog";
import { Alert, AlertDescription } from "./components/ui/alert";
import { Choice, NumberControl } from "./components/Controls";
import { Inspector, type ToolPanel } from "./components/Inspector";
import {
  Viewport,
  type CameraView,
  type JointView,
} from "./components/Viewport";
import { Production } from "./components/Production";
import { LightboxEditor, LightboxOverview } from "./components/LightboxEditor";
import { lightboxProject } from "./core/lightbox";
import { newProject, chooseStyle, STYLES } from "./core/project";
import {
  contoursFromSource,
  FONT_NAMES,
  physicalHeight,
  parseSvg,
} from "./core/source";
import {
  saveProject,
  savedProjects,
  parseProject,
  history,
  addRecord,
} from "./core/storage";
import {
  bundle,
  download,
  stl,
  dxf,
  svgContours,
  technicalPdf,
  costs,
} from "./core/output";
import type { Project, Model, Source, Feature, Layer } from "./core/types";
import { cn } from "./lib/utils";
import {
  isFitStyle,
  componentLabel,
  type FitComponent,
} from "./core/fit-assembly";

function StylePreview({ id }: { id: string }) {
  return (
    <div className="style-preview" aria-hidden="true">
      <img
        src={`/style-previews/${id}.png`}
        alt=""
        width={512}
        height={384}
        decoding="async"
        draggable={false}
      />
    </div>
  );
}
const tools: { panel: ToolPanel; name: string; icon: typeof Layers }[] = [
  { panel: "parameters", name: "Parámetros", icon: SlidersHorizontal },
  { panel: "layers", name: "Capas", icon: Layers },
  { panel: "holes", name: "Perforaciones", icon: CircleDot },
  { panel: "pins", name: "Pines", icon: Plus },
  { panel: "cuts", name: "Cortes", icon: Scissors },
  { panel: "presets", name: "Predefiniciones", icon: Bookmark },
];
export default function App() {
  const [project, setProject] = useState<Project>(() => {
    try {
      const p = localStorage.getItem("forma.autosave");
      return p ? parseProject(JSON.parse(p)) : newProject();
    } catch {
      return newProject();
    }
  });
  const [model, setModel] = useState<Model | null>(null),
    [modelScope, setModelScope] = useState(""),
    [busy, setBusy] = useState(true),
    [error, setError] = useState("");
  const [page, setPage] = useState("design"),
    [panel, setPanel] = useState<ToolPanel>("parameters"),
    [sourceTab, setSourceTab] = useState(project.source.mode);
  const [explode, setExplode] = useState(0),
    [grid, setGrid] = useState(true),
    [view, setView] = useState<CameraView>("iso"),
    [jointView, setJointView] = useState<JointView>("separated"),
    [fit, setFit] = useState(0),
    [selected, setSelected] = useState<string | null>(null),
    [leftOpen, setLeftOpen] = useState(true);
  const [exportOpen, setExportOpen] = useState(false),
    [helpOpen, setHelpOpen] = useState(false),
    [dark, setDark] = useState(false),
    [refresh, setRefresh] = useState(0),
    [exportLayer, setExportLayer] = useState("all");
  const mode = project.mode;
  const printEstimate = useMemo(
    () => model ? costs(project, model) : null,
    [model, project.production],
  );
  const [component, setComponent] = useState<FitComponent>("body");
  const [boxComponent,setBoxComponent]=useState<Layer>("boxBody");
  const [boxSection,setBoxSection]=useState(false);
  const [isolated, setIsolated] = useState(false);
  const inspectComponents =
    mode === "letters" && isFitStyle(project.style) && panel === "parameters";
  const focusedLayer = mode === "lightbox" ? boxComponent :
    inspectComponents &&
    component !== "fit" &&
    !(component === "face" && project.style === "printed-fit")
      ? component
      : null;
  useEffect(() => {
    setComponent("body");
    setIsolated(false);
    setBoxSection(false);
  }, [project.id, project.style, project.params.fitBaseType, mode]);
  useEffect(() => setExportLayer("all"), [model]);
  const fileRef = useRef<HTMLInputElement>(null),
    projectFile = useRef<HTMLInputElement>(null);
  const undo = useRef<Project[]>([]),
    redo = useRef<Project[]>([]),
    request = useRef(0),
    current = useRef(project);
  current.current = project;
  const update = (next: Project) => {
    undo.current = [...undo.current.slice(-39), current.current];
    redo.current = [];
    setProject({ ...next, updatedAt: new Date().toISOString() });
  };
  const revert = (direction: "undo" | "redo") => {
    const from = direction === "undo" ? undo : redo,
      to = direction === "undo" ? redo : undo;
    const prior = from.current.pop();
    if (prior) {
      to.current.push(current.current);
      setProject(prior);
    }
  };
  const save = () => {
    try {
      const saved = saveProject(current.current);
      setProject(saved);
      setRefresh((v) => v + 1);
      toast.success("Proyecto guardado en este navegador");
    } catch {
      toast.error(
        "No hay espacio disponible. Descargá el archivo del proyecto.",
      );
    }
  };
  const geometryKey = JSON.stringify({
    source: project.source,
    style: project.style,
    params: project.params,
    features: project.features,
    cuts: project.cuts,
    joint: project.joint,
    lightbox: mode === "lightbox" ? project.lightbox : undefined,
    mode,
  });
  useEffect(() => {
    const id = ++request.current;
    setBusy(true);
    setError("");
    let worker: Worker | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const timer = setTimeout(async () => {
      try {
        const shapes =
          mode === "letters" ? await contoursFromSource(project.source) : [];
        if (id !== request.current) return;
        worker = new Worker(new URL("./core/worker.ts", import.meta.url), {
          type: "module",
        });
        worker.onmessage = (event) => {
          if (id !== request.current) return;
          clearTimeout(timeout);
          if (event.data.error) setError(event.data.error);
          else {
            setModel(event.data.model);
            setModelScope(`${project.id}:${mode}`);
          }
          setBusy(false);
        };
        worker.onerror = () => {
          if (id === request.current) {
            setError(
              "No se pudo iniciar el motor geométrico. Recargá la aplicación.",
            );
            setBusy(false);
          }
        };
        worker.postMessage({ id, input: { project, shapes, mode } });
        timeout = setTimeout(() => {
          worker?.terminate();
          if (id === request.current) {
            setError(
              "El diseño requiere demasiado cálculo. Simplificá las curvas o reducí las piezas.",
            );
            setBusy(false);
          }
        }, 45000);
      } catch (e) {
        if (id === request.current) {
          setError(
            e instanceof Error ? e.message : "No se pudo leer el diseño.",
          );
          setBusy(false);
        }
      }
    }, 220);
    return () => {
      clearTimeout(timer);
      clearTimeout(timeout);
      worker?.terminate();
    };
  }, [geometryKey, project.id]);
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem("forma.autosave", JSON.stringify(project));
      } catch {
        /* Guardado explícito informa si falta espacio. */
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [project]);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const editing = (e.target as HTMLElement)?.closest(
        'input,textarea,[contenteditable="true"]',
      );
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        save();
      }
      if (editing) return;
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        revert(e.shiftKey ? "redo" : "undo");
      }
      if (e.key === "Escape") {
        setPanel("parameters");
        setSelected(null);
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selected) {
        e.preventDefault();
        update({
          ...current.current,
          features: current.current.features.filter((f) => f.id !== selected),
        });
        setSelected(null);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [selected]);
  const source = (changes: Partial<Source>) =>
    update({ ...project, source: { ...project.source, ...changes } });
  const loadSvg = async (file?: File) => {
    if (!file) return;
    try {
      if (file.size > 4000000)
        throw new Error("El SVG supera los 4 MB. Simplificá sus curvas.");
      const svg = await file.text();
      const contours = parseSvg(svg);
      update({
        ...project,
        name: file.name.replace(/\.svg$/i, ""),
        mode: "letters",
        source: {
          ...project.source,
          mode: "svg",
          svg,
          height: physicalHeight(svg, contours),
          fileName: file.name,
        },
        features: [],
        cuts: [],
      });
      setSourceTab("svg");
      toast.success("Vector cargado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo cargar el SVG.");
    }
  };
  const loadProject = async (file?: File) => {
    if (!file) return;
    try {
      if (file.size > 12000000)
        throw new Error("El proyecto supera el tamaño permitido.");
      const p = parseProject(JSON.parse(await file.text()));
      update(p);
      setSourceTab(p.source.mode);
      setPage("design");
      toast.success("Proyecto abierto");
    } catch {
      toast.error("El archivo no es un proyecto Grafo3D válido.");
    }
  };
  const place = (x: number, y: number) => {
    const type = panel === "pins" ? "pin" : "hole";
    const id = crypto.randomUUID();
    const feature: Feature = {
      id,
      type,
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10,
      diameter: 4,
      width: 10,
      height: 5,
      radius: 2.5,
      shape: "circle",
    };
    update({ ...project, features: [...project.features, feature] });
    setSelected(id);
  };
  const actualTool =
    mode === "letters"
      ? panel === "holes"
        ? "hole"
        : panel === "pins"
          ? "pin"
          : "orbit"
      : "orbit";
  const selectPanel = (v: ToolPanel) => {
    setPanel(v);
    if (v === "pins" && project.style !== "halo") {
      update(chooseStyle(project, "halo"));
      toast.info(
        "Se activó retroiluminación para ubicar pines sobre la cara impresa.",
      );
    }
    if (v === "holes" || v === "pins") {
      setView("top");
      setExplode(0);
    }
  };
  const ready = Boolean(model) && !busy && !error;
  const activeStyle = STYLES.find((s) => s.id === project.style)!;
  const exportParts =
    model?.parts.filter(
      (p) =>
        exportLayer === "all" ||
        p.layer === exportLayer ||
        `part:${p.id}` === exportLayer,
    ) || [];
  const projects = savedProjects(),
    records = history();
  return (
    <div className={cn("app-shell", dark && "dark")}>
      <Toaster richColors position="bottom-center" />
      <header className="app-header">
        <a
          className="wordmark"
          href="#"
          aria-label="Grafo3D by Grafoprint · Inicio"
          onClick={(e) => {
            e.preventDefault();
            setPage("design");
          }}
        >
          <img
            className="brand-logo"
            src="/brand/grafo3d-logo.png"
            alt="Grafo3D by Grafoprint"
            width="2172"
            height="724"
          />
        </a>
        <span className="header-divider" />
        <nav aria-label="Navegación principal">
          <button
            className={cn(page === "design" && "active")}
            onClick={() => setPage("design")}
          >
            Diseñar
          </button>
          <button
            className={cn(page === "production" && "active")}
            onClick={() => setPage("production")}
          >
            Producción
          </button>
          <button
            className={cn(page === "projects" && "active")}
            onClick={() => {
              setPage("projects");
              setRefresh((v) => v + 1);
            }}
          >
            Proyectos
          </button>
        </nav>
        <div className="header-right">
          <Badge variant="outline">Espacio local</Badge>
          <Button
            variant="ghost"
            size="icon"
            aria-label={dark ? "Tema claro" : "Tema oscuro"}
            onClick={() => setDark(!dark)}
          >
            {dark ? <Sun /> : <Moon />}
          </Button>
          <Button variant="outline" onClick={save}>
            <Save data-icon="inline-start" />
            Guardar
          </Button>
          <Button disabled={!ready} onClick={() => setExportOpen(true)}>
            <Download data-icon="inline-start" />
            Exportar
          </Button>
        </div>
      </header>
      <input
        ref={projectFile}
        hidden
        type="file"
        accept=".json"
        onChange={(e) => {
          void loadProject(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {page === "design" && (
        <>
          <div className="project-bar">
            <div>
              <button
                aria-label="Mostrar u ocultar herramientas de diseño"
                onClick={() => setLeftOpen(!leftOpen)}
              >
                {leftOpen ? <PanelLeftClose /> : <PanelLeftOpen />}
              </button>
              <span className="breadcrumb">
                Proyectos
                <ChevronRight />
              </span>
              <Input
                aria-label="Nombre del proyecto"
                maxLength={150}
                className="project-name"
                value={project.name}
                onChange={(e) => update({ ...project, name: e.target.value })}
              />
              <span className="save-dot" title="Guardado automático local" />
            </div>
            <div className="project-controls">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Deshacer"
                disabled={!undo.current.length}
                onClick={() => revert("undo")}
              >
                <Undo2 />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Rehacer"
                disabled={!redo.current.length}
                onClick={() => revert("redo")}
              >
                <Redo2 />
              </Button>
              <span className="project-unit">Milímetros</span>
            </div>
          </div>
          <main className={cn("editor", !leftOpen && "left-collapsed")}>
            {leftOpen && (
              <aside className="source-panel" key={project.id}>
                <Choice label="Tipo de diseño" value={mode} options={[{value:"letters",label:"Letras corpóreas"},{value:"lightbox",label:"Banderola circular"},{value:"joint",label:"Encastre esférico"}]} onChange={value=>{update(value==="lightbox"?lightboxProject(project):{...project,mode:value as Project["mode"]});setPanel(value==="joint"?"joint":"parameters");setExplode(0);}}/>
                {mode === "lightbox" ? <LightboxOverview project={project} model={busy?null:model} onChange={update}/> : mode === "joint" ? (
                  <div className="joint-overview">
                    <span className="eyebrow">SISTEMA DE FIJACIÓN</span>
                    <h2>
                      Una unión.
                      <br />
                      Dos piezas.
                    </h2>
                    <p>
                      Ajustá la esfera, el alojamiento y las fijaciones.
                      Inspeccioná el montaje y probá el ajuste antes de
                      producir.
                    </p>
                    <div className="joint-symbol">
                      <Link2 />
                    </div>
                    <div className="joint-metrics">
                      {model?.parts
                        .filter(
                          (p) => p.layer === "pin" || p.layer === "socket",
                        )
                        .map((part) => (
                          <div key={part.id}>
                            <span>{componentLabel(project, part.layer)}</span>
                            <strong>
                              {(
                                (part.volume / 1000) *
                                project.production.density
                              ).toFixed(1)}{" "}
                              <small>g</small>
                            </strong>
                          </div>
                        ))}
                    </div>
                    <p className="fine-note">
                      Masa calculada sobre el sólido. Material:{" "}
                      {project.production.filament}.
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => {
                        update({ ...project, mode: "letters" });
                        setPanel("parameters");
                      }}
                    >
                      <ArrowRight data-icon="inline-start" />
                      Volver al diseño de letras
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="panel-heading">
                      <span className="eyebrow">01 / DISEÑO</span>
                      <h2>Dale forma a tu idea.</h2>
                      <p>Un texto o vector. Infinitas posibilidades.</p>
                    </div>
                    <ToggleGroup
                      className="source-tabs"
                      variant="outline"
                      value={[sourceTab]}
                      onValueChange={(v) =>
                        v[0] && setSourceTab(v[0] as "text" | "svg")
                      }
                    >
                      <ToggleGroupItem value="text">
                        <Type />
                        Texto
                      </ToggleGroupItem>
                      <ToggleGroupItem value="svg">
                        <Upload />
                        Archivo SVG
                      </ToggleGroupItem>
                    </ToggleGroup>
                    {sourceTab === "text" ? (
                      <FieldGroup className="source-fields">
                        <Field>
                          <FieldLabel htmlFor="design-text">
                            Tu texto
                          </FieldLabel>
                          <Input
                            id="design-text"
                            className="design-text"
                            maxLength={100}
                            value={project.source.text}
                            onChange={(e) =>
                              source({ mode: "text", text: e.target.value })
                            }
                          />
                        </Field>
                        <Choice
                          label="Tipografía"
                          value={project.source.font}
                          options={FONT_NAMES.map((name) => ({
                            value: name,
                            label: name.replace(/([a-z])([A-Z])/g, "$1 $2"),
                          }))}
                          onChange={(v) => source({ mode: "text", font: v })}
                        />
                        <div className="paired-controls">
                          <NumberControl
                            label="Altura"
                            value={project.source.height}
                            min={5}
                            max={3000}
                            onChange={(v) => source({ height: v })}
                          />
                          <NumberControl
                            label="Espaciado"
                            value={project.source.spacing}
                            min={-20}
                            max={50}
                            onChange={(v) =>
                              source({ mode: "text", spacing: v })
                            }
                          />
                        </div>
                      </FieldGroup>
                    ) : (
                      <div
                        className="upload-zone"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          void loadSvg(e.dataTransfer.files[0]);
                        }}
                      >
                        <input
                          ref={fileRef}
                          hidden
                          type="file"
                          accept="image/svg+xml,.svg"
                          onChange={(e) => {
                            void loadSvg(e.target.files?.[0]);
                            e.target.value = "";
                          }}
                        />
                        <button onClick={() => fileRef.current?.click()}>
                          <Upload />
                          <strong>
                            {project.source.fileName ||
                              "Arrastrá tu archivo SVG"}
                          </strong>
                          <span>o hacé clic para elegir · hasta 4 MB</span>
                        </button>
                        <p>Textos convertidos a curvas y formas cerradas.</p>
                        {project.source.mode === "svg" && (
                          <NumberControl
                            label="Altura del diseño"
                            value={project.source.height}
                            min={5}
                            max={3000}
                            onChange={(v) => source({ height: v })}
                          />
                        )}
                      </div>
                    )}
                    <div className="style-heading">
                      <h3>Construcción</h3>
                      <span>{STYLES.length} estilos</span>
                    </div>
                    <div
                      className="style-grid"
                      role="radiogroup"
                      aria-label="Estilo de construcción"
                    >
                      {STYLES.map((style) => (
                        <button
                          key={style.id}
                          title={style.description}
                          role="radio"
                          aria-checked={
                            project.style === style.id && mode === "letters"
                          }
                          className={cn(
                            "style-card",
                            project.style === style.id &&
                              mode === "letters" &&
                              "selected",
                          )}
                          onClick={() => {
                            update(chooseStyle(project, style.id));
                            setPanel("parameters");
                          }}
                        >
                          <StylePreview id={style.id} />
                          <span>{style.name}</span>
                          <small>{style.short}</small>
                          {project.style === style.id && mode === "letters" && (
                            <i>
                              <Check />
                            </i>
                          )}
                        </button>
                      ))}
                    </div>
                    <Button variant="outline" className="w-full h-auto py-4" onClick={()=>{update(lightboxProject(project));setPanel("parameters");setExplode(0);}}>
                      <Layers data-icon="inline-start"/><span>Banderola circular<br/><small>Cartel luminoso de doble cara</small></span><ArrowRight data-icon="inline-end"/>
                    </Button>
                    <button
                      className="joint-launch"
                      onClick={() => {
                        update({ ...project, mode: "joint" });
                        setPanel("joint");
                      }}
                    >
                      <Link2 />
                      <span>
                        <strong>Encastre esférico</strong>
                        <small>Diseñá tu sistema de fijación</small>
                      </span>
                      <ArrowRight />
                    </button>
                  </>
                )}
                <button className="help-link" onClick={() => setHelpOpen(true)}>
                  <HelpCircle />
                  Guía de fabricación
                  <ArrowRight />
                </button>
              </aside>
            )}
            <section className="scene" aria-label="Área de trabajo 3D">
              <Viewport
                project={project}
                model={model}
                modelScope={modelScope}
                explode={explode}
                grid={grid}
                view={view}
                fit={fit}
                jointView={jointView}
                boxSection={boxSection}
                dark={dark}
                tool={actualTool}
                selected={selected}
                focusedLayer={focusedLayer}
                isolated={isolated && focusedLayer !== null}
                onPlace={place}
                onSelect={setSelected}
                onMove={(id, x, y) =>
                  update({
                    ...project,
                    features: project.features.map((f) =>
                      f.id === id ? { ...f, x, y } : f,
                    ),
                  })
                }
                onError={setError}
              />
              <div className="scene-top">
                <div className="scene-label">
                  <span className="status-dot" />
                  {mode === "lightbox" ? "Banderola circular" : mode === "joint" ? "Encastre esférico" : activeStyle.name}
                  <span>VISTA 3D</span>
                </div>
                <div className="scene-views">
                  <ToggleGroup
                    value={[view]}
                    onValueChange={(v) => v[0] && setView(v[0] as CameraView)}
                  >
                    <ToggleGroupItem value="iso" title="Perspectiva">
                      3D
                    </ToggleGroupItem>
                    <ToggleGroupItem value="top" title="Vista de frente">
                      Frente
                    </ToggleGroupItem>
                    <ToggleGroupItem value="side" title="Vista lateral">
                      Lateral
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>
              </div>
              <div className="scene-tools">
                <Button
                  variant="outline"
                  size="icon"
                  title="Encuadrar modelo"
                  aria-label="Encuadrar modelo"
                  onClick={() => setFit((v) => v + 1)}
                >
                  <Maximize />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  title="Mostrar u ocultar cuadrícula"
                  aria-label="Mostrar u ocultar cuadrícula"
                  onClick={() => setGrid(!grid)}
                >
                  <Grid2X2 />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  title="Volver a la órbita"
                  aria-label="Volver a la órbita"
                  onClick={() => setPanel("parameters")}
                >
                  <MousePointer2 />
                </Button>
              </div>
              {busy && (
                <div className="calculating">
                  <LoaderCircle className="animate-spin" />
                  Generando geometría…
                </div>
              )}
              {error && (
                <div className="scene-error">
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                </div>
              )}
              {model && !error && (
                <div className="model-dimensions">
                  <div className="model-dimensions-heading">
                    <span className="eyebrow">
                      {mode === "joint"
                        ? "PIEZAS SEPARADAS"
                        : "DIMENSIONES TOTALES"}
                    </span>
                    <output
                      className="print-mass"
                      aria-label="Gramos totales de impresión aproximados"
                      aria-live="polite"
                      aria-busy={busy}
                      title={`Total de todas las piezas de filamento y material flexible, incluidas las ocultas. Calculado con el volumen sólido, las densidades de Producción y ${project.production.waste}% de merma. Excluye acrílico, PVC y herrajes. El laminador determina el consumo final.`}
                    >
                      <span className="eyebrow">IMPRESIÓN APROX.</span>
                      <span>{busy ? "Calculando…" : `≈ ${printEstimate!.mass.toLocaleString("es-AR", {maximumFractionDigits: 1})} g`}</span>
                    </output>
                  </div>
                  <div className="model-dimension-values">
                    <strong>
                      {model.width.toFixed(1)}
                      <small>ANCHO</small>
                    </strong>
                    <b>×</b>
                    <strong>
                      {model.height.toFixed(1)}
                      <small>ALTO</small>
                    </strong>
                    <b>×</b>
                    <strong>
                      {model.depth.toFixed(1)}
                      <small>PROFUNDIDAD</small>
                    </strong>
                    <em>mm</em>
                  </div>
                </div>
              )}
              {mode === "joint" ? (
                <div className="assembly-control joint-views">
                  <span className="eyebrow">VISTA DEL ENCASTRE</span>
                  <ToggleGroup
                    value={[jointView]}
                    onValueChange={(v) =>
                      v[0] && setJointView(v[0] as JointView)
                    }
                  >
                    <ToggleGroupItem value="separated">
                      Separado
                    </ToggleGroupItem>
                    <ToggleGroupItem value="assembled">Montado</ToggleGroupItem>
                    <ToggleGroupItem value="section">Corte</ToggleGroupItem>
                  </ToggleGroup>
                </div>
              ) : (
                <div className="assembly-control">
                  <NumberControl
                    label="Vista de montaje"
                    value={explode}
                    max={mode === "lightbox" ? 100 : 80}
                    unit={mode === "lightbox" ? "%" : "mm"}
                    step={1}
                    slider
                    onChange={setExplode}
                  />
                  <div>
                    <span>Ensamblado</span>
                    <span>Despiece</span>
                  </div>
                </div>
              )}
              <div className="axis-widget">
                <span>Z</span>
                <span>Y</span>
                <span>X</span>
                <i />
              </div>
              <div className="scene-bottom">
                <span>
                  <Move3D />
                  Arrastrá para girar · rueda para zoom · botón derecho para
                  desplazar
                </span>
                <span>
                  {model?.parts.length || 0} piezas ·{" "}
                  {model?.perforation
                    ? `${model.perforation.holes} calados · `
                    : ""}
                  {model?.duration ? `${Math.round(model.duration)} ms` : ""}
                </span>
              </div>
            </section>
            <aside className="inspector">
              <div className="inspector-heading">
                <span className="eyebrow">02 / CONSTRUCCIÓN</span>
                <h2>
                  {mode === "joint"
                    ? "Encastre esférico"
                    : tools.find((t) => t.panel === panel)?.name ||
                      "Parámetros"}
                </h2>
              </div>
              {mode === "letters" && (
                <div
                  className="inspector-tabs"
                  role="tablist"
                  aria-label="Herramientas de construcción"
                >
                  {tools.map((t) => (
                    <button
                      key={t.panel}
                      role="tab"
                      aria-selected={panel === t.panel}
                      title={t.name}
                      aria-label={t.name}
                      onClick={() => selectPanel(t.panel)}
                    >
                      <t.icon />
                    </button>
                  ))}
                </div>
              )}
              <div className="inspector-scroll">
                {mode === "lightbox" ? <LightboxEditor project={project} onChange={update} component={boxComponent} onComponentChange={setBoxComponent} isolated={isolated} onIsolatedChange={setIsolated} section={boxSection} onSectionChange={setBoxSection}/> : <Inspector
                  key={`${project.id}:${mode}:${project.style}`}
                  project={project}
                  model={model}
                  panel={mode === "joint" ? "joint" : panel}
                  selected={selected}
                  component={component}
                  isolated={isolated}
                  onComponentChange={(value) => {
                    setComponent(value);
                    if (value === "fit") setIsolated(false);
                  }}
                  onIsolatedChange={setIsolated}
                  onChange={update}
                  onSelect={setSelected}
                  onPlaceCenter={() =>
                    place((model?.width || 100) / 2, (model?.height || 100) / 2)
                  }
                />}
                {model?.warnings.map((w) => (
                  <Alert key={w}>
                    <AlertDescription>{w}</AlertDescription>
                  </Alert>
                ))}
              </div>
              <div className="inspector-footer">
                <span>
                  <Check />
                  Geometría paramétrica
                </span>
                <Button variant="ghost" onClick={() => setPage("production")}>
                  Producir
                  <ArrowRight data-icon="inline-end" />
                </Button>
              </div>
            </aside>
          </main>
        </>
      )}
      {page === "production" && (
        <Production
          key={project.id}
          project={project}
          model={model}
          onChange={update}
          busy={busy || Boolean(error)}
        />
      )}
      {page === "projects" && (
        <main className="projects-page">
          <header className="page-title">
            <div>
              <span className="eyebrow">TU ESPACIO DE TRABAJO</span>
              <h1>Proyectos e historial.</h1>
              <p>
                Guardados en este navegador. Descargá el JSON para trasladarlos
                a otro equipo.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => projectFile.current?.click()}
              >
                <FolderOpen data-icon="inline-start" />
                Abrir archivo
              </Button>
              <Button
                onClick={() => {
                  update(newProject());
                  setSourceTab("text");
                  setPage("design");
                }}
              >
                <Plus data-icon="inline-start" />
                Nuevo proyecto
              </Button>
            </div>
          </header>
          <div className="project-grid">
            {projects.map((p) => (
              <article className="project-card" key={p.id}>
                <button
                  onClick={() => {
                    update(p);
                    setPage("design");
                    setSourceTab(p.source.mode);
                  }}
                >
                  <div className="project-thumbnail">
                    <strong>
                      {p.mode === "lightbox" ? "Banderola" : p.mode === "joint"
                        ? "Encastre"
                        : p.source.mode === "text"
                          ? p.source.text
                          : "SVG"}
                    </strong>
                  </div>
                  <h3>{p.name}</h3>
                  <p>
                    {p.mode === "lightbox" ? `Doble cara · Ø${p.lightbox.diameter} mm` : p.mode === "joint"
                      ? `Encastre esférico · Ø${p.joint.ball} mm`
                      : `${STYLES.find((s) => s.id === p.style)?.name} · ${p.source.height} mm`}
                  </p>
                  <small>{new Date(p.updatedAt).toLocaleString("es-AR")}</small>
                </button>
                <Button
                  variant="ghost"
                  onClick={() =>
                    download(
                      JSON.stringify(p, null, 2),
                      `${p.name}.forma.json`,
                      "application/json",
                    )
                  }
                >
                  <Download data-icon="inline-start" />
                  Archivo del proyecto
                </Button>
              </article>
            ))}
          </div>
          {!projects.length && (
            <Alert>
              <FolderOpen />
              <AlertDescription>
                Guardá tu primer diseño para encontrarlo acá.
              </AlertDescription>
            </Alert>
          )}
          <h2>Fichas de producción</h2>
          <div className="history-list">
            {records.map((record) => (
              <div key={record.number}>
                <FileText />
                <strong>{record.number}</strong>
                <span>{record.project.name}</span>
                <small>{new Date(record.at).toLocaleString("es-AR")}</small>
                <Button
                  variant="outline"
                  onClick={() => {
                    update(record.project);
                    setPage("production");
                    toast.info(
                      "Proyecto restaurado. Podés volver a generar su ficha.",
                    );
                  }}
                >
                  Abrir producción
                  <ArrowRight data-icon="inline-end" />
                </Button>
              </div>
            ))}
          </div>
        </main>
      )}
      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent className="export-dialog">
          <DialogHeader>
            <DialogTitle>Del diseño a la fabricación.</DialogTitle>
            <DialogDescription>
              Archivos a escala real, listos para tu flujo de trabajo.
            </DialogDescription>
          </DialogHeader>
          <div className="export-summary">
            <Box />
            <div>
              <strong>{project.name}</strong>
              <span>{model?.parts.length} componentes · milímetros</span>
            </div>
            <Badge variant="secondary">
              {ready ? "Listo" : "Actualizando"}
            </Badge>
          </div>
          <Button
            disabled={!ready}
            size="lg"
            onClick={() =>
              model &&
              download(
                bundle(project, model),
                `${project.name}-fabricacion.zip`,
                "application/zip",
              )
            }
          >
            <Package data-icon="inline-start" />
            Descargar paquete de fabricación
            <Download data-icon="inline-end" />
          </Button>
          <p className="fine-note">
            Incluye STL por pieza orientados sobre la cama, DXF y SVG de corte,
            proyecto editable y ficha de integración con Grafo.
          </p>
          <Choice
            label="Exportar componentes"
            value={exportLayer}
            options={[
              { value: "all", label: "Todos los componentes" },
              ...(
                [...new Set(model?.parts.map((p) => p.layer) || [])] as Layer[]
              ).map((l) => ({ value: l, label: componentLabel(project, l) })),
              ...(model?.parts || []).map((p) => ({
                value: `part:${p.id}`,
                label: `Pieza: ${p.name}`,
              })),
            ]}
            onChange={setExportLayer}
          />
          <div className="export-formats">
            <Button
              variant="outline"
              disabled={!ready}
              onClick={() =>
                download(stl(exportParts), `${project.name}-${exportLayer}.stl`)
              }
            >
              STL ensamblado
            </Button>
            <Button
              variant="outline"
              disabled={!ready}
              onClick={() =>
                download(
                  dxf(exportParts.flatMap((p) => p.contours)),
                  `${project.name}-${exportLayer}.dxf`,
                )
              }
            >
              Contornos DXF
            </Button>
            <Button
              variant="outline"
              disabled={!ready}
              onClick={() =>
                download(
                  svgContours(exportParts.flatMap((p) => p.contours)),
                  `${project.name}-${exportLayer}.svg`,
                )
              }
            >
              Contornos SVG
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                download(
                  JSON.stringify(project, null, 2),
                  `${project.name}.forma.json`,
                  "application/json",
                )
              }
            >
              Proyecto JSON
            </Button>
          </div>
          <Button
            variant="ghost"
            disabled={!ready}
            onClick={() => {
              if (model) {
                const number = addRecord(project);
                download(
                  technicalPdf(project, model, number),
                  `${number}.pdf`,
                  "application/pdf",
                );
                setRefresh((v) => v + 1);
              }
            }}
          >
            <FileText data-icon="inline-start" />
            Descargar ficha técnica PDF
          </Button>
        </DialogContent>
      </Dialog>
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Diseñá con la fabricación en mente.</DialogTitle>
            <DialogDescription>Un recorrido por Grafo3D</DialogDescription>
          </DialogHeader>
          <ol className="guide-steps">
            <li>
              <strong>Empezá por el contorno.</strong>
              <p>
                Escribí un texto o cargá un SVG con áreas rellenas. Convertí
                textos y trazos a curvas en tu editor vectorial.
              </p>
            </li>
            <li>
              <strong>Elegí cómo se construye.</strong>
              <p>
                Configurá el cuerpo, la tapa y los apoyos. Ajustá los espesores
                al material y a la boquilla de tu impresora.
              </p>
            </li>
            <li>
              <strong>Prepará las fijaciones.</strong>
              <p>
                Agregá perforaciones o pines y dividí las piezas que superan tu
                mesa. Los encastres requieren una prueba de tolerancia.
              </p>
            </li>
            <li>
              <strong>Pasá a producción.</strong>
              <p>
                Distribuí los componentes, revisá tus tarifas y descargá STL,
                DXF y la ficha técnica. El laminador define los tiempos y
                consumos finales.
              </p>
            </li>
          </ol>
          <p className="fine-note">
            Atajos: ⌘/Ctrl S guardar · ⌘/Ctrl Z deshacer · Esc órbita · Supr
            eliminar fijación.
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
