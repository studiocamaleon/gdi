"use client";
import { useEffect, useMemo, useRef } from "react";
import { formatoArchivoInbox } from "../../../../apps/api/src/common/inbox/medios";
import type { MediosInboxApi } from "@/lib/inbox-enviar-medios";
import { textoPlantilla } from "../../../../apps/api/src/common/inbox/plantillas";
import type {
  EquipoInbox,
  EquipoInboxApi,
  PlantillaInbox,
  PlantillasInboxApi,
  ArchivoPlantillaInbox,
} from "@/lib/meta-inbox-api";
import type { MetaConexionApi } from "@/lib/meta-conexion-api";
import { InboxView } from "../inbox-view";
import { ordenarConversacionesInbox } from "@/lib/inbox-combinar";
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
  {
    id: "diana",
    nombre: "Diana Robles",
    telefono: "+16505550126",
    empresa: "Muestras de archivos",
  },
  { id: "clara", nombre: "Clara Paz", telefono: "+16505550125", empresa: null },
];
const muestrasConversaciones: Record<string, MetaInbox["mensajes"]> = {
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
      id: "bruno-imagen-documento",
      adjunto: {
        estado: "LISTO",
        nombre: "Referencia-de-carteleria-adjunta-como-documento.jpg",
        mimeType: "image/jpeg",
        bytes: 180000,
        version: "demo",
      },
      nombreContacto: "Bruno Lago",
      tipo: "document",
      texto: null,
      enviadoEl: "2026-09-26T12:02:00Z",
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
  diana: [
    ...[
      {
        tipo: "audio",
        nombre: "Tono-de-prueba.m4a",
        mime: "audio/mp4",
        bytes: 7784,
      },
      {
        tipo: "audio",
        nombre: "Nota-de-voz-demo.m4a",
        mime: "audio/mp4",
        bytes: 7784,
      },
      {
        tipo: "video",
        nombre: "Recorrido-de-ejemplo.mp4",
        mime: "video/mp4",
        bytes: 4607937,
      },
      {
        tipo: "sticker",
        nombre: "Sticker-de-prueba.webp",
        mime: "image/webp",
        bytes: 7300,
      },
      {
        tipo: "document",
        nombre: "Indicaciones.txt",
        mime: "text/plain",
        bytes: 60,
      },
    ].map((f, i) => ({
      id: `diana-${i}`,
      nombreContacto: "Diana Robles",
      tipo: f.tipo,
      texto: null,
      enviadoEl: `2026-09-28T12:0${i}:00Z`,
      direccion: i === 1 ? "SALIENTE" : "ENTRANTE",
      voz: f.tipo === "audio",
      estadoEntrega: i === 1 ? "DEMO" : null,
      adjunto: {
        estado: "LISTO",
        nombre: f.nombre,
        mimeType: f.mime,
        bytes: f.bytes,
        version: "demo-medios",
      },
    })),
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
// Fechas relativas: ninguna muestra queda en el futuro ni por delante de un envío
// que el usuario acaba de simular. Se preservan los intervalos del historial.
const ultimaMuestra = Math.max(
  ...Object.values(muestrasConversaciones)
    .flat()
    .map((m) => Date.parse(m.enviadoEl)),
);
const desfase = Date.now() - 5 * 60_000 - ultimaMuestra;
const conversaciones: Record<string, MetaInbox["mensajes"]> =
  Object.fromEntries(
    Object.entries(muestrasConversaciones).map(([id, mensajes]) => [
      id,
      mensajes.map((m) => ({
        ...m,
        enviadoEl: new Date(Date.parse(m.enviadoEl) + desfase).toISOString(),
      })),
    ]),
  );
const operadorDemo = {
  id: identidad.usuarioId,
  nombre: "Alex Demo",
  presencia: "CONECTADO" as const,
};
const operadoresDemo = [
  operadorDemo,
  { id: "marina-demo", nombre: "Marina Demo", presencia: "CONECTADO" as const },
  {
    id: "tomas-demo",
    nombre: "Tomás Demo",
    presencia: "DESCONECTADO" as const,
  },
];
const equipos: Record<string, EquipoInbox> = Object.fromEntries(
  contactos.map((c) => [
    c.id,
    {
      responsable:
        c.id === "bruno" ? { ...operadoresDemo[1], disponible: true } : null,
      version: 0,
      estado: c.id === "bruno" ? "RESUELTA" : "ACTIVA",
      estadoVersion: 0,
      entrantesRevision: conversaciones[c.id].filter(
        (m) => m.direccion === "ENTRANTE",
      ).length,
      presenciaSimulada: true,
      operadores: operadoresDemo,
      eventos: [],
      anterior: null,
    },
  ]),
);
for (const mensajes of Object.values(conversaciones))
  for (const m of mensajes)
    if (m.direccion === "SALIENTE" && !m.delCelular)
      m.autor = operadoresDemo[1];
function autoasignarDemo(id: string) {
  const equipo = equipos[id];
  if (equipo.responsable) return;
  equipo.responsable = { ...operadorDemo, disponible: true };
  equipo.version++;
  equipo.eventos.push({
    id: crypto.randomUUID(),
    tipo: "AUTOASIGNACION",
    actor: operadorDemo,
    responsable: operadorDemo,
    anterior: null,
    texto: null,
    creadoEl: new Date().toISOString(),
  });
}
const lecturasDemo = new Map<string, number>();
const accionesEquipo = new Set<string>();
const equipoApi: EquipoInboxApi = {
  lectura: async (id, dto) => {
    lecturasDemo.set(id, Math.max(lecturasDemo.get(id) ?? 0, dto.revision));
    return { guardado: true };
  },
  estado: async (id, dto) => {
    if (accionesEquipo.has(dto.clave)) return { guardado: true };
    const equipo = equipos[id];
    if (equipo.estadoVersion !== dto.version)
      throw new Error("El estado cambió.");
    equipo.estado = dto.estado;
    equipo.estadoVersion++;
    equipo.eventos.push({
      id: crypto.randomUUID(),
      tipo: dto.estado === "RESUELTA" ? "RESUELTA" : "REABIERTA",
      actor: operadorDemo,
      anterior: null,
      responsable: null,
      texto: null,
      creadoEl: new Date().toISOString(),
    });
    accionesEquipo.add(dto.clave);
    return { guardado: true };
  },
  asignar: async (id, dto) => {
    if (accionesEquipo.has(dto.clave)) return { guardado: true };
    const equipo = equipos[id];
    if (dto.version !== equipo.version)
      throw new Error("La asignación cambió.");
    const anterior = equipo.responsable;
    const nuevo =
      operadoresDemo.find((o) => o.id === dto.responsableId) ?? null;
    equipo.responsable = nuevo ? { ...nuevo, disponible: true } : null;
    equipo.version++;
    equipo.eventos.push({
      id: crypto.randomUUID(),
      tipo: nuevo ? (anterior ? "TRANSFERENCIA" : "ASIGNACION") : "SIN_ASIGNAR",
      actor: operadorDemo,
      anterior,
      responsable: nuevo,
      texto: null,
      creadoEl: new Date().toISOString(),
    });
    accionesEquipo.add(dto.clave);
    return { guardado: true };
  },
  nota: async (id, dto) => {
    if (accionesEquipo.has(dto.clave)) return { guardado: true };
    equipos[id].eventos.push({
      id: crypto.randomUUID(),
      tipo: "NOTA",
      actor: operadorDemo,
      anterior: null,
      responsable: null,
      texto: dto.texto,
      creadoEl: new Date().toISOString(),
    });
    accionesEquipo.add(dto.clave);
    return { guardado: true };
  },
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
    autor: operadorDemo,
    estadoEntrega: "DEMO",
  });
  autoasignarDemo(id);
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
    : f.mimeType === "audio/mp4"
      ? "/dev/diseno/inbox/archivo?tipo=audio"
      : f.mimeType === "image/webp"
        ? "/dev/diseno/inbox/archivo?tipo=sticker"
        : f.mimeType === "text/plain"
          ? "/dev/diseno/inbox/archivo?tipo=texto"
          : f.mimeType === "video/mp4"
            ? "/registro/media/plant-tour.mp4"
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
      autor: operadorDemo,
      estadoEntrega: "DEMO",
    });
    autoasignarDemo(id);
    intentos.set(dto.clave, r);
    return r;
  },
};
const cargar: CargarInbox = async (query) => {
  const lista = ordenarConversacionesInbox(
    contactos
      .filter(
        (c) =>
          !query.filtro ||
          query.filtro === "TODAS" ||
          (query.filtro === "MIAS" &&
            equipos[c.id].responsable?.id === identidad.usuarioId) ||
          (query.filtro === "SIN_ASIGNAR" && !equipos[c.id].responsable) ||
          (query.filtro === "PARTICIPE" &&
            (conversaciones[c.id].some(
              (m) => m.autor?.id === identidad.usuarioId,
            ) ||
              equipos[c.id].eventos.some(
                (e) => e.tipo === "NOTA" && e.actor.id === identidad.usuarioId,
              ))),
      )
      .filter(
        (c) =>
          !query.estados ||
          query.estados.split(",").includes(equipos[c.id].estado ?? "ACTIVA"),
      )
      .filter(
        (c) =>
          !query.sinLeer ||
          (lecturasDemo.get(c.id) ?? 0) <
            (equipos[c.id].entrantesRevision ?? 0),
      )
      .filter(
        (c) =>
          !query.sinResponder ||
          conversaciones[c.id].at(-1)?.direccion === "ENTRANTE",
      )
      .filter(
        (c) =>
          !query.participe ||
          conversaciones[c.id].some(
            (m) => m.autor?.id === identidad.usuarioId,
          ) ||
          equipos[c.id].eventos.some(
            (e) => e.tipo === "NOTA" && e.actor.id === identidad.usuarioId,
          ),
      )
      .filter((c) =>
        `${c.nombre} ${c.telefono}`
          .toLocaleLowerCase()
          .includes((query.busqueda ?? "").toLocaleLowerCase()),
      )
      .map((c) => ({
        ...c,
        estado: equipos[c.id].estado,
        sinLeer:
          (lecturasDemo.get(c.id) ?? 0) <
          (equipos[c.id].entrantesRevision ?? 0),
        ultimoMensaje:
          [...conversaciones[c.id]].sort(
            (a, b) =>
              Date.parse(b.enviadoEl) - Date.parse(a.enviadoEl) ||
              b.id.localeCompare(a.id),
          )[0] ?? null,
      })),
  );
  const contacto = contactos.find(
    (c) => c.id === (query.conversacionId ?? lista[0]?.id),
  );
  const todos = contacto
    ? [...conversaciones[contacto.id]].sort(
        (a, b) =>
          Date.parse(a.enviadoEl) - Date.parse(b.enviadoEl) ||
          a.id.localeCompare(b.id),
      )
    : [];
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
    colaboracionHabilitada: true,
    lectura: contacto
      ? {
          revision: equipos[contacto.id].entrantesRevision ?? 0,
          pendiente:
            (lecturasDemo.get(contacto.id) ?? 0) <
            (equipos[contacto.id].entrantesRevision ?? 0),
        }
      : null,
    equipo: contacto ? structuredClone(equipos[contacto.id]) : null,
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
    conversaciones: lista,
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
const prueba = { numero: "+16505550100", venceEl: "2026-10-01T21:00:00Z" };
const cargarPrueba: CargarInbox = async (query, signal) => {
  const datos = await cargar(
    { ...query, conversacionId: "bruno", busqueda: "" },
    signal,
  );
  return datos
    ? {
        ...datos,
        prueba,
        conversaciones: datos.conversaciones?.filter((c) => c.id === "bruno"),
      }
    : null;
};
const conexionPrueba: MetaConexionApi = {
  ...conexionApi,
  estado: async () => {
    const e = await conexionApi.estado();
    return {
      ...e,
      canal: e.canal
        ? {
            ...e.canal,
            tipo: "PRUEBA",
            alta: null,
            importacion: null,
            resumen: null,
            prueba: {
              habilitada: true,
              destinatario: "+16505550124",
              venceEl: prueba.venceEl,
            },
          }
        : null,
    };
  },
};
export function InboxGeneralPreview({
  canalPrueba = false,
}: {
  canalPrueba?: boolean;
}) {
  const archivosLocales = useRef(
    new Map<string, { file: File; url: string; voz: boolean }>(),
  );
  useEffect(() => {
    const archivos = archivosLocales.current;
    return () => {
      for (const [id, mensajes] of Object.entries(conversaciones)) {
        conversaciones[id] = mensajes.filter((m) => !archivos.has(m.id));
      }
      for (const [clave, intento] of intentos) {
        if (intento.mensajeId && archivos.has(intento.mensajeId))
          intentos.delete(clave);
      }
      for (const f of archivos.values()) URL.revokeObjectURL(f.url);
      archivos.clear();
    };
  }, []);
  const mediosApi = useMemo<MediosInboxApi>(
    () => ({
      cargar: async (_id, _canal, file, voz, signal, progreso) => {
        signal.throwIfAborted();
        const id = crypto.randomUUID();
        const mimeType = voz
          ? file.type
          : (formatoArchivoInbox(file.name, file.type)?.mime ?? file.type);
        const normalizado =
          file.type === mimeType
            ? file
            : new File([file], file.name, { type: mimeType });
        archivosLocales.current.set(id, {
          file: normalizado,
          voz,
          url: URL.createObjectURL(normalizado),
        });
        progreso(100);
        return id;
      },
      cancelar: async (_id, _canal, id) => {
        const f = archivosLocales.current.get(id);
        if (f) URL.revokeObjectURL(f.url);
        archivosLocales.current.delete(id);
      },
      enviar: async (id, dto, signal) => {
        signal.throwIfAborted();
        if (intentos.has(dto.clave)) return intentos.get(dto.clave)!;
        const a = archivosLocales.current.get(dto.archivoId);
        if (!a) throw new Error("Adjunto local no disponible");
        const intento = {
          id: crypto.randomUUID(),
          clave: dto.clave,
          estado: "ACEPTADO",
          codigo: null,
          texto: null,
          creadoEl: new Date().toISOString(),
          mensajeId: dto.archivoId,
        };
        conversaciones[id].push({
          id: dto.archivoId,
          nombreContacto: null,
          tipo: a.voz
            ? "audio"
            : (formatoArchivoInbox(a.file.name, a.file.type)?.tipo ??
              "document"),
          texto: dto.texto ?? null,
          enviadoEl: intento.creadoEl,
          direccion: "SALIENTE",
          autor: operadorDemo,
          estadoEntrega: "DEMO",
          adjunto: {
            estado: "LISTO",
            nombre: a.file.name,
            mimeType: a.file.type,
            bytes: a.file.size,
            version: "local",
          },
        });
        autoasignarDemo(id);
        intentos.set(dto.clave, intento);
        return intento;
      },
    }),
    [archivosLocales],
  );
  return (
    <InboxView
      identidad={identidad}
      equipoApi={equipoApi}
      cargar={canalPrueba ? cargarPrueba : cargar}
      tiempoReal={null}
      conexionApi={canalPrueba ? conexionPrueba : conexionApi}
      enviarTexto={enviar}
      plantillasApi={plantillasApi}
      mediosApi={mediosApi}
      abrirAdjunto={async (id, signal) => {
        const local = archivosLocales.current.get(id);
        if (local)
          return {
            url: local.url,
            nombre: local.file.name,
            mimeType: local.file.type,
            bytes: local.file.size,
            expiraEn: 60,
          };
        const mensaje = Object.values(conversaciones)
          .flat()
          .find((m) => m.id === id);
        const archivo = archivosDemo.find(
          (f) => f.mimeType === mensaje?.adjunto?.mimeType,
        ) ?? {
          id,
          version: "demo",
          nombre: mensaje?.adjunto?.nombre ?? "Archivo",
          mimeType: mensaje?.adjunto?.mimeType ?? "application/pdf",
          bytes: 0,
        };
        const headers = await fetch(urlArchivoDemo(archivo), {
          method: "HEAD",
          signal,
        });
        return {
          url: urlArchivoDemo(archivo),
          vistaPreviaUrl:
            archivo.mimeType === "application/pdf"
              ? `${urlArchivoDemo(archivo)}?vista=inline`
              : undefined,
          nombre: mensaje?.adjunto?.nombre ?? archivo.nombre,
          mimeType: archivo.mimeType,
          bytes: Number(headers.headers.get("content-length")),
          expiraEn: 60,
        };
      }}
    />
  );
}
