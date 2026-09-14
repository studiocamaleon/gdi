/** Casos visuales basados en los configuradores comerciales. Sin fórmulas del motor. */
export type SheetLook = "H1" | "H2";
export type SheetSection = "configuracion" | "produccion" | "archivos";
export type QuoteState = "listo" | "calculando" | "pendiente" | "error";
export type SampleField = {
  id: string;
  label: string;
  type: "number" | "select" | "text";
  initial: string | number;
  options?: string[];
  unit?: string;
  min?: number;
};
export type SampleProduct = {
  id: string;
  name: string;
  family: string;
  description: string;
  unit: string;
  quantity: number;
  price: number;
  fields: SampleField[];
  extras: string[];
  features: string[];
  special?:
    | "piezas"
    | "vectorial"
    | "compuesto"
    | "tercerizado"
    | "personalizacion"
    | "sello"
    | "brief"
    | "documentos"
    | "carteleria";
};
const select = (id: string, label: string, options: string[]): SampleField => ({
  id,
  label,
  type: "select",
  initial: options[0],
  options,
});
const number = (
  id: string,
  label: string,
  initial: number,
  unit?: string,
): SampleField => ({ id, label, type: "number", initial, min: 1, unit });
const text = (id: string, label: string, initial: string): SampleField => ({
  id,
  label,
  type: "text",
  initial,
});

