/** Catálogo de exploración; sólo la combinación aprobada se promueve al sistema. */
export type ComponentFamily =
  "tabs" | "avatars" | "secondary" | "segmented" | "channels";
export type ComponentLook = "1" | "2" | "3" | "4";
export type ComponentChoices = Record<ComponentFamily, ComponentLook>;

export const componentFamilies: {
  id: ComponentFamily;
  label: string;
  prefix: string;
  description: string;
  options: { look: ComponentLook; name: string; description: string }[];
}[] = [
  {
    id: "tabs",
    label: "Pestañas",
    prefix: "T",
    description: "Distintas formas de navegar las secciones de una orden.",
    options: [
      {
        look: "1",
        name: "Cápsula neutra",
        description:
          "Barra gris con una pestaña blanca, como la referencia actual.",
      },
      {
        look: "2",
        name: "Línea naranja",
        description:
          "Una línea inferior marca la sección activa, con menos fondo.",
      },
      {
        look: "3",
        name: "Selección cálida",
        description: "Fondo naranja tenue, texto de marca y esquinas suaves.",
      },
      {
        look: "4",
        name: "Pestañas separadas",
        description:
          "Cada sección tiene su contorno y la activa se destaca en naranja.",
      },
    ],
  },
  {
    id: "avatars",
    label: "Avatares",
    prefix: "A",
    description:
      "La identidad del vendedor, con iniciales y una alternativa sin nombre.",
    options: [
      {
        look: "1",
        name: "Círculo suave",
        description:
          "Iniciales naranjas sobre un fondo tenue, cercano a la vista actual.",
      },
      {
        look: "2",
        name: "Cuadrado suave",
        description: "La misma paleta, con el radio de los botones aprobados.",
      },
      {
        look: "3",
        name: "Iniciales con degradado",
        description:
          "Fondo cálido y letras blancas para una identidad más visible.",
      },
      {
        look: "4",
        name: "Contorno discreto",
        description: "Fondo de la superficie, borde fino e iniciales neutras.",
      },
    ],
  },
  {
    id: "secondary",
    label: "Secundarios",
    prefix: "S",
    description:
      "Acciones que acompañan al botón principal sin competir con él.",
    options: [
      {
        look: "1",
        name: "Neutro sólido",
        description:
          "Fondo gris y texto oscuro. Compacto y fácil de reconocer.",
      },
      {
        look: "2",
        name: "Contorno neutro",
        description: "Un borde fino delimita la acción sobre la superficie.",
      },
      {
        look: "3",
        name: "Naranja tenue",
        description: "Una presencia cálida, con fondo suave y texto naranja.",
      },
      {
        look: "4",
        name: "Sólo texto e icono",
        description:
          "La opción más liviana; el fondo aparece al pasar el cursor.",
      },
    ],
  },
  {
    id: "segmented",
    label: "Segmentados",
    prefix: "G",
    description:
      "Elegir entre Orden de trabajo y Presupuesto dentro de un mismo control.",
    options: [
      {
        look: "1",
        name: "Unido y cálido",
        description:
          "Dos segmentos unidos y una selección suave, como la referencia.",
      },
      {
        look: "2",
        name: "Selección blanca",
        description:
          "Una pieza blanca dentro de una base gris con esquinas suaves.",
      },
      {
        look: "3",
        name: "Contorno y selección",
        description: "Superficie limpia con borde y selección naranja tenue.",
      },
      {
        look: "4",
        name: "Selección con degradado",
        description:
          "La opción activa toma el degradado cálido y las letras blancas.",
      },
    ],
  },
  {
    id: "channels",
    label: "Canales de venta",
    prefix: "C",
    description: "Cinco canales con selección única y nombres accesibles.",
    options: [
      {
        look: "1",
        name: "Iconos circulares",
        description:
          "Botones independientes y una selección cálida y discreta.",
      },
      {
        look: "2",
        name: "Iconos con contorno",
        description:
          "Esquinas suaves y un borde naranja para el canal elegido.",
      },
      {
        look: "3",
        name: "Barra de iconos",
        description:
          "Los cinco canales comparten una base gris con selección blanca.",
      },
      {
        look: "4",
        name: "Icono y nombre",
        description:
          "Cada canal muestra su nombre; la selección usa el degradado.",
      },
    ],
  },
];

export const approvedComponentChoices: ComponentChoices = {
  tabs: "2",
  avatars: "3",
  secondary: "2",
  segmented: "4",
  channels: "2",
};

export function describeComponentChoices(choices: ComponentChoices) {
  return componentFamilies
    .map((family) => `${family.label}: ${family.prefix}${choices[family.id]}`)
    .join(" · ");
}
