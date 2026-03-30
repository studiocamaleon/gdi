import { PlantillaMaquinaria } from "@/lib/maquinaria";

export type MaquinariaTechnicalPreset = {
  fabricante: string;
  modelo: string;
  parametrosTecnicos: Record<string, number | string | boolean>;
};

const LASER_BASE_DEFAULTS = {
  anchoMinHoja: 14.8,
  altoMinHoja: 21,
  margenSuperior: 0.5,
  margenInferior: 0.5,
  margenIzquierdo: 0.5,
  margenDerecho: 0.5,
  resolucionNominal: 1200,
  largoMaximoBanner: 120,
};

function createLaserPresets(
  fabricante: string,
  modelos: string[],
  params: Record<string, number | string | boolean>,
): MaquinariaTechnicalPreset[] {
  return modelos.map((modelo) => ({
    fabricante,
    modelo,
    parametrosTecnicos: {
      ...LASER_BASE_DEFAULTS,
      ...params,
    },
  }));
}

const LASER_PRESETS: MaquinariaTechnicalPreset[] = [
  ...createLaserPresets(
    "Canon",
    ["imagePRESS C270", "imagePRESS C710"],
    {
      anchoMaxHoja: 33,
      altoMaxHoja: 48.8,
      gramajeMinimo: 52,
      gramajeMaximo: 350,
    },
  ),
  ...createLaserPresets(
    "Canon",
    ["imagePRESS V1000"],
    {
      anchoMaxHoja: 33,
      altoMaxHoja: 130,
      largoMaximoBanner: 130,
      gramajeMinimo: 52,
      gramajeMaximo: 400,
    },
  ),
  ...createLaserPresets(
    "Canon",
    ["varioPRINT 135"],
    {
      anchoMaxHoja: 32,
      altoMaxHoja: 48.8,
      gramajeMinimo: 50,
      gramajeMaximo: 300,
    },
  ),
  ...createLaserPresets(
    "Konica Minolta",
    ["AccurioPress C4080"],
    {
      anchoMaxHoja: 33,
      altoMaxHoja: 130,
      largoMaximoBanner: 130,
      gramajeMinimo: 62,
      gramajeMaximo: 360,
    },
  ),
  ...createLaserPresets(
    "Konica Minolta",
    ["AccurioPress C7090"],
    {
      anchoMaxHoja: 33,
      altoMaxHoja: 90,
      largoMaximoBanner: 90,
      gramajeMinimo: 52,
      gramajeMaximo: 400,
    },
  ),
  ...createLaserPresets(
    "Konica Minolta",
    ["bizhub PRESS C1100"],
    {
      anchoMaxHoja: 33,
      altoMaxHoja: 48.8,
      gramajeMinimo: 55,
      gramajeMaximo: 350,
    },
  ),
  ...createLaserPresets(
    "Xerox",
    ["Versant 180"],
    {
      anchoMaxHoja: 33,
      altoMaxHoja: 66,
      largoMaximoBanner: 66,
      gramajeMinimo: 52,
      gramajeMaximo: 350,
    },
  ),
  ...createLaserPresets(
    "Xerox",
    ["Versant 280", "Versant 4100", "PrimeLink C9070"],
    {
      anchoMaxHoja: 33,
      altoMaxHoja: 66,
      largoMaximoBanner: 66,
      gramajeMinimo: 52,
      gramajeMaximo: 400,
    },
  ),
  ...createLaserPresets(
    "Ricoh",
    ["Pro C5100s", "Pro C5110s", "Pro C5200s", "Pro C5210s", "Pro C5300s", "Pro C5310s", "Pro 5100S"],
    {
      anchoMaxHoja: 33,
      altoMaxHoja: 48.7,
      gramajeMinimo: 52,
      gramajeMaximo: 360,
    },
  ),
  ...createLaserPresets(
    "Ricoh",
    ["Pro C7200x", "Pro C7200sx", "Pro C7500", "Pro C9200", "Pro C9210", "Pro C9003", "Pro C901", "Pro C901S"],
    {
      anchoMaxHoja: 33,
      altoMaxHoja: 70,
      largoMaximoBanner: 70,
      gramajeMinimo: 52,
      gramajeMaximo: 400,
    },
  ),
  ...createLaserPresets(
    "Ricoh",
    ["Pro 8200s", "Pro 8210s", "Pro 8220s"],
    {
      anchoMaxHoja: 33,
      altoMaxHoja: 48.8,
      gramajeMinimo: 40,
      gramajeMaximo: 350,
    },
  ),
  ...createLaserPresets(
    "Ricoh",
    ["IM C4500", "IM C5500", "IM C6000", "MP C4504", "MP C5504", "MP C6004"],
    {
      anchoMaxHoja: 32,
      altoMaxHoja: 45.7,
      gramajeMinimo: 52,
      gramajeMaximo: 300,
    },
  ),
  ...createLaserPresets(
    "Ricoh",
    ["MP 6055"],
    {
      anchoMaxHoja: 32,
      altoMaxHoja: 45.7,
      gramajeMinimo: 52,
      gramajeMaximo: 300,
    },
  ),
  ...createLaserPresets(
    "HP",
    ["LaserJet Enterprise M806"],
    {
      anchoMaxHoja: 31.2,
      altoMaxHoja: 47,
      gramajeMinimo: 60,
      gramajeMaximo: 220,
    },
  ),
  ...createLaserPresets(
    "HP",
    ["LaserJet Managed E725"],
    {
      anchoMaxHoja: 31.2,
      altoMaxHoja: 45,
      gramajeMinimo: 60,
      gramajeMaximo: 300,
    },
  ),
  ...createLaserPresets(
    "HP",
    ["Indigo 7K"],
    {
      anchoMaxHoja: 33,
      altoMaxHoja: 48.2,
      gramajeMinimo: 75,
      gramajeMaximo: 350,
    },
  ),
  ...createLaserPresets(
    "Kyocera",
    ["TASKalfa Pro 15000c"],
    {
      anchoMaxHoja: 33,
      altoMaxHoja: 48.7,
      gramajeMinimo: 52,
      gramajeMaximo: 360,
    },
  ),
  ...createLaserPresets(
    "Kyocera",
    ["ECOSYS P8060cdn"],
    {
      anchoMaxHoja: 32,
      altoMaxHoja: 45.7,
      gramajeMinimo: 52,
      gramajeMaximo: 300,
    },
  ),
  ...createLaserPresets(
    "Sharp",
    ["BP-90C80", "MX-7580N"],
    {
      anchoMaxHoja: 32,
      altoMaxHoja: 45.7,
      gramajeMinimo: 52,
      gramajeMaximo: 300,
    },
  ),
  ...createLaserPresets(
    "OKI",
    ["Pro9542dn", "Pro9541"],
    {
      anchoMaxHoja: 33,
      altoMaxHoja: 120,
      largoMaximoBanner: 120,
      gramajeMinimo: 64,
      gramajeMaximo: 360,
    },
  ),
  ...createLaserPresets(
    "OKI",
    ["C941dn"],
    {
      anchoMaxHoja: 33,
      altoMaxHoja: 132,
      largoMaximoBanner: 132,
      gramajeMinimo: 52,
      gramajeMaximo: 360,
    },
  ),
  ...createLaserPresets(
    "Lexmark",
    ["CS923de", "CX960"],
    {
      anchoMaxHoja: 32,
      altoMaxHoja: 66,
      gramajeMinimo: 60,
      gramajeMaximo: 300,
    },
  ),
  ...createLaserPresets(
    "Brother",
    ["HL-L9470CDN"],
    {
      anchoMaxHoja: 21.6,
      altoMaxHoja: 35.6,
      gramajeMinimo: 60,
      gramajeMaximo: 220,
    },
  ),
  ...createLaserPresets(
    "Brother",
    ["MFC-L9670CDN"],
    {
      anchoMaxHoja: 21.6,
      altoMaxHoja: 35.6,
      gramajeMinimo: 60,
      gramajeMaximo: 163,
    },
  ),
];

