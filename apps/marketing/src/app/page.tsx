import {
  ArrowDown,
  ArrowDownRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  FileText,
  Layers3,
  LayoutGrid,
  Monitor,
  Printer,
  SlidersHorizontal,
  Waypoints,
  ChartNoAxesCombined,
  Network,
  ScanLine,
  Mail,
} from "lucide-react";
import { Brand } from "../components/brand";
import { SiteHeader } from "../components/site-header";
import { CinematicMedia } from "../components/cinematic-media";
import { SignExperience } from "../components/sign-experience";
import { ProductionJourney } from "../components/production-journey";
import { FeatureCard } from "../components/feature-card";
import { getSiteConfig, planInquiry } from "../lib/site-config";

const modules = [
  {
    icon: FileText,
    number: "01",
    title: "Cotizá con criterio.",
    text: "Materiales, máquinas y rutas. Presupuestos que contemplan cómo trabajás y el margen que querés cuidar.",
    detail:
      "Motor de cálculo por material, máquina y ruta. Cotización de impresión, trabajos compuestos y cartelería.",
    tag: "COTIZACIÓN INTELIGENTE",
  },
  {
    icon: Waypoints,
    number: "02",
    title: "Conectá todo el taller.",
    text: "Órdenes claras, rutas por estación y un equipo que sabe cuál es el próximo paso.",
    detail:
      "Órdenes de trabajo, tablero de producción por ítem y estación, adjuntos y seguimiento. Pantalla de taller para mantener visible la carga del día.",
    tag: "PRODUCCIÓN + ÓRDENES",
  },
  {
    icon: ScanLine,
    number: "03",
    title: "Aprovechá cada material.",
    text: "Agrupá trabajos de gran formato y planificá su distribución sobre el material.",
    detail:
      "Unificador de impresión con nesting por material y selección de ancho de rollo. Cartelería por capas y cómputo de componentes.",
    tag: "GRAN FORMATO + CARTELERÍA",
  },
  {
    icon: ChartNoAxesCombined,
    number: "04",
    title: "Entendé tu operación.",
    text: "Métricas por rol, facturación y comisiones. La información del trabajo llega hasta la administración.",
    detail:
      "Paneles para ventas, gerencia, producción y finanzas. Facturación electrónica, registro de cobros y comisiones según reglas configurables.",
    tag: "GESTIÓN + MÉTRICAS",
  },
];
const plans = [
  {
    name: "Print",
    number: "01",
    price: "190",
    period: "/mes",
    priceNote: "14 días gratis · Sin tarjeta",
    icon: Printer,
    intro: "De un presupuesto preciso a un trabajo bien organizado.",
    base: "La base de tu operación",
    features: [
      "Cotización de trabajos de impresión",
      "Órdenes y seguimiento de producción",
      "Materiales, productos y clientes",
      "Gestión comercial y administrativa",
    ],
  },
  {
    name: "Sign",
    number: "02",
    price: "290",
    period: "/mes",
    priceNote: "14 días gratis · Sin tarjeta",
    icon: Layers3,
    intro: "Más componentes. Más procesos. El mismo control.",
    base: "Todo lo de Print, más",
    features: [
      "Configuración de cartelería en 3D",
      "Estructuras y materiales por trabajo",
      "Iluminación y componentes",
      "Procesos de fabricación y montaje",
    ],
  },
  {
    name: "Industrial",
    number: "03",
    price: "A medida",
    period: null,
    priceNote: "Onboarding y soporte dedicado",
    icon: Network,
    intro: "Una mirada completa para una producción más compleja.",
    base: "Todo lo de Sign, más",
    features: [
      "Planificación de la producción",
      "Capacidad y carga por estación",
      "Asignación de trabajo y responsables",
      "Trazabilidad y control de la operación",
    ],
  },
];
const faqs = [
  [
    "¿Para qué tipo de empresa es Grafo?",
    "Para empresas de la industria gráfica: impresión digital y gran formato, fabricación de cartelería y operaciones con procesos de producción más complejos. Los planes Print, Sign e Industrial acompañan esa evolución.",
  ],
  [
    "¿Los planes incluyen las funciones del nivel anterior?",
    "Sí. Sign incluye todas las capacidades de Print. Industrial incorpora las de Sign y Print y suma herramientas para coordinar una operación más compleja. Te ayudamos a elegir según tus trabajos y procesos.",
  ],
  [
    "¿Necesito instalar algo?",
    "Grafoprint funciona desde el navegador. Podés acceder desde una computadora o tablet, y usar una pantalla en el taller para consultar la producción.",
  ],
  [
    "¿Puedo migrar mis datos actuales?",
    "Durante la configuración inicial podemos acompañarte en la importación de clientes, materiales y productos desde tus planillas o tu sistema anterior.",
  ],
  [
    "¿Puedo probarlo antes de elegir?",
    "Sí. Podés iniciar una prueba gratuita de 14 días, sin tarjeta, o solicitar una demo para recorrer el sistema con el foco en tu operación.",
  ],
];

