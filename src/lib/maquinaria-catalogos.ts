import { PlantillaMaquinaria } from "@/lib/maquinaria";

export type CatalogoFabricanteModelos = {
  fabricante: string;
  modelos: string[];
};

const CATALOGO_IMPRESORA_LASER: CatalogoFabricanteModelos[] = [
  {
    fabricante: "Canon",
    modelos: ["imagePRESS C270", "imagePRESS C710", "imagePRESS V1000", "varioPRINT 135"],
  },
  {
    fabricante: "Konica Minolta",
    modelos: ["AccurioPress C4080", "AccurioPress C7090", "bizhub PRESS C1100"],
  },
  {
    fabricante: "Xerox",
    modelos: ["Versant 180", "Versant 280", "Versant 4100", "PrimeLink C9070"],
  },
  {
    fabricante: "Ricoh",
    modelos: [
      "Pro C5100s",
      "Pro C5110s",
      "Pro C5200s",
      "Pro C5210s",
      "Pro C5300s",
      "Pro C5310s",
      "Pro C7200x",
      "Pro C7200sx",
      "Pro C7500",
      "Pro C9200",
      "Pro C9210",
      "Pro C9003",
      "Pro C901",
      "Pro C901S",
      "Pro 5100S",
      "Pro 8200s",
      "Pro 8210s",
      "Pro 8220s",
      "IM C4500",
      "IM C5500",
      "IM C6000",
      "MP C4504",
      "MP C5504",
      "MP C6004",
      "MP 6055",
    ],
  },
  {
    fabricante: "HP",
    modelos: ["LaserJet Enterprise M806", "LaserJet Managed E725", "Indigo 7K"],
  },
  {
    fabricante: "Kyocera",
    modelos: ["TASKalfa Pro 15000c", "ECOSYS P8060cdn"],
  },
  {
    fabricante: "Sharp",
    modelos: ["BP-90C80", "MX-7580N"],
  },
  {
    fabricante: "OKI",
    modelos: ["Pro9542dn", "Pro9541", "C941dn"],
  },
  {
    fabricante: "Lexmark",
    modelos: ["CS923de", "CX960"],
  },
  {
    fabricante: "Brother",
    modelos: ["HL-L9470CDN", "MFC-L9670CDN"],
  },
];

const CATALOGO_PLOTTER_DE_CORTE: CatalogoFabricanteModelos[] = [
  {
    fabricante: "Graphtec",
    modelos: [
      "CE7000-40",
      "CE7000-60",
      "CE7000-130",
      "CE7000-160",
      "FC9000-75",
      "FC9000-140",
      "FC9000-160",
    ],
  },
  {
    fabricante: "Roland",
    modelos: ["VersaSTUDIO GS2-24", "CAMM-1 GR2-540", "CAMM-1 GR2-640"],
  },
  {
    fabricante: "Mimaki",
    modelos: ["CG-60AR", "CG-100AR", "CG-130AR"],
  },
  {
    fabricante: "Summa",
    modelos: ["SummaCut D60", "S2 D60", "S2 D120", "S2 D160", "S2 T160"],
  },
  {
    fabricante: "USCutter",
    modelos: ["TITAN 2 (28\")", "TITAN 2 (53\")", "TITAN 3 ARMS (28\")", "TITAN 3 ARMS (53\")", "TITAN 3 ARMS (68\")"],
  },
  {
    fabricante: "Mutoh",
    modelos: ["ValueCut 2 VC2-600", "ValueCut 2 VC2-1300", "ValueCut 2 VC2-1800"],
  },
  {
    fabricante: "GCC",
    modelos: ["Expert II 24", "Expert II 52 LX"],
  },
  {
    fabricante: "Skycut",
    modelos: [
      "C10", "C16", "C24",
      "D24", "D48", "D60",
      "V24", "V48", "V60",
      "VH24", "VH48", "VH60",
    ],
  },
];

export function getCatalogoFabricantesPorPlantilla(
  plantilla: PlantillaMaquinaria,
): CatalogoFabricanteModelos[] {
  if (plantilla === "impresora_laser") {
    return CATALOGO_IMPRESORA_LASER;
  }

  if (plantilla === "plotter_de_corte") {
    return CATALOGO_PLOTTER_DE_CORTE;
  }

  return [];
}