export const sheetProducts: SampleProduct[] = [
  {
    id: "tarjetas",
    name: "Tarjetas personales",
    family: "Impresión digital",
    description: "Papel, gramaje, caras, color y terminaciones.",
    unit: "u.",
    quantity: 500,
    price: 90,
    fields: [
      select("formato", "Formato", [
        "9 × 5 cm",
        "8,5 × 5,5 cm",
        "Medida personalizada",
      ]),
      select("papel", "Papel", [
        "Ilustración 300 g",
        "Ilustración 350 g",
        "Opalina 240 g",
      ]),
      select("color", "Impresión", ["Color · CMYK", "Blanco y negro"]),
      select("caras", "Caras", ["Frente y dorso", "Sólo frente"]),
    ],
    extras: ["Laminado mate", "Laminado brillante", "Puntas redondeadas"],
    features: ["Material", "Color y caras", "Opcionales"],
  },
  {
    id: "lona",
    name: "Lona impresa",
    family: "Gran formato",
    description: "Varias piezas, medidas personalizadas y material en rollo.",
    unit: "m²",
    quantity: 3,
    price: 12500,
    special: "piezas",
    fields: [
      select("material", "Material", [
        "Lona front 13 oz",
        "Lona backlight",
        "Lona mesh",
      ]),
      select("anchoRollo", "Ancho de rollo", ["1,60 m", "2,20 m", "3,20 m"]),
      select("calidad", "Calidad", ["Estándar", "Alta definición"]),
    ],
    extras: ["Ojales", "Dobladillo", "Bolsillo para caño", "Instalación"],
    features: ["Piezas y medidas", "Rollo", "Instalación"],
  },
  {
    id: "corte",
    name: "Letras en acrílico",
    family: "Corte y grabado",
    description: "Archivos vectoriales, capas, espesor y plan de corte.",
    unit: "u.",
    quantity: 1,
    price: 42500,
    special: "vectorial",
    fields: [
      select("material", "Material", ["Acrílico", "MDF", "PVC espumado"]),
      select("espesor", "Espesor", ["3 mm", "5 mm", "10 mm"]),
      select("color", "Color del material", [
        "Negro",
        "Blanco",
        "Transparente",
      ]),
      select("complejidad", "Complejidad de corte", [
        "Media",
        "Simple",
        "Alta",
      ]),
    ],
    extras: ["Grabado", "Pulido de cantos", "Cinta de montaje"],
    features: ["Vectores y capas", "Espesor", "Plan de corte"],
  },
  {
    id: "exhibidor",
    name: "Exhibidor de mostrador",
    family: "Producto compuesto",
    description: "Componentes fabricados, piezas heredadas y medidas 3D.",
    unit: "u.",
    quantity: 10,
    price: 9800,
    special: "compuesto",
    fields: [
      number("ancho", "Ancho", 30, "cm"),
      number("alto", "Alto", 45, "cm"),
      number("profundidad", "Profundidad", 18, "cm"),
      select("material", "Material principal", [
        "MDF 3 mm",
        "MDF 5 mm",
        "Acrílico 3 mm",
      ]),
    ],
    extras: ["Impresión de frente", "Armado", "Embalaje individual"],
    features: ["Dimensiones 3D", "Componentes", "Piezas heredadas"],
  },
  {
    id: "tercerizado",
    name: "Folletos offset",
    family: "Tercerizado",
    description: "Proveedor, tiradas, plazo y costo manual o de matriz.",
    unit: "u.",
    quantity: 1000,
    price: 82,
    special: "tercerizado",
    fields: [
      select("proveedor", "Proveedor", [
        "Proveedor de muestra A",
        "Proveedor de muestra B",
      ]),
      select("formato", "Formato", ["A5", "A4", "A6"]),
      select("papel", "Papel", ["Ilustración 115 g", "Ilustración 150 g"]),
      select("plazo", "Plazo del proveedor", [
        "5 días hábiles",
        "8 días hábiles",
      ]),
    ],
    extras: ["Plegado", "Envío del proveedor"],
    features: ["Proveedor", "Tiradas", "Costo manual"],
  },
  {
    id: "merch",
    name: "Tazas personalizadas",
    family: "Merchandising",
    description: "Producto comprado con áreas y técnicas de personalización.",
    unit: "u.",
    quantity: 24,
    price: 6300,
    special: "personalizacion",
    fields: [
      select("modelo", "Modelo", ["Cerámica 325 ml", "Mágica 325 ml"]),
      select("color", "Color del producto", [
        "Blanco",
        "Interior naranja",
        "Interior negro",
      ]),
      select("tecnica", "Técnica", ["Sublimación", "Transfer"]),
      select("area", "Área de personalización", [
        "Envolvente",
        "Una cara",
        "Dos caras",
      ]),
    ],
    extras: ["Caja individual", "Nombres variables"],
    features: ["Variantes", "Área impresa", "Personalización"],
  },
  {
    id: "sello",
    name: "Sello automático",
    family: "Sellos",
    description: "Cuerpo, tinta, texto y vista previa del diseño.",
    unit: "u.",
    quantity: 1,
    price: 22500,
    special: "sello",
    fields: [
      select("modelo", "Modelo", [
        "Trodat 4912 · 47 × 18 mm",
        "Trodat 4913 · 58 × 22 mm",
      ]),
      select("tinta", "Tinta", ["Negra", "Azul", "Roja"]),
      text("texto", "Texto del sello", "ESTUDIO NORTE"),
      select("tipografia", "Tipografía", [
        "Sans serif",
        "Serif",
        "Monoespaciada",
      ]),
    ],
    extras: ["Almohadilla de repuesto", "Logo del cliente"],
    features: ["Texto y tipografía", "Vista previa", "Tinta"],
  },
  {
    id: "diseno",
    name: "Diseño de identidad",
    family: "Servicio de diseño",
    description:
      "Brief, referencias, entregables, revisiones y tiempo de trabajo.",
    unit: "h",
    quantity: 6,
    price: 18000,
    special: "brief",
    fields: [
      text(
        "objetivo",
        "Objetivo del trabajo",
        "Renovar la identidad de Estudio Norte",
      ),
      select("nivel", "Alcance", [
        "Identidad básica",
        "Identidad completa",
        "Adaptación de arte",
      ]),
      number("revisiones", "Rondas de revisión", 2),
      select("entregables", "Entregables", [
        "Logo + aplicaciones",
        "Arte final para impresión",
        "Piezas para redes",
      ]),
    ],
    extras: ["Manual de marca", "Adaptaciones adicionales"],
    features: ["Brief", "Referencias", "Horas y revisiones"],
  },
  {
    id: "copiado",
    name: "Documentos y tomos",
    family: "Centro de copiado",
    description: "Archivos, páginas, copias, impresión y agrupación en tomos.",
    unit: "juegos",
    quantity: 2,
    price: 11200,
    special: "documentos",
    fields: [
      select("formato", "Tamaño", ["A4", "A3", "Oficio"]),
      select("papel", "Papel", ["Obra 80 g", "Obra 90 g"]),
      select("color", "Color", ["Blanco y negro", "Color"]),
      select("caras", "Faz", ["Doble faz", "Simple faz"]),
    ],
    extras: ["Anillado", "Tapa transparente", "Contratapa negra"],
    features: ["Documentos", "Páginas y copias", "Tomos"],
  },
  {
    id: "talonario",
    name: "Talonarios autocopiativos",
    family: "Impresión comercial",
    description: "Originales, copias, numeración y hojas por talonario.",
    unit: "u.",
    quantity: 20,
    price: 4200,
    fields: [
      select("formato", "Formato", ["A5", "A4", "1/3 de A4"]),
      select("copia", "Tipo de copia", ["Duplicado", "Triplicado", "Simple"]),
      number("hojas", "Hojas por talonario", 50),
      number("inicio", "Numeración inicial", 1),
    ],
    extras: ["Numerado", "Perforado", "Encuadernado"],
    features: ["Copias", "Numeración", "Hojas"],
  },
  {
    id: "cartel",
    name: "Letras corpóreas",
    family: "Cartelería",
    description: "Volumen, iluminación, componentes y condiciones de montaje.",
    unit: "u.",
    quantity: 1,
    price: 185000,
    special: "carteleria",
    fields: [
      text("texto", "Texto del cartel", "GRAFOPRINT"),
      number("ancho", "Ancho total", 150, "cm"),
      number("alto", "Alto", 40, "cm"),
      number("profundidad", "Profundidad", 8, "cm"),
      select("tecnologia", "Construcción", [
        "Frente acrílico + cuerpo PVC",
        "Acero inoxidable",
        "PVC macizo",
      ]),
      select("luz", "Iluminación", [
        "LED frontal",
        "LED retroiluminado",
        "Sin iluminación",
      ]),
    ],
    extras: ["Instalación", "Fuente de alimentación", "Plantilla de montaje"],
    features: ["Volumen", "Iluminación", "Montaje"],
  },
];

