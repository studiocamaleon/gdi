import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { ConfigPasosEditorView } from "./config-pasos-editor-view";
import type { RuleFieldDefinition } from "@/lib/rule-builder";

const observado = vi.hoisted(() => ({
  reglas: [] as { extraFields: RuleFieldDefinition[]; pasoActualId?: string }[],
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("./rule-builder", () => ({
  RuleBuilder: (props: (typeof observado.reglas)[number]) => {
    observado.reglas.push(props);
    return <div>Condición del paso</div>;
  },
}));

beforeEach(() => {
  observado.reglas.length = 0;
});
function escenario() {
  const familia = {
    codigo: "trabajo_manual",
    nombre: "Trabajo manual",
    relacionMaquinaSoportada: ["M-0"],
    modosTiempoSoportados: ["T-1"],
    mecanismosCantidadSoportados: [],
    modosActivacionSoportados: ["OBLIGATORIO", "OPCIONAL", "CONDICIONAL"],
    slotsRequeridos: [],
    multiplicadoresSoportados: [],
    paramsPasoSchema: [],
  };
  const ruta = {
    id: "alternativa-ficticia",
    nombre: "Principal",
    rutaVersion: 1,
    ruta: {
      id: "ruta-ficticia",
      nombre: "Impresión",
      pasos: [
        { id: "base", familiaCodigo: familia.codigo, orden: 1, activo: true },
      ],
    },
    configPasos: [
      {
        id: "config-base",
        rutaPasoId: "base",
        nombreVisible: "Impresión",
        ordenFlujo: 1,
        modoActivacion: "CONDICIONAL",
        condicionActivacionJson: {
          "==": [{ var: "pasoActivo_extra-troquelado" }, 1],
        },
        modoTiempo: "T-1",
        slotsMateriales: [],
        maquinasCandidatas: [],
        cargosDirectosPaso: [],
        multiplicadoresActivos: [],
      },
    ],
    pasosExtras: [
      {
        id: "extra-troquelado",
        familiaCodigo: familia.codigo,
        nombreVisible: "Troquelado",
        ordenFlujo: 3,
        ordenInterno: 2,
        activo: true,
        modoActivacion: "OPCIONAL",
        multiplicadoresActivos: [],
      },
      {
        id: "extra-diseno",
        familiaCodigo: familia.codigo,
        nombreVisible: "Diseño gráfico",
        ordenFlujo: 0,
        ordenInterno: 0,
        activo: true,
        modoActivacion: "OPCIONAL",
        multiplicadoresActivos: [],
      },
      {
        id: "extra-refilado",
        familiaCodigo: familia.codigo,
        nombreVisible: "Refilado",
        ordenFlujo: 2,
        ordenInterno: 1,
        activo: true,
        modoActivacion: "OPCIONAL",
        multiplicadoresActivos: [],
      },
    ],
  };
  return { familia, ruta };
}

function renderEditor(
  modeloProductivo?: React.ComponentProps<typeof ConfigPasosEditorView>["modeloProductivo"],
) {
  const { familia, ruta } = escenario();
  renderToStaticMarkup(
    <ConfigPasosEditorView
      producto={
        {
          id: "producto-ficticio",
          nombre: "Producto ficticio",
          modoMedidas: "FIJA",
        } as never
      }
      rutaAlternativa={ruta as never}
      catalogoFamilias={{ familias: [familia] } as never}
      lookups={{ materiasPrimas: [], maquinas: [], centrosCosto: [] } as never}
      modeloProductivo={modeloProductivo}
    />,
  );
}

it("el editor ofrece los pasos agregados al producto y respeta el orden y los nombres visibles", () => {
  renderEditor();
  expect(observado.reglas.length).toBeGreaterThan(0);
  const regla = observado.reglas.find((p) => p.pasoActualId === "base")!;
  expect(regla).toBeDefined();
  expect(regla.extraFields.find((f) => f.key === "pasoActivo_")?.pasos).toEqual(
    [
      { value: "extra-diseno", label: "Paso 1 · Diseño gráfico" },
      { value: "base", label: "Paso 2 · Impresión" },
      { value: "extra-refilado", label: "Paso 3 · Refilado" },
      { value: "extra-troquelado", label: "Paso 4 · Troquelado" },
    ],
  );
});

it("las condiciones siguen las conexiones de la ruta aunque difieran del orden de alta", () => {
  renderEditor({
    active: false,
    estructura: "SIMPLE",
    componentes: [],
    etapas: [],
    nodoSeleccionado: "paso:ruta:base",
    aristas: [
      { desdeClave: "extra:extra-refilado", haciaClave: "extra:extra-diseno" },
      { desdeClave: "extra:extra-diseno", haciaClave: "extra:extra-troquelado" },
      { desdeClave: "extra:extra-troquelado", haciaClave: "ruta:base" },
    ],
    panel: null,
    onOpen: vi.fn(),
    onClose: vi.fn(),
  });
  const regla = observado.reglas.find((p) => p.pasoActualId === "base")!;
  expect(regla).toBeDefined();
  expect(regla.extraFields.find((f) => f.key === "pasoActivo_")?.pasos).toEqual([
    { value: "extra-refilado", label: "Paso 1 · Refilado" },
    { value: "extra-diseno", label: "Paso 2 · Diseño gráfico" },
    { value: "extra-troquelado", label: "Paso 3 · Troquelado" },
    { value: "base", label: "Paso 4 · Impresión" },
  ]);
  for (const key of ["tecnologia_", "quienHace_"]) {
    expect(regla.extraFields.find((f) => f.key === key)?.pasos).toEqual([
      { value: "config-base", label: "Paso 4 · Impresión" },
    ]);
  }
});

it("respeta el orden del lienzo en ramas paralelas y a través de componentes", () => {
  renderEditor({
    active: false,
    estructura: "COMPUESTO",
    componentes: [{
      codigo: "componente-ficticio",
      nombre: "Componente ficticio",
      nodosPredecesoresClaves: ["extra:extra-troquelado", "extra:extra-diseno"],
      nodoIncorporacionClave: "ruta:base",
    }],
    etapas: [],
    nodoSeleccionado: "paso:ruta:base",
    aristas: [
      { desdeClave: "extra:extra-refilado", haciaClave: "extra:extra-diseno" },
      { desdeClave: "extra:extra-refilado", haciaClave: "extra:extra-troquelado" },
    ],
    panel: null,
    onOpen: vi.fn(),
    onClose: vi.fn(),
  });
  const regla = observado.reglas.find((p) => p.pasoActualId === "base")!;
  expect(regla).toBeDefined();
  expect(regla.extraFields.find((f) => f.key === "pasoActivo_")?.pasos).toEqual([
    { value: "extra-refilado", label: "Paso 1 · Refilado" },
    { value: "extra-troquelado", label: "Paso 2 · Troquelado" },
    { value: "extra-diseno", label: "Paso 3 · Diseño gráfico" },
    { value: "base", label: "Paso 4 · Impresión" },
  ]);
});
