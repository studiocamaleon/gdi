"use client";
import { InboxView } from "../inbox-view";
import type { CargarInbox, MetaInbox } from "@/lib/meta-inbox-api";

/** Sólo lo importa el lanzador local de QA, nunca la ruta privada /inbox. */
const identidad = {
  empresaId: "empresa-ficticia",
  usuarioId: "usuario-ficticio",
  empresa: "Gráfica ficticia",
  operador: "Ensayo local · sin conexión a Meta",
};
const cliente = {
  id: "11111111-1111-4111-8111-111111111111",
  nombre: "Estudio Oliva",
  razonSocial: null,
  activo: true,
  contactos: ["Alma Ferrer"],
};
const mensajes = Array.from({ length: 53 }, (_, i) => ({
  id: `mensaje-${String(i).padStart(3, "0")}`,
  nombreContacto: "Alma Ferrer",
  tipo: "text",
  texto:
    i === 52
      ? "¡Buenísimo! ¿Llegamos para el viernes?"
      : `Mensaje ficticio ${i + 1}: consulta por la cartelería del local.`,
  enviadoEl: new Date(Date.UTC(2026, 8, 25, 12, i)).toISOString(),
}));
const cargar: CargarInbox = async (query) =>
  ({
    empresaId: identidad.empresaId,
    usuarioId: identidad.usuarioId,
    contacto: { telefono: "+16505550123" },
    mensajes: query.antesDe ? mensajes.slice(0, 3) : mensajes.slice(3),
    anterior: query.antesDe ? null : mensajes[3].id,
    contexto: {
      estado: "encontrado",
      telefono: "+16505550123",
      cliente,
      coincidencias: [cliente],
      permisos: { clientes: true, ordenes: true },
      ordenes: [
        {
          id: "22222222-2222-4222-8222-222222222222",
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
      ],
    },
  }) satisfies MetaInbox;
export function InboxReadPreview() {
  return <InboxView identidad={identidad} cargar={cargar} />;
}
