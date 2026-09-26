"use client";
import { textoPlantilla } from "../../../../apps/api/src/common/inbox/plantillas";
import type {
  PlantillaInbox,
  PlantillasInboxApi,
  ArchivoPlantillaInbox,
} from "@/lib/meta-inbox-api";
import type { MetaConexionApi } from "@/lib/meta-conexion-api";
import { InboxView } from "../inbox-view";
import type {
  CargarInbox,
  MetaInbox,
  EnviarTextoInbox,
  IntentoInbox,
} from "@/lib/meta-inbox-api";

/** Fixtures exclusivos de la ruta local /dev; no crean datos ni conectan Meta. */
const identidad = {
  empresaId: "empresa-ficticia",
  usuarioId: "usuario-ficticio",
  empresa: "Gráfica ficticia",
  operador: "DEMO LOCAL · datos ficticios · sin Meta",
};
const contactos = [
  {
    id: "alma",
    nombre: "Alma Ferrer",
    telefono: "+16505550123",
    empresa: "Estudio Oliva",
  },
  {
    id: "bruno",
    nombre: "Bruno Lago",
    telefono: "+16505550124",
    empresa: "Café Nube",
  },
  { id: "clara", nombre: "Clara Paz", telefono: "+16505550125", empresa: null },
];
const conversaciones: Record<string, MetaInbox["mensajes"]> = {
  alma: [
    ...Array.from({ length: 50 }, (_, i) => ({
      id: `alma-${String(i).padStart(3, "0")}`,
      nombreContacto: "Alma Ferrer",
      tipo: "text",
      texto: `Consulta anterior ${i + 1} sobre la cartelería.`,
      enviadoEl: new Date(Date.UTC(2026, 8, 23, 12, i)).toISOString(),
      direccion: i % 2 ? "SALIENTE" : "ENTRANTE",
      delHistorial: true,
    })),
    {
      id: "alma-050",
      nombreContacto: "Alma Ferrer",
      tipo: "text",
      texto: "¡Hola! ¿Cómo viene la cartelería del local?",
      enviadoEl: "2026-09-26T13:00:00Z",
      direccion: "ENTRANTE",
    },
    {
      id: "alma-051",
      nombreContacto: "Alma Ferrer",
      tipo: "text",
      texto:
        "Hola, Alma. Ya está en producción. Tenemos la entrega prevista para el lunes.",
      enviadoEl: "2026-09-26T13:02:00Z",
      direccion: "SALIENTE",
      estadoEntrega: "READ",
      delCelular: true,
    },
    {
      id: "alma-052",
      nombreContacto: "Alma Ferrer",
      tipo: "text",
      texto: "Perfecto, pasamos a retirarla después del mediodía.",
      enviadoEl: "2026-09-26T13:05:00Z",
      direccion: "ENTRANTE",
      editado: true,
    },
  ],
  bruno: [
    {
      id: "bruno-001",
      nombreContacto: "Bruno Lago",
      tipo: "text",
      texto: "Necesitamos renovar la carta del café. Te paso el archivo.",
      enviadoEl: "2026-09-26T12:00:00Z",
      direccion: "ENTRANTE",
    },
    {
      id: "bruno-002",
      adjunto: {
        estado: "LISTO",
        nombre: "Ejemplo-inbox.pdf",
        mimeType: "application/pdf",
        bytes: 1400,
        version: "demo",
      },
      nombreContacto: "Bruno Lago",
      tipo: "document",
      texto: "Carta de primavera · versión final",
      enviadoEl: "2026-09-26T12:01:00Z",
      direccion: "ENTRANTE",
    },
    {
      id: "bruno-003",
      nombreContacto: "Bruno Lago",
      tipo: "text",
      texto: "Recibido. Revisamos las medidas y te confirmamos.",
      enviadoEl: "2026-09-26T12:03:00Z",
      direccion: "SALIENTE",
      estadoEntrega: "DELIVERED",
    },
  ],
  clara: [
    {
      id: "clara-001",
      nombreContacto: "Clara Paz",
      tipo: "text",
      texto: "Hola, ¿hacen etiquetas adhesivas en pequeñas cantidades?",
      enviadoEl: "2026-09-24T11:30:00Z",
      direccion: "ENTRANTE",
    },
    {
      id: "clara-002",
      nombreContacto: "Clara Paz",
      tipo: "revocado",
      texto: null,
      eliminado: true,
      enviadoEl: "2026-09-24T11:31:00Z",
      direccion: "ENTRANTE",
    },
    {
      id: "clara-003",
      nombreContacto: "Clara Paz",
      tipo: "text",
      texto: "Serían 200 unidades. Todavía no tengo cuenta con ustedes.",
      enviadoEl: "2026-09-24T11:33:00Z",
      direccion: "ENTRANTE",
    },
  ],
};
const intentos = new Map<string, IntentoInbox>();
const enviar: EnviarTextoInbox = async (id, dto) => {
  if (intentos.has(dto.clave)) return intentos.get(dto.clave)!;
  if (!conversaciones[id] || id === "clara")
    throw new Error("Demo: ventana cerrada");
  const enviado = {
    id: crypto.randomUUID(),
    clave: dto.clave,
    estado: "ACEPTADO",
    codigo: null,
    texto: null,
    creadoEl: new Date().toISOString(),
    mensajeId: crypto.randomUUID(),
  };
  conversaciones[id].push({
    id: enviado.mensajeId,
    nombreContacto: null,
    tipo: "text",
    texto: dto.texto,
    enviadoEl: enviado.creadoEl,
    direccion: "SALIENTE",
    estadoEntrega: "DEMO",
  });
  intentos.set(dto.clave, enviado);
  return enviado;
};
const plantillasDemo: PlantillaInbox[] = [
  {
    id: "101",
    nombre: "trabajo_listo",
    idioma: "es_AR",
    categoria: "UTILITY",
    estado: "APPROVED",
    formato: "NAMED",
    encabezado: "¡Tu trabajo está listo!",
    cuerpo:
      "Hola, {{nombre}}. Ya podés retirar tu pedido {{pedido}}. Te esperamos en {{direccion}}. ¡Gracias por elegirnos!",
    pie: "Tu idea, hecha realidad.",
    botones: [],
    variables: [
      { componente: "body", nombre: "nombre" },
      { componente: "body", nombre: "pedido" },
      { componente: "body", nombre: "direccion" },
    ],
    motivo: null,
    version: "demo-listo",
    pagina: null,
  },
  {
    id: "102",
    nombre: "confirmacion_pedido",
    idioma: "es_AR",
    categoria: "UTILITY",
    estado: "APPROVED",
    formato: "POSITIONAL",
    encabezado: "Pedido confirmado",
    cuerpo:
      "Hola, {{1}}. Recibimos tu pedido {{2}}. Te avisaremos por acá cuando esté listo.",
    pie: "Gracias por confiar en nuestro equipo.",
    botones: [{ texto: "Tengo una consulta", destino: "" }],
    variables: [
      { componente: "body", nombre: "1" },
      { componente: "body", nombre: "2" },
    ],
    motivo: null,
    version: "demo-pedido",
    pagina: null,
  },
  {
    id: "103",
    nombre: "catalogo_con_imagen",
    idioma: "es_AR",
    categoria: "MARKETING",
    estado: "APPROVED",
    formato: "NAMED",
    encabezado: "",
    cuerpo: "Descubrí nuestras novedades.",
    pie: "",
    botones: [],
    variables: [],
    motivo: null,
    archivo: "image",
    version: "demo-imagen",
    pagina: null,
  },
  {
    id: "104",
    nombre: "documento_del_trabajo",
    idioma: "es_AR",
    categoria: "UTILITY",
    estado: "APPROVED",
    formato: "NAMED",
    encabezado: "",
    archivo: "document",
    cuerpo:
      "Hola, {{nombre}}. Te compartimos el documento de tu trabajo para que puedas revisarlo.",
    pie: "Equipo Grafo",
    botones: [],
    variables: [{ componente: "body", nombre: "nombre" }],
    motivo: null,
    version: "demo-pdf",
    pagina: null,
  },
];
const archivosDemo: ArchivoPlantillaInbox[] = [
  {
    id: "demo-presupuesto",
    version: "presupuesto-1",
    origen: "PRESUPUESTO",
    referencia: "PRES-2026-0042",
    nombre: "PRES-2026-0042.pdf",
    mimeType: "application/pdf",
    bytes: 1400,
  },
  {
    id: "demo-factura",
    version: "factura-1",
    origen: "COMPROBANTE",
    referencia: "Factura C 0001-00000018",
    nombre: "C-0001-00000018.pdf",
    mimeType: "application/pdf",
    bytes: 1400,
  },
  {
    id: "demo-pdf",
    version: "pdf-1",
    nombre: "Documento-de-ejemplo.pdf",
    mimeType: "application/pdf",
    bytes: 1400,
  },
  {
    id: "demo-imagen",
    version: "imagen-1",
    nombre: "Ejemplo-carteleria.jpg",
    mimeType: "image/jpeg",
    bytes: 180000,
  },
];
const urlArchivoDemo = (f: ArchivoPlantillaInbox) =>
  f.mimeType === "application/pdf"
    ? "/dev/diseno/inbox/archivo"
    : "/catalogo/categorias/carteleria-montaje.jpg";
