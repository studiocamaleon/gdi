import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { DesarrolloDocumentalPanel } from "./desarrollo-documental-panel";
import { AprobacionDocumentalPublicaView } from "./aprobacion-documental-publica";
import { CapacidadesProvider } from "@/components/navigation/capacidades-provider";
import { DesignSystemProvider } from "@/components/design-system/appearance";
import type { DesarrolloDocumental, AprobacionDocumentalPublica } from "@/lib/desarrollo-documental-api";

const data: DesarrolloDocumental = { maestros: [{
  id: "arte", ordenId: "ot", nombre: "Arte del pedido", proposito: "PRINT", etapa: "DISENO",
  descripcion: null, requerido: true, creadoPorNombre: "Comercial", createdAt: "2026-09-22T12:00:00Z",
  revisionAprobada: null, revisionLiberada: null,
  gates: [{ id: "gate", nombre: "Control del cliente", tipoAprobacion: "CLIENTE", activo: true, orden: { id: "ot", numero: "OT-1", estado: "pendiente" }, paso: null }],
  revisiones: [{ id: "version", numero: 1, estado: "EN_REVISION", comentario: null, hash: "a".repeat(64), autorNombre: "Diseño", createdAt: "2026-09-22T12:00:00Z", liberadaEl: null, liberadaPorNombre: null,
    archivo: { id: "archivo", nombre: "arte.pdf", mimeType: "application/pdf", bytes: 1200, hash: "a".repeat(64) },
    solicitudes: [{ id: "solicitud", tipo: "CLIENTE", estado: "PENDIENTE", comentario: null, solicitadaPorNombre: "Comercial", asignadaAUsuario: null, asignadaARol: null, permiteDecisionExterna: true, expiraEl: null, resueltaEl: null, createdAt: "2026-09-22T12:00:00Z", decisiones: [] }],
  }],
}] };
function panel(incluida: boolean, gestionar = true) {
  return renderToStaticMarkup(<DesignSystemProvider theme="brand" appearance="light">
    <CapacidadesProvider capacidades={{ funciones: { aprobacion_arte: incluida, proyectos: false } }}>
      <DesarrolloDocumentalPanel ordenId="ot" initial={data} archivos={[]} ordenes={[{ id: "ot", numero: "OT-1", estado: "pendiente" }]} canManage={gestionar} onCambio={() => {}} onEdicionChange={() => {}} />
    </CapacidadesProvider>
  </DesignSystemProvider>);
}
function buttons(html: string) { return html.match(/<button\b[^>]*>[\s\S]*?<\/button>/g) ?? []; }

it("permite organizar arte en una OT sin la función de campañas", () => {
  const html = panel(true);
  expect(html).toContain("ARTE DE LA ORDEN");
  expect(html).toContain("Organizar versiones");
  expect(html).toContain("Configurar control");
  expect(buttons(html).find(b => b.includes("Aprobar"))).not.toContain("disabled");
});
it("sin C08 conserva archivos y cierres, pero no nuevas aprobaciones", () => {
  const html = panel(false);
  expect(html).toContain("arte.pdf");
  expect(html).toContain("Historial conservado");
  expect(html).not.toContain("Organizar versiones");
  expect(buttons(html).find(b => b.includes("Aprobar"))).toContain("disabled");
  expect(buttons(html).find(b => b.includes("Cancelar solicitud"))).not.toContain("disabled");
  expect(buttons(html).find(b => b.includes("Retirar control"))).not.toContain("disabled");
});
it("el permiso de consulta no permite retirar controles ni cancelar solicitudes", () => {
  const html = panel(true, false);
  expect(html).toContain("arte.pdf");
  const acciones = buttons(html).join(" ");
  expect(acciones).not.toMatch(/Organizar versiones|Cancelar solicitud|Retirar control|Aprobar/);
});

const publico: AprobacionDocumentalPublica = {
  negocio: "Gráfica", campana: null, orden: { id: "ot", numero: "OT-1" },
  documento: { nombre: "Arte del pedido", proposito: "PRINT", etapa: "DISENO" },
  revision: { numero: 1, nombreArchivo: "arte.pdf", mimeType: "application/pdf", bytes: 1200, hash: "a".repeat(64) },
  solicitud: { tipo: "CLIENTE", estado: "PENDIENTE", comentario: null, expiraEl: null },
  decision: null,
};
it.each([true, false])("el enlace de OT respeta puedeDecidir=%s y conserva la descarga", puedeDecidir => {
  const html = renderToStaticMarkup(<AprobacionDocumentalPublicaView token="token" initial={{ ...publico, puedeDecidir }} />);
  expect(html).toContain("OT-1");
  expect(html).toContain("Ver archivo");
  expect(html.includes("Aprobar revisión")).toBe(puedeDecidir);
  expect(html.includes("Solicitud en consulta")).toBe(!puedeDecidir);
});
