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
it("el editor ofrece los pasos agregados al producto y respeta el orden y los nombres visibles", () => {
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
    />,
  );
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
