"use client";

import Image from "next/image";
import { Pause, Play } from "lucide-react";
import { useState } from "react";
import styles from "./company-logos.module.css";

const companies = [
  { name: "Gráfica Corporearte", file: "corporearte.svg", width: 702, height: 164, style: "corporearte" },
  { name: "Señaliza", file: "senaliza.svg", width: 829, height: 148, style: "senaliza" },
  { name: "Visual Ilusión", file: "visual-ilusion.png", width: 371, height: 224, style: "visualIlusion" },
  { name: "Cero Stress", file: "cero-stress.jpg", width: 150, height: 150, style: "ceroStress" },
];

export function CompanyLogos() {
  const [paused, setPaused] = useState(false);

  return (
    <section
      id="empresas"
      className={`section-shell ${styles.section}`}
      aria-labelledby="companies-title"
    >
      <div className={styles.heading}>
        <h2 id="companies-title">Empresas que ya trabajan con Grafo</h2>
        <div className={styles.aside}>
          <p>Diseñado en Argentina. Pensado desde el taller.</p>
          <button
            type="button"
            className={styles.control}
            onClick={() => setPaused((value) => !value)}
            aria-label={paused ? "Reanudar animación de logos" : "Pausar animación de logos"}
            aria-controls="company-logos-track"
            title={paused ? "Reanudar animación" : "Pausar animación"}
          >
            {paused ? <Play size={13} aria-hidden="true" /> : <Pause size={13} aria-hidden="true" />}
          </button>
        </div>
      </div>
      <div className={styles.viewport}>
        <div id="company-logos-track" className={styles.track} data-paused={paused}>
          {[false, true].map((duplicate) => (
            <ul
              key={String(duplicate)}
              className={styles.group}
              aria-hidden={duplicate ? true : undefined}
            >
              {companies.map((company) => (
                <li key={company.file} className={styles.company}>
                  <Image
                    src={`/companies/${company.file}`}
                    alt={duplicate ? "" : company.name}
                    width={company.width}
                    height={company.height}
                    className={`${styles.logo} ${styles[company.style]}`}
                    loading="eager"
                    unoptimized
                  />
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </section>
  );
}
