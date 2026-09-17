"use client";
import { useState } from "react";
import {
  ArrowRight,
  Check,
  FileCheck2,
  Printer,
  ScanLine,
  PackageCheck,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
const steps = [
  {
    title: "Cotización",
    detail:
      "El precio nace de tus materiales, máquinas y procesos. El presupuesto aprobado se convierte en una orden de trabajo.",
    icon: FileCheck2,
    status: "Presupuesto aprobado",
    meta: "MATERIALES · CANTIDADES · RUTA",
    item: "Lona backlight · impresión + montaje",
  },
  {
    title: "Impresión",
    detail:
      "Cada equipo sabe qué producir. La orden reúne especificaciones, archivos y la información necesaria para avanzar.",
    icon: Printer,
    status: "En impresión",
    meta: "ARCHIVOS · ESPECIFICACIONES · ESTACIÓN",
    item: "Impresión digital · frente del cartel",
  },
  {
    title: "Terminación",
    detail:
      "Seguí el trabajo a través de sus estaciones. Estructura, iluminación y montaje se coordinan sobre la misma orden.",
    icon: ScanLine,
    status: "En terminación",
    meta: "TAREAS · RESPONSABLES · AVANCE",
    item: "Armado de estructura · instalación LED",
  },
  {
    title: "Entrega",
    detail:
      "Del taller al cliente, con trazabilidad. Facturación, cobro y comisiones continúan con la información del trabajo.",
    icon: PackageCheck,
    status: "Listo para entregar",
    meta: "ENTREGA · FACTURACIÓN · COBRO",
    item: "Control final · embalaje · despacho",
  },
];
export function ProductionJourney() {
  const [active, setActive] = useState(0),
    reduced = useReducedMotion();
  const stage = steps[active],
    Icon = stage.icon;
  return (
    <div className="production-demo">
      <div
        className="journey-nav"
        role="tablist"
        aria-label="Etapas de una orden de trabajo"
      >
        {steps.map((step, i) => (
          <button
            type="button"
            key={step.title}
            id={`journey-tab-${i}`}
            role="tab"
            aria-selected={active === i}
            aria-controls="journey-panel"
            tabIndex={active === i ? 0 : -1}
            onClick={() => setActive(i)}
            onKeyDown={(e) => {
              if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
                e.preventDefault();
                const next =
                  e.key === "Home"
                    ? 0
                    : e.key === "End"
                      ? 3
                      : (active + (e.key === "ArrowRight" ? 1 : 3)) % 4;
                setActive(next);
                document.getElementById(`journey-tab-${next}`)?.focus();
              }
            }}
            className={i <= active ? "is-reached" : ""}
          >
            <span className="journey-number">
              {i < active ? <Check size={15} /> : `0${i + 1}`}
            </span>
            {step.title}
            {i < 3 && <ArrowRight size={15} className="journey-arrow" />}
          </button>
        ))}
      </div>
      <div
        id="journey-panel"
        className="journey-panel"
        role="tabpanel"
        aria-labelledby={`journey-tab-${active}`}
      >
        <div className="journey-copy">
          <span className="eyebrow">UN SOLO FLUJO</span>
          <h3>{stage.title}</h3>
          <p>{stage.detail}</p>
        </div>
        <motion.div
          className="order-preview"
          key={active}
          initial={reduced ? false : { opacity: 0.6, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          <div className="order-top">
            <span>
              <Icon size={17} />
              Orden de trabajo
            </span>
            <span className="order-id">OT–2048</span>
          </div>
          <div className="order-body">
            <span className="order-caption">EJEMPLO DE UNA ORDEN</span>
            <h4>Cartel luminoso</h4>
            <p>{stage.item}</p>
            <span className="order-status">
              <span />
              {stage.status}
            </span>
            <div className="order-progress" aria-hidden="true">
              <span style={{ width: `${(active + 1) * 25}%` }} />
            </div>
            <span className="order-meta">{stage.meta}</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
