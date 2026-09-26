/** Datos ficticios. Este prototipo no importa clientes ni conexiones reales. */
export type MensajeDemo = {
  id: string;
  tipo: "entrada" | "salida" | "nota" | "evento" | "documento";
  texto: string;
  hora: string;
  estado?: "enviado" | "error";
};
export type ConversacionDemo = {
  id: string;
  nombre: string;
  empresa: string;
  iniciales: string;
  etiqueta: string;
  preview: string;
  hora: string;
  sinLeer: number;
  responsable: "Camila" | "Julián" | "Sin asignar";
  resuelta: boolean;
  vinculada: boolean;
  ventanaAbierta: boolean;
  presupuesto?: string;
  orden?: string;
  mensajes: MensajeDemo[];
};
export const conversacionesDemo: ConversacionDemo[] = [
  {
    id: "alma",
    nombre: "Alma Ferrer",
    empresa: "Estudio Oliva",
    iniciales: "AF",
    etiqueta: "En producción",
    preview: "¡Buenísimo! ¿Llegamos para el viernes?",
    hora: "10:42",
    sinLeer: 0,
    responsable: "Camila",
    resuelta: false,
    vinculada: true,
    ventanaAbierta: true,
    presupuesto: "PRE-0248",
    orden: "OT-0186",
    mensajes: [
      {
        id: "a1",
        tipo: "evento",
        texto: "Conversación vinculada a Estudio Oliva",
        hora: "09:18",
      },
      {
        id: "a2",
        tipo: "entrada",
        texto:
          "¡Hola, Cami! ¿Cómo va la cartelería del local? Ya tenemos fecha de apertura 🙌",
        hora: "09:18",
      },
      {
        id: "a3",
        tipo: "salida",
        texto:
          "¡Hola, Alma! Ya está en producción. Te dejo el presupuesto que aprobamos para que tengas todo a mano.",
        hora: "09:24",
        estado: "enviado",
      },
      {
        id: "a4",
        tipo: "documento",
        texto: "Presupuesto PRE-0248",
        hora: "09:24",
        estado: "enviado",
      },
      {
        id: "a5",
        tipo: "nota",
        texto:
          "Coordinar con producción el horario de retiro. El cliente necesita montar la cartelería antes de la apertura.",
        hora: "10:15",
      },
      {
        id: "a6",
        tipo: "entrada",
        texto: "¡Buenísimo! ¿Llegamos para el viernes?",
        hora: "10:42",
      },
    ],
  },
  {
    id: "tomas",
    nombre: "Tomás Rivas",
    empresa: "Café Nube",
    iniciales: "TR",
    etiqueta: "Presupuesto",
    preview: "Te paso las medidas de la vidriera.",
    hora: "10:36",
    sinLeer: 1,
    responsable: "Sin asignar",
    resuelta: false,
    vinculada: true,
    ventanaAbierta: true,
    presupuesto: "PRE-0251",
    mensajes: [
      {
        id: "t1",
        tipo: "entrada",
        texto:
          "¡Hola! Necesitamos vinilo para la vidriera del café. Te paso las medidas de la vidriera: 2,40 × 1,80 m.",
        hora: "10:36",
      },
    ],
  },
  {
    id: "vera",
    nombre: "Vera Molina",
    empresa: "Hotel Ladera",
    iniciales: "VM",
    etiqueta: "Diseño",
    preview: "¿Podemos hacer el logo un poco más grande?",
    hora: "10:21",
    sinLeer: 0,
    responsable: "Julián",
    resuelta: false,
    vinculada: true,
    ventanaAbierta: true,
    orden: "OT-0190",
    mensajes: [
      {
        id: "v1",
        tipo: "entrada",
        texto:
          "Vimos la propuesta de señalética. Nos gusta mucho, ¿podemos hacer el logo un poco más grande?",
        hora: "10:21",
      },
    ],
  },
  {
    id: "nuevo",
    nombre: "+1 650 555 0144",
    empresa: "Contacto sin vincular",
    iniciales: "?",
    etiqueta: "Nueva consulta",
    preview: "Hola, ¿hacen etiquetas para packaging?",
    hora: "10:08",
    sinLeer: 1,
    responsable: "Sin asignar",
    resuelta: false,
    vinculada: false,
    ventanaAbierta: true,
    mensajes: [
      {
        id: "n1",
        tipo: "entrada",
        texto:
          "Hola, ¿hacen etiquetas para packaging? Necesito 500 unidades para mi emprendimiento.",
        hora: "10:08",
      },
    ],
  },
  {
    id: "bruno",
    nombre: "Bruno Costa",
    empresa: "Taller Forma",
    iniciales: "BC",
    etiqueta: "Entrega",
    preview: "Paso a retirar mañana. ¡Gracias!",
    hora: "Ayer",
    sinLeer: 0,
    responsable: "Camila",
    resuelta: false,
    vinculada: true,
    ventanaAbierta: false,
    orden: "OT-0179",
    mensajes: [
      {
        id: "b1",
        tipo: "salida",
        texto: "Bruno, tu trabajo ya está listo para retirar por el taller.",
        hora: "Ayer · 09:30",
        estado: "enviado",
      },
      {
        id: "b2",
        tipo: "entrada",
        texto: "Paso a retirar mañana. ¡Gracias!",
        hora: "Ayer · 09:42",
      },
    ],
  },
  {
    id: "ines",
    nombre: "Inés Paz",
    empresa: "Mercado Botánico",
    iniciales: "IP",
    etiqueta: "Finalizada",
    preview: "Quedó todo hermoso. Muchas gracias 😊",
    hora: "Ayer",
    sinLeer: 0,
    responsable: "Camila",
    resuelta: true,
    vinculada: true,
    ventanaAbierta: true,
    orden: "OT-0168",
    mensajes: [
      {
        id: "i1",
        tipo: "entrada",
        texto: "Quedó todo hermoso. Muchas gracias 😊",
        hora: "Ayer · 17:20",
      },
      {
        id: "i2",
        tipo: "salida",
        texto:
          "¡Gracias a vos, Inés! Nos alegra que haya quedado como lo imaginabas.",
        hora: "Ayer · 17:25",
        estado: "enviado",
      },
    ],
  },
];
