import type { PublicPlan } from "./public-plans";

// Catálogo editorial de conectores implementados. La disponibilidad comercial
// se calcula con las prestaciones efectivas de las ofertas públicas.
// Evidencia y exclusiones: docs/web-integraciones-y-comparativa-2026-09-22.md.
const integrations = [
  {
    key: "fiscal_argentina",
    name: "ARCA · Facturación electrónica",
    description:
      "Emití comprobantes electrónicos vinculados a tus trabajos, con autorización de ARCA.",
    requirement: "Argentina · Requiere configurar la delegación fiscal.",
    icon: "invoice",
  },
  {
    key: "whatsapp_automatico",
    name: "WhatsApp Business · Wati",
    description:
      "Enviá presupuestos y avisos automáticos sobre el avance de los trabajos.",
    requirement: "Requiere una cuenta de Wati y plantillas aprobadas.",
    icon: "message",
  },
  {
    key: "mcp",
    name: "Asistentes de IA · MCP",
    description:
      "Conectá un asistente compatible para consultar el catálogo y cotizar con datos de tu empresa.",
    requirement:
      "Requiere un asistente compatible y una credencial de acceso de Grafo.",
    icon: "assistant",
  },
  {
    key: "impresion_directa",
    name: "Impresoras · QZ Tray",
    description:
      "Enviá documentos, planos CAD y etiquetas a las impresoras configuradas en Grafo.",
    requirement: "Requiere QZ Tray y la configuración de las impresoras.",
    icon: "printer",
  },
] as const;

export function publicIntegrations(plans: PublicPlan[]) {
  return integrations
    .map((integration) => ({
      ...integration,
      plans: plans
        .filter((plan) =>
          plan.prestaciones?.some((p) => p.clave === integration.key),
        )
        .map((plan) => plan.nombre),
    }))
    .filter((integration) => integration.plans.length > 0);
}
