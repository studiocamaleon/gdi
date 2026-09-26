"use client";
import type { MetaConexionApi } from "@/lib/meta-conexion-api";
import { InboxView } from "../inbox-view";
import type { CargarInbox, MetaInbox } from "@/lib/meta-inbox-api";

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
      enviadoEl: "2026-09-26T11:30:00Z",
      direccion: "ENTRANTE",
    },
    {
      id: "clara-002",
      nombreContacto: "Clara Paz",
      tipo: "revocado",
      texto: null,
      eliminado: true,
      enviadoEl: "2026-09-26T11:31:00Z",
      direccion: "ENTRANTE",
    },
    {
      id: "clara-003",
      nombreContacto: "Clara Paz",
      tipo: "text",
      texto: "Serían 200 unidades. Todavía no tengo cuenta con ustedes.",
      enviadoEl: "2026-09-26T11:33:00Z",
      direccion: "ENTRANTE",
    },
  ],
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
    />
  );
}