const plantillasApi: PlantillasInboxApi = {
  archivos: async (id) => {
    const contacto = contactos.find((c) => c.id === id);
    return {
      cliente: contacto?.empresa
        ? { id: `cliente-${id}`, nombre: contacto.empresa }
        : null,
      archivos: contacto?.empresa ? archivosDemo : [],
      motivo: contacto?.empresa
        ? null
        : "Este teléfono no coincide con una ficha de cliente. Probá con Alma o Bruno en esta demo.",
    };
  },
  urlArchivo: urlArchivoDemo,
  listar: async (canalId) => ({
    canalId,
    plantillas: plantillasDemo,
    siguiente: null,
  }),
  enviar: async (id, dto) => {
    if (intentos.has(dto.clave)) return intentos.get(dto.clave)!;
    const p = plantillasDemo.find((p) => p.id === dto.plantillaId);
    if (!p || p.motivo || !conversaciones[id])
      throw new Error("Plantilla ficticia no disponible");
    const archivo = p.archivo
      ? archivosDemo.find((f) => f.id === dto.archivoId)
      : null;
    if (p.archivo && !archivo) throw new Error("Elegí el archivo de ejemplo");
    const r = {
      id: crypto.randomUUID(),
      clave: dto.clave,
      estado: "ACEPTADO",
      codigo: null,
      texto: null,
      creadoEl: new Date().toISOString(),
      mensajeId: crypto.randomUUID(),
    };
    conversaciones[id].push({
      id: r.mensajeId,
      nombreContacto: null,
      tipo: p.archivo || "template",
      plantilla: true,
      ...(archivo
        ? {
            adjunto: {
              estado: "LISTO",
              nombre: archivo.nombre,
              mimeType: archivo.mimeType,
              bytes: archivo.bytes,
              version: archivo.version,
            },
          }
        : {}),
      texto: textoPlantilla(p, dto.valores),
      enviadoEl: r.creadoEl,
      direccion: "SALIENTE",
      estadoEntrega: "DEMO",
    });
    intentos.set(dto.clave, r);
    return r;
  },
};
const cargar: CargarInbox = async (query) => {
  const lista = contactos.filter((c) =>
    `${c.nombre} ${c.telefono}`
      .toLocaleLowerCase()
      .includes((query.busqueda ?? "").toLocaleLowerCase()),
  );
  const contacto =
    contactos.find((c) => c.id === query.conversacionId) ?? lista[0];
  const todos = contacto ? conversaciones[contacto.id] : [];
  const desde = query.desdeId
    ? todos.findIndex((m) => m.id === query.desdeId)
    : -1;
  const antes = query.antesDe
    ? todos.findIndex((m) => m.id === query.antesDe)
    : -1;
  const fin = antes >= 0 ? antes : todos.length;
  const inicio = desde >= 0 ? desde : Math.max(0, fin - 50);
  const cliente = contacto?.empresa
    ? {
        id: `cliente-${contacto.id}`,
        nombre: contacto.empresa,
        razonSocial: null,
        activo: true,
        contactos: [contacto.nombre],
      }
    : null;
  return {
    empresaId: identidad.empresaId,
    usuarioId: identidad.usuarioId,
    origen: "GENERAL",
    respuesta: {
      plantillasHabilitadas: true,
      habilitado: true,
      abierta: contacto?.id !== "clara",
      servidorEl: new Date().toISOString(),
      hasta: new Date(
        Date.now() + (contacto?.id === "clara" ? -3600000 : 7200000),
      ).toISOString(),
    },
    envios: [],
    canalId: "canal-ficticio",
    conversacionId: contacto?.id ?? null,
    contacto: { telefono: contacto?.telefono ?? "", nombre: contacto?.nombre },
    conversaciones: lista.map((c) => ({
      ...c,
      ultimoMensaje: conversaciones[c.id].at(-1) ?? null,
    })),
    listaAnterior: null,
    mensajes: todos.slice(inicio, fin),
    anterior: inicio > 0 ? todos[inicio].id : null,
    contexto: contacto
      ? {
          estado: cliente ? "encontrado" : "sin_coincidencias",
          telefono: contacto.telefono,
          cliente,
          coincidencias: cliente ? [cliente] : [],
          permisos: { clientes: true, ordenes: true },
          ordenes:
            contacto.id === "alma"
              ? [
                  {
                    id: "orden-ficticia",
                    numero: "OT-DEMO-0186",
                    estado: "produccion",
                    fechaEntrega: "2026-09-28",
                    items: [
                      {
                        nombre: "Cartelería del local",
                        cantidad: 2,
                        cantidadUnidad: "u.",
                      },
                    ],
                  },
                ]
              : [],
        }
      : null,
  } satisfies MetaInbox;
};
const noConectar = async (): Promise<never> => {
  throw new Error("Vista local sin conexión a Meta");
};
const conexionApi: MetaConexionApi = {
  estado: async () => ({
    empresaId: identidad.empresaId,
    usuarioId: identidad.usuarioId,
    disponible: false,
    modo: null,
    sandboxVerificadoEl: null,
    canal: {
      numero: "+16505550100",
      estado: "VERIFICADO",
      credencialVencida: false,
      recepcionPreparada: true,
      alta: {
        estado: "SOLICITUDES_COMPLETADAS",
        falloCodigo: null,
        updatedAt: "2026-09-26",
      },
      importacion: {
        progresoInformado: 100,
        finInformadoEl: "2026-09-26",
        historialRechazado: false,
        necesitaRevision: false,
      },
      pendientes: 0,
      revisiones: 0,
      resumen: {
        estado: "RECIBIDO_PROCESADO",
        pendientes: 0,
        revisiones: 0,
        bloquesProcesados: 3,
        ultimoRecibidoEl: "2026-09-26",
      },
    },
  }),
  preparar: noConectar,
  consultar: noConectar,
  canjear: noConectar,
  verificar: noConectar,
  cancelar: noConectar,
};
export function InboxGeneralPreview() {
  return (
    <InboxView
      identidad={identidad}
      cargar={cargar}
      tiempoReal={null}
      conexionApi={conexionApi}
      enviarTexto={enviar}
      plantillasApi={plantillasApi}
      abrirAdjunto={async (id) => {
        const mensaje = Object.values(conversaciones)
          .flat()
          .find((m) => m.id === id);
        const archivo =
          archivosDemo.find((f) => f.mimeType === mensaje?.adjunto?.mimeType) ??
          archivosDemo[0];
        return {
          url: urlArchivoDemo(archivo),
          nombre: archivo.nombre,
          mimeType: archivo.mimeType,
          bytes: archivo.bytes,
          expiraEn: 60,
        };
      }}
    />
  );
}
