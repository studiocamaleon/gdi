import Image from "next/image";
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { Brand } from "./brand";
import styles from "./about-section.module.css";

const partners = [
  { image: "socio-retrato-01.png", width: 1122, height: 1402 },
  { image: "socio-retrato-02.png", width: 1229, height: 1280 },
  { image: "socio-retrato-03.png", width: 1122, height: 1402 },
];

export function AboutSection({ contact }: { contact: string }) {
  return (
    <section className={`${styles.section} section-shell`} id="nosotros" aria-labelledby="about-title">
      <div className={styles.heading}>
        <div>
          <span className="eyebrow dark-eyebrow">NOSOTROS · EL ORIGEN DE GRAFO</span>
          <h2 id="about-title">Grafo nació<br /><span>en una gráfica.</span></h2>
        </div>
        <div className={styles.intro}>
          <p>Somos <strong>Gráfica Corporearte</strong>, los creadores de Grafoprint.
            Conocemos el trabajo que hay detrás de cada presupuesto, cada material y cada entrega.
            Porque también es nuestro trabajo.</p>
          <span className={styles.introNote}><span aria-hidden="true" /> Experiencia real, convertida en software.</span>
        </div>
      </div>

      <div className={styles.story}>
        <figure className={styles.workshop}>
          <Image
            src="/about/corporearte-local.png"
            alt="El local de Gráfica Corporearte, la gráfica donde nació Grafoprint"
            width={1448}
            height={1086}
            sizes="(max-width: 760px) calc(100vw - 50px), (max-width: 1190px) 52vw, 730px"
            quality={85}
          />
          <figcaption>
            <span>01 / NUESTRO PUNTO DE PARTIDA</span>
            <div><strong>Gráfica Corporearte</strong><ArrowDownRight size={26} aria-hidden="true" /></div>
          </figcaption>
        </figure>

        <div className={styles.people}>
          <div className={styles.peopleHeading}>
            <span className={styles.label}>02 / LOS FUNDADORES DE CORPOREARTE</span>
            <h3>Compartimos el oficio.<br /><span>Y las ganas de hacerlo mejor.</span></h3>
          </div>
          <div className={styles.portraits}>
            {partners.map((partner) => (
              <figure key={partner.image} className={styles.person}>
                <div className={styles.portrait}>
                  <Image
                    src={`/about/${partner.image}`}
                    alt="Fundador de Gráfica Corporearte, equipo creador de Grafoprint"
                    width={partner.width}
                    height={partner.height}
                    sizes="(max-width: 760px) 30vw, (max-width: 1190px) 14vw, 185px"
                    quality={85}
                  />
                </div>
              </figure>
            ))}
          </div>
          <div className={styles.peopleCopy}>
            <p>Detrás de Grafo estamos los tres fundadores de Corporearte.
              Llevamos la experiencia de nuestra gráfica a una herramienta para conectar
              la cotización, los materiales y la producción de tu taller.</p>
            <a className="text-link dark-link" href={contact}>Hablemos de tu gráfica <ArrowUpRight size={16} /></a>
          </div>
        </div>
      </div>

      <div className={styles.origin}>
        <div className={styles.originBrand}>
          <Image src="/companies/corporearte.svg" alt="Gráfica Corporearte" width={702} height={164} className={styles.corporearteLogo} unoptimized />
          <span>La experiencia del taller</span>
        </div>
        <div className={styles.connection} aria-hidden="true"><span /><ArrowRight size={18} /></div>
        <div className={styles.originBrand}>
          <Brand />
          <span>Un sistema para tu industria</span>
        </div>
        <p>Del trabajo de todos los días<br /> <strong>a una forma más clara de gestionarlo.</strong></p>
      </div>
    </section>
  );
}
