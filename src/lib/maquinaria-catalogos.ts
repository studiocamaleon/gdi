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

export function getCatalogoFabricantesPorPlantilla(
  plantilla: PlantillaMaquinaria,
): CatalogoFabricanteModelos[] {
  if (plantilla === "impresora_laser") {
    return CATALOGO_IMPRESORA_LASER;
  }

  return [];
}
