import {
  Check,
  CheckCheck,
  CircleCheck,
  CircleHelp,
  Clock3,
  FlaskConical,
  TriangleAlert,
} from "lucide-react";
import s from "./inbox-message-status.module.css";

const estados = {
  ACEPTADO: {
    Icono: CircleCheck,
    etiqueta: "Aceptado por Meta; pendiente de envío",
    texto: "Aceptado",
  },
  SENT: { Icono: Check, etiqueta: "Enviado", texto: null },
  DELIVERED: { Icono: CheckCheck, etiqueta: "Entregado", texto: null },
  READ: { Icono: CheckCheck, etiqueta: "Leído", texto: null },
  PLAYED: { Icono: CheckCheck, etiqueta: "Reproducido", texto: null },
  PENDING: { Icono: Clock3, etiqueta: "Pendiente", texto: "Pendiente" },
  ENVIANDO: {
    Icono: Clock3,
    etiqueta: "Esperando confirmación",
    texto: "Esperando confirmación",
  },
  INCIERTO: {
    Icono: CircleHelp,
    etiqueta: "Sin confirmación; no reenviar todavía",
    texto: "Sin confirmación · no reenviar todavía",
  },
  ERROR: {
    Icono: TriangleAlert,
    etiqueta: "No entregado",
    texto: "No entregado",
  },
  RECHAZADO: {
    Icono: TriangleAlert,
    etiqueta: "No enviado",
    texto: "No enviado",
  },
  DEMO: {
    Icono: FlaskConical,
    etiqueta: "Simulado; sin envío real",
    texto: "Simulado · sin envío real",
  },
};

/** Un check de entrega/lectura sólo se muestra si el estado lo confirma.
 * El acuse del POST y la demo no se presentan como entrega al destinatario. */
export function InboxMessageStatus({
  estado,
  compacto = false,
}: {
  estado: string;
  compacto?: boolean;
}) {
  const { Icono, etiqueta, texto } = estados[
    estado as keyof typeof estados
  ] ?? {
    Icono: CircleHelp,
    etiqueta: "Estado recibido",
    texto: "Estado recibido",
  };
  return (
    <span
      className={s.status}
      data-state={estado}
      role="img"
      aria-label={etiqueta}
      title={etiqueta}
    >
      <Icono size={16} strokeWidth={2} aria-hidden="true" />
      {texto && !compacto && <span aria-hidden="true">{texto}</span>}
    </span>
  );
}