export type SamplePiece = {
  id: number;
  name: string;
  width: number;
  height: number;
  quantity: number;
};
export type SampleDocument = {
  id: number;
  name: string;
  pages: number;
  copies: number;
};
export type SheetDraft = {
  values: Record<string, string | number>;
  quantity: number;
  extras: string[];
  notes: string;
  files: string[];
  pieces: SamplePiece[];
  documents: SampleDocument[];
  grouped: boolean;
  quote: QuoteState;
};
export function initialSheetDraft(product: SampleProduct): SheetDraft {
  return {
    values: Object.fromEntries(
      product.fields.map((field) => [field.id, field.initial]),
    ),
    quantity: product.quantity,
    extras: [],
    notes: "",
    files: ["arte-estudio-norte.pdf"],
    pieces: [
      { id: 1, name: "Frente principal", width: 100, height: 150, quantity: 2 },
    ],
    documents: [
      { id: 1, name: "Manual de marca.pdf", pages: 24, copies: 2 },
      { id: 2, name: "Anexos.pdf", pages: 8, copies: 2 },
    ],
    grouped: false,
    quote: "listo",
  };
}

export function sampleQuote(product: SampleProduct, draft: SheetDraft) {
  const subtotal = product.price * draft.quantity;
  const extras = draft.extras.length * 1500;
  return {
    subtotal,
    extras,
    taxes: (subtotal + extras) * 0.21,
    total: (subtotal + extras) * 1.21,
  };
}
export const sampleMoney = (value: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