function createPlotterCortePresets(
  fabricante: string,
  modelos: string[],
  params: Record<string, number | string | boolean>,
): MaquinariaTechnicalPreset[] {
  return modelos.map((modelo) => ({
    fabricante,
    modelo,
    parametrosTecnicos: { vacioSujecion: false, ...params },
  }));
}

// anchoUtil en cm, velocidadCorte en mm/s
const PLOTTER_DE_CORTE_PRESETS: MaquinariaTechnicalPreset[] = [
  // Graphtec CE7000 — serie entry/mid professional
  ...createPlotterCortePresets("Graphtec", ["CE7000-40"], { anchoUtil: 37.5, velocidadCorte: 1000 }),
  ...createPlotterCortePresets("Graphtec", ["CE7000-60"], { anchoUtil: 58.4, velocidadCorte: 1000 }),
  ...createPlotterCortePresets("Graphtec", ["CE7000-130"], { anchoUtil: 127, velocidadCorte: 1000 }),
  ...createPlotterCortePresets("Graphtec", ["CE7000-160"], { anchoUtil: 157.5, velocidadCorte: 1000 }),
  // Graphtec FC9000 — serie high-production
  ...createPlotterCortePresets("Graphtec", ["FC9000-75"], { anchoUtil: 76.2, velocidadCorte: 1485 }),
  ...createPlotterCortePresets("Graphtec", ["FC9000-140"], { anchoUtil: 137.2, velocidadCorte: 1485 }),
  ...createPlotterCortePresets("Graphtec", ["FC9000-160"], { anchoUtil: 160, velocidadCorte: 1485 }),
  // Roland VersaSTUDIO / CAMM-1 GR2
  ...createPlotterCortePresets("Roland", ["VersaSTUDIO GS2-24"], { anchoUtil: 58.4, velocidadCorte: 850 }),
  ...createPlotterCortePresets("Roland", ["CAMM-1 GR2-540"], { anchoUtil: 137.2, velocidadCorte: 1530 }),
  ...createPlotterCortePresets("Roland", ["CAMM-1 GR2-640"], { anchoUtil: 162.5, velocidadCorte: 1530 }),
  // Mimaki CG-AR
  ...createPlotterCortePresets("Mimaki", ["CG-60AR"], { anchoUtil: 60.6, velocidadCorte: 1000 }),
  ...createPlotterCortePresets("Mimaki", ["CG-100AR"], { anchoUtil: 107, velocidadCorte: 1000 }),
  ...createPlotterCortePresets("Mimaki", ["CG-130AR"], { anchoUtil: 137, velocidadCorte: 1000 }),
  // Summa D/T-Series
  ...createPlotterCortePresets("Summa", ["SummaCut D60", "S2 D60"], { anchoUtil: 58.4, velocidadCorte: 1131 }),
  ...createPlotterCortePresets("Summa", ["S2 D120"], { anchoUtil: 120, velocidadCorte: 1414 }),
  ...createPlotterCortePresets("Summa", ["S2 D160"], { anchoUtil: 160, velocidadCorte: 1414 }),
  ...createPlotterCortePresets("Summa", ["S2 T160"], { anchoUtil: 158, velocidadCorte: 1414 }),
  // USCutter TITAN
  ...createPlotterCortePresets("USCutter", ["TITAN 2 (28\")", "TITAN 3 ARMS (28\")"], { anchoUtil: 71.1, velocidadCorte: 940 }),
  ...createPlotterCortePresets("USCutter", ["TITAN 2 (53\")", "TITAN 3 ARMS (53\")"], { anchoUtil: 134.6, velocidadCorte: 940 }),
  ...createPlotterCortePresets("USCutter", ["TITAN 3 ARMS (68\")"], { anchoUtil: 172.7, velocidadCorte: 940 }),
  // Mutoh ValueCut 2
  ...createPlotterCortePresets("Mutoh", ["ValueCut 2 VC2-600"], { anchoUtil: 61, velocidadCorte: 1080 }),
  ...createPlotterCortePresets("Mutoh", ["ValueCut 2 VC2-1300"], { anchoUtil: 130, velocidadCorte: 1080 }),
  ...createPlotterCortePresets("Mutoh", ["ValueCut 2 VC2-1800"], { anchoUtil: 180, velocidadCorte: 1080 }),
  // GCC Expert II
  ...createPlotterCortePresets("GCC", ["Expert II 24"], { anchoUtil: 60, velocidadCorte: 705 }),
  ...createPlotterCortePresets("GCC", ["Expert II 52 LX"], { anchoUtil: 132, velocidadCorte: 400 }),
  // Skycut C Series (stepper, desktop/semi-pro)
  ...createPlotterCortePresets("Skycut", ["C10"], { anchoUtil: 26, velocidadCorte: 600 }),
  ...createPlotterCortePresets("Skycut", ["C16"], { anchoUtil: 39, velocidadCorte: 600 }),
  ...createPlotterCortePresets("Skycut", ["C24"], { anchoUtil: 61, velocidadCorte: 600 }),
  // Skycut D Series (doble cabezal, stepper)
  ...createPlotterCortePresets("Skycut", ["D24"], { anchoUtil: 56, velocidadCorte: 600 }),
  ...createPlotterCortePresets("Skycut", ["D48"], { anchoUtil: 119, velocidadCorte: 600 }),
  ...createPlotterCortePresets("Skycut", ["D60"], { anchoUtil: 150, velocidadCorte: 600 }),
  // Skycut V Series (alta fuerza, stepper)
  ...createPlotterCortePresets("Skycut", ["V24"], { anchoUtil: 61, velocidadCorte: 600 }),
  ...createPlotterCortePresets("Skycut", ["V48"], { anchoUtil: 124, velocidadCorte: 600 }),
  ...createPlotterCortePresets("Skycut", ["V60"], { anchoUtil: 154, velocidadCorte: 600 }),
  // Skycut VH Series (servo motor, alta velocidad — profesional)
  ...createPlotterCortePresets("Skycut", ["VH24"], { anchoUtil: 61, velocidadCorte: 1200 }),
  ...createPlotterCortePresets("Skycut", ["VH48"], { anchoUtil: 124, velocidadCorte: 1200 }),
  ...createPlotterCortePresets("Skycut", ["VH60"], { anchoUtil: 154, velocidadCorte: 1200 }),
];

export function getTechnicalPresetForMachine(
  plantilla: PlantillaMaquinaria,
  fabricante?: string,
  modelo?: string,
) {
  const normalizedFabricante = (fabricante ?? "").trim().toLowerCase();
  const normalizedModelo = (modelo ?? "").trim().toLowerCase();

  if (!normalizedFabricante || !normalizedModelo) {
    return null;
  }

  const presetList =
    plantilla === "impresora_laser"
      ? LASER_PRESETS
      : plantilla === "plotter_de_corte"
        ? PLOTTER_DE_CORTE_PRESETS
        : null;

  if (!presetList) {
    return null;
  }

  return (
    presetList.find(
      (item) =>
        item.fabricante.trim().toLowerCase() === normalizedFabricante &&
        item.modelo.trim().toLowerCase() === normalizedModelo,
    ) ?? null
  );
}