export default function Page() {
  const links = getSiteConfig();
  const schema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Grafoprint",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: links.site,
    description:
      "Sistema operativo de la industria gráfica: cotización, producción y gestión para impresión, cartelería y operaciones industriales.",
  };
  return (
    <>
      <a className="skip-link" href="#contenido">
        Saltar al contenido
      </a>
      <SiteHeader login={links.login} signup={links.signup} />
      <main id="contenido">
        <section className="hero" id="top">
          <div className="hero-film">
            <CinematicMedia priority />
            <div className="hero-film-shade" />
          </div>
          <div className="hero-content section-shell">
            <div className="hero-label">
              <span className="tiny-cross" />
              DISEÑADO PARA LO QUE PRODUCÍS
            </div>
            <h1>
              El sistema operativo
              <br />
              de la industria
              <br />
              <span>gráfica.</span>
            </h1>
            <p>
              Cotización, producción y gestión.
              <br />
              Todo conectado. De la primera idea
              <br className="desktop-break" /> a la última entrega.
            </p>
            <div className="hero-actions">
              <a className="button button-orange" href="#experiencia">
                Ver Grafo en acción <ArrowDown size={17} />
              </a>
              <a className="text-link" href="#precios">
                Explorar planes <ArrowUpRight size={16} />
              </a>
            </div>
            <span className="hero-trial">
              14 días gratis · Sin tarjeta · Configuración guiada
            </span>
          </div>
          <div className="hero-corner">
            <span className="corner-line" />
            <span>
              DEL MATERIAL
              <br />A LA POSIBILIDAD.
            </span>
          </div>
          <nav
            className="hero-chapters section-shell"
            aria-label="Explorar las especialidades de Grafo"
          >
            <a href="#impresion">
              <span>01</span>
              <div>
                <strong>Impresión</strong>
                <small>Del archivo al material</small>
              </div>
              <ArrowDownRight size={22} />
            </a>
            <a href="#carteleria">
              <span>02</span>
              <div>
                <strong>Cartelería</strong>
                <small>Cada pieza, bajo control</small>
              </div>
              <ArrowDownRight size={22} />
            </a>
            <a href="#industrial">
              <span>03</span>
              <div>
                <strong>Industrial</strong>
                <small>Toda tu operación conectada</small>
              </div>
              <ArrowDownRight size={22} />
            </a>
          </nav>
        </section>
        <div className="trust-strip section-shell">
          <span>
            CREADO PARA QUIENES
            <br />
            HACEN QUE LAS IDEAS SE VEAN.
          </span>
          <strong>
            Gráfica Corporearte<span>Ya trabaja con Grafoprint</span>
          </strong>
          <span className="trust-location">
            Diseñado en Argentina.
            <br />
            Pensado desde el taller.
          </span>
        </div>
        <section id="experiencia" className="intro-section section-shell">
          <div className="intro-label">
            <span className="eyebrow">UN SISTEMA. TODO TU MUNDO.</span>
            <ArrowDownRight size={30} />
          </div>
          <h2>
            Tu trabajo tiene
            <br />
            muchas formas.
            <br />
            <span>Tu gestión, un solo lugar.</span>
          </h2>
          <p>
            Imprimís. Construís. Transformás.
            <br />
            Grafo conecta cada parte de tu operación para que puedas
            concentrarte en lo que mejor hacés.
          </p>
        </section>
        <section id="impresion" className="print-section section-shell">
          <div className="print-visual">
            <CinematicMedia controllable={false} />
            <div className="print-overlay" />
            <span className="media-index">01 / EL ORIGEN DE CADA TRABAJO</span>
            <div className="material-note">
              <Printer size={21} />
              <span>
                Impresión de gran formato
                <small>Material · Medida · Cantidad · Proceso</small>
              </span>
            </div>
          </div>
          <div className="print-copy">
            <span className="eyebrow">01 / IMPRESIÓN</span>
            <h2>
              De una buena idea
              <br />a un trabajo <br />
              <span>bien calculado.</span>
            </h2>
            <p>
              Un presupuesto tiene mucho detrás. Grafo reúne materiales,
              máquinas, tiempos y márgenes para que cada trabajo empiece con
              información clara.
            </p>
            <ul className="simple-list">
              <li>
                <Check size={16} />
                Cotización según tu forma de producir
              </li>
              <li>
                <Check size={16} />
                Órdenes conectadas con el taller
              </li>
              <li>
                <Check size={16} />
                Aprovechamiento del material
              </li>
            </ul>
            <a className="text-link dark-link" href="#modulos">
              Conocé el sistema <ArrowUpRight size={16} />
            </a>
          </div>
        </section>
        <SignExperience />
        <section id="industrial" className="industrial-section">
          <div className="section-shell">
            <div className="section-heading industrial-heading">
              <div>
                <span className="eyebrow">03 / INDUSTRIAL</span>
                <h2>
                  Una orden.
                  <br />
                  <span>Toda tu planta.</span>
                </h2>
              </div>
              <p>
                Cuando la operación crece, cada conexión importa.
                <br />
                Personas, estaciones y trabajos sobre la misma información.
              </p>
            </div>
            <div className="plant-window">
              <CinematicMedia />
              <div className="plant-title">
                <span>IMPRESIÓN → TERMINACIÓN → DESPACHO</span>
                <h3>
                  Todo encuentra
                  <br />
                  su próximo paso.
                </h3>
              </div>
              <div className="plant-footer">
                <span>
                  <Waypoints size={16} />
                  Una visión de toda la producción
                </span>
                <a href="#como">
                  Seguí una orden <ArrowDown size={15} />
                </a>
              </div>
            </div>
            <div id="como">
              <ProductionJourney />
            </div>
          </div>
        </section>
        <section className="system-section section-shell" id="modulos">
          <div className="section-heading">
            <div>
              <span className="eyebrow dark-eyebrow">
                EL SISTEMA DETRÁS DE TODO
              </span>
              <h2>
                Más claridad.
                <br />
                <span>En cada decisión.</span>
              </h2>
            </div>
            <p>
              Desde el presupuesto hasta el despacho.
              <br />
              Cada módulo habla con el siguiente.
            </p>
          </div>
          <div className="feature-grid">
            {modules.map((module) => (
              <FeatureCard key={module.number}>
                <div className="feature-top">
                  <module.icon size={25} />
                  <span>{module.number}</span>
                </div>
                <span className="feature-tag">{module.tag}</span>
                <h3>{module.title}</h3>
                <p>{module.text}</p>
                <details>
                  <summary>
                    Explorar funciones <ChevronDown size={16} />
                  </summary>
                  <p>{module.detail}</p>
                </details>
              </FeatureCard>
            ))}
          </div>
          <div className="system-footer">
            <span>
              <Monitor size={18} />
              También en la pantalla de tu taller.
            </span>
            <a href={links.signup}>
              Empezar prueba gratis <ArrowUpRight size={16} />
            </a>
          </div>
        </section>
        <section
          className="integrations-section section-shell"
          id="integraciones"
        >
          <div>
            <span className="eyebrow dark-eyebrow">INTEGRACIONES</span>
            <h2>
              Tu operación,
              <br />
              <span>sin islas.</span>
            </h2>
            <p>
              Presupuestos, conversaciones, archivos y cobros conectados con el
              trabajo.
            </p>
          </div>
          <div className="integration-list">
            <div>
              <span className="integration-monogram">Wa</span>
              <span>
                <strong>WhatsApp · Wati</strong>
                <small>Presupuestos y avisos de estado</small>
              </span>
              <ArrowUpRight size={18} />
            </div>
            <div>
              <span className="integration-monogram">MP</span>
              <span>
                <strong>Mercado Pago</strong>
                <small>Links de pago y cobros</small>
              </span>
              <ArrowUpRight size={18} />
            </div>
            <div>
              <span className="integration-monogram">
                <FileText size={21} />
              </span>
              <span>
                <strong>Facturación electrónica</strong>
                <small>Comprobantes vinculados al trabajo</small>
              </span>
              <ArrowUpRight size={18} />
            </div>
            <div>
              <span className="integration-monogram">
                <Layers3 size={21} />
              </span>
              <span>
                <strong>Google Drive</strong>
                <small>Archivos y artes finales por orden</small>
              </span>
              <ArrowUpRight size={18} />
            </div>
          </div>
        </section>
        <section className="plans-section" id="precios">
          <div className="section-shell">
            <div className="plans-heading">
              <span className="eyebrow">TRES NIVELES. UNA MISMA VISIÓN.</span>
              <h2>
                Un sistema que crece
                <br />
                <span>con tu operación.</span>
              </h2>
              <p>Empezá donde estás. Sumá capacidades cuando las necesites.</p>
            </div>
            <div className="plan-grid">
              {plans.map((plan, index) => (
                <article
                  className={`plan-card ${index === 1 ? "plan-featured" : ""}`}
                  key={plan.name}
                >
                  <div className="plan-top">
                    <plan.icon size={24} />
                    <span>0{index + 1}</span>
                  </div>
                  <h3>{plan.name}</h3>
                  <p className="plan-intro">{plan.intro}</p>
                  <div
                    className={`plan-price ${plan.period ? "" : "plan-price-custom"}`}
                  >
                    {plan.period && <span className="plan-currency">USD</span>}
                    <strong>{plan.price}</strong>
                    {plan.period && (
                      <span className="plan-period">{plan.period}</span>
                    )}
                  </div>
                  <p className="plan-price-note">{plan.priceNote}</p>
                  <div className="plan-inheritance">
                    {index > 0 ? (
                      <Layers3 size={16} />
                    ) : (
                      <LayoutGrid size={16} />
                    )}
                    <strong>{plan.base}</strong>
                  </div>
                  <ul>
                    {plan.features.map((feature) => (
                      <li key={feature}>
                        <Check size={15} />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <a
                    href={planInquiry(links.demo, plan.name)}
                    className={`button ${index === 1 ? "button-orange" : "button-outline"}`}
                  >
                    Consultar plan <ArrowUpRight size={16} />
                  </a>
                </article>
              ))}
            </div>
            <div className="plans-note">
              <span>
                <SlidersHorizontal size={17} />
                Te ayudamos a elegir según tus trabajos, tu equipo y tus
                procesos.
              </span>
              <a href={links.signup}>
                O empezá con una prueba gratis <ArrowUpRight size={15} />
              </a>
            </div>
          </div>
        </section>
        <section className="faq-section section-shell" id="faq">
          <div>
            <span className="eyebrow dark-eyebrow">ANTES DE EMPEZAR</span>
            <h2>
              Hablemos
              <br />
              de los detalles.
            </h2>
            <a className="text-link dark-link" href={links.demo}>
              Consultar con el equipo <ArrowUpRight size={16} />
            </a>
          </div>
          <div className="faq-list">
            {faqs.map(([question, answer]) => (
              <details key={question}>
                <summary>
                  {question}
                  <span>
                    <ChevronDown size={18} />
                  </span>
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>
        <section className="final-cta section-shell">
          <div className="cta-technical">
            <Brand compact />
            <span>EL PRÓXIMO PASO ES TUYO.</span>
          </div>
          <h2>
            Hacé lugar
            <br />
            para lo que viene<span>.</span>
          </h2>
          <div className="final-cta-bottom">
            <p>
              Tu industria se transforma.
              <br />
              Tu forma de gestionarla también.
            </p>
            <div>
              <a className="button button-orange" href={links.signup}>
                Empezar prueba gratis <ArrowUpRight size={17} />
              </a>
              <a className="text-link" href={links.demo}>
                Solicitar una demo <ArrowUpRight size={16} />
              </a>
            </div>
          </div>
        </section>
      </main>
      <footer className="footer section-shell">
        <div className="footer-top">
          <a href="#top" aria-label="Grafoprint, inicio">
            <Brand />
          </a>
          <p>El sistema operativo de la industria gráfica.</p>
          <a href="mailto:soporte@grafoprint.com.ar">
            <Mail size={16} />
            Hablemos
          </a>
        </div>
        <div className="footer-bottom">
          <span>
            © {new Date().getFullYear()} Grafoprint · Hecho en Argentina
          </span>
          <nav aria-label="Información legal">
            <a href={links.terms}>Términos</a>
            <a href={links.privacy}>Privacidad</a>
            <a href="#faq">Ayuda</a>
          </nav>
          <a href="#top" className="back-top">
            Volver arriba <ArrowUpRight size={15} />
          </a>
        </div>
      </footer>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(schema).replace(/</g, "\\u003c"),
        }}
      />
    </>
  );
}
